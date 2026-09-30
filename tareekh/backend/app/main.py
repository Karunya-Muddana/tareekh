import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response

from . import db, registry, threadctx
from .config import settings, today_iso
from .routers.api import router
from .routers.app_api import router as app_router
from .routers.voice_api import router as voice_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.init()
    # uploads that were mid-processing when the server stopped will never finish; say so instead of hanging
    db.execute("UPDATE uploads SET status='error', error='interrupted by a server restart; upload again' "
               "WHERE status IN ('queued', 'extracting', 'segmenting', 'retaining')")
    threadctx.warm()   # load the tokenizer now, not on the first chat message
    yield


app = FastAPI(title="Tareekh API", version="0.1.0", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(router)
app.include_router(app_router)
app.include_router(voice_router)


@app.get("/", include_in_schema=False)
def home():
    return FileResponse(Path(__file__).parent / "static" / "index.html")


# The Tareekh mark (same as web/app/icon.svg): a diary leaf, turned brass corner, red ribbon making the T.
ICON = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#141414"/>'
        '<path d="M15 12h34a4 4 0 0 1 4 4v23L39 53H19a4 4 0 0 1-4-4z" fill="#f7f7f3"/>'
        '<path d="M53 39H43a4 4 0 0 0-4 4v10z" fill="#c9a15a"/><path d="M28.5 19h7v40l-3.5-4-3.5 4z" fill="#c8321e"/>'
        '<rect x="20" y="19" width="24" height="6.5" rx="2" fill="#141414"/></svg>')


@app.get("/icon.svg", include_in_schema=False)
def icon():
    return Response(ICON, media_type="image/svg+xml")


@app.get("/manifest.webmanifest", include_in_schema=False)
def manifest():
    return JSONResponse({"name": "Tareekh", "short_name": "Tareekh", "start_url": "/", "display": "standalone",
                         "background_color": "#f3f4f1", "theme_color": "#141414",
                         "icons": [{"src": "/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any"}]},
                        media_type="application/manifest+json")


@app.get("/health")
def health():
    return {"ok": True, "bank": settings.bank_id, "today": today_iso(), "practice": registry.practice(),
            "hindsight": settings.hindsight_url, "llm": settings.llm_model, "vision": settings.vision_model,
            "keys": {"hindsight": bool(settings.hindsight_api_key), "llm": bool(settings.llm_api_key)}}
