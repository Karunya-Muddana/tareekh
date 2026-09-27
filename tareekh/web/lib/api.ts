// Typed calls to the FastAPI backend (proxied at /backend by next.config.ts).

export type Practice = { lawyer: string; lawyer_short: string; assistant: string; assistant_short: string; city: string };
export type CaseRow = { id: string; case_number: string; short_name: string; title: string; judge_id: string };
export type ChatRow = { id: string; title: string; case_id: string | null; updated_at: string; last: string | null };
export type StoredMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  citations: unknown[];
  meta: { mode?: string; seconds?: number; learned?: unknown[] };
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
export type CalendarEvent = { date: string; case_id: string; short_name: string; kind: "hearing" | "listed" };
export type ChatMemory = { id: string; chat_id: string; case_id: string | null; text: string; kind: string; created_at: string; chat_title: string | null };
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
  calendar: (month: string) => call<{ month: string; today: string; events: CalendarEvent[] }>(`/calendar?month=${month}`),
  chats: () => call<ChatRow[]>("/chats"),
  chat: (id: string) => call<ChatRow & { messages: StoredMessage[] }>(`/chats/${id}`),
  newChat: (title?: string, caseId?: string | null) => call<ChatRow>("/chats", json("POST", { title, case_id: caseId ?? null })),
  deleteChat: (id: string) => call<{ deleted: string }>(`/chats/${id}`, { method: "DELETE" }),
  chatMemories: () => call<ChatMemory[]>("/chat-memories"),
  forgetMemory: (id: string) => call<{ forgotten: string }>(`/chat-memories/${id}`, { method: "DELETE" }),
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

// Anything that changes the chat list tells the sidebar to refresh.
export const CHATS_CHANGED = "tareekh:chats-changed";
export const chatsChanged = () => window.dispatchEvent(new Event(CHATS_CHANGED));

export const fmtDate = (iso?: string | null, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) => {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(+d) ? iso : d.toLocaleDateString("en-IN", opts);
};
