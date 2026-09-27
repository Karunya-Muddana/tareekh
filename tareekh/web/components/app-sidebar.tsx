"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, FileUp, MoreHorizontal, PenSquare, Search, Trash2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from "@/components/ui/sidebar";
import { api, CHATS_CHANGED, chatsChanged, type ChatRow, type MemoryStatus, type Practice } from "@/lib/api";
import { cn } from "@/lib/utils";

function groupByAge(chats: ChatRow[]) {
  const day = 86_400_000;
  const startOfToday = new Date(new Date().toDateString()).getTime();
  const groups: { label: string; items: ChatRow[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Earlier", items: [] },
  ];
  for (const c of chats) {
    const t = new Date(c.updated_at).getTime();
    const g = t >= startOfToday ? 0 : t >= startOfToday - day ? 1 : t >= startOfToday - 7 * day ? 2 : 3;
    groups[g].items.push(c);
  }
  return groups.filter((g) => g.items.length);
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const [chats, setChats] = useState<ChatRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [practice, setPractice] = useState<Practice | null>(null);
  const [status, setStatus] = useState<MemoryStatus | null | "offline">(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const loadChats = useCallback(() => api.chats().then(setChats).catch(() => setChats([])), []);

  useEffect(() => {
    loadChats();
    api.health().then((h) => setPractice(h.practice)).catch(() => {});
    const poll = () => api.status().then(setStatus).catch(() => setStatus("offline"));
    poll();
    const t = setInterval(poll, 15_000);
    window.addEventListener(CHATS_CHANGED, loadChats);
    return () => {
      clearInterval(t);
      window.removeEventListener(CHATS_CHANGED, loadChats);
    };
  }, [loadChats]);

  // Close the drawer after navigating on a phone.
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (chats ?? []).filter((c) => c.id !== pendingDelete);
    return q ? list.filter((c) => `${c.title} ${c.last ?? ""}`.toLowerCase().includes(q)) : list;
  }, [chats, query, pendingDelete]);

  const newChat = async () => {
    const c = await api.newChat();
    chatsChanged();
    router.push(`/chat/${c.id}`);
  };

  // Delete with a grace period instead of a confirm dialog: it disappears now, and is only removed for real
  // if the lawyer doesn't press Undo within 5 s.
  const remove = (id: string) => {
    setPendingDelete(id);
    if (pathname === `/chat/${id}`) router.push("/");
    const timer = setTimeout(() => {
      api.deleteChat(id).finally(() => {
        setPendingDelete(null);
        loadChats();
      });
    }, 5000);
    window.dispatchEvent(
      new CustomEvent("tareekh:toast", {
        detail: { text: "Chat deleted", action: "Undo", onAction: () => { clearTimeout(timer); setPendingDelete(null); } },
      }),
    );
  };

  const busy = status && status !== "offline" ? status.pending_operations + status.pending_consolidation : 0;

  return (
    <Sidebar variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="gap-3 px-3 pt-4">
        <div className="flex items-center justify-between px-1">
          <Link href="/" className="flex items-baseline gap-2" aria-label="Tareekh, go to Today">
            <span className="title-xl text-[26px] text-foreground">Tareekh</span>
          </Link>
          <button
            onClick={newChat}
            className="press text-muted-foreground hover:text-foreground hover:bg-sidebar-accent grid size-9 place-items-center rounded-lg"
            aria-label="New chat"
            title="New chat"
          >
            <PenSquare className="size-[18px]" />
          </button>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={pathname === "/"} render={<Link href="/" />} className="press h-10">
              <CalendarDays />
              <span>Today</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={pathname === "/upload"} render={<Link href="/upload" />} className="press h-10">
              <FileUp />
              <span>Add notes</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <label className="bg-sidebar-accent/70 focus-within:ring-ring/50 flex h-9 items-center gap-2 rounded-lg px-2.5 focus-within:ring-2">
          <Search className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            aria-label="Search chats"
            className="placeholder:text-muted-foreground/80 w-full bg-transparent text-[16px] outline-none md:text-sm"
            spellCheck={false}
          />
        </label>
      </SidebarHeader>

      <SidebarContent className="fade-y px-1">
        {chats === null ? (
          <SidebarGroup>
            <SidebarMenu>
              {Array.from({ length: 6 }, (_, i) => (
                <SidebarMenuItem key={i}>
                  <SidebarMenuSkeleton />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ) : visible.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-sm leading-relaxed">
            {query ? "No chat matches that." : "Your conversations will show up here. Ask about a case, or tap “Brief me” on a hearing."}
          </p>
        ) : (
          groupByAge(visible).map((g) => (
            <SidebarGroup key={g.label} className="py-1">
              <SidebarGroupLabel className="text-muted-foreground/80 text-[11px] font-medium tracking-wide uppercase">
                {g.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {g.items.map((c) => (
                    <SidebarMenuItem key={c.id}>
                      <SidebarMenuButton
                        isActive={pathname === `/chat/${c.id}`}
                        render={<Link href={`/chat/${c.id}`} />}
                        className="press h-9"
                        title={c.title}
                      >
                        <span className="truncate">{c.title}</span>
                      </SidebarMenuButton>
                      <SidebarMenuAction
                        showOnHover
                        onClick={() => remove(c.id)}
                        aria-label={`Delete “${c.title}”`}
                        title="Delete chat"
                      >
                        {isMobile ? <MoreHorizontal /> : <Trash2 />}
                      </SidebarMenuAction>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border border-t px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground title-xl grid size-9 shrink-0 place-items-center rounded-full text-lg">
            {practice?.lawyer?.[0] ?? "T"}
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-medium">{practice ? `Adv. ${practice.lawyer}` : "Loading…"}</div>
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs" aria-live="polite">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  status === "offline" ? "bg-destructive" : busy ? "bg-memo animate-pulse motion-reduce:animate-none" : "bg-emerald-600 dark:bg-emerald-400",
                )}
                aria-hidden
              />
              <span className="tnum truncate">
                {status === "offline"
                  ? "Memory offline"
                  : status
                    ? busy
                      ? `${status.total_documents} memories · learning`
                      : `${status.total_documents} memories`
                    : "Connecting…"}
              </span>
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
