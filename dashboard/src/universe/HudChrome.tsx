import type { ComponentChildren } from "preact";

export interface HudChromeProps {
  brand: ComponentChildren;
  search: ComponentChildren;
  leftRail: ComponentChildren;
  lodChip: ComponentChildren;
  breadcrumb: ComponentChildren;
  navControls: ComponentChildren;
  status?: ComponentChildren;
}

export function HudChrome({
  brand,
  search,
  leftRail,
  lodChip,
  breadcrumb,
  navControls,
  status,
}: HudChromeProps) {
  return (
    <>
      <header class="universe-hud-top">
        {brand}
        <div class="universe-search-slot">{search}</div>
      </header>
      {leftRail}
      <footer class="universe-hud-bottom">
        {lodChip}
        {breadcrumb}
        {navControls}
      </footer>
      {status ? <div class="universe-status">{status}</div> : null}
    </>
  );
}

export function UniverseBrand() {
  return (
    <div class="universe-brand">
      <span class="universe-brand-logo" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none">
          <path
            d="M10 3.2c3.6 0 6.4 2.4 6.4 5.6 0 2.4-1.8 4-4 4-1.7 0-3-1.2-3-2.8 0-1.2.9-2.1 2-2.1"
            stroke="#8B7CFF"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <path
            d="M10 16.8c-3.6 0-6.4-2.4-6.4-5.6 0-2.4 1.8-4 4-4 1.7 0 3 1.2 3 2.8 0 1.2-.9 2.1-2 2.1"
            stroke="#5B9DF5"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <circle cx="10" cy="10" r="1.3" fill="#EAEDF6" />
        </svg>
      </span>
      <span class="universe-brand-wordmark">
        <span class="rg">rg</span> universe
      </span>
    </div>
  );
}
