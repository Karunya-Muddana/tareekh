"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, FileUp, MessagesSquare, PenSquare } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { toast } from "@/components/app-shell";
import { api, chatsChanged, type ChatRow } from "@/lib/api";
import { mutate } from "@/lib/cache";
import { cn } from "@/lib/utils";

/** Phone-only bottom bar: the three things you do between hearings, one thumb away. */
export function TabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile, openMobile } = useSidebar();
  const [starting, setStarting] = useState(false);

  const tabs = [
    { key: "today", label: "Today", icon: CalendarDays, href: "/", active: pathname === "/" },
    { key: "chats", label: "Chats", icon: MessagesSquare, active: openMobile },
    { key: "new", label: "Ask", icon: PenSquare, active: false },
    { key: "notes", label: "Add notes", icon: FileUp, href: "/upload", active: pathname === "/upload" },
  ] as const;
  const activeIndex = tabs.findIndex((t) => t.active);

  const newChat = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const c = await api.newChat();
      mutate<ChatRow[]>("chats", (xs) => [c, ...(xs ?? [])], true);
      chatsChanged();
      router.push(`/chat/${c.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t start a chat");
    } finally {
      setStarting(false);
    }
  };

  return (
    <nav
      aria-label="Main"
      className="bg-background fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="relative mx-auto grid h-16 max-w-md grid-cols-4 px-2">
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className="spring bg-primary absolute top-0 left-2 h-0.5 rounded-full"
            style={{ width: "calc((100% - 16px) / 4)", transform: `translateX(${activeIndex * 100}%) scaleX(0.4)` }}
          />
        )}
        {tabs.map((t) => {
          const Icon = t.icon;
          const inner = (
            <>
              <span className={cn("spring grid size-7 place-items-center", t.active && "-translate-y-0.5")}>
                <Icon className={cn("size-[22px]", t.key === "new" && starting && "animate-pulse")} strokeWidth={t.active ? 2.2 : 1.8} aria-hidden />
              </span>
              <span className="text-[11px] font-medium">{t.label}</span>
            </>
          );
          const cls = cn(
            "press flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors",
            t.active ? "text-primary" : "text-muted-foreground",
          );
          return "href" in t ? (
            <Link key={t.key} href={t.href} className={cls} aria-current={t.active ? "page" : undefined}>
              {inner}
            </Link>
          ) : (
            <button key={t.key} className={cls} onClick={t.key === "chats" ? () => setOpenMobile(true) : newChat} aria-label={t.key === "new" ? "New chat" : "Chats"}>
              {inner}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
