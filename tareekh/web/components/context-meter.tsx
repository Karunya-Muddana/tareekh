"use client";

import { Popover } from "@base-ui/react/popover";
import { ChevronRight, Loader2, Minimize2 } from "lucide-react";
import type { ChatContext } from "@/lib/api";
import { cn } from "@/lib/utils";

const fmt = (n: number) =>
  n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

/**
 * How full this chat's context is. The whole thread rides along with every question; past `compress_at` the
 * backend folds older turns into a summary (the newest stay word for word). Opens a breakdown with "Compress now".
 */
export function ContextMeter({
  ctx,
  onCompress,
}: {
  ctx: ChatContext | null;
  onCompress: () => void;
}) {
  if (!ctx) return null;
  const share = Math.min(ctx.used / ctx.budget, 1);
  const pct = Math.round(share * 100);
  const level = share >= ctx.compress_at ? "full" : share >= ctx.compress_at * 0.75 ? "warm" : "ok";
  const r = 7;
  const c = 2 * Math.PI * r;

  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          "press hover:bg-accent flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs tabular-nums",
          level === "full" ? "text-tape" : "text-muted-foreground hover:text-foreground",
        )}
        aria-label={`Context ${pct}% full${ctx.compressing ? ", compressing" : ""}`}
      >
        {ctx.compressing ? (
          <Loader2 className="size-[18px] animate-spin" aria-hidden />
        ) : (
          <svg viewBox="0 0 18 18" className="size-[18px] -rotate-90" aria-hidden>
            <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth="2.25" />
            <circle
              cx="9"
              cy="9"
              r={r}
              fill="none"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - share)}
              className={cn(
                "transition-[stroke-dashoffset] duration-500 ease-out",
                level === "full" ? "stroke-tape" : level === "warm" ? "stroke-memo" : "stroke-current",
              )}
            />
          </svg>
        )}
        <span className="hidden sm:inline">{pct}%</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
          <Popover.Popup className="bg-popover text-popover-foreground border-border data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 w-[min(20rem,calc(100vw-2rem))] origin-(--transform-origin) rounded-xl border p-4 shadow-[var(--shadow-soft)] outline-none">
            <Popover.Title className="text-sm font-semibold">Context</Popover.Title>
            <div className="mt-2 flex items-baseline justify-between text-[13px] tabular-nums">
              <span>
                <span className="font-semibold">{fmt(ctx.used)}</span>
                <span className="text-muted-foreground"> of {fmt(ctx.budget)} tokens</span>
              </span>
              <span className={cn("font-medium", level === "full" ? "text-tape" : "text-muted-foreground")}>{pct}%</span>
            </div>
            <div className="bg-muted relative mt-2 h-1.5 overflow-hidden rounded-full" aria-hidden>
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500 ease-out",
                  level === "full" ? "bg-tape" : level === "warm" ? "bg-memo" : "bg-foreground/70",
                )}
                style={{ width: `${pct}%` }}
              />
              <div className="bg-background absolute inset-y-0 w-0.5" style={{ left: `${ctx.compress_at * 100}%` }} />
            </div>

            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[13px] tabular-nums">
              {ctx.summarized_messages > 0 && (
                <>
                  <dt className="text-muted-foreground">Summary of {ctx.summarized_messages} earlier messages</dt>
                  <dd className="text-right">{fmt(ctx.summary_tokens)}</dd>
                </>
              )}
              <dt className="text-muted-foreground">
                {ctx.summarized_messages > 0 ? "Recent messages" : "Messages"}, word for word ({ctx.recent_messages})
              </dt>
              <dd className="text-right">{fmt(ctx.recent_tokens)}</dd>
              {ctx.last_prompt_tokens != null && (
                <>
                  <dt className="text-muted-foreground">Last request to the model</dt>
                  <dd className="text-right">
                    {fmt(ctx.last_prompt_tokens)} <span className="text-muted-foreground">/ {fmt(ctx.model_window)}</span>
                  </dd>
                </>
              )}
            </dl>

            <Popover.Description className="text-muted-foreground mt-3 text-xs leading-relaxed">
              The whole chat goes with every question. At {Math.round(ctx.compress_at * 100)}%, older messages are
              summarised automatically; the last four always stay word for word. The last request also includes the
              notes found for it.
            </Popover.Description>

            {ctx.summary && (
              <details className="group mt-3">
                <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-1 text-xs font-medium">
                  <ChevronRight className="size-3.5 transition-transform duration-200 group-open:rotate-90" aria-hidden />
                  Read the summary
                </summary>
                <p className="bg-muted/60 mt-2 max-h-44 overflow-y-auto overscroll-contain rounded-lg p-2.5 text-xs leading-relaxed whitespace-pre-line">
                  {ctx.summary}
                </p>
              </details>
            )}

            <button
              type="button"
              onClick={onCompress}
              disabled={!ctx.can_compress || ctx.compressing}
              className="press border-border hover:bg-accent mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border text-[13px] font-medium disabled:opacity-50"
            >
              {ctx.compressing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Minimize2 className="size-4" aria-hidden />}
              {ctx.compressing ? "Compressing…" : ctx.can_compress ? "Compress now" : "Nothing to compress yet"}
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
