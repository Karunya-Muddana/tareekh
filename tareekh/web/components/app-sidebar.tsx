"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, FileUp, LogOut, Waypoints, MoreHorizontal, PenSquare, Search, Trash2 } from "lucide-react";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { Wordmark } from "@/components/brand";
import { Skeleton } from "@/components/ui/skeleton";
import CountUp from "@/components/bits/CountUp";
import ShinyText from "@/components/bits/ShinyText";
import { ThemeSwitch } from "@/components/theme-switch";
import { api, chatsChanged, prefetchChat, useChats, useMemoryStatus, type ChatRow } from "@/lib/api";
import { mutate } from "@/lib/cache";
import { initials, signOut, useSession } from "@/lib/session";
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
  const { data: chats, loading: chatsLoading } = useChats();
  const { data: status, error: statusError } = useMemoryStatus();
  const user = useSession();
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

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
    mutate<ChatRow[]>("chats", (xs) => [c, ...(xs ?? [])], true);
    chatsChanged();
    router.push(`/chat/${c.id}`);
  };

  // Delete with a grace period instead of a confirm dialog: it disappears now, and is only removed for real
  // if the lawyer doesn't press Undo within 5 s.
  const remove = (id: string) => {
    setPendingDelete(id);
    if (pathname === `/chat/${id}`) router.push("/");
    const timer = setTimeout(() => {
      mutate<ChatRow[]>("chats", (xs) => (xs ?? []).filter((c) => c.id !== id), true);
      api.deleteChat(id).finally(() => {
        setPendingDelete(null);
        chatsChanged();
      });
    }, 5000);
    window.dispatchEvent(
      new CustomEvent("tareekh:toast", {
        detail: { text: "Chat deleted", action: "Undo", onAction: () => { clearTimeout(timer); setPendingDelete(null); } },
      }),
    );
  };

  const offline = !status && !!statusError;
  const busy = status ? status.pending_operations + status.pending_consolidation : 0;
  const leave = () => {
    signOut();
    window.location.replace("/login"); // full load: nothing from this session survives in memory
  };

  return (
    <Sidebar variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="gap-3 px-3 pt-4">
        <div className="flex items-center justify-between px-1">
          <Link href="/" className="press -ml-1 flex items-center rounded-lg p-1" aria-label="Tareekh, go to Today">
            <Wordmark markClassName="logo-animate size-7" />
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
            <SidebarMenuButton isActive={pathname === "/graph"} render={<Link href="/graph" />} className="press h-10">
              <Waypoints />
              <span>Knowledge graph</span>
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
            placeholder="Search chats"
            aria-label="Search chats"
            className="w-full bg-transparent text-[16px] outline-none md:text-sm"
            spellCheck={false}
          />
        </label>
      </SidebarHeader>

      <SidebarContent className="fade-y px-1">
        {chatsLoading ? (
          <SidebarGroup>
            <SidebarMenu>
              {/* fixed widths: random ones differ between the server render and the browser */}
              {[72, 58, 84, 64, 76, 52].map((w, i) => (
                <SidebarMenuItem key={i} className="flex h-8 items-center px-2" role="status" aria-label={i === 0 ? "Loading chats" : undefined}>
                  <Skeleton className="h-4" style={{ width: `${w}%` }} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ) : visible.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-sm leading-relaxed">
            {query ? "No chat matches that." : "Your chats will show up here. Ask about a case, or tap “Brief me” on today’s cause list."}
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
                    <SidebarMenuItem key={c.id} className="animate-in fade-in slide-in-from-left-1 duration-300 motion-reduce:animate-none">
                      <SidebarMenuButton
                        isActive={pathname === `/chat/${c.id}`}
                        render={<Link href={`/chat/${c.id}`} onMouseEnter={() => prefetchChat(c.id)} onFocus={() => prefetchChat(c.id)} onTouchStart={() => prefetchChat(c.id)} />}
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

      <SidebarFooter className="border-sidebar-border gap-3 border-t px-3 py-3">
        <div className="flex items-center gap-3 px-1">
          <div className="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold tracking-wide">
            {user ? initials(user.name) : "·"}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium">{user?.name ?? "Signed out"}</div>
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs" aria-live="polite">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  offline ? "bg-destructive" : busy ? "bg-memo animate-pulse motion-reduce:animate-none" : "bg-emerald-600 dark:bg-emerald-400",
                )}
                aria-hidden
              />
              <span className="tnum truncate">
                {offline
                  ? "Memory offline"
                  : status
                    ? <>
                        <CountUp to={status.total_documents} duration={0.9} separator="," /> memories
                        {busy ? <> · <ShinyText text="learning" color="var(--muted-foreground)" shineColor="var(--foreground)" speed={1.8} /></> : null}
                      </>
                    : "Connecting…"}
              </span>
            </div>
          </div>
          <button
            onClick={leave}
            className="press text-muted-foreground hover:text-foreground hover:bg-sidebar-accent grid size-9 place-items-center rounded-lg"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
        <ThemeSwitch />
      </SidebarFooter>
    </Sidebar>
  );
}
