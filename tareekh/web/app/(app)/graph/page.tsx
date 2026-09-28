"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, ExternalLink, FileText, Loader2, Search, X } from "lucide-react";
import { TopBar, toast } from "@/components/app-shell";
import { GraphCanvas, TYPE_LABEL, type GraphCanvasHandle } from "@/components/graph-canvas";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { api, chatsChanged, fmtDate, useEntry, useGraph, type GraphNode, type GraphSearch, type SearchHit, type SearchMode } from "@/lib/api";
import RubberSegment from "@/components/bits/RubberSegment";
import CountUp from "@/components/bits/CountUp";
import { cn } from "@/lib/utils";

const MODES: [SearchMode, string, string][] = [
  ["both", "Both", "Exact words (typos allowed) and meaning"],
  ["keyword", "Words", "Words in the note, typos allowed"],
  ["semantic", "Meaning", "Notes about the same thing, even in other words"],
];

export default function KnowledgeGraphPage() {
  return (
    <Suspense>
      <KnowledgeGraph />
    </Suspense>
  );
}

function KnowledgeGraph() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: graph, error } = useGraph();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [mode, setMode] = useState<SearchMode>((params.get("mode") as SearchMode) || "both");
  const [result, setResult] = useState<GraphSearch | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<string | null>(params.get("node"));
  const [caseFilter, setCaseFilter] = useState<string | null>(null);
  const canvas = useRef<GraphCanvasHandle>(null);
  const isMobile = useIsMobile();

  // Search as you type (debounced); stale requests are cancelled.
  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResult(null);
      setSearching(false);
      return;
    }
    const ctl = new AbortController();
    setSearching(true);
    const t = setTimeout(() => {
      api
        .graphSearch(query, mode, ctl.signal)
        .then((r) => {
          setResult(r);
          setSearching(false);
        })
        .catch((e) => {
          if (e?.name !== "AbortError") {
            setSearching(false);
            toast(e instanceof Error ? e.message : "Search failed");
          }
        });
    }, 260);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, mode]);

  // Keep the search in the address bar, so a search can be shared or come back to.
  useEffect(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (mode !== "both") sp.set("mode", mode);
    if (selected) sp.set("node", selected);
    const next = sp.toString();
    if (next !== params.toString()) router.replace(next ? `/graph?${next}` : "/graph", { scroll: false });
  }, [q, mode, selected, router, params]);

  const nodeById = useMemo(() => new Map((graph?.nodes ?? []).map((n) => [n.id, n])), [graph]);

  const focus = useMemo(() => {
    if (result) return new Map(result.results.map((r) => [r.id, r.score]));
    if (caseFilter && graph)
      return new Map(graph.nodes.filter((n) => n.case_id === caseFilter || n.id === `c:${caseFilter}`).map((n) => [n.id, 1]));
    return null;
  }, [result, caseFilter, graph]);

  // After each search, bring the matches into view.
  useEffect(() => {
    if (!focus) return;
    const ids = [...focus.keys()];
    const t = setTimeout(() => canvas.current?.fit(ids.length ? ids : undefined), 60);
    return () => clearTimeout(t);
  }, [focus]);

  const select = (n: GraphNode | null) => {
    if (!n) return setSelected(null);
    if (n.type === "case") {
      setQ("");
      setCaseFilter((c) => (c === n.id.slice(2) ? null : n.id.slice(2)));
      setSelected(null);
      return;
    }
    if (n.type === "judge" || n.type === "counsel" || n.type === "client") {
      setCaseFilter(null);
      setQ(n.label);
      return;
    }
    setSelected(n.id);
  };

  const cases = (graph?.nodes ?? []).filter((n) => n.type === "case");
  const hits = result?.results.filter((r) => nodeById.has(r.id)) ?? [];
  const selectedNode = selected ? nodeById.get(selected) : undefined;

  const reader = selectedNode ? (
    <NoteReader node={selectedNode} terms={result?.results.find((r) => r.id === selected)?.terms ?? []} onClose={() => setSelected(null)} inSheet={isMobile} />
  ) : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <title>Knowledge graph · Tareekh</title>
      <TopBar title={<span className="text-muted-foreground font-normal">Knowledge graph</span>} />

      <main className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col px-4 pb-6 md:px-8">
        <header className="pt-2 pb-5 md:pt-6">
          <h1 className="title-xl text-[40px] md:text-[56px]">Knowledge graph</h1>
          <p className="text-muted-foreground mt-2 hidden max-w-2xl text-[15px] sm:block">
            Every note, order sheet and document, linked by case, court, time and meaning. Search, and only what’s relevant stays.
          </p>
        </header>

        {/* Search */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="bg-card border-input focus-within:ring-ring/40 flex h-12 flex-1 items-center gap-2.5 rounded-xl border px-3.5 shadow-[var(--shadow-soft)] focus-within:ring-2">
            {searching ? <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" aria-hidden /> : <Search className="text-muted-foreground size-4 shrink-0" aria-hidden />}
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setCaseFilter(null);
              }}
              placeholder="Search notes: “survey pegs”, “adjournment costs”, “Srinivas’s half”"
              aria-label="Search the knowledge graph"
              className="min-w-0 flex-1 bg-transparent text-[16px] outline-none"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
            />
            {q && (
              <button onClick={() => setQ("")} className="press text-muted-foreground hover:text-foreground grid size-8 place-items-center rounded-md" aria-label="Clear search">
                <X className="size-4" />
              </button>
            )}
          </label>
          <RubberSegment
            aria-label="Match by"
            size="lg"
            className="h-12 w-full shrink-0 md:w-72"
            value={mode}
            onChange={(v) => setMode(v as SearchMode)}
            items={MODES.map(([m, label, hint]) => ({ value: m, label: <span title={hint}>{label}</span> }))}
            trackColor="var(--muted)"
            thumbColor="var(--foreground)"
            textColor="var(--muted-foreground)"
            activeTextColor="var(--background)"
            radius={12}
            inset={4}
          />
        </div>

        {/* Case filter */}
        {cases.length > 0 && (
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
            {cases.map((c) => {
              const on = caseFilter === c.id.slice(2);
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setQ("");
                    setCaseFilter(on ? null : c.id.slice(2));
                  }}
                  aria-pressed={on}
                  className={cn(
                    "press h-9 shrink-0 rounded-full border px-3.5 text-[13px] transition-colors",
                    on ? "bg-foreground text-background border-transparent" : "border-border text-foreground/80 hover:bg-accent",
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4 grid gap-4 lg:h-[max(560px,calc(100dvh-260px))] lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Graph */}
          <div className="border-border bg-card relative h-[58dvh] min-h-[360px] overflow-hidden rounded-2xl border lg:h-full lg:min-h-0">
            {graph ? (
              <>
                <GraphCanvas ref={canvas} graph={graph} focus={focus} selected={selected} onSelect={select} className="absolute inset-0" />
                <Legend />
                {result && hits.length === 0 && !searching && (
                  <div className="fade bg-card/90 absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 rounded-xl px-4 py-3 text-center text-sm shadow-[var(--shadow-soft)]">
                    Nothing matches “{result.query}”.
                    <div className="text-muted-foreground mt-0.5 text-xs">Try fewer words, or switch to Meaning.</div>
                  </div>
                )}
              </>
            ) : error ? (
              <div className="grid h-full place-items-center p-6 text-center">
                <div>
                  <p className="font-medium">Can’t load the graph</p>
                  <p className="text-muted-foreground mt-1 text-sm">{error.message}. Is the backend running?</p>
                </div>
              </div>
            ) : (
              <div className="grid h-full place-items-center" role="status" aria-label="Loading graph">
                <Skeleton className="size-40 rounded-full" />
              </div>
            )}
          </div>

          {/* Side panel: the note you're reading, or the results, or an overview */}
          <aside className="flex min-h-0 flex-col lg:h-full">
            {!isMobile && reader ? (
              reader
            ) : result ? (
              <Results hits={hits} result={result} nodeById={nodeById} selected={selected} onPick={(id) => setSelected(id)} />
            ) : (
              <Overview graph={graph} caseFilter={caseFilter} nodeById={nodeById} onPick={(id) => setSelected(id)} />
            )}
          </aside>
        </div>
      </main>

      {/* Phones: the note opens as a sheet over the graph */}
      <Sheet open={!!(isMobile && reader)} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-2xl p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Note</SheetTitle>
          </SheetHeader>
          {reader}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Legend() {
  const items: [string, string][] = [
    ["Note", "bg-primary"],
    ["Order sheet", "bg-memo"],
    ["Document", "bg-chart-3"],
    ["Chat memory", "bg-tape"],
  ];
  return (
    <div className="bg-card/85 pointer-events-none absolute top-3 left-3 rounded-lg px-2.5 py-2 font-mono text-[11px] leading-5 backdrop-blur-sm">
      <div className="text-muted-foreground hidden md:block">Scroll to zoom · Drag to pan · Click to read</div>
      <div className="text-muted-foreground md:hidden">Pinch to zoom · Tap to read</div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {items.map(([label, cls]) => (
          <span key={label} className="text-foreground/80 flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", cls)} aria-hidden />
            {label}
          </span>
        ))}
        <span className="text-foreground/80 flex items-center gap-1.5">
          <span className="border-foreground size-2.5 rounded-full border-2" aria-hidden />
          Case
        </span>
      </div>
    </div>
  );
}

function Results({
  hits,
  result,
  nodeById,
  selected,
  onPick,
}: {
  hits: SearchHit[];
  result: GraphSearch;
  nodeById: Map<string, GraphNode>;
  selected: string | null;
  onPick: (id: string) => void;
}) {
  const caseName = (id?: string | null) => (id ? nodeById.get(`c:${id}`)?.label : undefined);
  return (
    <section aria-label="Search results" className="flex min-h-0 flex-col">
      <div className="text-muted-foreground flex items-baseline justify-between px-1 pb-2 text-sm">
        <span className="tnum">
          {hits.length} {hits.length === 1 ? "match" : "matches"}
        </span>
        {result.semantic_source === "local" && result.mode !== "keyword" && (
          <span className="text-xs" title="Memory is unreachable, so meaning is matched on this machine from the notes' words.">
            Meaning: offline match
          </span>
        )}
      </div>
      <ol className="-mx-1 flex min-h-0 flex-col gap-1 overflow-y-auto px-1 pb-2">
        {hits.map((h, i) => {
          const n = nodeById.get(h.id)!;
          return (
            <li key={h.id} className="rise" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
              <button
                onClick={() => onPick(h.id)}
                className={cn(
                  "press hover:bg-accent w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                  selected === h.id && "bg-accent",
                )}
              >
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <TypeDot type={n.type} />
                  <span className="truncate">
                    {caseName(n.case_id) ?? TYPE_LABEL[n.type]}
                    {n.date ? ` · ${fmtDate(n.date, { day: "numeric", month: "short", year: "numeric" })}` : ""}
                  </span>
                  <span className="ml-auto flex shrink-0 gap-1">
                    {h.keyword > 0 && <MatchTag>words</MatchTag>}
                    {h.semantic > 0 && <MatchTag>meaning</MatchTag>}
                  </span>
                </div>
                <p className="mt-1 line-clamp-3 text-[13.5px] leading-snug">
                  <Highlight text={h.snippet} terms={h.terms} />
                </p>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Overview({
  graph,
  caseFilter,
  nodeById,
  onPick,
}: {
  graph?: { counts: { notes: number; memories: number; cases: number }; nodes: GraphNode[] };
  caseFilter: string | null;
  nodeById: Map<string, GraphNode>;
  onPick: (id: string) => void;
}) {
  if (!graph) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (caseFilter) {
    const c = nodeById.get(`c:${caseFilter}`);
    const items = graph.nodes
      .filter((n) => n.case_id === caseFilter && n.type !== "case")
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    return (
      <section aria-label={c?.label} className="flex min-h-0 flex-col">
        <div className="px-1 pb-2">
          <div className="font-medium">{c?.label}</div>
          <div className="text-muted-foreground text-sm tnum">
            {c?.sub} · {items.length} items, newest first
          </div>
        </div>
        <ol className="-mx-1 flex min-h-0 flex-col gap-1 overflow-y-auto px-1">
          {items.map((n) => (
            <li key={n.id}>
              <button onClick={() => onPick(n.id)} className="press hover:bg-accent w-full rounded-xl px-3 py-2 text-left">
                <div className="text-muted-foreground flex items-center gap-2 text-xs tnum">
                  <TypeDot type={n.type} />
                  {TYPE_LABEL[n.type]} · {fmtDate(n.date, { day: "numeric", month: "short", year: "numeric" })}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[13.5px] leading-snug">{n.label}</p>
              </button>
            </li>
          ))}
        </ol>
      </section>
    );
  }
  return (
    <section className="text-muted-foreground px-1 text-sm leading-relaxed">
      <p className="text-foreground">
        <span className="tnum font-semibold"><CountUp to={graph.counts.notes} duration={0.9} /></span> notes, orders and documents across{" "}
        <span className="tnum font-semibold">{graph.counts.cases}</span> cases
        {graph.counts.memories ? (
          <>
            , and <span className="tnum font-semibold">{graph.counts.memories}</span> things remembered from chats
          </>
        ) : null}
        .
      </p>
      <p className="mt-3">
        Lines join each note to its case, to the hearing before it, and to notes about the same things in other cases. A
        case’s judge, opposing counsel and client hang off it.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        <li>
          <span className="text-foreground font-medium">Words</span> finds the words you type, even misspelt: “seabreze
          adjurnment”.
        </li>
        <li>
          <span className="text-foreground font-medium">Meaning</span> finds notes about the same thing in other words: “sale
          signed by only one owner”.
        </li>
        <li>
          <span className="text-foreground font-medium">A case</span> in the graph or the row above shows only its notes.
        </li>
      </ul>
    </section>
  );
}

function NoteReader({ node, terms, onClose, inSheet }: { node: GraphNode; terms: string[]; onClose: () => void; inSheet?: boolean }) {
  const router = useRouter();
  const isEntry = node.id.startsWith("e:");
  const { data: entry, error } = useEntry(isEntry ? node.id.slice(2) : null);
  const [opening, setOpening] = useState(false);

  const ask = async () => {
    setOpening(true);
    try {
      const c = await api.newChat(`About · ${entry?.short_name ?? "a note"} ${entry?.hearing_date ?? ""}`.trim(), node.case_id ?? null);
      chatsChanged();
      const q = `About the ${TYPE_LABEL[node.type].toLowerCase()} of ${fmtDate(node.date)}${entry?.short_name ? ` in ${entry.short_name}` : ""}: `;
      router.push(`/chat/${c.id}?q=${encodeURIComponent(q)}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t start the chat");
      setOpening(false);
    }
  };

  const text = isEntry ? entry?.text : node.label;
  return (
    <article className="fade bg-card border-border flex min-h-0 flex-col rounded-2xl border shadow-[var(--shadow-soft)] max-lg:rounded-none max-lg:border-0 max-lg:shadow-none">
      <header className="border-border flex items-start gap-3 border-b px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="text-muted-foreground flex items-center gap-2 text-xs tnum">
            <TypeDot type={node.type} />
            {TYPE_LABEL[node.type]}
            {node.date ? ` · ${fmtDate(node.date, { day: "numeric", month: "long", year: "numeric" })}` : ""}
            {node.author ? ` · ${node.author}` : ""}
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">{entry?.short_name ?? (node.kind ? `${node.kind} from a chat` : TYPE_LABEL[node.type])}</h2>
          {entry?.case_number && <div className="text-muted-foreground text-sm tnum">{entry.case_number}</div>}
        </div>
        <button onClick={onClose} hidden={inSheet} className="press text-muted-foreground hover:text-foreground hover:bg-accent grid size-9 shrink-0 place-items-center rounded-lg" aria-label="Close note">
          <X className="size-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {isEntry && !entry && !error && (
          <div className="flex flex-col gap-3" role="status" aria-label="Loading note">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        )}
        {error && <p className="text-muted-foreground text-sm">{error.message}</p>}

        {entry?.files.map((f) => <Original key={f.name} name={f.name} kind={f.kind} url={`/backend${f.url}`} />)}

        {text && (
          <div className="mt-4 first:mt-0">
            <div className="text-muted-foreground mb-1.5 text-xs font-medium">{isEntry ? "Text read from it" : "What was remembered"}</div>
            <p className="text-[14.5px] leading-relaxed whitespace-pre-line">
              <Highlight text={text} terms={terms} />
            </p>
          </div>
        )}
      </div>

      {node.case_id && (
        <footer className="border-border flex flex-wrap gap-2 border-t px-5 py-3">
          <button
            onClick={ask}
            disabled={opening}
            className="press bg-primary text-primary-foreground inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium disabled:opacity-60"
          >
            {opening ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowUpRight className="size-4" aria-hidden />}
            Ask about this
          </button>
        </footer>
      )}
    </article>
  );
}

/** The original as it was uploaded: the photo, the PDF, or a link for other files. */
function Original({ name, kind, url }: { name: string; kind: string | null; url: string }) {
  const isImage = kind === "image" || /\.(jpe?g|png|webp|heic|gif)$/i.test(name);
  const isPdf = kind === "pdf" || /\.pdf$/i.test(name);
  const [loaded, setLoaded] = useState(false);
  if (isImage)
    return (
      <a href={url} target="_blank" rel="noreferrer" className="group bg-muted relative mb-3 block overflow-hidden rounded-xl" aria-label={`Open ${name} full size`}>
        {!loaded && <Skeleton className="aspect-[3/4] w-full rounded-none" />}
        {/* eslint-disable-next-line @next/next/no-img-element -- originals come from the backend, sized as uploaded */}
        <img
          src={url}
          alt={`Original: ${name}`}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={cn("w-full object-contain transition-opacity duration-300", loaded ? "opacity-100" : "absolute inset-0 opacity-0")}
        />
        <span className="bg-background/85 text-foreground absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <ExternalLink className="size-3" aria-hidden /> Full size
        </span>
      </a>
    );
  if (isPdf)
    return (
      <div className="mb-3">
        <iframe src={url} title={name} className="border-border h-[60dvh] w-full rounded-xl border bg-white" />
        <a href={url} target="_blank" rel="noreferrer" className="text-foreground mt-1.5 inline-flex items-center gap-1 text-sm font-medium hover:underline">
          <ExternalLink className="size-3.5" aria-hidden /> Open PDF
        </a>
      </div>
    );
  return (
    <a href={url} target="_blank" rel="noreferrer" className="press border-border hover:bg-accent mb-3 flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm">
      <FileText className="text-muted-foreground size-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <ExternalLink className="text-muted-foreground size-4" aria-hidden />
    </a>
  );
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const parts = useMemo(() => {
    const clean = terms.filter((t) => t && t.length > 1).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!clean.length) return [text];
    return text.split(new RegExp(`(${clean.join("|")})`, "gi"));
  }, [text, terms]);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-memo-soft text-foreground rounded-sm px-0.5">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function TypeDot({ type }: { type: GraphNode["type"] }) {
  const cls =
    type === "note" ? "bg-primary" : type === "order_sheet" ? "bg-memo" : type === "document" ? "bg-chart-3" : type === "memory" ? "bg-tape" : "bg-muted-foreground";
  return <span className={cn("size-2 shrink-0 rounded-full", cls)} aria-hidden />;
}

function MatchTag({ children }: { children: React.ReactNode }) {
  return <span className="bg-muted text-muted-foreground rounded px-1.5 py-px text-[10.5px] font-medium">{children}</span>;
}
