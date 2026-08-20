import type { SubgraphPayload } from "../types";
import type { Vec3 } from "./types";

export interface L2Neighborhood {
  packageId: number;
  anchor: Vec3;
  payload: SubgraphPayload;
}
