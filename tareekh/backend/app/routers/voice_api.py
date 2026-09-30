"""Voice mode endpoints: transcribe a spoken question, and stream a spoken answer. Both run on Vertex AI."""
import logging
from itertools import chain

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from .. import llm, voice

router = APIRouter(prefix="/voice")
log = logging.getLogger("tareekh.voice")

MAX_AUDIO = 12 * 1024 * 1024   # about six minutes of 16 kHz WAV; one question is a few seconds


@router.post("/warm", status_code=204)
def warm_up(background: BackgroundTasks):
    """Voice mode just opened: get the connection and credentials ready before the first question."""
    background.add_task(voice.warm)
    background.add_task(llm.warm)


@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    data = await audio.read()
    if not data:
        raise HTTPException(400, "No audio received")
    if len(data) > MAX_AUDIO:
        raise HTTPException(413, "That recording is too long for one question")
    try:
        return {"text": voice.transcribe(data, audio.content_type or "audio/wav")}
    except voice.NotATranscript as e:
        # Never pass on words nobody said. The UI asks the lawyer to repeat the question.
        log.warning("rejected an invented transcript: %s", e)
        return {"text": "", "rejected": True}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(503, f"Couldn't transcribe that: {type(e).__name__}") from e


class SpeakIn(BaseModel):
    text: str


@router.post("/speak")
def speak(body: SpeakIn):
    """Raw 16-bit PCM, 24 kHz mono, streamed as Gemini produces it (the browser plays it as it arrives)."""
    stream = voice.speak(body.text)
    try:
        first = next(stream)          # fail with a proper status before any audio is sent
    except StopIteration:
        return Response(status_code=204)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, str(e)) from e
    return StreamingResponse(chain([first], stream), media_type=f"audio/L16; rate={voice.SAMPLE_RATE}; channels=1",
                             headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})
