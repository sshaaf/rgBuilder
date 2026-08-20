import type { SubgraphPayload } from "../types";
import type { Vec3 } from "./types";

export type NeighborhoodMode = "package" | "unit" | "call";

export interface L2Neighborhood {
  packageId: number;
  unitId?: number | null;
  anchor: Vec3;
  payload: SubgraphPayload;
  seedIndex?: number | null;
  mode: NeighborhoodMode;
  /** When set, only these node indices are rendered (unit drill-down). */
  filterIndices?: number[] | null;
}
