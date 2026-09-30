"use client";

import { useEffect, useId, useRef } from "react";
import { BRAND } from "@/components/brand";

export type PresenceState = "idle" | "listening" | "thinking" | "speaking";

/**
 * Tareekh's voice: the logo mark, alive. The same diary leaf, turned corner and red ribbon as the app icon
 * (components/brand.tsx), each with one job in a conversation:
 *
 * - listening: ruled lines appear on the leaf and ripple with your voice, as if the note is being written;
 * - thinking:  the turned corner lifts and settles, the diary being leafed through for the date;
 * - speaking:  the red ribbon slips past the edge of the tile and moves with her voice, like tape in a breeze;
 * - idle:      a slow breath.
 *
 * Plain SVG driven by one requestAnimationFrame loop that writes attributes directly, so it never re-renders React.
 */
export function TareekhPresence({
  state,
  getInputLevel,
  getOutputLevel,
  className,
}: {
  state: PresenceState;
  getInputLevel: () => number;
  getOutputLevel: () => number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const stateRef = useRef(state);
  stateRef.current = state;
  const ref = {
    body: useRef<SVGGElement>(null),
    leaf: useRef<SVGPathElement>(null),
    corner: useRef<SVGPathElement>(null),
    ribbon: useRef<SVGPathElement>(null),
    lines: useRef<SVGGElement>(null),
    glow: useRef<SVGCircleElement>(null),
  };

  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Eased values that chase each state's targets, so every change of state is a movement, never a jump.
    const v = { fold: 14, tail: 6, wave: 0.4, lines: 0, glow: 0.12, level: 0, breathe: 0 };
    let raf = 0;
    let last = performance.now();
    const t0 = last;

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = (now - t0) / 1000;
      const s = stateRef.current;
      const ease = (tau: number) => 1 - Math.exp(-dt / tau);

      const raw = s === "speaking" ? getOutputLevel() : s === "listening" ? getInputLevel() : 0;
      v.level += (raw - v.level) * ease(raw > v.level ? 0.05 : 0.18);
      const L = reduce ? 0 : v.level;

      // Targets per state.
      const fold = s === "thinking" && !reduce ? 14 + 8 * (0.5 - 0.5 * Math.cos(t * 2.6)) : 14;
      const tail = s === "speaking" ? 30 + 26 * L : s === "listening" ? 10 : 6;
      const wave = reduce ? 0 : s === "speaking" ? 1.2 + 7 * L : s === "thinking" ? 0.8 : 0.35;
      const lines = s === "listening" ? 1 : s === "thinking" ? 0.35 : 0;
      const glow = s === "speaking" ? 0.22 + 0.5 * L : s === "listening" ? 0.14 + 0.3 * L : s === "thinking" ? 0.16 : 0.1;

      v.fold += (fold - v.fold) * ease(0.12);
      v.tail += (tail - v.tail) * ease(s === "speaking" ? 0.08 : 0.35);
      v.wave += (wave - v.wave) * ease(0.1);
      v.lines += (lines - v.lines) * ease(0.3);
      v.glow += (glow - v.glow) * ease(0.1);

      // Leaf and turned corner (same geometry as the logo, with the fold size free).
      const f = v.fold;
      ref.leaf.current?.setAttribute("d", `M15 12H49a4 4 0 0 1 4 4V${53 - f}L${53 - f} 53H19a4 4 0 0 1-4-4z`);
      ref.corner.current?.setAttribute("d", `M53 ${53 - f}H${57 - f}a4 4 0 0 0-4 4V53z`);

      // The ribbon: anchored under the date line, swinging more toward the tail, with the logo's notched end.
      const top = 19, len = 40 + v.tail, w = 3.5, n = 28;
      const speed = s === "speaking" ? 7 : 3;
      const left: string[] = [], right: string[] = [];
      for (let i = 0; i <= n; i++) {
        const y = top + (len * i) / n;
        const along = i / n;
        const x = 32 + v.wave * along * along * Math.sin(along * 5.2 - t * speed) + (reduce ? 0 : 0.6 * Math.sin(t * 0.9) * along);
        left.push(`${(x - w).toFixed(2)} ${y.toFixed(2)}`);
        right.push(`${(x + w).toFixed(2)} ${y.toFixed(2)}`);
      }
      const endY = top + len;
      const endX = 32 + v.wave * Math.sin(5.2 - t * speed) + (reduce ? 0 : 0.6 * Math.sin(t * 0.9));
      ref.ribbon.current?.setAttribute(
        "d",
        `M${left[0]}L${left.join("L")}L${endX.toFixed(2)} ${(endY - 4).toFixed(2)}L${right[n]}L${right.slice().reverse().join("L")}Z`,
      );

      // Ruled lines: written while you speak.
      const g = ref.lines.current;
      if (g) {
        g.setAttribute("opacity", (0.28 * v.lines + 0.5 * v.lines * L).toFixed(3));
        Array.from(g.children).forEach((line, i) => {
          const y0 = 31 + i * 5;
          const pts: string[] = [];
          for (let x = 19; x <= 47; x += 2) {
            const dy = L * 1.4 * Math.sin(x * 0.8 + t * 9 + i * 1.7);
            pts.push(`${x} ${(y0 + dy).toFixed(2)}`);
          }
          line.setAttribute("points", pts.join(" "));
        });
      }

      // A slow breath for the whole mark, and a warm halo that follows whoever is speaking.
      v.breathe = reduce ? 1 : 1 + 0.012 * Math.sin(t * 1.6) + 0.03 * L;
      ref.body.current?.setAttribute("transform", `translate(32 32) scale(${v.breathe.toFixed(4)}) translate(-32 -32)`);
      ref.glow.current?.setAttribute("opacity", v.glow.toFixed(3));
      ref.glow.current?.setAttribute("r", (40 + 10 * L).toFixed(2));

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // The refs are stable; the level getters come from the voice session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getInputLevel, getOutputLevel]);

  return (
    <svg viewBox="-14 -14 92 130" className={className} role="img" aria-label={`Tareekh, ${state}`}>
      <defs>
        <radialGradient id={`${uid}-halo`}>
          <stop offset="0%" stopColor={BRAND.seal} stopOpacity="0.9" />
          <stop offset="55%" stopColor={BRAND.brass} stopOpacity="0.25" />
          <stop offset="100%" stopColor={BRAND.brass} stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${uid}-tile`}>
          <rect width="64" height="64" rx="14" />
        </clipPath>
      </defs>
      <circle ref={ref.glow} cx="32" cy="34" r="40" fill={`url(#${uid}-halo)`} opacity="0.1" />
      <g ref={ref.body}>
        <rect width="64" height="64" rx="14" fill={BRAND.ink} />
        <g clipPath={`url(#${uid}-tile)`}>
          <path ref={ref.leaf} d="M15 12h34a4 4 0 0 1 4 4v23L39 53H19a4 4 0 0 1-4-4z" fill={BRAND.paper} />
          <g ref={ref.lines} opacity="0" stroke={BRAND.ink} strokeWidth="0.9" strokeLinecap="round" fill="none">
            <polyline points="19 31 47 31" />
            <polyline points="19 36 47 36" />
            <polyline points="19 41 47 41" />
            <polyline points="19 46 47 46" />
          </g>
          <path ref={ref.corner} d="M53 39H43a4 4 0 0 0-4 4v10z" fill={BRAND.brass} />
        </g>
        {/* Outside the clip: the ribbon runs past the edge of the tile, as the red tape runs past a case file. */}
        <path ref={ref.ribbon} d="M28.5 19h7v40l-3.5-4-3.5 4z" fill={BRAND.seal} />
        <rect x="20" y="19" width="24" height="6.5" rx="2" fill={BRAND.ink} />
        <rect x="0.5" y="0.5" width="63" height="63" rx="13.5" fill="none" stroke="#fff" strokeOpacity="0.16" className="hidden dark:block" />
      </g>
    </svg>
  );
}
