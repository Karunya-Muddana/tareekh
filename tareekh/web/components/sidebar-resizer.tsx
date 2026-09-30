"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { SIDEBAR_WIDTH_KEY } from "@/lib/theme-script";
import { cn } from "@/lib/utils";

const MIN = 200;
const MAX = 440;
const DEFAULT = 256;
const COLLAPSE_BELOW = 140; // drag nearly shut and let go: the sidebar closes, like a split view on a Mac

const clamp = (n: number) => Math.min(MAX, Math.max(MIN, Math.round(n)));

function apply(w: number | null) {
  const root = document.documentElement;
  if (w == null) root.style.removeProperty("--sidebar-width-user");
  else root.style.setProperty("--sidebar-width-user", `${w}px`);
}

function save(w: number | null) {
  try {
    if (w == null || w === DEFAULT) localStorage.removeItem(SIDEBAR_WIDTH_KEY);
    else localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
  } catch {}
}

/**
 * The sidebar's right edge: drag to resize (200-440 px), double-click to reset, arrow keys when focused.
 * The width lives in a CSS variable on <html>, so dragging never re-renders the app.
 */
export function SidebarResizer() {
  const { state, isMobile, setOpen } = useSidebar();
  const [width, setWidth] = useState(DEFAULT);
  const [dragging, setDragging] = useState(false);
  const start = useRef({ x: 0, w: DEFAULT });
  const live = useRef(DEFAULT);

  useEffect(() => {
    const w = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width-user"));
    if (w) setWidth((live.current = w));
  }, []);

  if (isMobile || state !== "expanded") return null;

  const set = (w: number) => {
    live.current = w;
    apply(w);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, w: live.current };
    setDragging(true);
    document.documentElement.dataset.resizing = "";
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    set(clamp(start.current.w + e.clientX - start.current.x));
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    delete document.documentElement.dataset.resizing;
    if (start.current.w + e.clientX - start.current.x < COLLAPSE_BELOW) {
      set(start.current.w); // reopen at the width it had
      setOpen(false);
      return;
    }
    setWidth(live.current);
    save(live.current);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 48 : 16;
    const next =
      e.key === "ArrowLeft" ? clamp(live.current - step) : e.key === "ArrowRight" ? clamp(live.current + step) : e.key === "Home" ? DEFAULT : null;
    if (next == null) return;
    e.preventDefault();
    set(next);
    setWidth(next);
    save(next);
  };

  const reset = () => {
    set(DEFAULT);
    setWidth(DEFAULT);
    apply(null);
    save(null);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={reset}
      onKeyDown={onKeyDown}
      className={cn(
        "group fixed inset-y-0 z-30 hidden w-3 -translate-x-1/2 cursor-col-resize touch-none outline-none md:block",
        "left-(--sidebar-width)",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-[background-color,width] duration-150",
          dragging ? "bg-foreground/40 w-0.5" : "group-hover:bg-foreground/25 group-focus-visible:bg-ring group-focus-visible:w-0.5 bg-transparent",
        )}
      />
    </div>
  );
}
