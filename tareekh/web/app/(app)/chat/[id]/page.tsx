"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { UIMessage } from "ai";
import { TopBar } from "@/components/app-shell";
import { ChatView, toUIMessages } from "@/components/tareekh-chat";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type CaseRow } from "@/lib/api";
import { cn } from "@/lib/utils";

const MODE_KEY = "tareekh:quick";

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useSearchParams().get("q");
  const [chat, setChat] = useState<{ title: string; case_id: string | null; initial: UIMessage[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cases, setCases] = useState<Record<string, CaseRow>>({});
  const [lawyer, setLawyer] = useState<string>();
  const [quick, setQuick] = useState(true);

  useEffect(() => {
    try {
      const v = localStorage.getItem(MODE_KEY);
      if (v != null) setQuick(v === "1");
    } catch {}
    api.cases().then((cs) => setCases(Object.fromEntries(cs.map((c) => [c.id, c])))).catch(() => {});
    api.health().then((h) => setLawyer(h.practice.lawyer_short)).catch(() => {});
  }, []);

  useEffect(() => {
    setChat(null);
    api
      .chat(id)
      .then((c) => setChat({ title: c.title, case_id: c.case_id, initial: toUIMessages(c.messages) }))
      .catch((e) => setError(e.message));
  }, [id]);

  const setMode = (v: boolean) => {
    setQuick(v);
    try {
      localStorage.setItem(MODE_KEY, v ? "1" : "0");
    } catch {}
  };

  const scoped = chat?.case_id ? cases[chat.case_id] : undefined;

  return (
    <div className="flex h-dvh flex-col">
      <title>{chat?.title ? `${chat.title} · Tareekh` : "Tareekh"}</title>
      <TopBar
        title={
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{chat?.title ?? ""}</span>
            {scoped && (
              <span className="bg-accent text-muted-foreground shrink-0 rounded-md px-1.5 py-0.5 text-xs font-normal">
                {scoped.short_name}
              </span>
            )}
          </span>
        }
        right={
          <div
            role="radiogroup"
            aria-label="Answer depth"
            className="bg-muted flex shrink-0 rounded-lg p-0.5 text-[13px]"
            title="Quick: one search, a few seconds. Deep: searches across cases, about 25 s."
          >
            {[
              ["Quick", true],
              ["Deep", false],
            ].map(([label, v]) => (
              <button
                key={label as string}
                role="radio"
                aria-checked={quick === v}
                onClick={() => setMode(v as boolean)}
                className={cn(
                  "press rounded-md px-2.5 py-1 font-medium",
                  quick === v ? "bg-background text-foreground shadow-[var(--shadow-soft)]" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label as string}
              </button>
            ))}
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
            key={id}
            chatId={id}
            initial={chat.initial}
            caseId={chat.case_id}
            quick={quick}
            firstMessage={q}
            lawyerName={lawyer}
          />
        )}
      </div>
    </div>
  );
}
