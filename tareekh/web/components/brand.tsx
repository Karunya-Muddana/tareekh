import { useId } from "react";
import { cn } from "@/lib/utils";

/** Fixed brand colours. The mark looks the same in light and dark mode on purpose. */
export const BRAND = {
  ink: "#141414", // Coat black: the advocate's gown
  paper: "#f7f7f3", // Record paper
  brass: "#c9a15a", // Manila: the case-file folder (the turned corner)
  seal: "#c8321e", // Red tape: tied round every case file
} as const;

/**
 * The Tareekh mark: a diary leaf with a turned corner, and a red ribbon marking the page.
 * The ribbon and the ruled header make the T. The turned corner is the next date.
 */
export function LogoMark({ className, title, style }: { className?: string; title?: string; style?: React.CSSProperties }) {
  const clip = useId();
  return (
    <svg viewBox="0 0 64 64" className={cn("shrink-0", className)} style={style} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <rect width="64" height="64" rx="14" fill={BRAND.ink} />
      <clipPath id={clip}>
        <rect width="64" height="64" rx="14" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <LogoGlyph />
      </g>
      <rect x="0.5" y="0.5" width="63" height="63" rx="13.5" fill="none" stroke="#fff" strokeOpacity="0.16" className="hidden dark:block" />
    </svg>
  );
}

export function LogoGlyph() {
  return (
    <>
      <path d="M15 12h34a4 4 0 0 1 4 4v23L39 53H19a4 4 0 0 1-4-4z" fill={BRAND.paper} />
      <path className="logo-corner" d="M53 39H43a4 4 0 0 0-4 4v10z" fill={BRAND.brass} />
      <path className="logo-ribbon" d="M28.5 19h7v40l-3.5-4-3.5 4z" fill={BRAND.seal} />
      <rect x="20" y="19" width="24" height="6.5" rx="2" fill={BRAND.ink} />
    </>
  );
}

/** The wordmark: "tareekh" in the Indic display face (see .indic in globals.css). */
export function Wordmark({ className, markClassName, mark = true }: { className?: string; markClassName?: string; mark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)} aria-label="Tareekh" role="img">
      {mark && <LogoMark className={cn("size-8", markClassName)} />}
      <span className="indic text-[27px]" aria-hidden>
        tareekh
      </span>
    </span>
  );
}
