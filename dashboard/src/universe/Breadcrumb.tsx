import type { UniverseNavState } from "./lodState";
import { breadcrumbSegments, canSkipL4, navFromBreadcrumbIndex } from "./lodState";
import type { UniverseLayout } from "./types";
import { findPackage } from "./selectionPanelHelpers";

export interface BreadcrumbProps {
  nav: UniverseNavState;
  layout: UniverseLayout | null;
  onNavigate: (index: number) => void;
}

export function Breadcrumb({ nav, layout, onNavigate }: BreadcrumbProps) {
  if (nav.lod <= 1) return null;

  const pkg =
    nav.packageId != null && layout ? findPackage(layout, nav.packageId) : undefined;
  const skipL4 = canSkipL4(pkg);
  const segments = breadcrumbSegments(nav, skipL4);

  return (
    <nav class="universe-breadcrumb glass" aria-label="Spatial path">
      <svg class="universe-breadcrumb-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M10 3.2c3.6 0 6.4 2.4 6.4 5.6 0 2.4-1.8 4-4 4-1.7 0-3-1.2-3-2.8 0-1.2.9-2.1 2-2.1"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
      {segments.map((seg, i) => (
        <span key={`${seg.navIndex}-${seg.label}`} class="universe-breadcrumb-segment">
          {i > 0 ? <span class="universe-breadcrumb-sep">›</span> : null}
          <button
            type="button"
            class={`universe-breadcrumb-btn${i === segments.length - 1 ? " here" : ""}`}
            disabled={i === segments.length - 1}
            onClick={() => onNavigate(seg.navIndex)}
          >
            {seg.label}
          </button>
        </span>
      ))}
    </nav>
  );
}

/** @deprecated internal — use breadcrumbSegments + navFromBreadcrumbIndex */
export { navFromBreadcrumbIndex };
