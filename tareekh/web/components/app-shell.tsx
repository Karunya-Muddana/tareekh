"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PanelLeft } from "lucide-react";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { LogoMark } from "@/components/brand";
import { TabBar } from "@/components/tab-bar";
import SwipeToast from "@/components/bits/SwipeToast";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  // In a chat the composer owns the bottom of the screen, so the tab bar steps aside.
  const tabs = !usePathname().startsWith("/chat/");
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className={cn("min-h-dvh", tabs && "pb-[calc(env(safe-area-inset-bottom)+64px)] md:pb-0")}>{children}</SidebarInset>
      {tabs && <TabBar />}
      <Toaster tabs={tabs} />
    </SidebarProvider>
  );
}

/** Translucent top bar: content scrolls under it; a soft edge replaces a hard divider once scrolled. */
export function TopBar({ title, right, className }: { title?: ReactNode; right?: ReactNode; className?: string }) {
  const { toggleSidebar, isMobile, state } = useSidebar();
  // On phones the tab bar has "Chats", so outside a chat the corner holds the mark instead of a menu button.
  const inChat = usePathname().startsWith("/chat/");
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
      {isMobile && !inChat ? (
        <span className="grid size-10 place-items-center" aria-hidden>
          <LogoMark className="logo-animate size-7" />
        </span>
      ) : (isMobile || state === "collapsed") && (
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

/** Status/completion toasts with an optional Undo: React Bits SwipeToast, swipe down to dismiss, fuse shows time left. */
function Toaster({ tabs }: { tabs: boolean }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const on = (e: Event) => setToasts((xs) => [...xs.slice(-2), { id: Date.now() + Math.random(), ...(e as CustomEvent).detail } as Toast]);
    window.addEventListener("tareekh:toast", on);
    return () => window.removeEventListener("tareekh:toast", on);
  }, []);
  const drop = (id: number) => setToasts((xs) => xs.filter((x) => x.id !== id));
  return (
    <div
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center px-4 md:bottom-[calc(env(safe-area-inset-bottom)+16px)] [&>*]:pointer-events-auto",
        tabs ? "bottom-[calc(env(safe-area-inset-bottom)+76px)]" : "bottom-[calc(env(safe-area-inset-bottom)+92px)]",
      )}
    >
      {toasts.map((t) => (
        <SwipeToast
          key={t.id}
          inline
          title={t.text}
          actionLabel={t.action ?? ""}
          onAction={t.onAction}
          onClose={() => drop(t.id)}
          duration={5000}
          width={380}
          radius={12}
          background="var(--foreground)"
          color="var(--background)"
          fuseColor="var(--tape)"
          closeButton={false}
        />
      ))}
    </div>
  );
}

export const toast = (text: string, action?: string, onAction?: () => void) =>
  window.dispatchEvent(new CustomEvent("tareekh:toast", { detail: { text, action, onAction } }));
