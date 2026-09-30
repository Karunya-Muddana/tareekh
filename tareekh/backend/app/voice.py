"""Voice mode, entirely on Vertex AI: Gemini transcribes what the lawyer says, Gemini TTS reads the answer back.

Turn-based on purpose: the browser records one question, we transcribe it, the normal chat pipeline answers it, and
the answer is streamed back as audio. Nobody interrupts anybody.
"""
import base64
import json
import logging
import re
from collections.abc import Iterator

import httpx

from . import llm, registry
from .config import settings

log = logging.getLogger("tareekh.voice")

SAMPLE_RATE = 24000   # Gemini TTS streams 16-bit mono PCM at 24 kHz

# One kept-alive client for every speech call: a fresh TLS handshake to Vertex on each request added latency to
# every turn.
_http = httpx.Client(timeout=httpx.Timeout(60, connect=10, read=30), limits=httpx.Limits(max_keepalive_connections=4))


def warm() -> None:
    """Called when voice mode opens: refresh the token and open the connection while the mic is starting."""
    try:
        llm.vertex_token()
        _http.get(llm.vertex_url("publishers/google/models").split("/projects/")[0] + "/", timeout=5)
    except Exception as e:  # noqa: BLE001 - warming is best effort
        log.info("voice warm-up: %s", e)

# The spelling aid is names only. An earlier prompt handed over the case registry, and the model "helpfully"
# answered the question from it (with an invented date) instead of writing it down.
STT_SYSTEM = ("You are a speech-to-text engine. Write down exactly the words spoken in the audio, nothing else. "
              "The speaker is usually asking a question: write the question down, never answer it. Do not add facts, "
              "dates or names that were not spoken. Use these spellings when the speaker says one of these names: "
              "{names}. If nothing is spoken, output nothing.")


def _names() -> str:
    rows = [r["n"] for q in ("SELECT short_name AS n FROM cases", "SELECT title AS n FROM cases", "SELECT name AS n FROM judges",
                             "SELECT name AS n FROM counsel", "SELECT name AS n FROM clients") for r in registry.db.rows(q)]
    p = registry.practice()
    return "; ".join(sorted({n for n in rows + [p["lawyer"], p["assistant"], p["city"]] if n}))


def _model(name: str) -> str:
    return name.split("/")[-1]   # "google/gemini-…" (OpenAI-compatible naming) -> "gemini-…"


MAX_WORDS_PER_SECOND = 4.5   # fast speech is ~3.5; anything well past that wasn't said, it was made up


class NotATranscript(ValueError):
    """The model returned more words than the recording could hold: treat it as invented, never act on it."""


def wav_seconds(audio: bytes) -> float | None:
    """Duration of a PCM WAV from its header, or None if it isn't one we can read."""
    import io
    import wave
    try:
        with wave.open(io.BytesIO(audio)) as w:
            return w.getnframes() / float(w.getframerate())
    except Exception:  # noqa: BLE001
        return None


def check_transcript(text: str, seconds: float | None) -> str:
    words = len(text.split())
    if seconds and words > 6 and words > seconds * MAX_WORDS_PER_SECOND:
        raise NotATranscript(f"{words} words from {seconds:.1f} s of audio")
    return text


def transcribe(audio: bytes, mime: str = "audio/wav") -> str:
    text = _transcribe(audio, mime)
    return check_transcript(text, wav_seconds(audio) if "wav" in mime else None)


def _transcribe(audio: bytes, mime: str) -> str:
    """Thinking is switched off: transcription doesn't need it, and with it on one call in our tests took 46 s."""
    body = {
        "systemInstruction": {"parts": [{"text": STT_SYSTEM.format(names=_names())}]},
        "contents": [{"role": "user", "parts": [
            {"inlineData": {"mimeType": mime, "data": base64.b64encode(audio).decode()}},
            {"text": "Transcribe the audio."},
        ]}],
        "generationConfig": {"temperature": 0, "thinkingConfig": {"thinkingBudget": 0}},
    }
    last: Exception | None = None
    for model in dict.fromkeys([_model(settings.voice_stt_model or settings.llm_model), _model(settings.llm_model)]):
        try:
            r = _http.post(llm.vertex_url(f"publishers/google/models/{model}:generateContent"), json=body,
                           headers={"Authorization": f"Bearer {llm.vertex_token()}"}, timeout=httpx.Timeout(30, connect=10))
            r.raise_for_status()
            parts = ((r.json().get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
            return " ".join(p.get("text", "") for p in parts).strip()
        except Exception as e:  # noqa: BLE001
            log.warning("transcription with %s failed (%s)", model, e)
            last = e
    raise RuntimeError(f"transcription failed: {last}")


_CITE = re.compile(r"\s*\[\d+(?:\s*[,–-]\s*\d+)*\]")


def spoken(text: str) -> str:
    """A written answer made fit to read aloud: no citation markers, markdown, bullets or tables."""
    t = _CITE.sub("", text or "")
    t = re.sub(r"```.*?```", " ", t, flags=re.S)
    t = re.sub(r"^\s*\|.*\|\s*$", " ", t, flags=re.M)                  # table rows
    t = re.sub(r"^\s{0,3}#{1,6}\s*(.+)$", r"\1.", t, flags=re.M)       # headings become sentences
    t = re.sub(r"^\s*(?:[-*•]|\d+[.)])\s+", "", t, flags=re.M)          # list markers
    t = re.sub(r"[*_`~]+", "", t)                                        # emphasis
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)                      # links
    lines = [ln.strip() for ln in t.splitlines() if ln.strip()]
    out = " ".join(ln if ln[-1] in ".!?:;" else ln + "." for ln in lines)
    return re.sub(r"\s{2,}", " ", out).strip()


def _tts_body(text: str) -> dict:
    return {
        "contents": [{"role": "user", "parts": [{"text": settings.voice_style + text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"languageCode": settings.voice_language,
                             "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": settings.voice_name}}},
        },
    }


def speak(text: str) -> Iterator[bytes]:
    """Stream the answer as raw 16-bit PCM (24 kHz mono) as Gemini produces it; the first chunk takes about a
    second. Falls back to the stable TTS model if the preview one refuses."""
    text = spoken(text)[:4000]
    if not text:
        return
    for model in dict.fromkeys([settings.voice_tts_model, settings.voice_tts_fallback]):
        sent = False
        try:
            url = llm.vertex_url(f"publishers/google/models/{model}:streamGenerateContent?alt=sse", version="v1beta1")
            with _http.stream("POST", url, json=_tts_body(text),
                              headers={"Authorization": f"Bearer {llm.vertex_token()}"}) as r:
                if r.status_code != 200:
                    r.read()
                    raise RuntimeError(f"{r.status_code}: {r.text[:200]}")
                carry = b""
                for line in r.iter_lines():
                    if not line.startswith("data:"):
                        continue
                    for cand in json.loads(line[5:]).get("candidates") or []:
                        for p in (cand.get("content") or {}).get("parts") or []:
                            data = (p.get("inlineData") or {}).get("data")
                            if not data:
                                continue
                            pcm = carry + base64.b64decode(data)
                            cut = len(pcm) - len(pcm) % 2          # never split a 16-bit sample across chunks
                            carry = pcm[cut:]
                            if cut:
                                sent = True
                                yield pcm[:cut]
                return
        except Exception as e:  # noqa: BLE001
            if sent:            # audio already went out: a second voice mid-sentence would be worse than stopping
                log.warning("TTS stream from %s broke mid-answer: %s", model, e)
                return
            log.warning("TTS with %s failed (%s); trying the fallback", model, e)
    raise RuntimeError("Text-to-speech is unavailable on Vertex AI right now")
