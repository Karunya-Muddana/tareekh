"""A chat's working context: the whole thread is carried into every answer, and when it grows past its budget the
older turns are folded into a rolling summary so the thread keeps going without losing what was established.

Token counts use tiktoken's o200k_base encoding. It is not Gemini's own tokenizer, but it tracks it closely enough
for a budget meter, runs locally and costs nothing per message. If it can't load, a characters/4 estimate is used.
"""
import datetime as dt
import json
import logging
import re
import threading

from . import db, llm, registry
from .config import settings

log = logging.getLogger("tareekh.threadctx")

COMPRESS_AT = 0.8     # summarise once the thread uses this share of its budget
KEEP_RECENT = 4       # the newest messages always stay word for word (two question-answer pairs)
PER_MESSAGE = 4       # role and separator overhead per message, as chat formats count it

_enc = None
_enc_lock = threading.Lock()
_locks: dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()
_running: set[str] = set()


def count(text: str | None) -> int:
    global _enc
    if not text:
        return 0
    if _enc is None:
        with _enc_lock:
            if _enc is None:
                try:
                    import tiktoken
                    _enc = tiktoken.get_encoding("o200k_base")
                except Exception as e:  # noqa: BLE001 - offline first run: estimate instead
                    log.warning("tiktoken unavailable (%s); estimating tokens from length", e)
                    _enc = False
    return len(_enc.encode(text, disallowed_special=())) if _enc else len(text) // 4


def warm() -> None:
    """Load the encoding in the background at startup so the first chat doesn't pay for it."""
    threading.Thread(target=count, args=("warm",), daemon=True).start()


def budget() -> int:
    return settings.chat_context_tokens


def _lock(chat_id: str) -> threading.Lock:
    with _locks_guard:
        return _locks.setdefault(chat_id, threading.Lock())


def wait(chat_id: str) -> None:
    """Block until a running compression of this chat has finished, so a new turn reads a consistent thread."""
    with _lock(chat_id):
        pass


_CITE = re.compile(r"\s*\[\d+(?:\s*,\s*\d+)*\]")


def _plain(content: str) -> str:
    """Old answers' [n] markers point at facts from an earlier turn; left in, the model may reuse the numbers."""
    return _CITE.sub("", content or "")


def _summary(chat_id: str) -> dict:
    return db.row("SELECT summary, upto FROM chat_summaries WHERE chat_id=?", chat_id) or {"summary": None, "upto": 0}


def carried(chat_id: str) -> tuple[str | None, list[dict]]:
    """What the agent gets: the summary of older turns (if any) and every message after it, word for word."""
    s = _summary(chat_id)
    msgs = db.rows("SELECT id, role, content FROM messages WHERE chat_id=? AND id>? ORDER BY id", chat_id, s["upto"] or 0)
    return s["summary"], [{"id": m["id"], "role": m["role"], "content": _plain(m["content"])} for m in msgs if m["content"]]


def state(chat_id: str) -> dict:
    summary, recent = carried(chat_id)
    s = _summary(chat_id)
    summarized = db.row("SELECT count(*) AS n FROM messages WHERE chat_id=? AND id<=?", chat_id, s["upto"] or 0)["n"]
    last = db.row("SELECT meta FROM messages WHERE chat_id=? AND role='assistant' ORDER BY id DESC LIMIT 1", chat_id)
    last_prompt = None
    if last and last["meta"]:
        last_prompt = json.loads(last["meta"]).get("prompt_tokens")
    summary_tokens = count(summary)
    recent_tokens = sum(count(m["content"]) + PER_MESSAGE for m in recent)
    used = summary_tokens + recent_tokens
    return {
        "budget": budget(), "used": used, "compress_at": COMPRESS_AT,
        "summary_tokens": summary_tokens, "recent_tokens": recent_tokens,
        "recent_messages": len(recent), "summarized_messages": summarized,
        "can_compress": len(recent) > KEEP_RECENT, "compressing": chat_id in _running,
        "summary": summary, "last_prompt_tokens": last_prompt, "model_window": settings.llm_context_window,
    }


SYSTEM = """You compress the earlier part of a chat between Adv. {lawyer}, a civil litigator, and Tareekh, his
practice-memory assistant, so the conversation can continue without the full transcript.

Write a compact briefing that the assistant will read before the next question. Keep, exactly as written:
case names and numbers, party and witness names, dates, amounts, exhibit and I.A. numbers, and quotes that
matter. Keep what the lawyer asked about, what was established in the answers (with dates), any decisions,
instructions or preferences he stated, and questions still open. Drop pleasantries, repetition and the
assistant's formatting. Do not add anything that is not in the text.

Start with "Asked, in order:" and the lawyer's questions as a numbered list (his words, shortened only if long),
so "what did I ask first?" can still be answered. Then plain bullets under short headings, at most about 500 words
in all. If a PREVIOUS SUMMARY is given, merge it in:
the result replaces it."""


def compress(chat_id: str, force: bool = False) -> bool:
    """Fold everything but the newest messages into the summary. Returns True if it did."""
    with _lock(chat_id):
        try:
            st = state(chat_id)
            if not st["can_compress"] or (not force and st["used"] < st["budget"] * COMPRESS_AT):
                return False
            _running.add(chat_id)
            summary, recent = carried(chat_id)
            old = recent[:-KEEP_RECENT]
            who = {"user": registry.practice()["lawyer_short"], "assistant": "Tareekh"}
            transcript = "\n\n".join(f"{who.get(m['role'], m['role'])}: {m['content']}" for m in old)
            user = (f"PREVIOUS SUMMARY:\n{summary}\n\n" if summary else "") + f"CONVERSATION TO COMPRESS:\n{transcript}"
            new = (llm.chat([{"role": "system", "content": SYSTEM.format(lawyer=registry.practice()["lawyer"])},
                             {"role": "user", "content": user}]).content or "").strip()
            if not new:
                log.warning("compression of chat %s returned nothing; keeping the full thread", chat_id)
                return False
            db.execute("""INSERT INTO chat_summaries (chat_id, summary, upto, updated_at) VALUES (?,?,?,?)
                          ON CONFLICT(chat_id) DO UPDATE SET summary=excluded.summary, upto=excluded.upto,
                          updated_at=excluded.updated_at""",
                       chat_id, new, old[-1]["id"], dt.datetime.now().isoformat(timespec="seconds"))
            log.info("compressed chat %s: %d messages -> %d tokens", chat_id, len(old), count(new))
            return True
        except Exception as e:  # noqa: BLE001 - a failed compression just means the thread stays long
            log.warning("compression of chat %s failed: %s", chat_id, e)
            return False
        finally:
            _running.discard(chat_id)


def compress_later(chat_id: str) -> bool:
    """After an answer: if the thread is over the threshold, compress it in the background. Returns True if started."""
    st = state(chat_id)
    if chat_id in _running or not st["can_compress"] or st["used"] < st["budget"] * COMPRESS_AT:
        return False
    _running.add(chat_id)   # visible to the meter at once; compress() re-adds and clears it
    threading.Thread(target=compress, args=(chat_id,), daemon=True).start()
    return True


def forget(chat_id: str) -> None:
    db.execute("DELETE FROM chat_summaries WHERE chat_id=?", chat_id)
