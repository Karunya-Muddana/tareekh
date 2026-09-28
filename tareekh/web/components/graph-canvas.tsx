"use client";

// Knowledge graph renderer: Sigma.js (WebGL) over a graphology graph, laid out by ForceAtlas2 in a web worker.
// Search relevance, hover and selection are drawn through Sigma's node/edge reducers, so nothing is rebuilt
// when the focus changes; a short tween fades what isn't relevant instead of cutting it.

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type Sigma from "sigma";
import type { default as GraphologyGraph } from "graphology";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { Graph, GraphLinkType, GraphNode, GraphNodeType } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import ShinyText from "@/components/bits/ShinyText";
import { cn } from "@/lib/utils";

export type GraphCanvasHandle = { fit: (ids?: string[]) => void };

type Props = {
  graph: Graph;
  /** node id -> relevance. null = no filter, everything visible */
  focus: Map<string, number> | null;
  selected: string | null;
  onSelect: (n: GraphNode | null) => void;
  /** which kinds of links to draw */
  linkTypes: Set<GraphLinkType>;
  className?: string;
};

type Palette = Record<"bg" | "fg" | "muted" | "primary" | "memo" | "green" | "seal" | "card" | "border", string> & { sans: string };

const SIZE: Record<GraphNodeType, number> = { case: 13, judge: 6.5, counsel: 6.5, client: 6.5, note: 4, order_sheet: 4, document: 4, memory: 5 };

/** CSS colours (oklch tokens included) to rgb, which WebGL understands. */
function toRGB(color: string, probe: CanvasRenderingContext2D) {
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const c = (name: string) => toRGB(css.getPropertyValue(name).trim(), probe);
  return {
    bg: c("--background"),
    card: c("--card"),
    fg: c("--foreground"),
    muted: c("--muted-foreground"),
    border: c("--border"),
    primary: c("--primary"),
    memo: c("--memo"),
    green: c("--chart-3"),
    seal: c("--tape"),
    sans: css.getPropertyValue("--font-anek").trim() || "system-ui, sans-serif",
  };
}

const rgb = (s: string) => s.match(/\d+/g)!.slice(0, 3).map(Number);
/** blend a colour toward another; t=0 → a, t=1 → b */
function mix(a: string, b: string, t: number) {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
}

function nodeColor(type: GraphNodeType, p: Palette) {
  return type === "note" ? p.primary : type === "order_sheet" ? p.memo : type === "document" ? p.green : type === "memory" ? p.seal : type === "case" ? p.card : p.muted;
}
function edgeColor(type: GraphLinkType, p: Palette) {
  const base = type === "semantic" ? p.primary : type === "temporal" ? p.green : type === "entity" ? p.memo : type === "memory" ? p.seal : p.muted;
  return mix(base, p.bg, type === "semantic" ? 0.62 : type === "case" ? 0.72 : 0.55);
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, Props>(function GraphCanvas({ graph, focus, selected, onSelect, linkTypes, className }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const gRef = useRef<GraphologyGraph | null>(null);
  const paletteRef = useRef<Palette | null>(null);
  const state = useRef({
    focus: null as Map<string, number> | null,
    keep: new Set<string>(),
    top: new Set<string>(),
    selected: null as string | null,
    hovered: null as string | null,
    hoverNeighbours: new Set<string>(),
    fade: 1, // 0 → 1 while a new focus eases in
    linkTypes: linkTypes,
  });
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [ready, setReady] = useState(false);
  const [settling, setSettling] = useState(false);
  const { mode } = useTheme();

  const fitTo = async (ids?: string[]) => {
    const s = sigmaRef.current;
    if (!s) return;
    const { getCameraStateToFitViewportToNodes } = await import("@sigma/utils");
    const nodes = ids?.filter((id) => gRef.current?.hasNode(id));
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!nodes?.length) return void s.getCamera().animatedReset({ duration: reduce ? 0 : 500 });
    const target = getCameraStateToFitViewportToNodes(s, nodes);
    // leave room for labels, and never zoom in so far that one match fills the screen
    target.ratio = Math.max(target.ratio * 1.45, 0.22);
    s.getCamera().animate(target, { duration: reduce ? 0 : 650, easing: "cubicInOut" });
  };
  useImperativeHandle(ref, () => ({ fit: (ids) => void fitTo(ids) }));

  // ---- build sigma once per graph
  useEffect(() => {
    let disposed = false;
    let layout: { start: () => void; stop: () => void; kill: () => void } | null = null;
    let stopTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      const [{ default: Graphology }, { default: SigmaCtor }, { default: EdgeCurveProgram }, { createNodeBorderProgram }, fa2, { default: FA2Layout }] =
        await Promise.all([
          import("graphology"),
          import("sigma"),
          import("@sigma/edge-curve"),
          import("@sigma/node-border"),
          import("graphology-layout-forceatlas2"),
          import("graphology-layout-forceatlas2/worker"),
        ]);
      if (disposed || !container.current) return;
      const p = (paletteRef.current = readPalette());

      // Seed positions: each case on a ring, its notes around it, so the layout starts close to its answer.
      const g = new Graphology({ multi: false, type: "undirected" });
      const cases = graph.nodes.filter((n) => n.type === "case");
      const caseAngle = new Map(cases.map((c, i) => [c.id.slice(2), (i / Math.max(cases.length, 1)) * Math.PI * 2]));
      let jitter = 0;
      // Each case starts on a wide ring, with its own notes in a small cloud around it, so clusters begin apart.
      const entityCase = new Map<string, string>();
      for (const l of graph.links) if (l.type === "entity") entityCase.set(l.target, l.source.slice(2));
      for (const n of graph.nodes) {
        const home = n.type === "case" ? n.id.slice(2) : n.case_id ?? entityCase.get(n.id);
        const a = home ? caseAngle.get(home) : undefined;
        const cx = a === undefined ? 0 : Math.cos(a) * 260;
        const cy = a === undefined ? 0 : Math.sin(a) * 260;
        const spread = n.type === "case" ? 0 : 30 + 45 * Math.random();
        const t = Math.random() * Math.PI * 2;
        jitter++;
        g.addNode(n.id, {
          x: cx + Math.cos(t) * spread + (jitter % 7),
          y: cy + Math.sin(t) * spread + (jitter % 5),
          size: SIZE[n.type],
          label: n.type === "case" ? n.label : n.label.length > 42 ? `${n.label.slice(0, 41)}…` : n.label,
          color: nodeColor(n.type, p),
          nodeType: n.type,
          kind: n.type,
          type: n.type === "case" ? "border" : "circle",
          borderColor: p.fg,
          raw: n,
        });
      }
      for (const l of graph.links) {
        if (!g.hasNode(l.source) || !g.hasNode(l.target) || g.hasEdge(l.source, l.target)) continue;
        g.addEdge(l.source, l.target, {
          linkType: l.type,
          size: l.type === "semantic" ? 0.5 + (l.weight ?? 0) * 1.4 : l.type === "case" ? 0.6 : 0.9,
          color: edgeColor(l.type, p),
          // Layout is driven by case, timeline and people; "same topic" links barely pull, so cases don't knot together.
          weight: l.type === "semantic" ? 0.03 : l.type === "temporal" ? 1.2 : l.type === "case" ? 2 : 1,
          type: l.type === "semantic" ? "curve" : "line",
        });
      }
      g.forEachNode((id) => g.mergeNodeAttributes(id, { size: g.getNodeAttribute(id, "size") + Math.min(g.degree(id), 14) * (g.getNodeAttribute(id, "nodeType") === "case" ? 0.35 : 0.14) }));
      gRef.current = g;

      const drawHover = (ctx: CanvasRenderingContext2D, data: { x: number; y: number; size: number; label: string | null; raw?: GraphNode }, settings: { labelSize: number }) => {
        const pal = paletteRef.current!;
        const label = data.label;
        if (!label) return;
        ctx.font = `500 ${settings.labelSize}px ${pal.sans}`;
        const w = ctx.measureText(label).width;
        const h = settings.labelSize + 10;
        const x = data.x + data.size + 4;
        const y = data.y - h / 2;
        ctx.fillStyle = pal.card;
        ctx.shadowColor = "rgba(0,0,0,0.12)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 2;
        ctx.beginPath();
        ctx.roundRect(x - 2, y, w + 16, h, 6);
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.beginPath();
        ctx.arc(data.x, data.y, data.size + 3, 0, Math.PI * 2);
        ctx.fillStyle = pal.card;
        ctx.fill();
        ctx.fillStyle = pal.fg;
        ctx.fillText(label, x + 6, data.y + settings.labelSize / 3);
      };

      const drawLabel = (ctx: CanvasRenderingContext2D, data: { x: number; y: number; size: number; label: string | null; nodeType?: string }, settings: { labelSize: number }) => {
        const pal = paletteRef.current!;
        if (!data.label) return;
        const isCase = data.nodeType === "case";
        const size = isCase ? settings.labelSize + 1.5 : settings.labelSize;
        ctx.font = `${isCase ? 600 : 500} ${size}px ${pal.sans}`;
        const x = data.x + data.size + 5;
        const y = data.y + size / 3;
        ctx.lineJoin = "round";
        ctx.lineWidth = 4;
        ctx.strokeStyle = pal.card;
        ctx.strokeText(data.label, x, y);
        ctx.fillStyle = isCase ? pal.fg : pal.muted;
        ctx.fillText(data.label, x, y);
      };

      const s = new SigmaCtor(g, container.current, {
        renderEdgeLabels: false,
        defaultEdgeType: "line",
        edgeProgramClasses: { curve: EdgeCurveProgram },
        nodeProgramClasses: {
          border: createNodeBorderProgram({
            borders: [
              { size: { value: 0.16 }, color: { attribute: "borderColor" } },
              { size: { fill: true }, color: { attribute: "color" } },
            ],
            drawLabel: drawLabel as never,
            drawHover: drawHover as never,
          }),
        },
        labelFont: p.sans,
        labelSize: 12,
        labelWeight: "500",
        labelColor: { color: p.muted },
        labelDensity: 0.7,
        labelGridCellSize: 110,
        labelRenderedSizeThreshold: 9,
        zIndex: true,
        stagePadding: container.current.clientWidth < 600 ? 28 : 70,
        minCameraRatio: 0.08,
        maxCameraRatio: 4,
        defaultDrawNodeHover: drawHover as never,
        defaultDrawNodeLabel: drawLabel as never,
        nodeReducer: (id, attrs) => reduceNode(id, attrs),
        edgeReducer: (id, attrs) => reduceEdge(id, attrs),
      });
      sigmaRef.current = s;

      function reduceNode(id: string, attrs: Record<string, unknown>) {
        const st = state.current;
        const pal = paletteRef.current!;
        const res: Record<string, unknown> = { ...attrs };
        const isCase = attrs.nodeType === "case";
        if (st.focus) {
          const rel = st.focus.get(id);
          if (rel !== undefined) {
            res.size = (attrs.size as number) * (1 + Math.min(rel, 1.5) * 0.55 * st.fade);
            res.zIndex = 2;
            if (st.top.has(id)) res.forceLabel = true;
          } else if (st.keep.has(id)) {
            res.color = mix(attrs.color as string, pal.bg, 0.45 * st.fade);
            if (isCase) res.borderColor = mix(pal.fg, pal.bg, 0.4 * st.fade);
            res.zIndex = 1;
          } else {
            res.color = mix(attrs.color as string, pal.bg, 0.9 * st.fade);
            if (isCase) res.borderColor = mix(pal.fg, pal.bg, 0.85 * st.fade);
            res.label = st.fade > 0.5 ? null : attrs.label;
            res.zIndex = 0;
          }
        }
        if (st.hovered && id !== st.hovered && !st.hoverNeighbours.has(id)) {
          res.color = mix(res.color as string, pal.bg, 0.7);
          if (isCase) res.borderColor = mix(pal.fg, pal.bg, 0.6);
          res.label = null;
        }
        if (st.hovered && st.hoverNeighbours.has(id)) res.forceLabel = true;
        if (id === st.selected) {
          res.highlighted = true;
          res.zIndex = 3;
        }
        return res;
      }

      function reduceEdge(id: string, attrs: Record<string, unknown>) {
        const st = state.current;
        const pal = paletteRef.current!;
        const res: Record<string, unknown> = { ...attrs };
        const [a, b] = g.extremities(id);
        if (!st.linkTypes.has(attrs.linkType as GraphLinkType)) return { ...res, hidden: true };
        if (st.focus) {
          const inA = st.focus.has(a) || st.keep.has(a);
          const inB = st.focus.has(b) || st.keep.has(b);
          if (!(inA && inB)) {
            if (st.fade > 0.6) res.hidden = true;
            else res.color = mix(attrs.color as string, pal.bg, st.fade * 1.4);
          }
        }
        if (st.hovered) {
          if (a === st.hovered || b === st.hovered) {
            res.color = mix(attrs.color as string, pal.fg, 0.25);
            res.size = (attrs.size as number) * 1.8;
            res.zIndex = 2;
          } else res.color = mix(res.color as string, pal.bg, 0.75);
        }
        return res;
      }

      s.on("enterNode", ({ node }) => {
        state.current.hovered = node;
        state.current.hoverNeighbours = new Set(g.neighbors(node));
        container.current!.style.cursor = "pointer";
        s.refresh({ skipIndexation: true });
      });
      s.on("leaveNode", () => {
        state.current.hovered = null;
        state.current.hoverNeighbours = new Set();
        container.current!.style.cursor = "grab";
        s.refresh({ skipIndexation: true });
      });
      s.on("clickNode", ({ node }) => onSelectRef.current(g.getNodeAttribute(node, "raw") as GraphNode));
      s.on("clickStage", () => onSelectRef.current(null));

      // ForceAtlas2: settle live in a worker (a short, visible "breathing" into place), or at once for reduced motion.
      const settings = { ...fa2.default.inferSettings(g), gravity: 0.35, scalingRatio: 9, slowDown: 5, linLogMode: true, outboundAttractionDistribution: true, adjustSizes: true, barnesHutOptimize: g.order > 400, edgeWeightInfluence: 1 };
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        fa2.default.assign(g, { iterations: 400, settings });
        s.getCamera().setState({ x: 0.5, y: 0.5, ratio: 1 });
      } else {
        fa2.default.assign(g, { iterations: 120, settings });
        layout = new FA2Layout(g, { settings });
        layout.start();
        setSettling(true);
        stopTimer = setTimeout(() => {
          layout?.stop();
          setSettling(false);
        }, 2200);
      }
      setReady(true);
    })();

    return () => {
      disposed = true;
      clearTimeout(stopTimer);
      layout?.kill();
      sigmaRef.current?.kill();
      sigmaRef.current = null;
      gRef.current = null;
      setReady(false);
    };
  }, [graph]);

  // ---- focus: recompute the kept set, then tween the fade
  useEffect(() => {
    const s = sigmaRef.current;
    const g = gRef.current;
    if (!s || !g) return;
    const st = state.current;
    st.focus = focus;
    st.keep = new Set();
    st.top = new Set();
    if (focus) {
      for (const id of focus.keys()) {
        if (!g.hasNode(id)) continue;
        const cid = (g.getNodeAttribute(id, "raw") as GraphNode).case_id;
        if (cid && g.hasNode(`c:${cid}`)) st.keep.add(`c:${cid}`);
      }
      st.top = new Set([...focus.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id));
    }
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = reduce ? 1 : Math.min(1, (t - start) / 380);
      st.fade = 1 - Math.pow(1 - k, 3);
      s.refresh({ skipIndexation: true });
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [focus, ready]);

  useEffect(() => {
    state.current.linkTypes = linkTypes;
    sigmaRef.current?.refresh({ skipIndexation: true });
  }, [linkTypes, ready]);

  useEffect(() => {
    state.current.selected = selected;
    sigmaRef.current?.refresh({ skipIndexation: true });
  }, [selected, ready]);

  // ---- theme: recolour in place
  useEffect(() => {
    const s = sigmaRef.current;
    const g = gRef.current;
    if (!s || !g) return;
    const p = (paletteRef.current = readPalette());
    g.forEachNode((id, a) => g.mergeNodeAttributes(id, { color: nodeColor(a.nodeType, p), borderColor: p.fg }));
    g.forEachEdge((id, a) => g.setEdgeAttribute(id, "color", edgeColor(a.linkType, p)));
    s.setSetting("labelColor", { color: p.muted });
    s.refresh();
  }, [mode, ready]);

  const cam = (fn: (c: ReturnType<Sigma["getCamera"]>) => void) => {
    const s = sigmaRef.current;
    if (s) fn(s.getCamera());
  };

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div
        ref={container}
        role="img"
        aria-label={`Knowledge graph: ${graph.counts.notes} notes across ${graph.counts.cases} cases. Use the list beside it to read them.`}
        className="absolute inset-0 touch-none select-none"
        style={{ cursor: "grab" }}
      />
      {settling && (
        <div className="fade text-muted-foreground pointer-events-none absolute top-4 right-4 font-mono text-[11px]" aria-hidden>
          <ShinyText text="Arranging…" color="var(--muted-foreground)" shineColor="var(--foreground)" speed={1.6} />
        </div>
      )}
      <div className="absolute right-3 bottom-3 flex flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-soft)]">
        {(
          [
            ["Zoom in", Plus, () => cam((c) => c.animatedZoom({ duration: 250 }))],
            ["Zoom out", Minus, () => cam((c) => c.animatedUnzoom({ duration: 250 }))],
            ["Fit to view", Maximize2, () => void fitTo(focus ? [...focus.keys()] : undefined)],
          ] as const
        ).map(([label, I, fn]) => (
          <button key={label} onClick={fn} aria-label={label} title={label} className="press text-muted-foreground hover:text-foreground hover:bg-accent grid size-10 place-items-center md:size-9">
            <I className="size-4" />
          </button>
        ))}
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
