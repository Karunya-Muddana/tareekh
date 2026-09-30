// Typed calls to the FastAPI backend (proxied at /backend by next.config.ts).

import { invalidate, load, prefetch, useCached } from "@/lib/cache";

export type Practice = { lawyer: string; lawyer_short: string; assistant: string; assistant_short: string; city: string };
export type CaseRow = { id: string; case_number: string; short_name: string; title: string; judge_id: string };
export type ChatRow = { id: string; title: string; case_id: string | null; updated_at: string; last: string | null };
export type StoredMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  citations: unknown[];
  meta: { mode?: string; seconds?: number; learned?: unknown[]; prompt_tokens?: number | null };
  created_at: string;
};
export type Hearing = {
  case_id: string;
  case_number: string;
  short_name: string;
  title: string;
  date: string;
  listed_for: string | null;
  court_hall: string | null;
  judge: string;
  judge_id: string;
  counsel: string;
  client: string;
  represents: string;
  last: { date: string; by: string; text: string; source_file: string } | null;
};
export type Today = {
  today: string;
  practice: Practice;
  hearings: Hearing[];
  upcoming: Hearing[];
  judges: Record<string, { name: string; profile: string | null }>;
  commitments: string | null;
  recent: { case_id: string; hearing_date: string; author: string; doc_type: string; text: string }[];
};
export type GraphNodeType = "note" | "order_sheet" | "document" | "memory" | "case" | "judge" | "counsel" | "client";
export type GraphNode = { id: string; type: GraphNodeType; label: string; sub?: string; case_id?: string | null; date?: string; author?: string | null; kind?: string; file?: string };
export type GraphLinkType = "case" | "entity" | "temporal" | "semantic" | "memory";
export type GraphLink = { source: string; target: string; type: GraphLinkType; weight?: number };
export type Graph = { nodes: GraphNode[]; links: GraphLink[]; counts: { notes: number; memories: number; cases: number } };
export type SearchMode = "both" | "keyword" | "semantic";
export type SearchHit = { id: string; score: number; keyword: number; semantic: number; terms: string[]; snippet: string };
export type GraphSearch = { query: string; mode: SearchMode; results: SearchHit[]; semantic_source: "memory" | "local" | null };
export type EntryDetail = {
  id: string; case_id: string | null; short_name: string | null; case_number: string | null; hearing_date: string | null;
  author: string | null; doc_type: string; text: string; source_file: string;
  files: { name: string; kind: string | null; url: string }[];
};
export type Insights = { commitments: string | null; judges: Today["judges"] };
export type CalendarEvent = { date: string; case_id: string; short_name: string; kind: "hearing" | "listed" };
export type ChatMemory = { id: string; chat_id: string; case_id: string | null; text: string; kind: string; created_at: string; chat_title: string | null };
export type ChatContext = {
  budget: number;
  used: number;
  compress_at: number;
  summary_tokens: number;
  recent_tokens: number;
  recent_messages: number;
  summarized_messages: number;
  can_compress: boolean;
  compressing: boolean;
  summary: string | null;
  last_prompt_tokens: number | null;
  model_window: number;
};
export type MemoryStatus = { pending_operations: number; pending_consolidation: number; total_documents: number; total_observations: number };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/backend${path}`, init);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.detail ?? `Request failed (${r.status})`);
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

export const api = {
  health: () => call<{ practice: Practice; today: string }>("/health"),
  status: () => call<MemoryStatus>("/memory/status"),
  cases: () => call<CaseRow[]>("/cases"),
  today: () => call<Today>("/today"),
  todayInsights: () => call<Insights>("/today/insights"),
  calendar: (month: string) => call<{ month: string; today: string; events: CalendarEvent[] }>(`/calendar?month=${month}`),
  chats: () => call<ChatRow[]>("/chats"),
  chat: (id: string) => call<ChatRow & { messages: StoredMessage[]; context: ChatContext }>(`/chats/${id}`),
  chatContext: (id: string) => call<ChatContext>(`/chats/${id}/context`),
  compressChat: (id: string) => call<ChatContext>(`/chats/${id}/compress`, { method: "POST" }),
  newChat: (title?: string, caseId?: string | null) => call<ChatRow>("/chats", json("POST", { title, case_id: caseId ?? null })),
  deleteChat: (id: string) => call<{ deleted: string }>(`/chats/${id}`, { method: "DELETE" }),
  chatMemories: () => call<ChatMemory[]>("/chat-memories"),
  forgetMemory: (id: string) => call<{ forgotten: string }>(`/chat-memories/${id}`, { method: "DELETE" }),
  graph: () => call<Graph>("/graph"),
  graphSearch: (q: string, mode: SearchMode, signal?: AbortSignal) =>
    call<GraphSearch>(`/graph/search?q=${encodeURIComponent(q)}&mode=${mode}`, { signal }),
  entry: (id: string) => call<EntryDetail>(`/entries/${id}`),
  upload: (fd: FormData) => call<{ upload_id: string }>("/uploads", { method: "POST", body: fd }),
  getUpload: (id: string) => call<Upload>(`/uploads/${id}`),
  confirm: (id: string, edits: unknown[]) => call<unknown>(`/uploads/${id}/confirm`, json("POST", { edits })),
};

export type UploadEntry = {
  id: string;
  source_file: string;
  case_id: string | null;
  hearing_date: string | null;
  author: string | null;
  doc_type: string;
  text: string;
  confidence: number | null;
  reason: string | null;
  status: string;
};
export type Upload = { id: string; status: string; error: string | null; files: string[]; entries: UploadEntry[] };

// Anything that changes the chat list tells the sidebar (and Today's chat memories) to refresh.
export const CHATS_CHANGED = "tareekh:chats-changed";
export const chatsChanged = () => {
  invalidate("chats");
  invalidate("chat-memories");
  window.dispatchEvent(new Event(CHATS_CHANGED));
};

// ---- cached reads (stale-while-revalidate, see lib/cache.ts)
const MIN = 60_000;
export const useHealth = () => useCached("health", api.health, { maxAge: 10 * MIN, persist: true });
export const useToday = () => useCached("today", api.today, { maxAge: MIN, persist: true });
export const useInsights = () => useCached("today-insights", api.todayInsights, { maxAge: 2 * MIN, persist: true });
export const useChats = () => useCached("chats", api.chats, { maxAge: 30_000, persist: true });
export const useCases = () => useCached("cases", api.cases, { maxAge: 10 * MIN, persist: true });
export const useChatMemories = () => useCached("chat-memories", api.chatMemories, { maxAge: 30_000, persist: true });
export const useMemoryStatus = () => useCached("status", api.status, { maxAge: 15_000, refreshInterval: 15_000 });
export const useGraph = () => useCached("graph", api.graph, { maxAge: MIN });
export const useEntry = (id: string | null) => useCached(id ? `entry:${id}` : null, () => api.entry(id!), { maxAge: 10 * MIN });
export const useCalendar = (month: string | null) =>
  useCached(month ? `calendar:${month}` : null, () => api.calendar(month!), { maxAge: 5 * MIN });

// Chats are cached only briefly (their messages change as you talk), mostly so hover-prefetch makes opening instant.
export const chatKey = (id: string) => `chat:${id}`;
export const prefetchChat = (id: string) => prefetch(chatKey(id), () => api.chat(id), { maxAge: 15_000 });
export const loadChat = (id: string) => load(chatKey(id), () => api.chat(id), { maxAge: 15_000 });

export const fmtDate = (iso?: string | null, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) => {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(+d) ? iso : d.toLocaleDateString("en-IN", opts);
};
