export interface HelpOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function HelpOverlay({ open, onClose }: HelpOverlayProps) {
  if (!open) return null;

  return (
    <div
      class="universe-help-overlay open"
      role="dialog"
      aria-labelledby="universe-help-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div class="universe-help-card">
        <h2 id="universe-help-title">
          <span class="rg">rg</span> universe
        </h2>
        <p>
          One viewport, no tabs. Communities are galaxies — zoom in for packages and functions,
          search to fly anywhere.
        </p>
        <div class="universe-help-rows">
          <div class="universe-help-row">
            <span class="k">CLICK</span>
            <span class="t">Fly into a community, package, or function</span>
          </div>
          <div class="universe-help-row">
            <span class="k">DRAG</span>
            <span class="t">Orbit the cosmos (scroll to zoom)</span>
          </div>
          <div class="universe-help-row">
            <span class="k">/ or ⌘K</span>
            <span class="t">Search — name, community, or semantic when served</span>
          </div>
          <div class="universe-help-row">
            <span class="k">ESC</span>
            <span class="t">Back one level · close panel or help</span>
          </div>
        </div>
        <button type="button" class="universe-help-dismiss" onClick={onClose}>
          Enter the universe
        </button>
      </div>
    </div>
  );
}
