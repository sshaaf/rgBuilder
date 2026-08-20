import type { UniverseNavState } from "./lodState";

export interface BreadcrumbProps {
  nav: UniverseNavState;
  onNavigate: (index: number) => void;
}

export function Breadcrumb({ nav, onNavigate }: BreadcrumbProps) {
  if (nav.lod === 0) return null;

  const segments: { label: string; index: number }[] = [{ label: "Universe", index: 0 }];
  if (nav.communityLabel) {
    segments.push({ label: nav.communityLabel, index: 1 });
  }
  if (nav.packageLabel) {
    segments.push({ label: nav.packageLabel, index: 2 });
  }
  if (nav.symbolName) {
    segments.push({ label: nav.symbolName, index: 3 });
  }

  return (
    <nav class="universe-breadcrumb" aria-label="Spatial path">
      {segments.map((seg, i) => (
        <span key={`${seg.index}-${seg.label}`} class="universe-breadcrumb-segment">
          {i > 0 ? <span class="universe-breadcrumb-sep">›</span> : null}
          <button
            type="button"
            class="universe-breadcrumb-btn"
            disabled={i === segments.length - 1}
            onClick={() => onNavigate(seg.index)}
          >
            {seg.label}
          </button>
        </span>
      ))}
    </nav>
  );
}
