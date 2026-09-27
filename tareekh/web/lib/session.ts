"use client";

// Simulated sign-in for the prototype. Nothing is verified: the chosen profile is kept in a cookie so the
// proxy can send signed-out visitors to /login. Swap this for real auth before anyone else uses the app.

import { useSyncExternalStore } from "react";

export const SESSION_COOKIE = "tareekh_session";
const EVENT = "tareekh:session";

export type SessionUser = { name: string; email: string; role: "Counsel" | "Junior" | "Clerk" };

function parse(): SessionUser | null {
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw.slice(SESSION_COOKIE.length + 1)));
  } catch {
    return null;
  }
}

let cached: { raw: string; user: SessionUser | null } = { raw: "", user: null };
function snapshot() {
  const raw = document.cookie;
  if (raw !== cached.raw) cached = { raw, user: parse() };
  return cached.user;
}

export function signIn(user: SessionUser) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(JSON.stringify(user))}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(EVENT));
}

export function signOut() {
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("tareekh:c1:")) localStorage.removeItem(k);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("focus", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("focus", cb);
  };
}

export const useSession = () => useSyncExternalStore(subscribe, snapshot, () => null);

export const initials = (name: string) =>
  name
    .replace(/^(adv\.?|sri|smt\.?)\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
