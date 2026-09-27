"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PanelLeft } from "lucide-react";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-dvh">{children}</SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}

/** Translucent top bar: content scrolls under it; a soft edge replaces a hard divider once scrolled. */
export function TopBar({ title, right, className }: { title?: ReactNode; right?: ReactNode; className?: string }) {
  const { toggleSidebar, isMobile, state } = useSidebar();
  const [scrolled, setScrolled] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = ref.current?.parentElement;
    if (!scroller) return;
    const on = () => setScrolled(scroller.scrollTop > 4 || window.scrollY > 4);
    scroller.addEventListener("scroll", on, { passive: true });
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", on);
      window.removeEventListener("scroll", on);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "bg-background/75 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20 flex h-14 items-center gap-2 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150 transition-shadow duration-200",
        scrolled && "shadow-[0_1px_0_var(--border)]",
        className,
      )}
    >
      {(isMobile || state === "collapsed") && (
        <button
          onClick={toggleSidebar}
          className="press text-muted-foreground hover:text-foreground hover:bg-accent grid size-10 place-items-center rounded-lg"
          aria-label="Open menu"
        >
          <PanelLeft className="size-5" />
        </button>
      )}
      <div className="min-w-0 flex-1 truncate text-[15px] font-medium">{title}</div>
      {right}
    </div>
  );
}

type Toast = { id: number; text: string; action?: string; onAction?: () => void };

/** Status/completion toasts with an optional Undo. Listens for `tareekh:toast` window events. */
function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const t = { id: Date.now() + Math.random(), ...(e as CustomEvent).detail } as Toast;
      setToasts((xs) => [...xs, t]);
      setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== t.id)), 5000);
    };
    window.addEventListener("tareekh:toast", on);
    return () => window.removeEventListener("tareekh:toast", on);
  }, []);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+16px)] z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-foreground text-background animate-in fade-in slide-in-from-bottom-2 pointer-events-auto flex items-center gap-4 rounded-xl py-2.5 pr-2.5 pl-4 text-sm shadow-lg duration-200 motion-reduce:animate-none"
        >
          <span>{t.text}</span>
          {t.action && (
            <button
              className="press rounded-lg px-2.5 py-1 font-medium hover:bg-white/10"
              onClick={() => {
                t.onAction?.();
                setToasts((xs) => xs.filter((x) => x.id !== t.id));
              }}
            >
              {t.action}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export const toast = (text: string, action?: string, onAction?: () => void) =>
  window.dispatchEvent(new CustomEvent("tareekh:toast", { detail: { text, action, onAction } }));
