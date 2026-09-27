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
