import type { AnalysisToolDef, AnalysisToolId } from "./analysisTools";

const TOOL_ICONS: Record<AnalysisToolId, string> = {
  cfg: "bi-bar-chart-line",
  dataflow: "bi-bezier",
  slice: "bi-scissors",
  blast: "bi-radioactive",
  migration: "bi-signpost-split",
  taint: "bi-bug",
};

export interface LeftRailProps {
  onHome: () => void;
  onFocusSearch: () => void;
  onOpenCommands: () => void;
  onOpenHelp: () => void;
  bridgeEmphasis: boolean;
  onToggleBridgeEmphasis: () => void;
  showSecurityOverlays: boolean;
  onToggleSecurityOverlays: () => void;
  onStub: (label: string) => void;
  analysisTools: AnalysisToolDef[];
  activeAnalysisTool: AnalysisToolId | null;
  onToggleAnalysisTool: (id: AnalysisToolId) => void;
}

export function LeftRail({
  onHome,
  onFocusSearch,
  onOpenCommands,
  onOpenHelp,
  bridgeEmphasis,
  onToggleBridgeEmphasis,
  showSecurityOverlays,
  onToggleSecurityOverlays,
  onStub,
  analysisTools,
  activeAnalysisTool,
  onToggleAnalysisTool,
}: LeftRailProps) {
  return (
    <nav class="universe-rail" aria-label="Universe layers">
      <button
        type="button"
        class="universe-rail-btn active"
        aria-label="Universe home"
        title="Universe · L1"
        onClick={onHome}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <ellipse cx="12" cy="12" rx="9.2" ry="3.9" transform="rotate(-24 12 12)" />
          <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <button
        type="button"
        class="universe-rail-btn"
        aria-label="Search symbols"
        title="Symbols — press / to search"
        onClick={onFocusSearch}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
          <path d="M9 8l-4 4 4 4M15 8l4 4-4 4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        class={`universe-rail-btn${bridgeEmphasis ? " active" : ""}`}
        aria-label="Bridge emphasis"
        aria-pressed={bridgeEmphasis}
        title="Bridge emphasis"
        data-testid="universe-bridge-toggle"
        onClick={onToggleBridgeEmphasis}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="6" cy="6" r="2.3" />
          <circle cx="18.2" cy="8.2" r="2.3" />
          <circle cx="10" cy="18" r="2.3" />
        </svg>
      </button>
      <button
        type="button"
        class={`universe-rail-btn${showSecurityOverlays ? " active" : ""}`}
        aria-label="Security overlays"
        aria-pressed={showSecurityOverlays}
        title="Migration / taint overlays on cosmos"
        data-testid="universe-security-toggle"
        onClick={onToggleSecurityOverlays}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M12 3 4 7v6c0 5 3.5 8 8 8s8-3 8-8V7l-8-4Z" stroke-linejoin="round" />
        </svg>
      </button>

      {analysisTools.length > 0 ? (
        <>
          <div class="universe-rail-divider" aria-hidden="true" />
          {analysisTools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              class={`universe-rail-btn universe-rail-tool${activeAnalysisTool === tool.id ? " active" : ""}`}
              aria-label={tool.label}
              aria-pressed={activeAnalysisTool === tool.id}
              title={tool.title}
              data-testid={tool.testId}
              onClick={() => onToggleAnalysisTool(tool.id)}
            >
              <i class={`bi ${TOOL_ICONS[tool.id]}`} aria-hidden="true" />
            </button>
          ))}
        </>
      ) : null}

      <button
        type="button"
        class="universe-rail-btn"
        aria-label="Metrics overlay"
        title="Metrics overlay"
        onClick={() => onStub("Metrics overlay — export telemetry (#59)")}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M4 18V6M10 18V10M16 18v-5M22 18V4" stroke-linecap="round" />
        </svg>
      </button>
      <button
        type="button"
        class="universe-rail-btn"
        aria-label="Open commands"
        title="Universe commands"
        data-testid="universe-commands-open"
        onClick={onOpenCommands}
      >
        ⌘
      </button>
      <div class="universe-rail-spacer" />
      <button
        type="button"
        class="universe-rail-btn universe-rail-help"
        aria-label="Help"
        title="Help · ?"
        onClick={onOpenHelp}
      >
        ?
      </button>
      <div class="universe-rail-avatar" title="serve mode · local" aria-hidden="true" />
    </nav>
  );
}

/** @deprecated use LeftRail */
export function SideNav({ onOpenCommands }: { onOpenCommands?: () => void }) {
  return (
    <LeftRail
      onHome={() => {}}
      onFocusSearch={() => {}}
      onOpenCommands={onOpenCommands ?? (() => {})}
      onOpenHelp={() => {}}
      bridgeEmphasis={false}
      onToggleBridgeEmphasis={() => {}}
      showSecurityOverlays={true}
      onToggleSecurityOverlays={() => {}}
      onStub={() => {}}
      analysisTools={[]}
      activeAnalysisTool={null}
      onToggleAnalysisTool={() => {}}
    />
  );
}
