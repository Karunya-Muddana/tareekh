import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response

from . import db, registry
from .config import settings, today_iso
from .routers.api import router
from .routers.app_api import router as app_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.init()
    # uploads that were mid-processing when the server stopped will never finish; say so instead of hanging
    db.execute("UPDATE uploads SET status='error', error='interrupted by a server restart; upload again' "
               "WHERE status IN ('queued', 'extracting', 'segmenting', 'retaining')")
    yield


app = FastAPI(title="Tareekh API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(router)
app.include_router(app_router)


@app.get("/", include_in_schema=False)
def home():
    return FileResponse(Path(__file__).parent / "static" / "index.html")


ICON = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#8e2a20"/>'
        '<text x="256" y="340" font-family="Georgia,serif" font-size="300" font-weight="700" fill="#fff6f0" '
        'text-anchor="middle">T</text></svg>')


@app.get("/icon.svg", include_in_schema=False)
def icon():
    return Response(ICON, media_type="image/svg+xml")


@app.get("/manifest.webmanifest", include_in_schema=False)
def manifest():
    return JSONResponse({"name": "Tareekh", "short_name": "Tareekh", "start_url": "/", "display": "standalone",
                         "background_color": "#f5f3ef", "theme_color": "#f5f3ef",
                         "icons": [{"src": "/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable"}]},
                        media_type="application/manifest+json")


@app.get("/health")
def health():
    return {"ok": True, "bank": settings.bank_id, "today": today_iso(), "practice": registry.practice(),
            "hindsight": settings.hindsight_url, "llm": settings.llm_model, "vision": settings.vision_model,
            "keys": {"hindsight": bool(settings.hindsight_api_key), "llm": bool(settings.llm_api_key)}}
