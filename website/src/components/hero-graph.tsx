"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Hero graph animation matched to docs/designs-examples/rbuilder-redesign.html:
 * 1) Set dasharray/offset to path length (hidden)
 * 2) Stagger stroke-dashoffset → 0 (1.1s ease, 150 + i*160ms)
 * 3) After draw, restore stroke-dasharray: 6 (dashed "on" edges from the mock CSS)
 * 4) Agent node uses pulseGlow (opacity 1 ↔ 0.45, 2.6s)
 */
const EDGE_PATHS = [
  "M70,60 C110,80 130,110 150,150",
  "M150,150 C190,170 210,175 240,180",
  "M240,180 C280,150 320,110 360,90",
  "M240,180 C270,220 290,250 320,280",
  "M360,90 C390,140 400,180 400,220",
  "M320,280 C350,260 380,240 400,220",
] as const;

const DRAW_MS = 1100;
const STAGGER_MS = 160;
const START_MS = 150;

export function HeroGraph({ className }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const root = svgRef.current;
    if (!root) return;
    const paths = Array.from(
      root.querySelectorAll<SVGPathElement>(".hero-graph-edge.on"),
    );

    const showFinal = (path: SVGPathElement) => {
      // Match redesign runtime: after draw, dasharray stays at path length (solid).
      const len = path.getTotalLength();
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = "0";
      path.style.transition = "none";
    };

    if (reduceMotion) {
      paths.forEach(showFinal);
      return;
    }

    const timers: number[] = [];

    paths.forEach((path) => {
      const len = path.getTotalLength();
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = `${len}`;
      path.style.transition = "none";
    });

    // Double rAF so the initial hidden state paints before the transition
    // (same timing as redesign: 1.1s ease, start 150ms, stagger 160ms).
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        paths.forEach((path, i) => {
          path.style.transition = `stroke-dashoffset ${DRAW_MS}ms ease`;
          timers.push(
            window.setTimeout(() => {
              path.style.strokeDashoffset = "0";
            }, START_MS + i * STAGGER_MS),
          );
        });
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [reduceMotion]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-3.5",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(160deg, var(--graph-glow), transparent 55%)`,
        }}
        aria-hidden
      />
      <svg
        ref={svgRef}
        viewBox="0 0 480 380"
        className="relative z-[1] block h-auto w-full"
        role="img"
        aria-label="Animated knowledge graph: repo to discover to graph to agent"
      >
        {EDGE_PATHS.map((d, i) => (
          <path key={i} className="hero-graph-edge on" d={d} />
        ))}

        <circle
          className="hero-graph-dot"
          cx="70"
          cy="60"
          r="6"
          fill="var(--graph-node-fill)"
          stroke="var(--graph-label)"
          strokeWidth={1.5}
        />
        <text className="hero-graph-label" x="84" y="55">
          repo
        </text>

        <circle
          className="hero-graph-dot"
          cx="150"
          cy="150"
          r="7"
          fill="var(--graph-node-accent-fill)"
          stroke="var(--graph-edge-on)"
          strokeWidth={1.5}
        />
        <text className="hero-graph-label strong" x="164" y="146">
          discover
        </text>

        <circle
          className="hero-graph-dot"
          cx="240"
          cy="180"
          r="7"
          fill="var(--graph-node-accent-fill)"
          stroke="var(--graph-edge-on)"
          strokeWidth={1.5}
        />
        <text className="hero-graph-label strong" x="200" y="205">
          graph
        </text>

        <circle
          className="hero-graph-dot"
          cx="360"
          cy="90"
          r="6"
          fill="var(--graph-amber-fill)"
          stroke="var(--graph-amber)"
          strokeWidth={1.5}
        />
        <text className="hero-graph-label" x="335" y="76">
          blast-radius
        </text>

        <circle
          className="hero-graph-dot"
          cx="320"
          cy="280"
          r="6"
          fill="var(--graph-node-fill)"
          stroke="var(--graph-label)"
          strokeWidth={1.5}
        />
        <text className="hero-graph-label" x="284" y="305">
          semantic query
        </text>

        <circle
          className={cn("hero-graph-dot", !reduceMotion && "hero-graph-pulse")}
          cx="400"
          cy="220"
          r="8"
          fill="var(--graph-node-accent-fill)"
          stroke="var(--graph-edge-on)"
          strokeWidth={2}
        />
        <text className="hero-graph-label strong" x="414" y="216">
          agent
        </text>
      </svg>
    </div>
  );
}
