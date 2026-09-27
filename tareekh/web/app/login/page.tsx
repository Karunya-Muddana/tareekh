"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { LogoMark, BRAND } from "@/components/brand";
import { ThemeSwitch } from "@/components/theme-switch";
import { useHealth } from "@/lib/api";
import { initials, signIn, type SessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const { data: health } = useHealth();
  const practice = health?.practice;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const people: SessionUser[] = [
    { name: `Adv. ${practice?.lawyer ?? "Aditya Varma"}`, email: "aditya@chamber.in", role: "Counsel" },
    { name: practice?.assistant ?? "Divya Kanaka", email: "divya@chamber.in", role: "Junior" },
  ];

  const go = (u: SessionUser) => {
    setBusy(u.email);
    signIn(u);
    // Only same-site paths, never an absolute URL from the query string.
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!addr) return;
    const known = people.find((p) => p.email === addr);
    const local = addr.split("@")[0].replace(/[._-]+/g, " ");
    go(known ?? { name: local.replace(/\b\w/g, (c) => c.toUpperCase()), email: addr, role: "Counsel" });
  };

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <title>Sign in · Tareekh</title>

      {/* Brand panel: fixed brand colours in both themes */}
      <section
        className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex"
        style={{ background: BRAND.ink, color: BRAND.paper }}
        aria-hidden
      >
        <div className="flex items-center gap-3">
          <LogoMark className="size-9 rounded-[10px] ring-1 ring-white/15" />
        </div>
        <div>
          <div className="indic text-[88px] xl:text-[112px]">tareekh</div>
          <p className="mt-6 max-w-sm text-[17px] leading-relaxed opacity-80">
            Every date, every hearing, every order sheet. Remembered, and ready before you reach the court hall.
          </p>
        </div>
        <p className="text-sm opacity-60">Practice memory for litigators{practice?.city ? ` · ${practice.city}` : ""}</p>
        {/* the red ribbon from the mark, running off the panel */}
        <div className="absolute top-0 right-16 h-40 w-5" style={{ background: BRAND.seal, clipPath: "polygon(0 0,100% 0,100% 100%,50% 88%,0 100%)" }} />
      </section>

      {/* Form */}
      <section className="flex flex-col px-6 pt-[calc(env(safe-area-inset-top)+24px)] pb-[calc(env(safe-area-inset-bottom)+24px)] sm:px-10">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2.5 lg:invisible">
            <LogoMark className="size-8" />
            <span className="indic text-[27px]">tareekh</span>
          </span>
          <ThemeSwitch className="w-32" />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="title-xl text-[44px]">Good to see you</h1>
          <p className="text-muted-foreground mt-2 text-[15px]">Sign in to your chamber.</p>

          <ul className="mt-8 flex flex-col gap-2" aria-label="Chamber accounts">
            {people.map((p, i) => (
              <li key={p.email}>
                <button
                  onClick={() => go(p)}
                  disabled={!!busy}
                  className="press group border-border hover:bg-accent focus-visible:ring-ring flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left outline-none focus-visible:ring-2 disabled:opacity-60"
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-semibold tracking-wide",
                      i === 0 ? "bg-primary text-primary-foreground" : "bg-memo-soft text-memo",
                    )}
                  >
                    {initials(p.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="text-muted-foreground block truncate text-sm">
                      {p.role} · {p.email}
                    </span>
                  </span>
                  {busy === p.email ? (
                    <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />
                  ) : (
                    <ArrowRight className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  )}
                </button>
              </li>
            ))}
          </ul>

          <div className="text-muted-foreground my-6 flex items-center gap-3 text-xs">
            <span className="bg-border h-px flex-1" />
            or use your email
            <span className="bg-border h-px flex-1" />
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Email
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@chamber.in"
                className="border-input bg-background focus-visible:ring-ring/50 h-11 rounded-lg border px-3 text-[16px] font-normal outline-none focus-visible:ring-2 md:text-sm"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-input bg-background focus-visible:ring-ring/50 h-11 rounded-lg border px-3 text-[16px] font-normal outline-none focus-visible:ring-2 md:text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={!!busy}
              className="press bg-primary text-primary-foreground mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium shadow-[var(--shadow-soft)] disabled:opacity-60"
            >
              {busy && !people.some((p) => p.email === busy) ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Continue
            </button>
          </form>

          <p className="text-muted-foreground mt-6 text-xs leading-relaxed">
            Demo sign-in: nothing is checked and no password is stored. It only decides whose name appears in the app.
          </p>
        </div>
      </section>
    </main>
  );
}
