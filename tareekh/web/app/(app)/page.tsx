"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ChevronLeft, ChevronRight, Gavel, MessageSquareQuote, Sparkles } from "lucide-react";
import { TopBar, toast } from "@/components/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { api, chatsChanged, fmtDate, type CalendarEvent, type ChatMemory, type Hearing, type Today } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function TodayPage() {
  const router = useRouter();
  const [data, setData] = useState<Today | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [memories, setMemories] = useState<ChatMemory[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.today().then(setData).catch((e) => setError(e.message));
    api.chatMemories().then(setMemories).catch(() => {});
  }, []);

  const brief = async (h: Hearing, question?: string) => {
    setBusy(h.case_id);
    try {
      const c = await api.newChat(`${question ? "" : "Brief · "}${h.short_name}`, h.case_id);
      chatsChanged();
      const q =
        question ??
        `Brief me for today's hearing in ${h.short_name} (${h.case_number}), listed for ${h.listed_for ?? "hearing"}. ` +
          `What happened last time, what is pending from our side, and what should I expect from ${h.judge}?`;
      router.push(`/chat/${c.id}?q=${encodeURIComponent(q)}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t start the chat");
      setBusy(null);
    }
  };

  const forget = (m: ChatMemory) => {
    setMemories((xs) => xs.filter((x) => x.id !== m.id));
    const timer = setTimeout(() => api.forgetMemory(m.id).catch(() => {}), 5000);
    toast("Forgotten", "Undo", () => {
      clearTimeout(timer);
      setMemories((xs) => [m, ...xs]);
    });
  };

  const day = data ? new Date(`${data.today}T00:00:00`) : null;

  return (
    <div className="min-h-dvh">
      <title>Today · Tareekh</title>
      <TopBar title={<span className="text-muted-foreground font-normal">{data?.practice.lawyer ? `Adv. ${data.practice.lawyer}` : ""}</span>} />

      <main className="mx-auto w-full max-w-6xl px-5 pt-2 pb-[calc(env(safe-area-inset-bottom)+48px)] md:px-8">
        {/* Large title */}
        <header className="pt-4 pb-8 md:pt-8">
          {day ? (
            <>
              <p className="text-muted-foreground text-sm tnum">{day.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
              <h1 className="title-xl mt-1 text-[52px] md:text-7xl">{day.toLocaleDateString("en-IN", { weekday: "long" })}</h1>
              <p className="text-muted-foreground mt-3 text-[15px]">
                {data!.hearings.length === 0
                  ? "No matters listed today."
                  : `${data!.hearings.length} ${data!.hearings.length === 1 ? "matter" : "matters"} listed${
                      data!.hearings[0].court_hall ? `, starting in ${data!.hearings[0].court_hall.split(",")[0]}` : ""
                    }.`}
              </p>
            </>
          ) : error ? (
            <div>
              <h1 className="title-xl text-5xl">Can’t reach memory</h1>
              <p className="text-muted-foreground mt-2 text-sm">{error}. Is the backend running? (start.ps1)</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3" role="status" aria-label="Loading">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-14 w-64" />
              <Skeleton className="h-4 w-72" />
            </div>
          )}
        </header>

        <div className="grid gap-x-12 gap-y-12 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-12">
            {/* Today's hearings */}
            <section aria-labelledby="h-today">
              <SectionTitle id="h-today">In court today</SectionTitle>
              {!data ? (
                <HearingSkeleton />
              ) : data.hearings.length === 0 ? (
                <p className="text-muted-foreground py-4 text-sm">Nothing listed. A good day to clear pending drafts.</p>
              ) : (
                <ol className="divide-border divide-y">
                  {data.hearings.map((h, i) => (
                    <li key={h.case_id} className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both py-5 duration-300 motion-reduce:animate-none" style={{ animationDelay: `${i * 50}ms` }}>
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <span className="tnum font-mono">{String(i + 1).padStart(2, "0")}</span>
                        <span>{h.court_hall?.split(",")[0]}</span>
                        <span aria-hidden>·</span>
                        <span>{h.judge}</span>
                      </div>
                      <h3 className="mt-1.5 text-xl font-semibold tracking-tight">{h.short_name}</h3>
                      <p className="text-muted-foreground mt-0.5 text-sm">
                        {h.case_number} · for {h.represents} · <span className="text-foreground/80">{h.listed_for}</span>
                      </p>
                      {h.last && (
                        <blockquote className="border-border text-foreground/80 mt-3 border-l-2 pl-3 text-[14px] leading-relaxed">
                          <span className="line-clamp-3">{h.last.text}</span>
                          <footer className="text-muted-foreground mt-1 text-xs tnum">
                            Last time, {fmtDate(h.last.date)} · {h.last.by}’s note
                          </footer>
                        </blockquote>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => brief(h)}
                          disabled={busy === h.case_id}
                          className="press bg-primary text-primary-foreground inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium shadow-[var(--shadow-soft)] disabled:opacity-60"
                        >
                          <Sparkles className="size-4" aria-hidden />
                          {busy === h.case_id ? "Opening…" : "Brief me"}
                        </button>
                        <button
                          onClick={() => brief(h, `${h.short_name}: `)}
                          className="press hover:bg-accent text-foreground/80 inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm"
                        >
                          Ask about it <ArrowUpRight className="size-3.5" aria-hidden />
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* Commitments */}
            <section aria-labelledby="h-commit">
              <SectionTitle id="h-commit">Open commitments</SectionTitle>
              {data?.commitments ? (
                <div className="text-foreground/85 max-w-prose text-[15px] leading-relaxed whitespace-pre-line">{data.commitments}</div>
              ) : (
                <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
                  <span>Tareekh is still learning these from the notes.</span>
                  {data?.hearings[0] && (
                    <button
                      onClick={() => brief(data.hearings[0], "What is pending from our side this week, and what is overdue?")}
                      className="press text-primary rounded-md font-medium hover:underline"
                    >
                      Ask what’s pending
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Up next */}
            {data && data.upcoming.length > 0 && (
              <section aria-labelledby="h-next">
                <SectionTitle id="h-next">Coming up</SectionTitle>
                <ul className="divide-border divide-y">
                  {data.upcoming.map((h) => (
                    <li key={h.case_id} className="flex items-baseline justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{h.short_name}</div>
                        <div className="text-muted-foreground truncate text-sm">{h.listed_for}</div>
                      </div>
                      <div className="text-muted-foreground shrink-0 text-sm tnum">{fmtDate(h.date, { weekday: "short", day: "numeric", month: "short" })}</div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="flex min-w-0 flex-col gap-12">
            <MonthCalendar today={data?.today} />

            {/* Remembered from chats */}
            <section aria-labelledby="h-mem">
              <SectionTitle id="h-mem">Remembered from chats</SectionTitle>
              {memories.length === 0 ? (
                <p className="text-muted-foreground text-sm leading-relaxed">
                  When you tell Tareekh a plan or a decision in a chat, it keeps it here. These rank below court records and are
                  always marked in answers.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {memories.map((m) => (
                    <li key={m.id} className="bg-memo-soft/50 border-memo/20 group rounded-xl border px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <MessageSquareQuote className="text-memo mt-0.5 size-4 shrink-0" aria-hidden />
                        <p className="min-w-0 flex-1 text-[13.5px] leading-snug">{m.text}</p>
                      </div>
                      <div className="text-muted-foreground mt-1.5 flex items-center justify-between pl-6 text-xs">
                        <span className="truncate tnum">
                          {m.kind} · {fmtDate(m.created_at)}
                        </span>
                        <button onClick={() => forget(m)} className="press hover:text-foreground rounded px-1 font-medium">
                          Forget
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Judges */}
            {data && Object.keys(data.judges).length > 0 && (
              <section aria-labelledby="h-judges">
                <SectionTitle id="h-judges">Before the bench today</SectionTitle>
                <div className="flex flex-col gap-2">
                  {Object.entries(data.judges).map(([id, j]) => (
                    <details key={id} className="group border-border rounded-xl border px-3 py-2.5 open:pb-3">
                      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
                        <Gavel className="text-muted-foreground size-4" aria-hidden />
                        {j.name}
                        <ChevronRight className="text-muted-foreground ml-auto size-4 transition-transform duration-200 group-open:rotate-90" aria-hidden />
                      </summary>
                      <p className="text-foreground/80 mt-2 text-[13.5px] leading-relaxed whitespace-pre-line">
                        {j.profile ?? "Still learning how this judge runs a court. Ask in a chat meanwhile."}
                      </p>
                    </details>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-muted-foreground mb-2 text-[12px] font-medium tracking-[0.08em] uppercase">
      {children}
    </h2>
  );
}

function HearingSkeleton() {
  return (
    <div className="flex flex-col gap-8 py-4" role="status" aria-label="Loading hearings">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- calendar
function MonthCalendar({ today }: { today?: string }) {
  const [month, setMonth] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (today && !month) {
      setMonth(today.slice(0, 7));
      setPicked(today);
    }
  }, [today, month]);

  useEffect(() => {
    if (month) api.calendar(month).then((r) => setEvents(r.events)).catch(() => setEvents([]));
  }, [month]);

  const cells = useMemo(() => {
    if (!month) return [];
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const lead = (first.getDay() + 6) % 7; // Monday first
    const days = new Date(y, m, 0).getDate();
    return [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  }, [month]);

  const byDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events) (map[e.date] ??= []).push(e);
    return map;
  }, [events]);

  const shift = (d: number) => {
    if (!month) return;
    const [y, m] = month.split("-").map(Number);
    const n = new Date(y, m - 1 + d, 1);
    setMonth(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`);
    setPicked(null);
  };

  const title = month ? new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "";
  const pickedEvents = picked ? byDay[picked] ?? [] : [];

  return (
    <section aria-labelledby="h-cal">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="h-cal" className="title-xl text-2xl">
          {title}
        </h2>
        <div className="flex gap-1">
          <button onClick={() => shift(-1)} className="press hover:bg-accent grid size-9 place-items-center rounded-lg" aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </button>
          <button onClick={() => shift(1)} className="press hover:bg-accent grid size-9 place-items-center rounded-lg" aria-label="Next month">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="text-muted-foreground grid grid-cols-7 pb-1 text-center text-[11px] font-medium">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) =>
          d ? (
            <button
              key={d}
              onClick={() => setPicked(d)}
              aria-label={`${fmtDate(d)}${byDay[d] ? `, ${byDay[d].length} hearing${byDay[d].length > 1 ? "s" : ""}` : ""}`}
              aria-pressed={picked === d}
              className={cn(
                "press relative mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-full text-sm tnum",
                picked === d ? "bg-foreground text-background" : "hover:bg-accent",
                d === today && picked !== d && "text-primary font-semibold",
              )}
            >
              {Number(d.slice(8))}
              {byDay[d] && (
                <span className="absolute bottom-1 flex gap-0.5" aria-hidden>
                  {byDay[d].slice(0, 3).map((e, k) => (
                    <span
                      key={k}
                      className={cn(
                        "size-1 rounded-full",
                        e.kind === "listed" ? (picked === d ? "bg-background" : "bg-primary") : picked === d ? "bg-background/60" : "bg-muted-foreground/50",
                      )}
                    />
                  ))}
                </span>
              )}
            </button>
          ) : (
            <span key={`x${i}`} />
          ),
        )}
      </div>
      <div className="mt-3 min-h-12" aria-live="polite">
        {picked && (
          <ul className="flex flex-col gap-1.5">
            {pickedEvents.length === 0 ? (
              <li className="text-muted-foreground text-sm">{fmtDate(picked, { weekday: "long", day: "numeric", month: "long" })}: nothing listed.</li>
            ) : (
              pickedEvents.map((e) => (
                <li key={e.case_id + e.date} className="flex items-center gap-2 text-sm">
                  <span className={cn("size-1.5 rounded-full", e.kind === "listed" ? "bg-primary" : "bg-muted-foreground/50")} aria-hidden />
                  <span className="font-medium">{e.short_name}</span>
                  <span className="text-muted-foreground">{e.kind === "listed" ? "listed" : "heard"}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
