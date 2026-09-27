import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import db
from .config import settings, today_iso
from .routers.api import router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.init()
    yield


app = FastAPI(title="Tareekh API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(router)


@app.get("/", include_in_schema=False)
def home():
    return FileResponse(Path(__file__).parent / "static" / "index.html")


@app.get("/health")
def health():
    return {"ok": True, "bank": settings.bank_id, "today": today_iso(),
            "hindsight": settings.hindsight_url, "llm": settings.llm_model, "vision": settings.vision_model,
            "keys": {"hindsight": bool(settings.hindsight_api_key), "llm": bool(settings.llm_api_key)}}
