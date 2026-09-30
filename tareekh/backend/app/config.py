import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    hindsight_url: str = os.getenv("HINDSIGHT_URL", "https://api.hindsight.vectorize.io")
    hindsight_api_key: str | None = os.getenv("HINDSIGHT_API_KEY")
    bank_id: str = os.getenv("HINDSIGHT_BANK_ID", "chamber-memory")

    # "vertex" = Gemini on Vertex AI via gcloud ADC (base URLs/keys below are ignored);
    # "openai" = any OpenAI-compatible endpoint (Groq, etc.) using the URL/key below.
    llm_provider: str = os.getenv("LLM_PROVIDER", "openai")
    vertex_project: str | None = os.getenv("VERTEX_PROJECT")
    vertex_location: str = os.getenv("VERTEX_LOCATION", "global")

    # Any OpenAI-compatible endpoint. Default: Groq.
    llm_base_url: str = os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1")
    llm_api_key: str | None = os.getenv("LLM_API_KEY") or os.getenv("GROQ_API_KEY")
    llm_model: str = os.getenv("LLM_MODEL", "openai/gpt-oss-120b")
    # OCR can use a different provider/model than reasoning.
    vision_base_url: str = os.getenv("VISION_BASE_URL", os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1"))
    vision_api_key: str | None = os.getenv("VISION_API_KEY") or os.getenv("LLM_API_KEY") or os.getenv("GROQ_API_KEY")
    vision_model: str = os.getenv("VISION_MODEL", "qwen/qwen3.8-27b")

    data_dir: Path = Path(os.getenv("DATA_DIR", str(BACKEND_DIR / "var")))
    # Pin "today" for the demo (the synthetic data's demo day is 2026-10-05). Empty = real date.
    today_override: str | None = os.getenv("TODAY") or None
    auto_confirm_threshold: float = float(os.getenv("AUTO_CONFIRM_THRESHOLD", "0.8"))
    # How much of a chat is carried into each answer before older turns are summarised, and the model's own window.
    chat_context_tokens: int = int(os.getenv("CHAT_CONTEXT_TOKENS", "24000"))
    llm_context_window: int = int(os.getenv("LLM_CONTEXT_WINDOW", "1048576"))
    # Voice mode, all on Vertex AI: Gemini transcribes, Gemini TTS speaks. Gacrux is the "mature" female voice.
    voice_tts_model: str = os.getenv("VOICE_TTS_MODEL", "gemini-3.1-flash-tts-preview")
    voice_tts_fallback: str = os.getenv("VOICE_TTS_FALLBACK", "gemini-2.5-flash-tts")
    voice_name: str = os.getenv("VOICE_NAME", "Gacrux")
    voice_language: str = os.getenv("VOICE_LANGUAGE", "en-GB")
    voice_style: str = os.getenv("VOICE_STYLE", "Say this as a calm, wise, older British woman with a warm, "
                                                "educated English accent, unhurried and reassuring: ")
    # Transcription: flash-lite with thinking off was the fastest (~2 s) and exact in our tests; 2.5-flash misheard a case
    voice_stt_model: str = os.getenv("VOICE_STT_MODEL", "gemini-2.5-flash-lite")

    @property
    def db_path(self) -> Path:
        return self.data_dir / "tareekh.db"

    @property
    def upload_dir(self) -> Path:
        return self.data_dir / "uploads"


settings = Settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)


def today_iso() -> str:
    import datetime as dt
    return settings.today_override or dt.date.today().isoformat()
