"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Mic, Square, X } from "lucide-react";
import { TareekhPresence, type PresenceState } from "@/components/voice/tareekh-presence";
import { ThinkingWords } from "@/components/thinking-words";
import { chatsChanged } from "@/lib/api";
import { VoiceAudio } from "@/lib/voice-audio";
import { cn } from "@/lib/utils";

type Phase = "starting" | "ready" | "listening" | "transcribing" | "thinking" | "speaking" | "error";


// Turn taking: after she finishes, the mic listens again; a pause ends the question.
const TICK_MS = 50;
const SPEECH_MS = 150; // this long above the threshold counts as speech starting
const END_SILENCE_MS = 1100; // this long below it, after speech, ends the question
const NO_SPEECH_MS = 9000; // nobody spoke: stop listening and wait for a tap
const MAX_QUESTION_MS = 60_000;

const PCM_RATE = 24000; // Gemini TTS: 16-bit mono PCM at 24 kHz

const spokenText = (s: string) =>
  s
    .replace(/\s*\[\d+(?:\s*[,–-]\s*\d+)*\]/g, "")
    .replace(/[*_`#>|]/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

async function post<T>(path: string, init: RequestInit, signal: AbortSignal): Promise<T> {
  const r = await fetch(`/backend${path}`, { ...init, signal });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.detail ?? `Request failed (${r.status})`);
  return body as T;
}

/**
 * Turn-based voice conversation inside a chat. You speak, pause, and Tareekh answers aloud in a calm British voice
 * (Gemini TTS on Vertex AI); then it listens again. No barge-in: while she speaks the mic is off. Every turn is saved
 * to the chat like a typed one.
 */
export function VoiceMode({
  open,
  onClose,
  chatId,
  caseId,
  quick,
  scope,
}: {
  open: boolean;
  /** changed: at least one turn was added to the chat, so the page should reload it. */
  onClose: (changed: boolean) => void;
  chatId: string;
  caseId: string | null;
  quick: boolean;
  scope?: string;
}) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [heard, setHeard] = useState("");
  const [answer, setAnswer] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const audio = useRef<VoiceAudio | null>(null);
  const abort = useRef<AbortController | null>(null);
  const changed = useRef(false);
  const settings = useRef({ quick, caseId });
  settings.current = { quick, caseId };

  const getIn = useCallback(() => audio.current?.micLevel() ?? 0, []);
  const getOut = useCallback(() => audio.current?.outLevel() ?? 0, []);

  const finish = useCallback(() => {
    abort.current?.abort();
    audio.current?.close();
    audio.current = null;
    onClose(changed.current);
    changed.current = false;
  }, [onClose]);

  // One question, answered: transcribe → ask → speak. Then listen again.
  const answerTurn = useCallback(
    async (wav: Blob, signal: AbortSignal) => {
      setPhase("transcribing");
      const fd = new FormData();
      fd.append("audio", wav, "question.wav");
      const { text } = await post<{ text: string }>("/voice/transcribe", { method: "POST", body: fd }, signal);
      if (!text) {
        // Empty, or rejected by the server as more words than the recording could hold: never act on it.
        setNote("I didn’t catch that clearly. Tap the mic and say it again.");
        setPhase("ready");
        return false;
      }
      setHeard(text);
      setAnswer("");
      setPhase("thinking");
      const r = await post<{ answer: string }>(
        `/chats/${chatId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: text, quick: settings.current.quick, case_id: settings.current.caseId, voice: true }),
        },
        signal,
      );
      changed.current = true;
      chatsChanged();
      setAnswer(spokenText(r.answer));
      const res = await fetch("/backend/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: r.answer }),
        signal,
      });
      if (res.status === 204) return true;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setNote(body.detail ? `Couldn’t speak the answer: ${body.detail}` : "Couldn’t speak the answer; it’s on screen.");
        setPhase("ready");
        return false;
      }
      setPhase("speaking");
      await audio.current!.play(res, PCM_RATE, signal);
      return !signal.aborted;
    },
    [chatId],
  );

  // Listen until the speaker pauses (or taps), then hand the recording to answerTurn.
  const stopNow = useRef<(() => void) | null>(null);
  const listen = useCallback(async () => {
    const a = audio.current;
    if (!a) return;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setNote(null);
    setPhase("listening");
    a.startRecording();

    const wav = await new Promise<Blob | null>((done) => {
      const floor: number[] = [];
      let loud = 0, quiet = 0, spoke = false;
      const t0 = performance.now();
      let last = t0;
      const end = (keep: boolean) => {
        clearInterval(timer);
        stopNow.current = null;
        const blob = a.stopRecording();
        done(keep ? blob : null);
      };
      stopNow.current = () => end(true);
      ctl.signal.addEventListener("abort", () => end(false));
      const timer = setInterval(() => {
        const r = a.micRms();
        const now = performance.now();
        const dt = now - last; // real time, not ticks: background tabs slow timers down to once a second
        last = now;
        const elapsed = now - t0;
        if (elapsed < 300) floor.push(r); // the room's own noise, measured before anyone speaks
        const base = floor.length ? floor.slice().sort((x, y) => x - y)[floor.length >> 1] : 0.005;
        const threshold = Math.max(base * 3, 0.012);
        if (r > threshold) {
          loud += dt;
          quiet = 0;
          if (loud >= SPEECH_MS) spoke = true;
        } else {
          loud = 0;
          quiet += dt;
        }
        if (spoke && quiet >= END_SILENCE_MS) end(true);
        else if (!spoke && elapsed > NO_SPEECH_MS) end(false);
        else if (elapsed > MAX_QUESTION_MS) end(true);
      }, TICK_MS);
    });

    if (ctl.signal.aborted) return;
    if (!wav) {
      setPhase("ready");
      return;
    }
    try {
      const again = await answerTurn(wav, ctl.signal);
      if (again && !ctl.signal.aborted) void listen(); // hands-free: her turn is over, so it's yours again
    } catch (e) {
      if (ctl.signal.aborted) return;
      setNote(e instanceof Error ? e.message : "Something went wrong");
      setPhase("ready");
    }
  }, [answerTurn]);

  // Open: set up audio and ask for the mic, then start listening straight away.
  useEffect(() => {
    if (!open) return;
    setPhase("starting");
    setHeard("");
    setAnswer("");
    setNote(null);
    changed.current = false;
    const a = new VoiceAudio();
    audio.current = a;
    // Warm the connections to Vertex while the mic opens, so the first question doesn't pay for a cold start.
    fetch("/backend/voice/warm", { method: "POST" }).catch(() => {});
    let live = true;
    a.openMic()
      .then(() => live && void listen())
      .catch((e: unknown) => {
        if (!live) return;
        setNote(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Tareekh needs the microphone. Allow it in the browser’s address bar, then tap the mic."
            : "Couldn’t open the microphone.",
        );
        setPhase("error");
      });
    return () => {
      live = false;
      abort.current?.abort();
      a.close();
      if (audio.current === a) audio.current = null;
    };
  }, [open, listen]);

  const onMic = () => {
    if (phase === "listening") return stopNow.current?.();
    if (phase === "ready" || phase === "error") {
      const a = audio.current;
      if (!a) return;
      a.openMic().then(() => void listen()).catch(() => setNote("Couldn’t open the microphone."));
    }
  };

  const presence: PresenceState =
    phase === "listening" ? "listening"
    : phase === "speaking" ? "speaking"
    : phase === "transcribing" || phase === "thinking" || phase === "starting" ? "thinking"
    : "idle";
  const busy = phase === "transcribing" || phase === "thinking" || phase === "speaking" || phase === "starting";

  const status =
    phase === "starting" ? "Opening the microphone…"
    : phase === "listening" ? "Listening"
    : phase === "transcribing" ? "Got it"
    : phase === "speaking" ? ""
    : phase === "error" ? "Microphone needed"
    : "Tap the mic to ask";

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && finish()}>
      <Dialog.Portal>
        <Dialog.Popup
          aria-label="Voice mode"
          className="bg-background text-foreground data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 fixed inset-0 z-50 flex flex-col overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] outline-none"
        >
          <header className="flex h-14 shrink-0 items-center px-5">
            <Dialog.Title className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
              <span className="text-foreground font-medium">Voice</span>
              {scope ? <> · {scope}</> : null}
            </Dialog.Title>
          </header>

          {/* The stage: the aura, and under it what was asked and what she's saying. */}
          <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-6">
            <TareekhPresence
              state={presence}
              getInputLevel={getIn}
              getOutputLevel={getOut}
              className={cn(
                "w-auto shrink-0 transition-[height] duration-500 ease-[var(--ease-out)] motion-reduce:transition-none",
                answer ? "h-[min(30dvh,260px)]" : "h-[min(50dvh,440px)]",
              )}
            />
            <div className="mt-2 flex w-full max-w-xl flex-col items-center gap-3 text-center" aria-live="polite">
              <div className="flex h-6 items-center">
                {phase === "thinking" ? (
                  <ThinkingWords />
                ) : (
                  status && <p className="text-muted-foreground text-[15px] tracking-wide">{status}</p>
                )}
              </div>
              {heard && <p className="text-muted-foreground line-clamp-2 max-w-md text-sm italic">“{heard}”</p>}
              {answer && (
                <p className="fade title-xl max-h-[24dvh] overflow-y-auto overscroll-contain text-[19px] leading-snug text-balance whitespace-pre-line">
                  {answer}
                </p>
              )}
              {note && <p className="text-tape text-sm">{note}</p>}
            </div>
          </div>

          {/* Controls float over the stage: one pill, the mic and the way out. */}
          <div className="flex shrink-0 flex-col items-center gap-2 px-6 pt-3 pb-7">
            <div className="material flex items-center gap-2 rounded-full border border-[var(--border)] p-2 shadow-[var(--shadow-soft)]">
              <button
                type="button"
                onClick={onMic}
                disabled={busy}
                aria-label={phase === "listening" ? "Done speaking" : "Speak"}
                className={cn(
                  "press grid size-14 place-items-center rounded-full transition-colors duration-200 disabled:opacity-35",
                  phase === "listening" ? "bg-tape text-white" : "bg-foreground text-background",
                )}
              >
                {phase === "listening" ? <Square className="size-5" fill="currentColor" aria-hidden /> : <Mic className="size-6" aria-hidden />}
              </button>
              <Dialog.Close
                className="press hover:bg-accent text-foreground grid size-14 place-items-center rounded-full"
                aria-label="Exit voice mode"
                title="Exit voice mode (Esc)"
              >
                <X className="size-6" aria-hidden />
              </Dialog.Close>
            </div>
            <p className="text-muted-foreground h-4 text-xs">
              {phase === "listening" ? "Pause when you’re done, or tap stop" : busy ? "One turn at a time" : ""}
            </p>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
