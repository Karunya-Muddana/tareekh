"""The /ask agent: context builder → tool loop → answer with [n] citations. Falls back to a fixed path on errors."""
import json
import logging
import re

from .. import llm, memory, registry
from . import context as ctxmod

log = logging.getLogger("tareekh.agent")
MAX_STEPS = 5

SYSTEM = """You are Tareekh, the practice memory of Adv. {lawyer}, a civil litigator in {city}.
You answer from his memory bank only. You remember; you never give legal advice.

How to work:
- The context below tells you which case(s) the question is probably about and what has been LEARNED about the
  judge and opposing counsel. Use it to aim your searches, but facts in the answer must come from tool results.
- recall_memories = fast fact lookup (what/when/who). reflect_on_memories = patterns and "what should I expect".
  case_timeline = everything on one case in date order. find_case = resolve a nickname or number.
- Filter by case_id for case questions; by judge_id or counsel_id for behaviour across cases.
- Every fact you state must carry a citation marker like [3] that refers to the numbered facts returned by tools.
- Lead with the closest thing memory DOES have. If the exact thing asked isn't recorded but related facts are
  (nothing on costs at the last hearing, but costs at an earlier one), say both in one line with dates:
  "Nothing on costs at the last hearing (2 Sep 2026); he last imposed costs on 9 Jul 2025: ...". Say memory has
  no record only when no fact bears on the question at all. Never deny something you go on to cite.
- "Last time" / "last hearing" means the most recent dated hearing in the facts; name its date.
- Questions about this conversation itself ("what did I ask first?", "sum up what we covered") are answered from
  the chat: the earlier messages and <earlier_in_this_chat>, if present. No citation is needed for those.
- Distinguish what the court's order recorded from what only {lawyer_short}'s or {assistant_short}'s notes say.
- Facts labelled CHAT MEMORY are things the lawyer told you in an earlier chat, not court records or hearing notes.
  Rank them BELOW records and notes: if they conflict, the record wins and you say so. When you rely on one, say
  so in the sentence ("from a chat memory, ...") and cite it like any other fact.
- Be brief. He may be standing in court. Lead with the answer, then 1-4 supporting lines. Dates as '12 Aug 2026'.
"""


def system_prompt() -> str:
    return SYSTEM.format(**registry.practice())


TOOLS = [
    {"type": "function", "function": {
        "name": "find_case", "description": "Resolve a case nickname, party name or case number to case ids.",
        "parameters": {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]}}},
    {"type": "function", "function": {
        "name": "recall_memories", "description": "Fast search of stored facts. Optional filters narrow to a case, judge or counsel.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string"}, "case_id": {"type": "string"}, "judge_id": {"type": "string"},
            "counsel_id": {"type": "string"}}, "required": ["query"]}}},
    {"type": "function", "function": {
        "name": "reflect_on_memories", "description": "Reason across many memories to find patterns (slower).",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string"}, "case_id": {"type": "string"}, "judge_id": {"type": "string"},
            "counsel_id": {"type": "string"}}, "required": ["query"]}}},
    {"type": "function", "function": {
        "name": "case_timeline", "description": "All stored facts for one case, oldest first.",
        "parameters": {"type": "object", "properties": {"case_id": {"type": "string"}}, "required": ["case_id"]}}},
]


class FactBook:
    """Numbers every fact the tools return so the answer can cite [n]."""

    def __init__(self):
        self.facts: list[dict] = []
        self._by_id: dict[str, int] = {}

    def add(self, f: dict) -> int:
        key = f.get("id") or f.get("text")
        if key in self._by_id:
            return self._by_id[key]
        self.facts.append(f)
        self._by_id[key] = len(self.facts)
        return len(self.facts)

    def render(self, facts: list[dict]) -> str:
        lines = []
        is_chat = lambda f: (f.get("metadata") or {}).get("doc_type") == "chat_memory"
        facts = sorted(facts, key=is_chat)            # records and notes first, chat memories last
        for f in facts:
            n = self.add(f)
            md = f.get("metadata") or {}
            when = md.get("hearing_date") or (f.get("occurred") or "")[:10]
            src = md.get("source_file") or f.get("type") or "memory"
            label = "CHAT MEMORY; " if is_chat(f) else ""
            lines.append(f"[{n}] ({label}{when}; {md.get('case_id', '')}; {src}) {f.get('text')}")
        return "\n".join(lines) or "(no matching memories)"

    def citations(self, answer: str) -> list[dict]:
        nums = [n for grp in re.findall(r"\[(\d+(?:\s*,\s*\d+)*)\]", answer) for n in re.split(r"\s*,\s*", grp)]
        used = sorted({int(n) for n in nums if 0 < int(n) <= len(self.facts)})
        out = []
        for n in used:
            f = self.facts[n - 1]
            md = f.get("metadata") or {}
            out.append({"n": n, "text": f.get("text"), "type": f.get("type"),
                        "case_id": md.get("case_id"), "hearing_date": md.get("hearing_date") or (f.get("occurred") or "")[:10] or None,
                        "source_file": md.get("source_file"), "doc_type": md.get("doc_type"), "upload_id": md.get("upload_id")})
        return out


def _case_id(value: str | None) -> str | None:
    """The model sometimes passes a case number or nickname ("O.S. 131/2025") where an id ("C3") belongs. A tag
    filter on that matches nothing, so resolve it, and drop the filter rather than search with a wrong one."""
    if not value or registry.get_case(value):
        return value or None
    hits = registry.find_cases(value, limit=1)
    return hits[0]["case_id"] if hits else None


def _run_tool(name: str, args: dict, book: FactBook) -> str:
    if name == "find_case":
        hits = registry.find_cases(args.get("text", ""), limit=3)
        return json.dumps([{**h, "case_number": registry.get_case(h["case_id"])["case_number"]} for h in hits])
    if "case_id" in args:
        args = {**args, "case_id": _case_id(args["case_id"])}
    filters = {k: args.get(k) for k in ("case_id", "judge_id", "counsel_id") if args.get(k)}
    if name == "recall_memories":
        return book.render(memory.recall(args["query"], **filters))
    if name == "case_timeline":
        if not args.get("case_id"):
            return "Unknown case. Use find_case first and pass its case_id (like C3)."
        facts = memory.recall(f"hearings, orders, outcomes and next dates in case {args['case_id']}",
                              case_id=args["case_id"], max_tokens=5000)
        facts.sort(key=lambda f: (f.get("metadata") or {}).get("hearing_date") or f.get("occurred") or "")
        return book.render(facts)
    if name == "reflect_on_memories":
        r = memory.reflect(args["query"], **filters)
        return f"REFLECTION: {r['text']}\nBASED ON:\n{book.render(r['memories'])}"
    return f"unknown tool {name}"


def _history_turns(history: list[dict] | None) -> list[dict]:
    """The thread so far, word for word, so follow-ups like 'and Ramesh?' make sense. Its size is managed upstream
    (threadctx): past the budget, older turns arrive as a summary instead."""
    return [{"role": h["role"], "content": h["content"]} for h in (history or [])
            if h.get("role") in ("user", "assistant") and h.get("content")]


def _system(ctx: dict) -> str:
    out = system_prompt() + "\n\n" + ctxmod.render(ctx)
    if ctx.get("summary"):
        out += ("\n<earlier_in_this_chat note=\"summary of older turns; the recent ones follow as messages\">\n"
                f"{ctx['summary']}\n</earlier_in_this_chat>")
    return out


def ask(question: str, active_case_id: str | None = None, quick: bool = False, history: list[dict] | None = None,
        summary: str | None = None) -> dict:
    """history: the thread's recent messages; summary: what older turns were compressed into (see threadctx)."""
    llm.reset_usage()
    out = _ask(question, active_case_id, quick, history, summary)
    out["prompt_tokens"] = llm.peak_prompt_tokens()
    return out


def _ask(question: str, active_case_id: str | None, quick: bool, history: list[dict] | None, summary: str | None) -> dict:
    turns = _history_turns(history)
    prev_q = next((t["content"] for t in reversed(turns) if t["role"] == "user"), "")
    search_text = f"{prev_q}\n{question}" if prev_q else question     # a follow-up inherits the case it's about
    ctx = ctxmod.build(search_text, active_case_id)
    if not ctx["case_ids"]:   # "was the samadhi ever affected?": the case is only named in the last answer
        prev_a = next((t["content"] for t in reversed(turns) if t["role"] == "assistant"), "") or summary or ""
        if prev_a:
            ctx = {**ctxmod.build(f"{search_text}\n{prev_a}", active_case_id), "guessed": True}
    ctx["summary"] = summary
    if quick:
        return _fixed_path(question, ctx, mode="quick", turns=turns, search_text=search_text)
    book, trace = FactBook(), []
    messages = [{"role": "system", "content": _system(ctx)}, *turns, {"role": "user", "content": question}]
    try:
        for _ in range(MAX_STEPS):
            msg = llm.chat(messages, tools=TOOLS)
            calls = msg.tool_calls or []
            if not calls:
                answer = (msg.content or "").strip()
                if not answer:
                    raise ValueError("model returned an empty answer")
                return {"answer": answer, "citations": book.citations(answer), "mode": "agent",
                        "cases": ctx["case_ids"], "trace": trace}
            # Send the assistant turn back verbatim: Gemini 3 needs its thought signatures (extra fields) returned.
            messages.append(msg.model_dump(exclude_none=True))
            for c in calls:
                args = json.loads(c.function.arguments or "{}")   # malformed JSON -> fallback below
                out = _run_tool(c.function.name, args, book)
                trace.append({"tool": c.function.name, "args": args})
                messages.append({"role": "tool", "tool_call_id": c.id, "content": out[:12000]})
        messages.append({"role": "user", "content": "Answer now with what you have, with citations."})
        answer = (llm.chat(messages).content or "").strip()
        if not answer:   # it still wanted a tool; out of steps, so take the fixed path below
            raise ValueError("no answer after the tool budget")
        return {"answer": answer, "citations": book.citations(answer), "mode": "agent", "cases": ctx["case_ids"], "trace": trace}
    except Exception as e:  # noqa: BLE001 - function calling can be flaky; never fail the user
        log.warning("agent loop failed (%s); using fixed path", e)
        return _fixed_path(question, ctx, mode="fallback", error=str(e), turns=turns, search_text=search_text)


def _fixed_path(question: str, ctx: dict, mode: str, error: str | None = None,
                turns: list[dict] | None = None, search_text: str | None = None) -> dict:
    """Resolve case → recall with its tags → one completion. Used for quick in-court questions and as fallback."""
    book = FactBook()
    # A case guessed from the previous answer is context, not a filter: that answer may span several cases.
    cid = ctx["case_ids"][0] if ctx["case_ids"] and not ctx.get("guessed") else None
    facts_txt = book.render(memory.recall(search_text or question, case_id=cid, max_tokens=2000, budget="low" if mode == "quick" else "mid"))
    messages = [{"role": "system", "content": _system(ctx)}, *(turns or []),
                {"role": "user", "content": f"QUESTION: {question}\n\nFACTS FROM MEMORY:\n{facts_txt}\n\n"
                                            "Answer using only these facts, with [n] citations."}]
    answer = llm.chat(messages).content or ""
    out = {"answer": answer, "citations": book.citations(answer), "mode": mode, "cases": ctx["case_ids"], "trace": []}
    if error:
        out["error"] = error
    return out
