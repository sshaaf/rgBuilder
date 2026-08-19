import { NODE_TYPE_FILTER_OPTIONS, GRAPH_TYPE_MASK_WITH_DOC_HEADINGS } from "./types";
import { nodeTypeColorForBit } from "./graphColors";

export interface NodeTypeFilterProps {
  mask: number;
  onChange: (mask: number) => void;
  disabled?: boolean;
  layout?: "inline" | "sidebar";
}

export function NodeTypeFilter({
  mask,
  onChange,
  disabled,
  layout = "inline",
}: NodeTypeFilterProps) {
  const toggle = (bit: number) => {
    const next = (mask & bit) !== 0 ? mask & ~bit : mask | bit;
    onChange(next || bit);
  };

  if (layout === "sidebar") {
    return (
      <div class="d-flex flex-column gap-1">
        <div class="d-flex flex-wrap gap-1 mb-2">
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            disabled={disabled}
            onClick={() => onChange(GRAPH_TYPE_MASK_WITH_DOC_HEADINGS)}
          >
            Code + doc headings
          </button>
        </div>
        {NODE_TYPE_FILTER_OPTIONS.map((opt) => (
          <label key={opt.label} class="form-check small mb-0">
            <input
              class="form-check-input"
              type="checkbox"
              checked={(mask & opt.bit) !== 0}
              disabled={disabled}
              onChange={() => toggle(opt.bit)}
            />
            <span class="form-check-label d-inline-flex align-items-center gap-1">
              <span
                class="graph-node-type-swatch"
                style={{ background: nodeTypeColorForBit(opt.bit) }}
                aria-hidden="true"
              />
              {opt.label}
            </span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <div class="d-flex flex-wrap align-items-center gap-2">
      <span class="text-muted small me-1">Node types:</span>
      {NODE_TYPE_FILTER_OPTIONS.map((opt) => (
        <label key={opt.label} class="form-check form-check-inline mb-0 small">
          <input
            class="form-check-input"
            type="checkbox"
            checked={(mask & opt.bit) !== 0}
            disabled={disabled}
            onChange={() => toggle(opt.bit)}
          />
          <span class="form-check-label">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}
