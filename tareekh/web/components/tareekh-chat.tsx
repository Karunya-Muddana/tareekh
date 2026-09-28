"use client";

import { Children, cloneElement, isValidElement, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useAISDKRuntime } from "@assistant-ui/ai-sdk";
import { AssistantRuntimeProvider, ThreadPrimitive, makeAssistantDataUI, useAuiState } from "@assistant-ui/react";
import { BookmarkCheck, FileText, MessageSquareQuote, Undo2 } from "lucide-react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { api, chatsChanged, fmtDate, type StoredMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SourcesData } from "@/app/api/chat/[id]/route";

// ---------------------------------------------------------------- stored history -> AI SDK messages
export function toUIMessages(rows: StoredMessage[]): UIMessage[] {
  return rows.map((m) => ({
    id: `m${m.id}`,
    role: m.role,
    parts: [
      { type: "text", text: m.content },
      ...(m.role === "assistant"
        ? [
            {
              type: "data-sources" as const,
              data: {
                citations: m.citations,
                learned: m.meta?.learned ?? [],
                seconds: m.meta?.seconds,
                mode: m.meta?.mode,
              } as SourcesData,
            },
          ]
        : []),
    ],
  })) as UIMessage[];
}

// ---------------------------------------------------------------- citations inside the answer text
const CITE_EVENT = "tareekh:cite";
const CITE_RE = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

function CiteMark({ n }: { n: number }) {
  const messageId = useAuiState((s) => s.message.id);
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(CITE_EVENT, { detail: { messageId, n } }))}
      className="press bg-tape-soft text-tape hover:bg-tape/20 mx-px inline-grid h-[18px] min-w-[18px] translate-y-[-1px] place-items-center rounded-[5px] px-1 align-middle text-[11px] leading-none font-semibold tabular-nums"
      aria-label={`Source ${n}`}
    >
      {n}
    </button>
  );
}

function withCites(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") {
      const out: ReactNode[] = [];
      let last = 0;
      for (const m of child.matchAll(CITE_RE)) {
        out.push(child.slice(last, m.index));
        for (const n of m[1].split(/\s*,\s*/)) out.push(<CiteMark key={`${m.index}-${n}`} n={Number(n)} />);
        last = (m.index ?? 0) + m[0].length;
      }
      out.push(child.slice(last));
      return out;
    }
    if (isValidElement<{ children?: ReactNode }>(child) && child.props.children) {
      return cloneElement(child, undefined, withCites(child.props.children));
    }
    return child;
  });
}

type MdProps = { children?: ReactNode; className?: string };
export const citeMarkdownComponents = {
  p: ({ children, className }: MdProps) => <p className={cn("aui-md-p", className)}>{withCites(children)}</p>,
  li: ({ children, className }: MdProps) => <li className={cn("aui-md-li", className)}>{withCites(children)}</li>,
};

// ---------------------------------------------------------------- sources + learned memories under each answer
type Citation = SourcesData["citations"][number];

function groupSources(citations: Citation[]) {
  // One document can be filed under several cases (the sale deed); show it once.
  const map = new Map<string, Citation & { ns: number[]; cases: Set<string> }>();
  for (const c of citations) {
    const key = `${c.source_file ?? c.type}|${c.hearing_date}`;
    const g = map.get(key) ?? { ...c, ns: [], cases: new Set<string>() };
    g.ns.push(c.n);
    if (c.case_id) g.cases.add(c.case_id);
    map.set(key, g);
  }
  return [...map.values()];
}

function SourcesPart({ data }: { data: SourcesData }) {
  const messageId = useAuiState((s) => s.message.id);
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<number | null>(null);
  const [forgotten, setForgotten] = useState<Set<string>>(new Set());
  const groups = useMemo(() => groupSources(data.citations ?? []), [data.citations]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d.messageId !== messageId) return;
      setFocus(d.n);
      setOpen(true);
    };
    window.addEventListener(CITE_EVENT, on);
    return () => window.removeEventListener(CITE_EVENT, on);
  }, [messageId]);

  useEffect(() => {
    if (!open || focus == null) return;
    const t = setTimeout(() => {
      listRef.current?.querySelector(`[data-n~="${focus}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 220);
    return () => clearTimeout(t);
  }, [open, focus]);

  const forget = (id: string) => {
    setForgotten((s) => new Set(s).add(id));
    const timer = setTimeout(() => api.forgetMemory(id).catch(() => {}), 5000);
    window.dispatchEvent(
      new CustomEvent("tareekh:toast", {
        detail: {
          text: "Forgotten",
          action: "Undo",
          onAction: () => {
            clearTimeout(timer);
            setForgotten((s) => {
              const n = new Set(s);
              n.delete(id);
              return n;
            });
          },
        },
      }),
    );
  };

  const learned = (data.learned ?? []).filter((l) => !forgotten.has(l.id));
  const chatMemoryCount = groups.filter((g) => g.doc_type === "chat_memory").length;

  return (
    <div className="mt-3 flex flex-col gap-2">
      {groups.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setFocus(null);
            setOpen(true);
          }}
          className="press text-muted-foreground hover:text-foreground hover:bg-accent -ml-1 flex w-fit items-center gap-2 rounded-lg px-2 py-1.5 text-[13px]"
        >
          <span className="flex -space-x-1.5" aria-hidden>
            {groups.slice(0, 3).map((g, i) => (
              <span
                key={i}
                className={cn(
                  "border-background grid size-5 place-items-center rounded-full border-2 text-[9px] font-semibold",
                  g.doc_type === "chat_memory" ? "bg-memo-soft text-memo" : "bg-muted text-foreground",
                )}
              >
                {g.doc_type === "chat_memory" ? <MessageSquareQuote className="size-2.5" /> : <FileText className="size-2.5" />}
              </span>
            ))}
          </span>
          <span className="tnum">
            {groups.length} source{groups.length > 1 ? "s" : ""}
            {chatMemoryCount > 0 && ` · ${chatMemoryCount} from chats`}
            {data.seconds != null && ` · ${Math.round(data.seconds)} s`}
          </span>
        </button>
      )}

      {learned.map((l) => (
        <div
          key={l.id}
          className="border-memo/25 bg-memo-soft/60 animate-in fade-in slide-in-from-bottom-1 flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] duration-300 motion-reduce:animate-none"
        >
          <BookmarkCheck className="text-memo mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-memo text-[11px] font-semibold tracking-wide uppercase">Remembered from this chat</div>
            <div className="text-foreground/90 mt-0.5 leading-snug">{l.text}</div>
          </div>
          <button
            onClick={() => forget(l.id)}
            className="press text-muted-foreground hover:text-foreground -mr-1 flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs"
          >
            <Undo2 className="size-3.5" /> Forget
          </button>
        </div>
      ))}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "gap-0 p-0",
            isMobile ? "max-h-[82dvh] rounded-t-2xl" : "w-[440px] sm:max-w-[440px]",
          )}
        >
          {isMobile && <div className="bg-muted-foreground/30 mx-auto mt-2.5 h-1 w-9 rounded-full" aria-hidden />}
          <SheetHeader className="px-5 pt-4 pb-2">
            <SheetTitle className="title-xl text-2xl">Sources</SheetTitle>
            <p className="text-muted-foreground text-xs">From notes, order sheets and documents. Chat memories are marked.</p>
          </SheetHeader>
          <div ref={listRef} className="fade-y flex-1 overflow-y-auto overscroll-contain px-3 pb-6">
            {groups.map((g) => {
              const memo = g.doc_type === "chat_memory";
              return (
                <div
                  key={`${g.source_file}-${g.hearing_date}`}
                  data-n={g.ns.join(" ")}
                  className={cn(
                    "rounded-xl px-3 py-3 transition-colors duration-500",
                    g.ns.includes(focus ?? -1) && "bg-tape-soft/60",
                  )}
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px]">
                    <span className="text-tape tnum font-semibold">{g.ns.join(", ")}</span>
                    {memo ? (
                      <span className="bg-memo-soft text-memo rounded-md px-1.5 py-px text-[11px] font-semibold">Chat memory</span>
                    ) : (
                      <span className="font-medium">{[...g.cases].join(" · ")}</span>
                    )}
                    <span className="text-muted-foreground tnum">{fmtDate(g.hearing_date)}</span>
                  </div>
                  <div className="text-muted-foreground mt-0.5 truncate font-mono text-[11px]" translate="no">
                    {g.source_file}
                  </div>
                  <p className="text-foreground/85 mt-1.5 text-[13.5px] leading-relaxed">{g.text}</p>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

const SourcesUI = makeAssistantDataUI<SourcesData>({ name: "sources", render: ({ data }) => <SourcesPart data={data} /> });

// ---------------------------------------------------------------- empty chat
function Welcome({ name, suggestions }: { name?: string; suggestions: string[] }) {
  return (
    <div className="mb-8 flex flex-col px-2">
      <h1 className="title-xl animate-in fade-in slide-in-from-bottom-1 text-[40px] duration-300 motion-reduce:animate-none md:text-5xl">
        {name ? `What do you need, ${name}?` : "What do you need?"}
      </h1>
      <p className="text-muted-foreground mt-2 max-w-md text-[15px]">
        Ask about any hearing, witness, order or deadline. Answers cite the note they came from.
      </p>
      <div className="mt-6 flex flex-col">
        {suggestions.map((s, i) => (
          <ThreadPrimitive.Suggestion
            key={s}
            prompt={s}
            send
            className="press text-muted-foreground hover:text-foreground hover:bg-accent animate-in fade-in slide-in-from-bottom-1 fill-mode-both -mx-2 flex items-baseline gap-3 rounded-lg px-2 py-2.5 text-left text-[15px] duration-300 motion-reduce:animate-none"
            style={{ animationDelay: `${80 + i * 40}ms` }}
          >
            <span>{s}</span>
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  );
}

const DEFAULT_SUGGESTIONS = [
  "How much of the land does Srinivas say he owns?",
  "Did Seabreeze do any work on the land before the injunction?",
  "What does Murthy sir do when the other side keeps asking for time?",
  "What is pending from our side this week?",
];

// ---------------------------------------------------------------- the chat
export function ChatView({
  chatId,
  initial,
  caseId,
  quick,
  firstMessage,
  lawyerName,
}: {
  chatId: string;
  initial: UIMessage[];
  caseId: string | null;
  quick: boolean;
  firstMessage?: string | null;
  lawyerName?: string;
}) {
  const settings = useRef({ quick, caseId });
  settings.current = { quick, caseId };

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/chat/${chatId}`,
        // FastAPI keeps the history, so only the newest message travels; the mode and case ride along.
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { messages: messages.slice(-1), quick: settings.current.quick, caseId: settings.current.caseId },
        }),
      }),
    [chatId],
  );

  const chat = useChat({
    id: chatId,
    messages: initial,
    transport,
    onFinish: () => chatsChanged(),
  });
  const runtime = useAISDKRuntime(chat);

  const sent = useRef(false);
  useEffect(() => {
    if (firstMessage && !sent.current && initial.length === 0) {
      sent.current = true;
      chat.sendMessage({ text: firstMessage });
    }
  }, [firstMessage, initial.length, chat]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <SourcesUI />
      <Thread
        components={{
          Welcome: () => <Welcome name={lawyerName} suggestions={DEFAULT_SUGGESTIONS} />,
        }}
      />
    </AssistantRuntimeProvider>
  );
}
