"use client";

import { useRef } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import RubberSegment from "@/components/bits/RubberSegment";
import { useTheme, type ThemePref } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: [ThemePref, string, typeof Sun][] = [
  ["light", "Light", Sun],
  ["dark", "Dark", Moon],
  ["system", "Match device", Monitor],
];

/** Light / Dark / Match device. React Bits RubberSegment; the new theme spreads from the option you picked. */
export function ThemeSwitch({ className }: { className?: string }) {
  const { pref, setTheme } = useTheme();
  const wrap = useRef<HTMLDivElement>(null);
  return (
    <div ref={wrap} className={cn("w-full", className)}>
      <RubberSegment
        aria-label="Appearance"
        size="sm"
        equalSlots
        className="w-full"
        value={pref}
        onChange={(v, i) => {
          const r = wrap.current?.getBoundingClientRect();
          setTheme(v as ThemePref, r ? { x: r.left + (r.width * (i + 0.5)) / OPTIONS.length, y: r.top + r.height / 2 } : undefined);
        }}
        items={OPTIONS.map(([value, label, Icon]) => ({ value, label: <span className="sr-only">{label}</span>, icon: <Icon className="size-3.5" aria-hidden /> }))}
        trackColor="var(--sidebar-accent)"
        thumbColor="var(--foreground)"
        textColor="var(--muted-foreground)"
        activeTextColor="var(--background)"
        radius={8}
      />
    </div>
  );
}
