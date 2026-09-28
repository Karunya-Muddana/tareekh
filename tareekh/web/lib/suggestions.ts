import { fmtDate, type CaseRow, type Hearing, type Today } from "@/lib/api";

// Starter questions for an empty chat, built from the live cause list so they always name real matters.

const FALLBACK = [
  "What is pending from our side this week?",
  "Which hearings are coming up in the next two weeks?",
  "What did the last order sheet say?",
];

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function chatSuggestions(today: Today | undefined, cases: CaseRow[] | undefined, caseId: string | null): string[] {
  const listed = [...(today?.hearings ?? []), ...(today?.upcoming ?? [])];

  if (caseId) {
    const h: Hearing | undefined = listed.find((x) => x.case_id === caseId);
    const name = h?.short_name ?? cases?.find((c) => c.id === caseId)?.short_name;
    if (!name) return FALLBACK;
    const out = [`What happened at the last hearing in ${name}?`, `What is pending from our side in ${name}?`];
    if (h?.listed_for) {
      const when = h.date === today?.today ? "today" : `on ${fmtDate(h.date, { day: "numeric", month: "short" })}`;
      out.push(`What should I have ready for ${lower(h.listed_for)} ${when}?`);
    }
    if (h?.judge) out.push(`What should I expect from ${h.judge} in ${name}?`);
    return out;
  }

  if (!listed.length) return FALLBACK;
  const out: string[] = [];
  const first = today?.hearings[0];
  if (first) {
    out.push(`What happened last time in ${first.short_name}?`);
    out.push("What is pending from our side before today’s hearings?");
  }
  const next = today?.upcoming[0];
  if (next) out.push(`What do I need for ${next.short_name} on ${fmtDate(next.date, { day: "numeric", month: "short" })}?`);
  const judge = (first ?? next)?.judge;
  if (judge) out.push(`What does ${judge} do when the other side keeps asking for time?`);
  return out.length ? out : FALLBACK;
}
