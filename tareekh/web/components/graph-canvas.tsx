"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { Graph, GraphLinkType, GraphNode, GraphNodeType } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

type SimNode = GraphNode & SimulationNodeDatum & { degree: number; alpha: number; target: number };
type SimLink = SimulationLinkDatum<SimNode> & { type: GraphLinkType; weight?: number };

export type GraphCanvasHandle = { fit: (ids?: string[]) => void };

const RADIUS: Record<GraphNodeType, number> = { case: 9, judge: 5.5, counsel: 5.5, client: 5.5, note: 3.6, order_sheet: 3.6, document: 3.6, memory: 4.2 };
const LINK_DISTANCE: Record<GraphLinkType, number> = { case: 46, entity: 70, temporal: 26, semantic: 90, memory: 40 };

/** Theme colours come from the CSS tokens, so the graph follows light/dark like everything else. */
function palette() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    bg: v("--background"),
    fg: v("--foreground"),
    muted: v("--muted-foreground"),
    border: v("--border"),
    primary: v("--primary"),
    memo: v("--memo"),
    green: v("--chart-3"),
    seal: "#c2412d",
    card: v("--card"),
    sans: v("--font-geist") || "system-ui, sans-serif",
    mono: v("--font-geist-mono") || "ui-monospace, monospace",
  };
}

function nodeColor(n: GraphNode, p: ReturnType<typeof palette>) {
  switch (n.type) {
    case "note":
      return p.primary;
    case "order_sheet":
      return p.memo;
    case "document":
      return p.green;
    case "memory":
      return p.seal;
    case "case":
      return p.fg;
    default:
      return p.muted;
  }
}

function linkColor(t: GraphLinkType, p: ReturnType<typeof palette>) {
  return t === "semantic" ? p.primary : t === "temporal" ? p.green : t === "entity" ? p.memo : t === "memory" ? p.seal : p.muted;
}

export const GraphCanvas = forwardRef<
  GraphCanvasHandle,
  {
    graph: Graph;
    /** node id -> relevance (0..1+). null = no filter, everything visible */
    focus: Map<string, number> | null;
    selected: string | null;
    onSelect: (n: GraphNode | null) => void;
    className?: string;
  }
>(function GraphCanvas({ graph, focus, selected, onSelect, className }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const view = useRef({ x: 0, y: 0, k: 1 });
  const goal = useRef<{ x: number; y: number; k: number } | null>(null);
  const hover = useRef<SimNode | null>(null);
  const frame = useRef(0);
  const colors = useRef<ReturnType<typeof palette> | null>(null);
  const size = useRef({ w: 0, h: 0 });
  const fitted = useRef(false); // first paint only; never reset the camera on later re-renders
  const { mode } = useTheme();
  const [hoverLabel, setHoverLabel] = useState<{ x: number; y: number; n: SimNode } | null>(null);

  // Layout once per graph: run the simulation to rest off-screen, then draw a still picture (cheap on phones).
  const { nodes, links, byId, neighbours } = useMemo(() => {
    const deg = new Map<string, number>();
    for (const l of graph.links) {
      deg.set(l.source, (deg.get(l.source) ?? 0) + 1);
      deg.set(l.target, (deg.get(l.target) ?? 0) + 1);
    }
    const nodes: SimNode[] = graph.nodes.map((n) => ({ ...n, degree: deg.get(n.id) ?? 0, alpha: 1, target: 1 }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = graph.links
      .filter((l) => byId.has(l.source) && byId.has(l.target))
      .map((l) => ({ source: byId.get(l.source)!, target: byId.get(l.target)!, type: l.type, weight: l.weight }));
    const sim = forceSimulation(nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .distance((l) => LINK_DISTANCE[l.type])
          .strength((l) => (l.type === "semantic" ? 0.15 + (l.weight ?? 0) * 0.5 : l.type === "temporal" ? 0.5 : 0.7)),
      )
      .force("charge", forceManyBody<SimNode>().strength((n) => (n.type === "case" ? -380 : -38)))
      .force("collide", forceCollide<SimNode>((n) => RADIUS[n.type] + 3))
      .force("x", forceX(0).strength(0.04))
      .force("y", forceY(0).strength(0.04))
      .force("center", forceCenter(0, 0))
      .stop();
    for (let i = 0; i < 320; i++) sim.tick();
    const neighbours = new Map<string, Set<string>>();
    for (const l of links) {
      const a = (l.source as SimNode).id;
      const b = (l.target as SimNode).id;
      if (!neighbours.has(a)) neighbours.set(a, new Set());
      if (!neighbours.has(b)) neighbours.set(b, new Set());
      neighbours.get(a)!.add(b);
      neighbours.get(b)!.add(a);
    }
    return { nodes, links, byId, neighbours };
  }, [graph]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const p = colors.current;
    if (!canvas || !p) return false;
    const ctx = canvas.getContext("2d")!;
    const { w, h } = size.current;
    const dpr = window.devicePixelRatio || 1;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ease the camera and node opacities toward their targets
    let moving = false;
    const g = goal.current;
    if (g) {
      const t = reduce ? 1 : 0.18;
      const v = view.current;
      v.x += (g.x - v.x) * t;
      v.y += (g.y - v.y) * t;
      v.k += (g.k - v.k) * t;
      if (Math.abs(g.x - v.x) + Math.abs(g.y - v.y) + Math.abs(g.k - v.k) * 100 < 0.5) {
        Object.assign(v, g);
        goal.current = null;
      } else moving = true;
    }
    for (const n of nodes) {
      if (Math.abs(n.alpha - n.target) > 0.01) {
        n.alpha += (n.target - n.alpha) * (reduce ? 1 : 0.16);
        moving = true;
      } else n.alpha = n.target;
    }

    const { x, y, k } = view.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.translate(w / 2 + x, h / 2 + y);
    ctx.scale(k, k);

    const hov = hover.current;
    const hovN = hov ? neighbours.get(hov.id) : null;

    // links
    ctx.lineCap = "round";
    for (const l of links) {
      const a = l.source as SimNode;
      const b = l.target as SimNode;
      let alpha = Math.min(a.alpha, b.alpha);
      if (hov) alpha = a === hov || b === hov ? 1 : alpha * 0.25;
      if (alpha < 0.02) continue;
      const base = l.type === "semantic" ? 0.22 + (l.weight ?? 0) * 0.6 : l.type === "case" ? 0.2 : 0.3;
      ctx.globalAlpha = Math.min(1, base * alpha * (hov && (a === hov || b === hov) ? 2.4 : 1));
      ctx.strokeStyle = linkColor(l.type, p);
      ctx.lineWidth = (l.type === "semantic" ? 1.1 : 0.8) / Math.sqrt(k);
      ctx.beginPath();
      ctx.moveTo(a.x!, a.y!);
      ctx.lineTo(b.x!, b.y!);
      ctx.stroke();
    }

    // nodes
    for (const n of nodes) {
      let alpha = n.alpha;
      if (hov && n !== hov && !hovN?.has(n.id)) alpha *= 0.3;
      if (alpha < 0.02) continue;
      const r = RADIUS[n.type] + Math.min(n.degree, 12) * (n.type === "case" ? 0.3 : 0.12);
      const rel = focus?.get(n.id);
      ctx.globalAlpha = alpha;
      if (rel !== undefined && n.type !== "case") {
        // matched: a soft halo sized by relevance
        ctx.fillStyle = nodeColor(n, p);
        ctx.globalAlpha = alpha * 0.16;
        ctx.beginPath();
        ctx.arc(n.x!, n.y!, r + 4 + Math.min(rel, 1.5) * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha;
      }
      ctx.beginPath();
      ctx.arc(n.x!, n.y!, r, 0, Math.PI * 2);
      if (n.type === "case") {
        ctx.fillStyle = p.card;
        ctx.fill();
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = p.fg;
        ctx.stroke();
      } else {
        ctx.fillStyle = nodeColor(n, p);
        ctx.fill();
      }
      if (n.id === selected) {
        ctx.lineWidth = 2 / k;
        ctx.strokeStyle = p.fg;
        ctx.beginPath();
        ctx.arc(n.x!, n.y!, r + 3.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // labels: cases always, the best matches, the selection; placed without overlapping
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textBaseline = "middle";
    const placed: [number, number, number, number][] = [];
    const topMatches = focus
      ? new Set([...focus.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id))
      : null;
    const candidates = nodes
      .filter((n) => n.alpha > 0.35 && (n.type === "case" || n.id === selected || topMatches?.has(n.id) || (k > 1.8 && n.type !== "judge" && n.type !== "counsel" && n.type !== "client") || (k > 1.1 && ["judge", "counsel", "client"].includes(n.type))))
      .sort((a, b) => (a.type === "case" ? -1 : 0) - (b.type === "case" ? -1 : 0) || (a.id === selected ? -1 : 0));
    for (const n of candidates) {
      const sx = w / 2 + x + n.x! * k;
      const sy = h / 2 + y + n.y! * k;
      if (sx < -50 || sy < -20 || sx > w + 50 || sy > h + 20) continue;
      const isCase = n.type === "case";
      ctx.font = isCase ? `600 12.5px ${p.sans}` : `11.5px ${p.mono}`;
      const text = isCase ? n.label : n.label.length > 34 ? `${n.label.slice(0, 33)}…` : n.label;
      const tw = ctx.measureText(text).width;
      const lx = sx + RADIUS[n.type] * k + 6;
      const box: [number, number, number, number] = [lx - 3, sy - 8, lx + tw + 3, sy + 8];
      if (placed.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
      placed.push(box);
      ctx.globalAlpha = Math.min(1, n.alpha) * (isCase ? 1 : 0.85);
      ctx.fillStyle = p.bg;
      ctx.globalAlpha *= 0.8;
      ctx.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
      ctx.globalAlpha = Math.min(1, n.alpha) * (isCase ? 1 : 0.85);
      ctx.fillStyle = isCase ? p.fg : p.muted;
      ctx.fillText(text, lx, sy);
    }
    ctx.globalAlpha = 1;
    return moving;
  }, [nodes, links, neighbours, focus, selected]);

  const loop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    const step = () => {
      if (draw()) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, [draw]);

  const fit = useCallback(
    (ids?: string[]) => {
      const pts = (ids?.length ? ids.map((id) => byId.get(id)).filter(Boolean) : nodes) as SimNode[];
      if (!pts.length) return;
      const xs = pts.map((n) => n.x!);
      const ys = pts.map((n) => n.y!);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const { w, h } = size.current;
      const pad = 70;
      const k = Math.max(0.25, Math.min(2.4, Math.min((w - pad * 2) / Math.max(x1 - x0, 1), (h - pad * 2) / Math.max(y1 - y0, 1))));
      goal.current = { k, x: -((x0 + x1) / 2) * k, y: -((y0 + y1) / 2) * k };
      loop();
    },
    [byId, nodes, loop],
  );
  useImperativeHandle(ref, () => ({ fit }), [fit]);

  // fade what the search didn't find; its neighbouring cases stay faintly for context
  useEffect(() => {
    const keep = new Set<string>();
    if (focus) {
      for (const id of focus.keys()) {
        keep.add(id);
        const cid = byId.get(id)?.case_id;
        if (cid) keep.add(`c:${cid}`);
      }
    }
    for (const n of nodes) n.target = !focus ? 1 : focus.has(n.id) ? 1 : keep.has(n.id) ? 0.55 : 0.05;
    loop();
  }, [focus, nodes, byId, loop]);

  // size + theme
  useEffect(() => {
    colors.current = palette();
    loop();
  }, [mode, loop]);

  useEffect(() => {
    const el = wrapRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      size.current = { w: r.width, h: r.height };
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
      if (!fitted.current && r.width > 0) {
        fitted.current = true;
        colors.current = palette();
        fit();
        const g = goal.current;
        if (g) Object.assign(view.current, g); // no zoom-in animation on first paint
        goal.current = null;
      }
      loop();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, loop]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // --- pointer: pan, pinch, wheel zoom, hover, click
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ moved: number; pinch?: number } | null>(null);

  const toWorld = (cx: number, cy: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const { x, y, k } = view.current;
    return { wx: (cx - r.left - size.current.w / 2 - x) / k, wy: (cy - r.top - size.current.h / 2 - y) / k, sx: cx - r.left, sy: cy - r.top };
  };
  const pick = (cx: number, cy: number) => {
    const { wx, wy } = toWorld(cx, cy);
    let best: SimNode | null = null;
    let bestD = Infinity;
    const slop = 8 / view.current.k;
    for (const n of nodes) {
      if (n.alpha < 0.3) continue;
      const d = Math.hypot(n.x! - wx, n.y! - wy);
      if (d < RADIUS[n.type] + slop && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  };
  const zoomAt = (sx: number, sy: number, factor: number) => {
    const v = goal.current ?? { ...view.current };
    const k = Math.max(0.2, Math.min(6, v.k * factor));
    const { w, h } = size.current;
    const px = sx - w / 2;
    const py = sy - h / 2;
    goal.current = { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
    loop();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    canvasRef.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current = { moved: 99, pinch: Math.hypot(a.x - b.x, a.y - b.y) };
    } else drag.current = { moved: 0 };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !drag.current) {
      const n = pick(e.clientX, e.clientY);
      if (n !== hover.current) {
        hover.current = n;
        const { sx, sy } = toWorld(e.clientX, e.clientY);
        setHoverLabel(n ? { x: sx, y: sy, n } : null);
        canvasRef.current!.style.cursor = n ? "pointer" : "grab";
        loop();
      }
      return;
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && drag.current.pinch) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const r = canvasRef.current!.getBoundingClientRect();
      goal.current = null;
      const factor = d / drag.current.pinch;
      drag.current.pinch = d;
      const v = view.current;
      const k = Math.max(0.2, Math.min(6, v.k * factor));
      const px = (a.x + b.x) / 2 - r.left - size.current.w / 2;
      const py = (a.y + b.y) / 2 - r.top - size.current.h / 2;
      Object.assign(v, { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k });
      loop();
      return;
    }
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    drag.current.moved += Math.abs(dx) + Math.abs(dy);
    goal.current = null;
    view.current.x += dx;
    view.current.y += dy;
    if (hoverLabel) setHoverLabel(null);
    loop();
  };
  const endPointer = (e: React.PointerEvent, click: boolean) => {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (pointers.current.size === 0) drag.current = null;
    if (click && d && d.moved < 5 && !d.pinch) {
      const n = pick(e.clientX, e.clientY);
      onSelect(n);
      loop();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  });

  const hn = hoverLabel?.n;
  return (
    <div ref={wrapRef} className={cn("relative overflow-hidden", className)}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Knowledge graph: ${graph.counts.notes} notes across ${graph.counts.cases} cases. Use the list beside it to read them.`}
        className="block touch-none select-none"
        style={{ cursor: "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endPointer(e, true)}
        onPointerCancel={(e) => endPointer(e, false)}
        onPointerLeave={() => {
          if (!drag.current && hover.current) {
            hover.current = null;
            setHoverLabel(null);
            loop();
          }
        }}
      />
      {hn && (
        <div
          className="bg-popover text-popover-foreground border-border pointer-events-none absolute z-10 max-w-72 rounded-lg border px-2.5 py-1.5 text-xs shadow-[var(--shadow-soft)]"
          style={{ left: Math.min(hoverLabel!.x + 14, size.current.w - 290), top: hoverLabel!.y + 12 }}
        >
          <div className="text-muted-foreground tnum mb-0.5">
            {TYPE_LABEL[hn.type]}
            {hn.date ? ` · ${hn.date}` : ""}
            {hn.author ? ` · ${hn.author}` : ""}
          </div>
          <div className="line-clamp-3 leading-snug">{hn.type === "case" ? `${hn.label} · ${hn.sub ?? ""}` : hn.label}</div>
        </div>
      )}
      <div className="absolute right-3 bottom-3 flex flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-soft)]">
        {[
          ["Zoom in", Plus, () => zoomAt(size.current.w / 2, size.current.h / 2, 1.4)],
          ["Zoom out", Minus, () => zoomAt(size.current.w / 2, size.current.h / 2, 1 / 1.4)],
          ["Fit to view", Maximize2, () => fit(focus ? [...focus.keys()] : undefined)],
        ].map(([label, Icon, fn]) => {
          const I = Icon as typeof Plus;
          return (
            <button
              key={label as string}
              onClick={fn as () => void}
              aria-label={label as string}
              title={label as string}
              className="press text-muted-foreground hover:text-foreground hover:bg-accent grid size-10 place-items-center md:size-9"
            >
              <I className="size-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
});

export const TYPE_LABEL: Record<GraphNodeType, string> = {
  note: "Note",
  order_sheet: "Order sheet",
  document: "Document",
  memory: "Remembered from chat",
  case: "Case",
  judge: "Judge",
  counsel: "Opposing counsel",
  client: "Client",
};
