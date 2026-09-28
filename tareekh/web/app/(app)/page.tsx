"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ChevronLeft, ChevronRight, Gavel, MessageSquareQuote, Sparkles } from "lucide-react";
import { TopBar, toast } from "@/components/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Prose } from "@/components/prose";
import {
  api,
  chatsChanged,
  fmtDate,
  useCalendar,
  useChatMemories,
  useInsights,
  useToday,
  type CalendarEvent,
  type ChatMemory,
  type Hearing,
} from "@/lib/api";
import { mutate } from "@/lib/cache";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export default function TodayPage() {
  const router = useRouter();
  const { data, error: todayError } = useToday();
  const { data: insights, loading: insightsLoading } = useInsights();
  const { data: memoryList } = useChatMemories();
  const user = useSession();
  const [hidden, setHidden] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const error = todayError?.message;
  const memories = (memoryList ?? []).filter((m) => !hidden.includes(m.id));
  const judges = insights?.judges ?? data?.judges ?? {};

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
    setHidden((xs) => [...xs, m.id]);
    const timer = setTimeout(() => {
      api.forgetMemory(m.id).catch(() => {});
      mutate<ChatMemory[]>("chat-memories", (xs) => (xs ?? []).filter((x) => x.id !== m.id), true);
    }, 5000);
    toast("Forgotten", "Undo", () => {
      clearTimeout(timer);
      setHidden((xs) => xs.filter((x) => x !== m.id));
    });
  };

  const day = data ? new Date(`${data.today}T00:00:00`) : null;

  return (
    <div className="min-h-dvh">
      <title>Today · Tareekh</title>
      <TopBar title={<span className="text-muted-foreground font-normal">{user?.name ?? ""}</span>} />

      <main className="mx-auto w-full max-w-6xl px-5 pt-2 pb-[calc(env(safe-area-inset-bottom)+48px)] md:px-8">
        {/* Large title */}
        <header className="pt-4 pb-8 md:pt-8">
          {day ? (
            <>
              <p className="fade text-muted-foreground text-sm tnum">
                {greeting(user?.name)} · {day.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              <h1 className="indic ink-in mt-3 text-[56px] md:text-[80px]" style={{ "--d": "120ms" } as React.CSSProperties}>{day.toLocaleDateString("en-IN", { weekday: "long" }).toLowerCase()}</h1>
              <p className="text-muted-foreground mt-3 text-[15px]">
                {data!.hearings.length === 0
                  ? "Nothing on today’s cause list."
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

        {data && <WeekStrip today={data.today} />}

        <div className="grid gap-x-12 gap-y-12 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-12">
            {/* Today's hearings */}
            <section aria-labelledby="h-today">
              <SectionTitle id="h-today">Today’s cause list</SectionTitle>
              {!data ? (
                <HearingSkeleton />
              ) : data.hearings.length === 0 ? (
                <p className="text-muted-foreground py-4 text-sm">Nothing listed. A good day to clear pending drafts.</p>
              ) : (
                <ol className="divide-border divide-y">
                  {data.hearings.map((h, i) => (
                    <li key={h.case_id} className="rise py-5" style={{ "--i": i, "--d": "200ms" } as React.CSSProperties}>
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
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
                            Previous hearing, {fmtDate(h.last.date)} · {h.last.by}’s note
                          </footer>
                        </blockquote>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => brief(h)}
                          disabled={busy === h.case_id}
                          className="press bg-primary text-primary-foreground inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-medium shadow-[var(--shadow-soft)] disabled:opacity-60 md:h-10 md:px-4"
                        >
                          <Sparkles className={cn("size-4", busy === h.case_id && "animate-spin [animation-duration:1.4s]")} aria-hidden />
                          {busy === h.case_id ? "Opening…" : "Brief me"}
                        </button>
                        <button
                          onClick={() => brief(h, `${h.short_name}: `)}
                          className="press hover:bg-accent text-foreground/80 inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm md:h-10"
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
              <SectionTitle id="h-commit">Pending from our side</SectionTitle>
              {insights?.commitments ? (
                <Commitments text={insights.commitments} />
              ) : insightsLoading && !insights ? (
                <div className="flex flex-col gap-2 py-1" role="status" aria-label="Loading commitments">
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
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
                <SectionTitle id="h-next">Next dates</SectionTitle>
                <ul className="divide-border divide-y">
                  {data.upcoming.map((h) => (
                    <li key={h.case_id} className="flex items-baseline justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{h.short_name}</div>
                        <div className="text-muted-foreground line-clamp-2 text-sm">{h.listed_for}</div>
                      </div>
                      <div className="text-muted-foreground shrink-0 text-sm tnum">{fmtDate(h.date, { weekday: "short", day: "numeric", month: "short" })}</div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="flex min-w-0 flex-col gap-12">
            <div className="hidden lg:block">
              <MonthCalendar today={data?.today} />
            </div>

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
                    <li key={m.id} className="lift bg-memo-soft/50 border-memo/20 group animate-in fade-in rounded-xl border px-3 py-2.5 duration-300">
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
            {Object.keys(judges).length > 0 && (
              <section aria-labelledby="h-judges">
                <SectionTitle id="h-judges">Before the bench today</SectionTitle>
                <div className="flex flex-col gap-2">
                  {Object.entries(judges).map(([id, j]) => (
                    <details key={id} className="lift group border-border rounded-xl border px-3 py-2.5 open:pb-3">
                      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
                        <Gavel className="text-muted-foreground size-4" aria-hidden />
                        {j.name}
                        <ChevronRight className="text-muted-foreground ml-auto size-4 transition-transform duration-200 group-open:rotate-90" aria-hidden />
                      </summary>
                      {j.profile ? (
                        <Prose className="mt-2 text-[13.5px]">{j.profile}</Prose>
                      ) : (
                        <p className="text-muted-foreground mt-2 text-[13.5px] leading-relaxed">
                          {insightsLoading ? "Checking memory…" : "Still learning how this court runs. Ask in a chat meanwhile."}
                        </p>
                      )}
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

function greeting(name?: string) {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const first = name?.replace(/^adv\.?\s+/i, "").split(" ")[0];
  return first ? `${part}, ${first}` : part;
}

/** Phones: this week at a glance, right under the date. The month calendar stays on larger screens. */
function WeekStrip({ today }: { today: string }) {
  const days = useMemo(() => {
    const t = new Date(`${today}T00:00:00`);
    const monday = new Date(t);
    monday.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });
  }, [today]);
  const months = [...new Set(days.map((d) => d.slice(0, 7)))];
  const a = useCalendar(months[0]);
  const b = useCalendar(months[1] ?? null);
  const [picked, setPicked] = useState(today);
  const byDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of [...(a.data?.events ?? []), ...(b.data?.events ?? [])]) (map[e.date] ??= []).push(e);
    return map;
  }, [a.data, b.data]);
  const events = byDay[picked] ?? [];

  return (
    <section aria-label="This week" className="rise -mx-5 mb-10 lg:hidden" style={{ "--d": "300ms" } as React.CSSProperties}>
      <div className="grid grid-cols-7 gap-1 px-4">
        {days.map((d) => {
          const on = d === picked;
          const n = byDay[d]?.filter((e) => e.kind === "listed").length ?? 0;
          return (
            <button
              key={d}
              onClick={() => setPicked(d)}
              aria-pressed={on}
              aria-label={`${fmtDate(d, { weekday: "long", day: "numeric", month: "long" })}${n ? `, ${n} listed` : ""}`}
              className={cn(
                "press spring flex flex-col items-center gap-1 rounded-2xl py-2",
                on ? "bg-foreground text-background scale-105" : d === today ? "text-primary" : "text-foreground",
              )}
            >
              <span className={cn("text-[11px] font-medium", on ? "text-background/70" : "text-muted-foreground")}>
                {fmtDate(d, { weekday: "narrow" })}
              </span>
              <span className="tnum text-[17px] font-semibold">{Number(d.slice(8))}</span>
              <span className="flex h-1 gap-0.5" aria-hidden>
                {Array.from({ length: Math.min(n, 3) }, (_, k) => (
                  <span key={k} className={cn("size-1 rounded-full", on ? "bg-background" : "bg-primary")} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      {picked !== today && (
        <ul key={picked} className="fade mt-3 flex flex-col gap-1.5 px-5" aria-live="polite">
          {events.length === 0 ? (
            <li className="text-muted-foreground text-sm">{fmtDate(picked, { weekday: "long", day: "numeric", month: "long" })}: nothing listed.</li>
          ) : (
            events.map((e) => (
              <li key={e.case_id + e.date} className="flex items-center gap-2 text-sm">
                <span className={cn("size-1.5 rounded-full", e.kind === "listed" ? "bg-primary" : "bg-muted-foreground/50")} aria-hidden />
                <span className="font-medium">{e.short_name}</span>
                <span className="text-muted-foreground">{e.kind === "listed" ? "listed" : "heard"}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}

/** Commitments from memory can run long: show the top, let the rest open in place. */
function Commitments({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 900;
  return (
    <div className="border-border bg-card relative rounded-2xl border px-5 py-4 shadow-[var(--shadow-soft)]">
      <div className={cn("relative overflow-hidden", long && !open && "max-h-72")}>
        <Prose key={String(open)} className={open ? "fade" : undefined}>{text}</Prose>
        {long && !open && <div className="from-card pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t" aria-hidden />}
      </div>
      {long && (
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="press text-primary mt-2 rounded-md text-sm font-medium hover:underline">
          {open ? "Show less" : "Show all"}
        </button>
      )}
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
  const [picked, setPicked] = useState<string | null>(null);
  const { data: cal } = useCalendar(month);
  const events = useMemo<CalendarEvent[]>(() => cal?.events ?? [], [cal]);

  useEffect(() => {
    if (today && !month) {
      setMonth(today.slice(0, 7));
      setPicked(today);
    }
  }, [today, month]);

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
                "press spring relative mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-full text-sm tnum",
                picked === d ? "bg-foreground text-background scale-105" : "hover:bg-accent",
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
