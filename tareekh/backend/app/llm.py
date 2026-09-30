"""Thin wrapper over any OpenAI-compatible API (Groq by default)."""
import base64
import json
import os
import logging
import re
import threading

from openai import OpenAI

from .config import settings

log = logging.getLogger("tareekh.llm")

_text = None
_vision = None
_vertex = {"creds": None, "client": None, "token": None}


def _vertex_client() -> OpenAI:
    """Vertex AI's OpenAI-compatible endpoint. ADC access tokens last ~1h, so refresh before they expire."""
    import datetime as dt

    import google.auth
    import google.auth.transport.requests

    v = _vertex
    if v["creds"] is None:
        v["creds"], _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    creds = v["creds"]
    expiry = getattr(creds, "expiry", None)
    if not creds.valid or (expiry and expiry - dt.datetime.utcnow() < dt.timedelta(minutes=5)):
        creds.refresh(google.auth.transport.requests.Request())
    if v["client"] is None or v["token"] != creds.token:
        loc = settings.vertex_location
        host = "aiplatform.googleapis.com" if loc == "global" else f"{loc}-aiplatform.googleapis.com"
        v["client"] = OpenAI(api_key=creds.token,
                             base_url=f"https://{host}/v1/projects/{settings.vertex_project}/locations/{loc}/endpoints/openapi")
        v["token"] = creds.token
    return v["client"]


def text_client() -> OpenAI:
    global _text
    if settings.llm_provider == "vertex":
        return _vertex_client()
    if _text is None:
        _text = OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key or "missing")
    return _text


def vision_client() -> OpenAI:
    global _vision
    if settings.llm_provider == "vertex" and not os.getenv("VISION_BASE_URL"):
        return _vertex_client()
    if _vision is None:
        _vision = OpenAI(base_url=settings.vision_base_url, api_key=settings.vision_api_key or "missing")
    return _vision


def _temp(model: str, t: float) -> dict:
    # Google recommends leaving Gemini 3 at its default temperature (low values can cause looping).
    return {} if "gemini-3" in model else {"temperature": t}


def _parse_json(s: str) -> dict:
    s = s.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", s, re.S)
    if m:
        s = m.group(1)
    start, end = s.find("{"), s.rfind("}")
    return json.loads(s[start:end + 1])


def chat_json(system: str, user: str, retries: int = 2, temperature: float = 0.1) -> dict:
    """Ask for a JSON object. Retries with the parse error fed back."""
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    last_err = None
    for _ in range(retries + 1):
        resp = text_client().chat.completions.create(
            model=settings.llm_model, messages=messages, response_format={"type": "json_object"},
            **_temp(settings.llm_model, temperature),
        )
        content = resp.choices[0].message.content or ""
        try:
            return _parse_json(content)
        except Exception as e:  # noqa: BLE001
            last_err = e
            messages += [{"role": "assistant", "content": content},
                         {"role": "user", "content": f"That was not valid JSON ({e}). Reply with only the JSON object."}]
    raise ValueError(f"LLM did not return JSON: {last_err}")


def chat(messages: list[dict], tools: list[dict] | None = None, temperature: float = 0.2):
    kwargs = {"model": settings.llm_model, "messages": messages, **_temp(settings.llm_model, temperature)}
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"
    resp = text_client().chat.completions.create(**kwargs)
    if resp.usage and resp.usage.prompt_tokens:
        _usage.prompt_tokens = max(getattr(_usage, "prompt_tokens", 0), resp.usage.prompt_tokens)
    return resp.choices[0].message


# The largest prompt (in the model's own tokens) sent on this thread since the last reset: one chat turn can make
# several calls, and the biggest one is what counts against the context window.
_usage = threading.local()


def reset_usage() -> None:
    _usage.prompt_tokens = 0


def peak_prompt_tokens() -> int | None:
    return getattr(_usage, "prompt_tokens", 0) or None


OCR_PROMPT = (
    "Transcribe all text in this image exactly as written. It is either a lawyer's handwritten court diary page, "
    "a notebook page, or a scanned court document. Rules: keep original line order and wording, keep abbreviations "
    "and numbers exactly (case numbers, dates, amounts, diary numbers), SKIP words that are struck through, "
    "keep any printed date header. Output only the transcription, no commentary."
)


def ocr_image(image_bytes: bytes, mime: str = "image/jpeg") -> str:
    b64 = base64.b64encode(image_bytes).decode()
    resp = vision_client().chat.completions.create(
        model=settings.vision_model, **_temp(settings.vision_model, 0),
        messages=[{"role": "user", "content": [
            {"type": "text", "text": OCR_PROMPT},
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
        ]}],
    )
    text = resp.choices[0].message.content or ""
    return re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()   # reasoning models (qwen) may emit thoughts
