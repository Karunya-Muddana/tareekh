"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ChevronLeft, ChevronRight, Gavel, MessageSquareQuote, Sparkles } from "lucide-react";
import { TopBar, toast } from "@/components/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Prose } from "@/components/prose";
import CountUp from "@/components/bits/CountUp";
import HoldButton from "@/components/bits/HoldButton";
import SpotlightCard from "@/components/bits/SpotlightCard";
import {
  api,
  chatsChanged,
  fmtDate,
  useCalendar,
  useChatMemories,
  useInsights,
  useCases,
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

  const briefAll = async () => {
    if (!data?.hearings.length) return;
    setBusy("__all");
    try {
      const c = await api.newChat("Brief · today’s cause list");
      chatsChanged();
      const list = data.hearings.map((h) => `${h.short_name} (${h.case_number}), listed for ${h.listed_for ?? "hearing"}`).join("; ");
      const q =
        `Brief me on today's cause list: ${list}. For each matter, in order: what happened last time, what is pending from our side, ` +
        `and what to have ready. Then anything the bench (${data.hearings[0].judge}) is likely to ask.`;
      router.push(`/chat/${c.id}?q=${encodeURIComponent(q)}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t start the chat");
      setBusy(null);
    }
  };

  // Forgetting is confirmed by holding the button (React Bits HoldButton), so it happens at once.
  const forget = (m: ChatMemory) => {
    setHidden((xs) => [...xs, m.id]);
    api
      .forgetMemory(m.id)
      .then(() => mutate<ChatMemory[]>("chat-memories", (xs) => (xs ?? []).filter((x) => x.id !== m.id), true))
      .catch(() => {
        setHidden((xs) => xs.filter((x) => x !== m.id));
        toast("Couldn’t forget that. Try again.");
      });
    toast("Forgotten");
  };

  const day = data ? new Date(`${data.today}T00:00:00`) : null;
  // The backend decides "today" (TODAY in backend/.env pins the demo day). Say so when it isn't the device's date.
  const pinned = data && data.today !== localISO(new Date());
  const { data: caseList } = useCases();
  const caseName = (id: string | null) => (id ? caseList?.find((c) => c.id === id)?.short_name : undefined);

  return (
    <div className="min-h-dvh">
      <title>Today · Tareekh</title>
      <TopBar title={<span className="text-muted-foreground font-normal">{user?.name ?? ""}</span>} />

      <main className="mx-auto w-full max-w-[68rem] px-5 pt-2 pb-[calc(env(safe-area-inset-bottom)+48px)] md:px-8">
        {/* Large title */}
        <header className="pt-4 pb-8 md:pt-8">
          {day ? (
            <>
              <p className="fade text-muted-foreground text-sm tnum">
                {greeting(user?.name)} · {day.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                {pinned && (
                  <span
                    className="bg-accent text-muted-foreground ml-2 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                    title="The backend pins this date (TODAY in backend/.env) so the demo data lines up."
                  >
                    Demo day
                  </span>
                )}
              </p>
              <h1 className="indic ink-in mt-3 text-[56px] md:text-[80px]" style={{ "--d": "120ms" } as React.CSSProperties}>{day.toLocaleDateString("en-IN", { weekday: "long" }).toLowerCase()}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
              <p className="text-muted-foreground text-[15px]">
                {data!.hearings.length === 0
                  ? "Nothing on today’s cause list."
                  : (
                    <>
                      <span className="text-foreground tnum font-semibold">
                        <CountUp to={data!.hearings.length} duration={0.8} />
                      </span>{" "}
                      {data!.hearings.length === 1 ? "matter" : "matters"} listed
                      {data!.hearings[0].court_hall ? `, starting in ${data!.hearings[0].court_hall.split(",")[0]}` : ""}.
                    </>
                  )}
              </p>
              {data!.hearings.length > 1 && (
                <button
                  onClick={briefAll}
                  disabled={busy === "__all"}
                  className="press border-foreground/20 text-foreground hover:bg-accent inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium disabled:opacity-60"
                >
                  <Sparkles className={cn("size-4", busy === "__all" && "animate-spin [animation-duration:1.4s]")} aria-hidden />
                  {busy === "__all" ? "Opening…" : "Brief me on today’s cause list"}
                </button>
              )}
              </div>
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

        <div className="grid gap-x-10 gap-y-12 lg:grid-cols-[minmax(0,1fr)_300px] xl:gap-x-14">
          <div className="flex min-w-0 flex-col gap-12">
            {/* Today's hearings */}
            <section aria-labelledby="h-today">
              <SectionTitle id="h-today">Today’s cause list</SectionTitle>
              {!data ? (
                <HearingSkeleton />
              ) : data.hearings.length === 0 ? (
                <p className="text-muted-foreground py-4 text-sm">Nothing listed. A good day to clear pending drafts.</p>
              ) : (
                <ol className="-mt-2">
                  {data.hearings.map((h, i) => (
                    <li key={h.case_id} className="rise border-border border-b last:border-b-0" style={{ "--i": i, "--d": "200ms" } as React.CSSProperties}>
                      <HearingCard
                        h={h}
                        memories={memories.filter((m) => m.case_id === h.case_id)}
                        busy={busy === h.case_id}
                        onBrief={() => brief(h)}
                        onAsk={() => brief(h, `${h.short_name}: `)}
                      />
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
                      className="press text-foreground rounded-md font-medium underline decoration-foreground/30 hover:decoration-foreground"
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

            {/* Remembered from chats: decisions and instructions can change what happens in court today */}
            <section aria-labelledby="h-mem" className="bg-memo-soft/45 border-memo/15 -mx-1 rounded-2xl border px-4 pt-3.5 pb-2">
              <h2 id="h-mem" className="text-memo flex items-center gap-2 text-[13px] font-semibold">
                <MessageSquareQuote className="size-4" aria-hidden />
                Remembered from chats
              </h2>
              {memories.length === 0 ? (
                <p className="text-muted-foreground py-2 text-sm leading-relaxed">
                  Tell Tareekh a decision, a client’s instruction or a deadline in any chat and it keeps it here. These rank below
                  court records and are always marked in answers.
                </p>
              ) : (
                MEMORY_GROUPS.map(([label, kinds]) => {
                  const items = memories.filter((m) => kinds.includes(m.kind) || (label === "Case facts" && !KNOWN_KINDS.includes(m.kind)));
                  if (!items.length) return null;
                  return (
                    <div key={label} className="border-memo/15 border-t py-2.5 first-of-type:border-t-0">
                      <h3 className="text-muted-foreground mb-1.5 text-[11px] font-medium tracking-[0.06em] uppercase">
                        {label} <span className="tnum">· {items.length}</span>
                      </h3>
                      <ul className="flex flex-col gap-2.5">
                        {items.map((m) => (
                          <li key={m.id} className="animate-in fade-in duration-300">
                            <p className="text-[13.5px] leading-snug">{m.text}</p>
                            <div className="text-muted-foreground mt-1 flex items-center justify-between gap-2 text-xs">
                              <span className="truncate tnum">
                                {caseName(m.case_id) ?? "All matters"} · {fmtDate(m.created_at, { day: "numeric", month: "short" })}
                              </span>
                              <HoldButton
                                size="sm"
                                holdTime={900}
                                radius={8}
                                wave={false}
                                glow={false}
                                backgroundColor="transparent"
                                fillColor="var(--tape)"
                                textColor="var(--muted-foreground)"
                                fillTextColor="#fff"
                                doneLabel="Forgotten"
                                onHold={() => forget(m)}
                                className="-mr-1 h-7! px-2! text-xs!"
                              >
                                Hold to forget
                              </HoldButton>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })
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

const MEMORY_GROUPS: [string, string[]][] = [
  ["Decisions", ["decision", "plan"]],
  ["Client instructions", ["instruction"]],
  ["Pending tasks", ["deadline", "task"]],
  ["Case facts", ["fact", "preference"]],
];
const KNOWN_KINDS = MEMORY_GROUPS.flatMap(([, k]) => k);

const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The note's opening sentence, as the at-a-glance line. The full note stays one tap away. */
function firstSentence(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  const m = t.match(/^(.{40,220}?[.!?])(\s|$)/);
  return m ? m[1] : t.length > 180 ? `${t.slice(0, 180).replace(/\s\S*$/, "")}…` : t;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function HearingCard({
  h,
  memories,
  busy,
  onBrief,
  onAsk,
}: {
  h: Hearing;
  memories: ChatMemory[];
  busy: boolean;
  onBrief: () => void;
  onAsk: () => void;
}) {
  const summary = h.last ? firstSentence(h.last.text) : null;
  const more = h.last && summary && summary.length < h.last.text.trim().length;
  return (
    <SpotlightCard className="-mx-3 rounded-xl px-3 py-6" spotlightColor="rgba(200, 50, 30, 0.05)">
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span>{h.court_hall?.split(",")[0]}</span>
        <span aria-hidden>·</span>
        <span>{h.judge}</span>
        <span aria-hidden>·</span>
        <span className="tnum">{h.case_number}</span>
      </div>
      <h3 className="mt-1.5 text-xl font-semibold tracking-tight">{h.short_name}</h3>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
        {h.listed_for && (
          <span className="bg-tape-soft text-tape rounded-md px-2 py-0.5">{cap(h.listed_for)}</span>
        )}
        <span className="text-muted-foreground">For {h.represents}</span>
      </div>

      {h.last && (
        <div className="mt-4">
          <div className="text-muted-foreground text-xs tnum">
            Previous hearing, {fmtDate(h.last.date, { day: "numeric", month: "short" })} · {h.last.by}’s note
          </div>
          <p className="text-foreground/90 mt-1 text-[14.5px] leading-relaxed">{summary}</p>
          {more && (
            <details className="group mt-1">
              <summary className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer list-none items-center gap-1 text-[13px] font-medium">
                <ChevronRight className="size-3.5 transition-transform duration-200 group-open:rotate-90" aria-hidden />
                <span className="group-open:hidden">Full note</span>
                <span className="hidden group-open:inline">Hide note</span>
              </summary>
              <p className="fade text-foreground/80 mt-2 text-[14px] leading-relaxed whitespace-pre-line">{h.last.text}</p>
            </details>
          )}
        </div>
      )}

      {memories.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {memories.map((m) => (
            <li key={m.id} className="bg-memo-soft/60 flex items-start gap-2 rounded-lg px-2.5 py-2 text-[13px] leading-snug">
              <MessageSquareQuote className="text-memo mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                <span className="text-memo font-semibold">{cap(m.kind)}:</span> {m.text}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={onBrief}
          disabled={busy}
          className="press bg-primary text-primary-foreground inline-flex h-11 max-w-full items-center gap-2 rounded-full px-5 text-sm font-medium shadow-[var(--shadow-soft)] disabled:opacity-60 md:h-10 md:px-4"
        >
          <Sparkles className={cn("size-4 shrink-0", busy && "animate-spin [animation-duration:1.4s]")} aria-hidden />
          <span className="truncate">
            {busy ? (
              "Opening…"
            ) : (
              <>
                Brief me<span className="hidden sm:inline"> on {h.short_name}</span>
              </>
            )}
          </span>
        </button>
        <button onClick={onAsk} className="press hover:bg-accent text-foreground/80 inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm md:h-10">
          Ask about it <ArrowUpRight className="size-3.5" aria-hidden />
        </button>
      </div>
    </SpotlightCard>
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
                on ? "bg-foreground text-background scale-105" : d === today ? "text-tape" : "text-foreground",
              )}
            >
              <span className={cn("text-[11px] font-medium", on ? "text-background/70" : "text-muted-foreground")}>
                {fmtDate(d, { weekday: "narrow" })}
              </span>
              <span className="tnum text-[17px] font-semibold">{Number(d.slice(8))}</span>
              <span className="flex h-1 gap-0.5" aria-hidden>
                {Array.from({ length: Math.min(n, 3) }, (_, k) => (
                  <span key={k} className={cn("size-1 rounded-full", on ? "bg-background" : "bg-tape")} />
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
                <span className={cn("size-1.5 rounded-full", e.kind === "listed" ? "bg-tape" : "bg-muted-foreground/50")} aria-hidden />
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
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="press text-foreground mt-2 rounded-md text-sm font-medium underline decoration-foreground/30 hover:decoration-foreground">
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
        <h2 id="h-cal" className="title-xl text-xl">
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
                "press spring relative mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-full text-sm tnum",
                picked === d ? "bg-foreground text-background scale-105" : "hover:bg-accent",
                d === today && picked !== d && "text-tape font-semibold",
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
                        e.kind === "listed" ? (picked === d ? "bg-background" : "bg-tape") : picked === d ? "bg-background/60" : "bg-muted-foreground/50",
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
                  <span className={cn("size-1.5 rounded-full", e.kind === "listed" ? "bg-tape" : "bg-muted-foreground/50")} aria-hidden />
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
