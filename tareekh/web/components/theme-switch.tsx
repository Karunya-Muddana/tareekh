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
    <div role="radiogroup" aria-label="Appearance" className={cn("bg-sidebar-accent flex rounded-lg p-0.5", className)}>
      {OPTIONS.map(([value, label, Icon]) => (
        <button
          key={value}
          role="radio"
          aria-checked={pref === value}
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
          className={cn(
            "press grid h-7 flex-1 place-items-center rounded-md px-2",
            pref === value ? "bg-background text-foreground shadow-[var(--shadow-soft)]" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}
