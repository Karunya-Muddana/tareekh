import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";

// Answers take 5-25 s: recall from Hindsight, then Gemini writes the answer.
export const maxDuration = 120;

const BACKEND = process.env.TAREEKH_BACKEND_URL ?? "http://127.0.0.1:8000";

export type SourcesData = {
  citations: {
    n: number;
    text: string;
    type?: string;
    case_id?: string;
    hearing_date?: string;
    source_file?: string;
    doc_type?: string;
  }[];
  learned: { id: string; text: string; case_id?: string | null; kind?: string }[];
  seconds?: number;
  mode?: string;
};

/**
 * One chat turn. The browser (AI SDK useChat) posts the thread; FastAPI answers the newest question with the chat's
 * stored history; the answer is streamed back as UI message parts: the text, then a `data-sources` part with the
 * citations and anything Tareekh decided to remember from this message.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { messages, quick, caseId }: { messages: UIMessage[]; quick?: boolean; caseId?: string | null } =
    await req.json();
  const last = messages.at(-1);
  const question = (last?.parts ?? [])
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const res = await fetch(`${BACKEND}/chats/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, quick: quick ?? true, case_id: caseId ?? null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Tareekh backend returned ${res.status}`);
      }
      const r = await res.json();

      // Stream the finished answer in small word runs so it reads in rather than landing as a block.
      const textId = crypto.randomUUID();
      writer.write({ type: "text-start", id: textId });
      const runs: string[] = (r.answer as string).match(/\S+\s*/g) ?? [];
      for (let i = 0; i < runs.length; i += 3) {
        writer.write({ type: "text-delta", id: textId, delta: runs.slice(i, i + 3).join("") });
        await new Promise((ok) => setTimeout(ok, 12));
      }
      writer.write({ type: "text-end", id: textId });

      const data: SourcesData = {
        citations: r.citations ?? [],
        learned: r.meta?.learned ?? [],
        seconds: r.meta?.seconds,
        mode: r.meta?.mode,
      };
      writer.write({ type: "data-sources", data });
    },
    onError: (e) => (e instanceof Error ? e.message : String(e)),
  });

  return createUIMessageStreamResponse({ stream });
}
