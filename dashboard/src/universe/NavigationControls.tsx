export interface NavigationControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
}

export function NavigationControls({ onZoomIn, onZoomOut, onRecenter }: NavigationControlsProps) {
  return (
    <div class="universe-nav-controls" aria-label="Camera controls">
      <button type="button" class="universe-nav-ctl" title="Zoom in" onClick={onZoomIn}>
        +
      </button>
      <button type="button" class="universe-nav-ctl" title="Zoom out" onClick={onZoomOut}>
        −
      </button>
      <button type="button" class="universe-nav-ctl" title="Recenter view" onClick={onRecenter}>
        ◎
      </button>
    </div>
  );
}
