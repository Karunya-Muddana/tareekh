"use client";

import { useRef, useState } from "react";
import { Camera, Check, FileUp, Loader2, X } from "lucide-react";
import { TopBar, toast } from "@/components/app-shell";
import { api, useCases, type Upload } from "@/lib/api";
import { invalidate } from "@/lib/cache";
import { cn } from "@/lib/utils";

const STEPS = [
  ["extracting", "Reading"],
  ["segmenting", "Filing by case"],
  ["review", "Check"],
  ["done", "Saved"],
] as const;

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [caseHint, setCaseHint] = useState("");
  const [over, setOver] = useState(false);
  const [up, setUp] = useState<Upload | null>(null);
  const [running, setRunning] = useState(false);
  const [edits, setEdits] = useState<Record<string, { case_id?: string; hearing_date?: string; reject?: boolean }>>({});
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

  const cases = useCases().data ?? [];

  const start = async () => {
    if (!files.length && !text.trim()) return toast("Add a photo, a file or a note first");
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    if (text.trim()) fd.append("text", text.trim());
    if (caseHint) fd.append("case_id", caseHint);
    setRunning(true);
    setEdits({});
    try {
      const { upload_id } = await api.upload(fd);
      for (;;) {
        const u = await api.getUpload(upload_id);
        setUp(u);
        if (!["queued", "extracting", "segmenting", "retaining"].includes(u.status)) break;
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed");
    }
    setRunning(false);
  };

  const save = async () => {
    if (!up) return;
    setRunning(true);
    try {
      await api.confirm(up.id, Object.entries(edits).map(([id, e]) => ({ id, ...e })));
      // new notes change Today's "previous hearing" lines and the calendar
      invalidate("today");
      invalidate("calendar:");
      const u = await api.getUpload(up.id);
      setUp(u);
      if (u.status === "done") {
        toast(`Saved ${u.entries.filter((e) => e.status === "retained").length} to memory`);
        setFiles([]);
        setText("");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t save");
    }
    setRunning(false);
  };

  const stepIndex = up ? (up.status === "queued" ? 0 : up.status === "retaining" ? 3 : STEPS.findIndex(([s]) => s === up.status)) : -1;
  const pending = up?.entries.filter((e) => !["retained", "rejected"].includes(e.status)) ?? [];

  return (
    <div className="min-h-dvh">
      <title>Add notes · Tareekh</title>
      <TopBar />
      <main className="mx-auto w-full max-w-2xl px-5 pb-[calc(env(safe-area-inset-bottom)+48px)] md:px-8">
        <header className="pt-4 pb-8 md:pt-8">
          <h1 className="title-xl text-[52px] md:text-6xl">Add notes</h1>
          <p className="text-muted-foreground mt-3 text-[15px]">
            Diary pages, order sheets, documents or a typed note. Tareekh reads them, files each hearing under its case, and asks you
            to check anything it isn’t sure about.
          </p>
        </header>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            setFiles([...e.dataTransfer.files]);
          }}
          className={cn(
            "rounded-2xl border border-dashed p-6 text-center transition-colors duration-200",
            over ? "border-primary bg-primary/[0.05]" : "border-foreground/15",
          )}
        >
          <FileUp className="text-muted-foreground mx-auto size-6" aria-hidden />
          <p className="mt-3 font-medium">Drop files here</p>
          <p className="text-muted-foreground mt-1 text-sm">JPG, PNG, PDF, DOCX or TXT</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button onClick={() => input.current?.click()} className="press bg-foreground text-background h-10 rounded-full px-4 text-sm font-medium">
              Choose files
            </button>
            <button onClick={() => camera.current?.click()} className="press hover:bg-accent inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm md:hidden">
              <Camera className="size-4" aria-hidden /> Take photo
            </button>
          </div>
          <input ref={input} type="file" multiple hidden accept=".jpg,.jpeg,.png,.pdf,.docx,.txt" onChange={(e) => setFiles([...(e.target.files ?? [])])} />
          <input ref={camera} type="file" hidden accept="image/*" capture="environment" onChange={(e) => setFiles([...(e.target.files ?? [])])} />
        </div>

        {files.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <li key={f.name + i} className="bg-muted flex items-center gap-1.5 rounded-lg py-1 pr-1 pl-2.5 font-mono text-xs" translate="no">
                <span className="max-w-[220px] truncate">{f.name}</span>
                <button onClick={() => setFiles(files.filter((_, k) => k !== i))} className="press hover:bg-background grid size-6 place-items-center rounded-md" aria-label={`Remove ${f.name}`}>
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <label className="mt-6 block">
          <span className="text-muted-foreground text-[12px] font-medium tracking-[0.08em] uppercase">Or type a note</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="12/9 Gorle partition. DW2 absent, Harinath sought time…"
            className="bg-muted/50 focus:ring-ring/40 mt-2 w-full resize-y rounded-xl px-3.5 py-3 text-[16px] leading-relaxed outline-none focus:ring-2"
          />
        </label>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={caseHint}
            onChange={(e) => setCaseHint(e.target.value)}
            aria-label="Case"
            className="bg-background text-foreground border-input h-11 min-w-0 flex-1 rounded-xl border px-3 text-[16px] sm:h-10 sm:text-[15px]"
          >
            <option value="">Case: detect from the note</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.short_name} ({c.case_number})
              </option>
            ))}
          </select>
          <button
            onClick={start}
            disabled={running}
            className="press bg-primary text-primary-foreground inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium shadow-[var(--shadow-soft)] disabled:opacity-60 sm:h-10"
          >
            {running && !up?.entries.length ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Read it
          </button>
        </div>

        {up && (
          <section className="mt-10" aria-live="polite">
            <ol className="flex flex-wrap gap-2 text-xs">
              {STEPS.map(([key, label], i) => (
                <li
                  key={key}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1",
                    i < stepIndex || up.status === "done" ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300" : i === stepIndex ? "bg-primary/10 text-primary" : "text-muted-foreground",
                  )}
                >
                  {i < stepIndex || up.status === "done" ? <Check className="size-3" /> : i === stepIndex && running ? <Loader2 className="size-3 animate-spin" /> : null}
                  {label}
                </li>
              ))}
            </ol>
            {up.status === "extracting" && <p className="text-muted-foreground mt-3 text-sm">Reading the handwriting. Photos take 10 to 30 seconds a page.</p>}
            {up.status === "error" && <p className="text-destructive mt-3 text-sm">{up.error}</p>}

            <ul className="mt-5 flex flex-col gap-3">
              {up.entries.map((e) => {
                const saved = e.status === "retained";
                const sure = (e.confidence ?? 0) >= 0.8;
                const ed = edits[e.id] ?? {};
                return (
                  <li key={e.id} className={cn("border-border rounded-2xl border p-4", saved && "opacity-70", ed.reject && "opacity-40")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        disabled={saved}
                        value={ed.case_id ?? e.case_id ?? ""}
                        onChange={(x) => setEdits({ ...edits, [e.id]: { ...ed, case_id: x.target.value } })}
                        aria-label="Case"
                        className="bg-background text-foreground border-input h-9 min-w-0 flex-1 rounded-lg border px-2 text-sm"
                      >
                        <option value="">Which case?</option>
                        {cases.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.short_name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        disabled={saved}
                        value={ed.hearing_date ?? e.hearing_date ?? ""}
                        onChange={(x) => setEdits({ ...edits, [e.id]: { ...ed, hearing_date: x.target.value } })}
                        aria-label="Date"
                        className="bg-background text-foreground border-input h-9 rounded-lg border px-2 text-sm tnum"
                      />
                      <span
                        title={e.reason ?? ""}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          saved ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300" : sure ? "bg-muted text-muted-foreground" : "bg-memo-soft text-memo",
                        )}
                      >
                        {saved ? "Saved" : sure ? "Looks right" : "Please check"}
                      </span>
                      {!saved && (
                        <label className="text-muted-foreground ml-auto flex items-center gap-1.5 text-xs">
                          <input type="checkbox" checked={!!ed.reject} onChange={(x) => setEdits({ ...edits, [e.id]: { ...ed, reject: x.target.checked } })} />
                          Skip
                        </label>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-2 font-mono text-[11px]" translate="no">
                      {e.source_file}
                    </p>
                    <p className="text-foreground/85 mt-1.5 line-clamp-6 text-[14px] leading-relaxed whitespace-pre-line">{e.text}</p>
                  </li>
                );
              })}
            </ul>

            {pending.length > 0 && up.status !== "extracting" && up.status !== "segmenting" && (
              <div className="mt-5 flex justify-end">
                <button
                  onClick={save}
                  disabled={running}
                  className="press bg-primary text-primary-foreground inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-medium shadow-[var(--shadow-soft)] disabled:opacity-60"
                >
                  {running && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Save to memory
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
