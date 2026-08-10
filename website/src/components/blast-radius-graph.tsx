"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type GraphSceneId =
  | "blast-radius"
  | "gql"
  | "semantic"
  | "cpg"
  | "metrics"
  | "taint"
  | "communities"
  | "migration";

type NodeRole = "dim" | "focus" | "hit";

type GraphNode = {
  x: number;
  y: number;
  r: number;
  label: string;
  lx: number;
  ly: number;
  role: NodeRole;
};

type GraphScene = {
  aria: string;
  fig: string;
  stats: string;
  dimEdges: string[];
  hotEdges: string[];
  /** Paths particles travel (one or more). */
  particles: { d: string; period: number; phase: number }[];
  nodes: GraphNode[];
};

const SCENES: Record<GraphSceneId, GraphScene> = {
  "blast-radius": {
    aria: "Call graph showing blast radius of priceShoppingCart",
    fig: "Fig. blast radius, depth 2",
    stats: "5 edges · 4 impacted",
    dimEdges: [
      "M70,50 C140,30 180,30 230,42",
      "M60,290 C100,250 120,230 158,200",
    ],
    hotEdges: [
      "M230,42 C270,90 285,120 295,160",
      "M295,160 C240,180 200,190 158,200",
      "M295,160 C280,220 265,250 250,285",
      "M295,160 C340,200 370,225 400,255",
      "M250,285 C300,280 350,270 398,258",
    ],
    particles: [
      {
        d: "M230,42 C270,90 285,120 295,160 C280,220 265,250 250,285 C300,280 350,270 398,258",
        period: 3000,
        phase: 0,
      },
    ],
    nodes: [
      { x: 70, y: 50, r: 9, label: "main.rs", lx: 86, ly: 46, role: "dim" },
      {
        x: 230,
        y: 42,
        r: 9,
        label: "CartController",
        lx: 246,
        ly: 38,
        role: "dim",
      },
      {
        x: 295,
        y: 160,
        r: 13,
        label: "priceShoppingCart()",
        lx: 315,
        ly: 150,
        role: "focus",
      },
      {
        x: 158,
        y: 200,
        r: 9,
        label: "PaymentGateway",
        lx: 30,
        ly: 188,
        role: "hit",
      },
      {
        x: 60,
        y: 290,
        r: 9,
        label: "InventoryService",
        lx: 30,
        ly: 318,
        role: "dim",
      },
      {
        x: 250,
        y: 285,
        r: 9,
        label: "OrderRepository",
        lx: 196,
        ly: 315,
        role: "hit",
      },
      {
        x: 400,
        y: 255,
        r: 9,
        label: "TaxCalculator",
        lx: 356,
        ly: 240,
        role: "hit",
      },
    ],
  },

  gql: {
    aria: "GQL inventory query highlighting matched functions",
    fig: "Fig. gql · all_functions",
    stats: "MATCH · typed edges",
    dimEdges: [
      "M80,80 C140,60 200,60 260,80",
      "M260,80 C320,100 360,140 380,200",
      "M80,80 C100,160 120,220 160,280",
      "M160,280 C240,300 320,280 380,200",
    ],
    hotEdges: [
      "M80,80 C160,120 200,160 240,200",
      "M240,200 C280,220 320,210 360,180",
    ],
    particles: [
      {
        d: "M80,80 C160,120 200,160 240,200 C280,220 320,210 360,180",
        period: 2800,
        phase: 0,
      },
      {
        d: "M160,280 C240,300 320,280 380,200",
        period: 3400,
        phase: 900,
      },
    ],
    nodes: [
      { x: 80, y: 80, r: 9, label: ":Function", lx: 96, ly: 76, role: "dim" },
      { x: 260, y: 80, r: 8, label: ":Class", lx: 274, ly: 76, role: "dim" },
      {
        x: 240,
        y: 200,
        r: 12,
        label: "priceShoppingCart",
        lx: 258,
        ly: 190,
        role: "focus",
      },
      { x: 360, y: 180, r: 9, label: "CALLS→", lx: 374, ly: 176, role: "hit" },
      { x: 160, y: 280, r: 8, label: "rows[]", lx: 174, ly: 276, role: "hit" },
      { x: 380, y: 200, r: 8, label: "schema_v1", lx: 340, ly: 230, role: "dim" },
    ],
  },

  semantic: {
    aria: "Semantic search hits lighting up related functions",
    fig: "Fig. semantic · checkout flow",
    stats: "top hit · score 0.91",
    dimEdges: [
      "M90,120 C150,80 220,70 300,90",
      "M300,90 C360,120 400,170 410,230",
      "M90,120 C80,180 90,240 140,290",
    ],
    hotEdges: [
      "M220,200 C260,160 290,130 300,90",
      "M220,200 C180,230 160,260 140,290",
      "M220,200 C280,220 340,230 410,230",
    ],
    particles: [
      {
        d: "M300,90 C290,130 260,160 220,200 C280,220 340,230 410,230",
        period: 3200,
        phase: 0,
      },
      {
        d: "M220,200 C180,230 160,260 140,290",
        period: 2600,
        phase: 700,
      },
    ],
    nodes: [
      { x: 300, y: 90, r: 8, label: '"checkout"', lx: 314, ly: 86, role: "dim" },
      {
        x: 220,
        y: 200,
        r: 13,
        label: "priceShoppingCart",
        lx: 238,
        ly: 190,
        role: "focus",
      },
      { x: 140, y: 290, r: 9, label: "CartService", lx: 40, ly: 295, role: "hit" },
      {
        x: 410,
        y: 230,
        r: 9,
        label: "CheckoutCtrl",
        lx: 330,
        ly: 255,
        role: "hit",
      },
      { x: 90, y: 120, r: 7, label: "embed", lx: 104, ly: 116, role: "dim" },
    ],
  },

  cpg: {
    aria: "CPG slice with CALL CFG and PDG edges",
    fig: "Fig. cpg · slice",
    stats: "24 nodes · DFG+CFG",
    dimEdges: [
      "M70,60 C120,50 180,55 230,80",
      "M400,70 C420,140 410,210 380,270",
    ],
    hotEdges: [
      "M230,80 C250,130 255,170 250,210",
      "M250,210 C200,230 150,240 110,250",
      "M250,210 C300,240 340,255 380,270",
      "M110,250 C180,280 260,290 330,280",
    ],
    particles: [
      {
        d: "M230,80 C250,130 255,170 250,210 C300,240 340,255 380,270",
        period: 3000,
        phase: 0,
      },
      {
        d: "M250,210 C200,230 150,240 110,250 C180,280 260,290 330,280",
        period: 3600,
        phase: 1100,
      },
    ],
    nodes: [
      { x: 230, y: 80, r: 9, label: "CALL", lx: 244, ly: 76, role: "dim" },
      { x: 250, y: 210, r: 12, label: "CFG/PDG", lx: 268, ly: 200, role: "focus" },
      { x: 110, y: 250, r: 9, label: "data-dep", lx: 40, ly: 245, role: "hit" },
      { x: 380, y: 270, r: 9, label: "ctrl-dep", lx: 320, ly: 300, role: "hit" },
      { x: 70, y: 60, r: 7, label: "AST", lx: 84, ly: 56, role: "dim" },
      { x: 400, y: 70, r: 7, label: "slice", lx: 350, ly: 66, role: "dim" },
      { x: 330, y: 280, r: 8, label: "stmt", lx: 344, ly: 276, role: "hit" },
    ],
  },

  metrics: {
    aria: "Centrality hotspots with PageRank emphasis",
    fig: "Fig. metrics · pagerank",
    stats: "hotspots ranked",
    dimEdges: [
      "M100,100 C160,80 220,90 280,120",
      "M280,120 C340,150 380,200 390,260",
      "M100,100 C90,170 100,230 140,290",
      "M140,290 C220,310 300,300 390,260",
    ],
    hotEdges: [
      "M240,180 C260,150 270,135 280,120",
      "M240,180 C200,200 170,240 140,290",
      "M240,180 C300,200 350,230 390,260",
      "M240,180 C180,140 140,120 100,100",
    ],
    particles: [
      {
        d: "M100,100 C180,140 210,160 240,180 C300,200 350,230 390,260",
        period: 3100,
        phase: 0,
      },
      {
        d: "M240,180 C200,200 170,240 140,290",
        period: 2500,
        phase: 800,
      },
    ],
    nodes: [
      {
        x: 240,
        y: 180,
        r: 14,
        label: "CartController",
        lx: 258,
        ly: 170,
        role: "focus",
      },
      { x: 280, y: 120, r: 9, label: "pr 0.082", lx: 294, ly: 116, role: "hit" },
      { x: 140, y: 290, r: 8, label: "harmonic", lx: 40, ly: 295, role: "hit" },
      { x: 390, y: 260, r: 8, label: "betweenness", lx: 310, ly: 290, role: "hit" },
      { x: 100, y: 100, r: 7, label: "node", lx: 114, ly: 96, role: "dim" },
    ],
  },

  taint: {
    aria: "Taint flow from source to sink",
    fig: "Fig. taint · source→sink",
    stats: "3 paths · PaymentGateway",
    dimEdges: [
      "M70,80 C130,60 200,70 260,100",
      "M70,260 C120,280 180,290 240,280",
    ],
    hotEdges: [
      "M90,160 C150,150 200,145 250,150",
      "M250,150 C300,160 350,180 400,210",
      "M250,150 C280,200 300,240 320,280",
    ],
    particles: [
      {
        d: "M90,160 C150,150 200,145 250,150 C300,160 350,180 400,210",
        period: 2900,
        phase: 0,
      },
      {
        d: "M90,160 C150,150 200,145 250,150 C280,200 300,240 320,280",
        period: 3400,
        phase: 1000,
      },
    ],
    nodes: [
      { x: 90, y: 160, r: 11, label: "SOURCE", lx: 106, ly: 156, role: "focus" },
      { x: 250, y: 150, r: 9, label: "sanitize?", lx: 264, ly: 146, role: "dim" },
      {
        x: 400,
        y: 210,
        r: 11,
        label: "PaymentGateway",
        lx: 300,
        ly: 236,
        role: "hit",
      },
      { x: 320, y: 280, r: 9, label: "SINK", lx: 334, ly: 276, role: "hit" },
      { x: 70, y: 80, r: 7, label: "input", lx: 84, ly: 76, role: "dim" },
      { x: 70, y: 260, r: 7, label: "CVE tag", lx: 84, ly: 256, role: "dim" },
    ],
  },

  communities: {
    aria: "Community clusters in the codebase graph",
    fig: "Fig. communities",
    stats: "cluster 12 · cart",
    dimEdges: [
      "M120,100 C180,90 240,95 300,120",
      "M300,120 C350,160 370,210 360,260",
      "M120,100 C90,160 90,220 120,270",
      "M120,270 C180,300 260,300 340,280",
    ],
    hotEdges: [
      "M200,180 C230,150 260,140 300,120",
      "M200,180 C170,200 145,235 120,270",
      "M200,180 C240,210 280,240 320,250",
      "M200,180 C160,150 140,130 120,100",
    ],
    particles: [
      {
        d: "M120,100 C160,150 180,165 200,180 C240,210 280,240 320,250",
        period: 3300,
        phase: 0,
      },
      {
        d: "M200,180 C170,200 145,235 120,270 C180,300 260,300 340,280",
        period: 3800,
        phase: 1200,
      },
    ],
    nodes: [
      {
        x: 200,
        y: 180,
        r: 14,
        label: "community 12",
        lx: 218,
        ly: 170,
        role: "focus",
      },
      { x: 120, y: 100, r: 8, label: "cart", lx: 134, ly: 96, role: "hit" },
      { x: 300, y: 120, r: 8, label: "pricing", lx: 314, ly: 116, role: "hit" },
      { x: 120, y: 270, r: 8, label: "orders", lx: 40, ly: 275, role: "hit" },
      { x: 320, y: 250, r: 8, label: "payment", lx: 334, ly: 246, role: "dim" },
      { x: 360, y: 260, r: 7, label: "other", lx: 374, ly: 256, role: "dim" },
    ],
  },

  migration: {
    aria: "Migration plan priority path through hotspots",
    fig: "Fig. migration · plan",
    stats: "priority · check OK",
    dimEdges: [
      "M80,80 C140,60 200,55 270,70",
      "M80,280 C150,300 240,300 330,280",
    ],
    hotEdges: [
      "M100,160 C160,140 210,130 250,140",
      "M250,140 C300,155 340,180 380,210",
      "M250,140 C270,190 290,230 320,270",
      "M100,160 C120,210 140,250 170,280",
    ],
    particles: [
      {
        d: "M100,160 C160,140 210,130 250,140 C300,155 340,180 380,210",
        period: 3000,
        phase: 0,
      },
      {
        d: "M100,160 C160,140 210,130 250,140 C270,190 290,230 320,270",
        period: 3500,
        phase: 900,
      },
    ],
    nodes: [
      {
        x: 100,
        y: 160,
        r: 11,
        label: "P0 package",
        lx: 116,
        ly: 156,
        role: "focus",
      },
      { x: 250, y: 140, r: 9, label: "blast↑", lx: 264, ly: 136, role: "hit" },
      { x: 380, y: 210, r: 10, label: "migrate", lx: 320, ly: 236, role: "hit" },
      { x: 320, y: 270, r: 9, label: "check ✓", lx: 334, ly: 266, role: "hit" },
      { x: 170, y: 280, r: 8, label: "P1", lx: 184, ly: 276, role: "dim" },
      { x: 270, y: 70, r: 7, label: "hints.json", lx: 284, ly: 66, role: "dim" },
    ],
  },
};

function fillFor(role: NodeRole): string {
  if (role === "focus") return "var(--graph-focus)";
  if (role === "hit") return "var(--graph-edge-on)";
  return "var(--surface)";
}

function strokeFor(role: NodeRole): string {
  if (role === "hit") return "var(--graph-edge-on)";
  return "var(--ink)";
}

function textFill(role: NodeRole): string {
  if (role === "hit") return "var(--graph-edge-on)";
  if (role === "focus") return "var(--ink)";
  return "var(--body)";
}

export function CapabilityGraph({
  sceneId,
  className,
}: {
  sceneId: GraphSceneId;
  className?: string;
}) {
  const scene = SCENES[sceneId];
  const pathRefs = useRef<Map<number, SVGPathElement>>(new Map());
  const dotRefs = useRef<Map<number, SVGCircleElement>>(new Map());
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;

    let raf = 0;
    let start = 0;
    let stopped = false;

    const kickoff = window.setTimeout(() => {
      if (stopped) return;
      start = performance.now();
      const tick = (now: number) => {
        if (stopped) return;
        const t = now - start;
        scene.particles.forEach((p, i) => {
          const path = pathRefs.current.get(i);
          const dot = dotRefs.current.get(i);
          if (!path || !dot) return;
          const len = path.getTotalLength();
          if (len <= 0) return;
          const local = ((t + p.phase) % p.period) / p.period;
          const pt = path.getPointAtLength(local * len);
          // setAttribute is reliable across Firefox + Chromium for SVG
          dot.setAttribute("cx", pt.x.toFixed(2));
          dot.setAttribute("cy", pt.y.toFixed(2));
          dot.setAttribute("opacity", "1");
        });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, 50);

    return () => {
      stopped = true;
      clearTimeout(kickoff);
      cancelAnimationFrame(raf);
    };
  }, [reduceMotion, scene, sceneId]);

  return (
    <div className={cn("w-full", className)} data-graph-scene={sceneId}>
      <svg
        viewBox="0 0 480 340"
        className="block h-auto w-full"
        role="img"
        aria-label={scene.aria}
      >
        <g fill="none">
          {scene.dimEdges.map((d) => (
            <path key={`d-${d}`} d={d} stroke="var(--hairline)" strokeWidth={1.5} />
          ))}
          {scene.hotEdges.map((d) => (
            <path
              key={`h-${d}`}
              d={d}
              stroke="var(--graph-edge-on)"
              strokeWidth={2}
            />
          ))}
        </g>

        {scene.particles.map((p, i) => (
          <path
            key={`pp-${sceneId}-${i}`}
            ref={(el) => {
              if (el) pathRefs.current.set(i, el);
              else pathRefs.current.delete(i);
            }}
            d={p.d}
            fill="none"
            stroke="none"
            aria-hidden
          />
        ))}

        {scene.nodes.map((n) => (
          <g key={`${sceneId}-${n.label}`}>
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={fillFor(n.role)}
              stroke={strokeFor(n.role)}
              strokeWidth={n.role === "focus" ? 2 : 1.5}
              opacity={n.role === "hit" ? 0.92 : 1}
            />
            <text
              x={n.lx}
              y={n.ly}
              style={{
                fill: textFill(n.role),
                fontWeight: 700,
                fontSize: 11,
                fontFamily: "var(--font-mono), ui-monospace, monospace",
              }}
            >
              {n.label}
            </text>
          </g>
        ))}

        {!reduceMotion &&
          scene.particles.map((_, i) => (
            <circle
              key={`dot-${sceneId}-${i}`}
              ref={(el) => {
                if (el) dotRefs.current.set(i, el);
                else dotRefs.current.delete(i);
              }}
              r={4.5}
              fill="var(--graph-edge-on)"
              opacity={0}
              style={{ pointerEvents: "none" }}
              data-particle={i}
            />
          ))}
      </svg>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em] text-[var(--mute)]">
        <span>{scene.fig}</span>
        <span>{scene.stats}</span>
      </div>
    </div>
  );
}

/** @deprecated use CapabilityGraph */
export function BlastRadiusGraph({ className }: { className?: string }) {
  return <CapabilityGraph sceneId="blast-radius" className={className} />;
}
