"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePref } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: [ThemePref, string, typeof Sun][] = [
  ["light", "Light", Sun],
  ["dark", "Dark", Moon],
  ["system", "Match device", Monitor],
];

export function ThemeSwitch({ className }: { className?: string }) {
  const { pref, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="Appearance" className={cn("bg-sidebar-accent relative flex rounded-lg p-0.5", className)}>
      <span
        aria-hidden
        className="spring bg-background absolute inset-y-0.5 left-0.5 rounded-md shadow-[var(--shadow-soft)]"
        style={{ width: "calc((100% - 4px) / 3)", transform: `translateX(${OPTIONS.findIndex(([v]) => v === pref) * 100}%)` }}
      />
      {OPTIONS.map(([value, label, Icon]) => (
        <button
          key={value}
          role="radio"
          aria-checked={pref === value}
          aria-label={label}
          title={label}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setTheme(value, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
          }}
          className={cn(
            "press relative grid h-8 flex-1 place-items-center rounded-md px-2 transition-colors",
            pref === value ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}
