"use client";

// Simulated sign-in for the prototype. Nothing is verified: the chosen profile is kept in a cookie so the
// proxy can send signed-out visitors to /login. Swap this for real auth before anyone else uses the app.

import { useSyncExternalStore } from "react";
import { clearCache } from "@/lib/cache";

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
  clearCache();
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(JSON.stringify(user))}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(EVENT));
}

export function signOut() {
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  clearCache();
  // No session event here: re-rendering the open screens would refetch the previous user's data. The caller
  // leaves with a full page load instead (see the sidebar), which also drops everything held in memory.
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
