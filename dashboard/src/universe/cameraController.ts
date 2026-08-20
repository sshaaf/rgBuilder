import type { Vec3 } from "./types";

export const FLY_DURATION_MS = 800;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Cubic ease-in-out (matches design.md 800ms cubic-bezier(0.4,0,0.2,1) approx). */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function flyDurationMs(): number {
  return prefersReducedMotion() ? 0 : FLY_DURATION_MS;
}

/** Eye position looking at a cosmos target from above-forward. */
export function flyCameraPose(
  target: Vec3,
  distance = 260,
): { eye: Vec3; lookAt: Vec3 } {
  return {
    lookAt: { x: target.x, y: target.y, z: target.z },
    eye: {
      x: target.x,
      y: target.y + distance * 0.35,
      z: target.z + distance,
    },
  };
}

export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}
