"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { UIMessage } from "ai";
import { TopBar } from "@/components/app-shell";
import { ChatView, toUIMessages } from "@/components/tareekh-chat";
import { Skeleton } from "@/components/ui/skeleton";
import { api, chatKey, loadChat, useCases, useToday, type ChatContext } from "@/lib/api";
import { ContextMeter } from "@/components/context-meter";
import { toast } from "@/components/app-shell";
import { chatSuggestions } from "@/lib/suggestions";
import { forget } from "@/lib/cache";
import { useSession } from "@/lib/session";
import RubberSegment from "@/components/bits/RubberSegment";
import { AudioLines } from "lucide-react";
import { VoiceMode } from "@/components/voice/voice-mode";

const MODE_KEY = "tareekh:quick";

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useSearchParams().get("q");
  const [chat, setChat] = useState<{ title: string; case_id: string | null; initial: UIMessage[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: caseList } = useCases();
  const { data: today } = useToday();
  const user = useSession();
  const lawyer = user?.name.replace(/^adv\.?\s+/i, "").split(" ")[0];
  const [quick, setQuick] = useState(true);
  const [ctx, setCtx] = useState<ChatContext | null>(null);
  const [voice, setVoice] = useState(false);
  const [version, setVersion] = useState(0);

  // Back from voice mode: the spoken turns are in the chat now, so show them.
  const reload = useCallback(() => {
    forget(chatKey(id));
    api
      .chat(id)
      .then((c) => {
        setChat({ title: c.title, case_id: c.case_id, initial: toUIMessages(c.messages) });
        setCtx(c.context);
        setVersion((v) => v + 1);
      })
      .catch(() => {});
  }, [id]);

  const refreshContext = useCallback(() => {
    api.chatContext(id).then(setCtx).catch(() => {});
  }, [id]);

  // While the backend is summarising older turns, keep the meter live until it's done.
  useEffect(() => {
    if (!ctx?.compressing) return;
    const t = setTimeout(refreshContext, 1500);
    return () => clearTimeout(t);
  }, [ctx, refreshContext]);

  const compress = () => {
    setCtx((c) => (c ? { ...c, compressing: true } : c));
    api
      .compressChat(id)
      .then((c) => {
        setCtx(c);
        toast(c.summarized_messages ? `Summarised ${c.summarized_messages} earlier messages` : "Nothing to compress yet");
      })
      .catch((e) => {
        refreshContext();
        toast(e instanceof Error ? e.message : "Couldn’t compress this chat");
      });
  };

  useEffect(() => {
    try {
      const v = localStorage.getItem(MODE_KEY);
      if (v != null) setQuick(v === "1");
    } catch {}
  }, []);

  useEffect(() => {
    setChat(null);
    setError(null);
    setCtx(null);
    // Usually already in the cache from hovering the sidebar link, so this resolves at once.
    loadChat(id)
      .then((c) => {
        setChat({ title: c.title, case_id: c.case_id, initial: toUIMessages(c.messages) });
        if (c.context) setCtx(c.context);   // shown at once from the (possibly prefetched) copy, then made current
        refreshContext();
      })
      .catch((e) => setError(e.message));
    // Messages change while you talk here; don't reopen this chat from a stale copy.
    return () => forget(chatKey(id));
  }, [id, refreshContext]);

  const setMode = (v: boolean) => {
    setQuick(v);
    try {
      localStorage.setItem(MODE_KEY, v ? "1" : "0");
    } catch {}
  };

  const scoped = chat?.case_id ? caseList?.find((c) => c.id === chat.case_id) : undefined;

  return (
    <div className="flex h-dvh flex-col">
      <title>{chat?.title ? `${chat.title} · Tareekh` : "Tareekh"}</title>
      <TopBar
        title={
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{chat?.title ?? ""}</span>
            {scoped && (
              <span className="bg-accent text-muted-foreground fade hidden shrink-0 rounded-md px-1.5 py-0.5 text-xs font-normal sm:inline">
                {scoped.short_name}
              </span>
            )}
          </span>
        }
        right={
          <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setVoice(true)}
            disabled={!chat}
            className="press text-muted-foreground hover:text-foreground hover:bg-accent grid size-9 place-items-center rounded-lg disabled:opacity-40"
            aria-label="Voice mode"
            title="Voice mode: ask out loud, hear the answer"
          >
            <AudioLines className="size-[18px]" aria-hidden />
          </button>
          <ContextMeter ctx={ctx} onCompress={compress} />
          <div title="Quick: one search, a few seconds. Deep: searches across cases, about 25 s." className="shrink-0">
            <RubberSegment
              aria-label="Answer depth"
              size="sm"
              value={quick ? "quick" : "deep"}
              onChange={(v) => setMode(v === "quick")}
              items={[
                { value: "quick", label: "Quick" },
                { value: "deep", label: "Deep" },
              ]}
              trackColor="var(--muted)"
              thumbColor="var(--foreground)"
              textColor="var(--muted-foreground)"
              activeTextColor="var(--background)"
              radius={9}
            />
          </div>
          </div>
        }
      />
      <div className="min-h-0 flex-1">
        {error ? (
          <div className="mx-auto max-w-md px-6 py-16 text-center">
            <p className="title-xl text-3xl">This chat isn’t here</p>
            <p className="text-muted-foreground mt-2 text-sm">{error}</p>
          </div>
        ) : !chat ? (
          <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 pt-8" role="status" aria-label="Loading chat">
            <Skeleton className="ml-auto h-9 w-2/5 rounded-xl" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </div>
        ) : (
          <ChatView
            key={`${id}:${version}`}
            chatId={id}
            initial={chat.initial}
            caseId={chat.case_id}
            quick={quick}
            firstMessage={q}
            lawyerName={lawyer}
            suggestions={chatSuggestions(today, caseList, chat.case_id)}
            onTurnDone={refreshContext}
          />
        )}
      </div>
      <VoiceMode
        open={voice}
        onClose={(changed) => {
          setVoice(false);
          if (changed) reload();
        }}
        chatId={id}
        caseId={chat?.case_id ?? null}
        quick={quick}
        scope={scoped?.short_name ?? chat?.title}
      />
    </div>
  );
}
