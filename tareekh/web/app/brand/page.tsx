import type { Metadata } from "next";
import Link from "next/link";
import { BRAND, LogoMark } from "@/components/brand";
import { ThemeSwitch } from "@/components/theme-switch";

export const metadata: Metadata = { title: "Brand · Tareekh" };

const FIXED = [
  ["Coat black", BRAND.ink, "The advocate’s gown. The tile, the text, the primary buttons."],
  ["Record paper", BRAND.paper, "The diary leaf. Neutral and crisp, never cream."],
  ["Manila", BRAND.brass, "The case-file folder: the turned corner, and everything remembered from chats."],
  ["Red tape", BRAND.seal, "Tied round every file. The one accent: today, what’s listed, where you are."],
] as const;

const THEMES = [
  {
    name: "Court day",
    note: "Light. Record-room paper, black, one red.",
    swatches: [["Background", "#f3f4f1"], ["Text", "#141414"], ["Accent", "#c8321e"], ["Memory", "#efe6d1"]],
  },
  {
    name: "Late chamber",
    note: "Dark. Lamp-black and chalk, the same red tape.",
    swatches: [["Background", "#0f0f0e"], ["Text", "#ecece7"], ["Accent", "#ff6b4e"], ["Memory", "#2a2418"]],
  },
] as const;

const VOICE: [string, string][] = [
  ["Next date", "Upcoming"],
  ["Today’s cause list", "Your schedule"],
  ["Previous hearing, 24 Sept · Divya’s note", "Last activity"],
  ["Listed for arguments", "Status: arguments"],
  ["Pending from our side", "Your to-dos"],
  ["Before the bench today", "Judges"],
];

export default function BrandPage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 pt-6 md:px-10">
        <Link href="/" className="press flex items-center gap-2.5 rounded-lg">
          <LogoMark className="size-8" />
          <span className="indic text-[27px]">tareekh</span>
        </Link>
        <ThemeSwitch className="w-32" />
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-24 px-6 pt-16 pb-24 md:px-10">
        <section>
          <h1 className="title-xl max-w-3xl text-5xl md:text-7xl">A diary that remembers every date.</h1>
          <p className="text-foreground/80 mt-6 max-w-2xl text-lg leading-relaxed">
            Tareekh is practice memory for Indian litigators. It should feel like the sharpest junior in the chamber: it
            knows the cause list, the last order, what the other side will ask for, and what sir said three dates ago. Calm,
            exact, and never in the way.
          </p>
        </section>

        {/* The mark */}
        <section className="grid gap-10 md:grid-cols-2 md:items-center">
          <div className="bg-card border-border grid aspect-square place-items-center rounded-3xl border shadow-[var(--shadow-soft)]">
            <LogoMark className="size-1/2" title="The Tareekh mark" />
          </div>
          <div>
            <h2 className="title-xl text-4xl">One leaf of the diary.</h2>
            <dl className="mt-6 flex flex-col gap-5 text-[15px] leading-relaxed">
              <Part color={BRAND.paper} term="The leaf">
                A page from the lawyer’s diary, where every next date has always been written.
              </Part>
              <Part color={BRAND.ink} term="The ruled header">
                The date line at the top of the page. With the ribbon, it forms the T.
              </Part>
              <Part color={BRAND.seal} term="The ribbon">
                Marks the page you need, and runs past the edge like the red tape on a case file.
              </Part>
              <Part color={BRAND.brass} term="The turned corner">
                The page is about to turn. There is always a next date.
              </Part>
            </dl>
          </div>
        </section>

        <section>
          <h2 className="title-xl text-4xl">Every size, same mark.</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              ["#f3f4f1", "On paper"],
              ["#0f0f0e", "On lamp-black"],
            ].map(([bg, label]) => (
              <div key={bg} className="border-border flex flex-col gap-4 rounded-2xl border p-6" style={{ background: bg }}>
                <div className="flex flex-wrap items-end gap-5">
                  {[16, 24, 32, 48, 72].map((px) => (
                    <LogoMark key={px} className="shrink-0" style={{ width: px, height: px }} />
                  ))}
                </div>
                <span className="text-xs" style={{ color: bg === "#0f0f0e" ? "#a3a39d" : "#585a56" }}>
                  {label}. The mark keeps its colours in both themes. Minimum size 16 px.
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Wordmark */}
        <section className="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-center">
          <div className="min-w-0">
            <h2 className="title-xl text-4xl">English letters, an Indian hand.</h2>
            <p className="text-foreground/80 mt-4 text-[15px] leading-relaxed">
              The wordmark is set in Samarkan: Roman letters drawn with the headline bar and strokes of Devanagari. It
              appears in three places only: the wordmark, the weekday on Today, and the sign-in screen. Everything else is
              Anek Latin and Eczar, so the interface stays quiet.
            </p>
          </div>
          <div className="bg-card border-border flex min-w-0 flex-col items-center justify-center gap-8 overflow-hidden rounded-3xl border p-6 sm:p-10 shadow-[var(--shadow-soft)]">
            <span className="indic text-[60px] sm:text-[84px]">tareekh</span>
            <span className="flex items-center gap-3">
              <LogoMark className="size-10" />
              <span className="indic text-[34px]">tareekh</span>
            </span>
          </div>
        </section>

        {/* Colour */}
        <section>
          <h2 className="title-xl text-4xl">Black coat, red tape.</h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FIXED.map(([name, hex, note]) => (
              <li key={name} className="border-border overflow-hidden rounded-2xl border">
                <div className="h-24" style={{ background: hex }} />
                <div className="p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{name}</span>
                    <span className="text-muted-foreground font-mono text-xs uppercase">{hex}</span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm leading-snug">{note}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {THEMES.map((t) => (
              <div key={t.name} className="border-border rounded-2xl border p-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <span className="title-xl text-2xl">{t.name}</span>
                  <span className="text-muted-foreground text-sm">{t.note}</span>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {t.swatches.map(([label, hex]) => (
                    <div key={label}>
                      <div className="border-border h-12 rounded-lg border" style={{ background: hex }} />
                      <div className="mt-1.5 text-xs">{label}</div>
                      <div className="text-muted-foreground font-mono text-[11px] uppercase">{hex}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Type */}
        <section>
          <h2 className="title-xl text-4xl">Type from Indian foundries.</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <TypeCard name="Eczar · Rosetta" use="Headings and dates" sample={<span className="title-xl text-5xl">Monday, 5 Oct</span>} />
            <TypeCard name="Anek Latin · Ek Type, Mumbai" use="Everything you read and tap" sample={<span className="text-2xl font-semibold tracking-tight">Seabreeze SP suit</span>} />
            <TypeCard name="Martian Mono" use="Small data labels" sample={<span className="tnum font-mono text-2xl">O.S. 57/2025</span>} />
          </div>
        </section>

        {/* Voice */}
        <section className="grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div>
            <h2 className="title-xl text-4xl">The chamber’s own words.</h2>
            <p className="text-foreground/80 mt-4 text-[15px] leading-relaxed">
              Write the English of an Indian court: cause lists, next dates, listed for, undertakings, “sir” for the bench.
              Short, specific, unhurried. Always say which note or order an answer came from. No slang, no exclamation
              marks, no cheer.
            </p>
          </div>
          <ul className="divide-border border-border divide-y rounded-2xl border">
            <li className="text-muted-foreground grid grid-cols-2 gap-4 px-5 py-3 text-xs font-medium tracking-wide uppercase">
              <span>Say</span>
              <span>Not</span>
            </li>
            {VOICE.map(([say, not]) => (
              <li key={say} className="grid grid-cols-2 gap-4 px-5 py-3 text-[15px]">
                <span>{say}</span>
                <span className="text-muted-foreground line-through decoration-1">{not}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}


function Part({ color, term, children }: { color: string; term: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="border-border mt-1.5 size-3 shrink-0 rounded-full border" style={{ background: color }} aria-hidden />
      <div>
        <dt className="font-medium">{term}</dt>
        <dd className="text-foreground/75">{children}</dd>
      </div>
    </div>
  );
}

function TypeCard({ name, use, sample }: { name: string; use: string; sample: React.ReactNode }) {
  return (
    <div className="border-border flex flex-col justify-between gap-8 rounded-2xl border p-5">
      {sample}
      <div>
        <div className="font-medium">{name}</div>
        <div className="text-muted-foreground text-sm">{use}</div>
      </div>
    </div>
  );
}
