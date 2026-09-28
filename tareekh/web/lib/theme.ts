"use client";

import { useCallback, useSyncExternalStore } from "react";
import { THEME_EVENT as EVENT, THEME_KEY as KEY } from "@/lib/theme-script";

export type ThemePref = "light" | "dark" | "system";

const THEME_COLOR = { light: "#fbfbf9", dark: "#0f1612" };

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {}
  return "system";
}

function resolved(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function syncMeta() {
  const color = THEME_COLOR[resolved()];
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", color));
}

/** `from` is where the change was triggered; the new theme spreads out from there. */
export function setTheme(pref: ThemePref, from?: { x: number; y: number }) {
  try {
    if (pref === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {}
  const swap = () => {
    // No colour transitions mid-swap: every element would animate at once and smear.
    const s = document.createElement("style");
    s.textContent = "*,*::before,*::after{transition:none!important}";
    document.head.appendChild(s);
    window.dispatchEvent(new Event(EVENT));
    syncMeta();
    requestAnimationFrame(() => requestAnimationFrame(() => s.remove()));
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement.style;
  const x = from?.x ?? innerWidth / 2;
  const y = from?.y ?? innerHeight / 2;
  root.setProperty("--vt-x", `${x}px`);
  root.setProperty("--vt-y", `${y}px`);
  root.setProperty("--vt-r", `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !reduce) doc.startViewTransition(swap);
  else swap();
}

function subscribe(cb: () => void) {
  const m = matchMedia("(prefers-color-scheme: dark)");
  const on = () => {
    syncMeta();
    cb();
  };
  window.addEventListener(EVENT, on);
  window.addEventListener("storage", on);
  m.addEventListener("change", on);
  return () => {
    window.removeEventListener(EVENT, on);
    window.removeEventListener("storage", on);
    m.removeEventListener("change", on);
  };
}

export function useTheme() {
  const pref = useSyncExternalStore(subscribe, read, () => "system" as ThemePref);
  const mode = useSyncExternalStore(subscribe, resolved, () => "light" as const);
  const toggle = useCallback(() => setTheme(resolved() === "dark" ? "light" : "dark"), []);
  return { pref, mode, setTheme, toggle };
}
