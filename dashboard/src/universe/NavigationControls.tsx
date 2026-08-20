export interface NavigationControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
}

export function NavigationControls({ onZoomIn, onZoomOut, onRecenter }: NavigationControlsProps) {
  return (
    <div class="universe-ctl" aria-label="Camera controls">
      <button type="button" class="universe-ctl-btn glass" title="Recenter" onClick={onRecenter}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="12" cy="12" r="2.2" />
        </svg>
      </button>
      <div class="universe-ctl-group glass">
        <button type="button" aria-label="Zoom out" onClick={onZoomOut}>
          −
        </button>
        <span class="universe-ctl-vr" />
        <button type="button" aria-label="Zoom in" onClick={onZoomIn}>
          +
        </button>
      </div>
    </div>
  );
}
