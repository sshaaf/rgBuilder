import type { ComponentChildren } from "preact";
import type { UniverseNavState } from "./lodState";
import { lodLabel } from "./lodState";

export function LodChip({ nav }: { nav: UniverseNavState }) {
  return (
    <div class="universe-lod-chip glass" data-testid="universe-lod-chip">
      L{nav.lod} · {lodLabel(nav.lod)}
    </div>
  );
}
