import { bundleDataUrl } from "../bundleUrl";
import type { CfgIndexPayload, SliceIndexPayload } from "../types";

let sliceIndexPromise: Promise<SliceIndexPayload | null> | null = null;
let cfgIndexPromise: Promise<CfgIndexPayload | null> | null = null;

async function loadSliceIndex(): Promise<SliceIndexPayload | null> {
  if (!sliceIndexPromise) {
    sliceIndexPromise = fetch(bundleDataUrl("slice_index.json"))
      .then((r) => (r.ok ? (r.json() as Promise<SliceIndexPayload>) : null))
      .catch(() => null);
  }
  return sliceIndexPromise;
}

async function loadCfgIndex(): Promise<CfgIndexPayload | null> {
  if (!cfgIndexPromise) {
    cfgIndexPromise = fetch(bundleDataUrl("cfg_index.json"))
      .then((r) => (r.ok ? (r.json() as Promise<CfgIndexPayload>) : null))
      .catch(() => null);
  }
  return cfgIndexPromise;
}

/** Resolve graph function_id (UUID) from symbol name for analysis tabs. */
export async function resolveFunctionId(
  name: string,
  filePath?: string | null,
): Promise<string | null> {
  const [slice, cfg] = await Promise.all([loadSliceIndex(), loadCfgIndex()]);
  const pools = [
    ...(slice?.available ? slice.functions : []),
    ...(cfg?.available ? cfg.functions : []),
  ];
  if (pools.length === 0) return null;

  const exact = pools.find(
    (f) => f.name === name && (!filePath || f.file_path === filePath),
  );
  if (exact) return exact.function_id;

  const byName = pools.find((f) => f.name === name);
  return byName?.function_id ?? null;
}
