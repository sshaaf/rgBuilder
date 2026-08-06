/* tslint:disable */
/* eslint-disable */

export class EngineContext {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Caller blast radius up to `max_depth` hops on the reverse call graph.
     */
    blastRadius(start_index: number, max_depth: number): string;
    /**
     * Expand metanode member indices into a subgraph JSON payload.
     */
    expandIndices(indices: Uint32Array, type_mask: number): string;
    constructor(bytes: Uint8Array);
    /**
     * Paginated node list filtered by node-type bitmask.
     */
    listNodes(type_mask: number, offset: number, limit: number): string;
    readonly digest: string;
    readonly edge_count: number;
    readonly node_count: number;
    readonly schema_version: number;
}

/**
 * Decode one CFG detail record fetched from `cfg_pdg.record_data.bin`.
 */
export function parseCfgDetail(bytes: Uint8Array): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_enginecontext_free: (a: number, b: number) => void;
    readonly enginecontext_blastRadius: (a: number, b: number, c: number, d: number) => void;
    readonly enginecontext_digest: (a: number, b: number) => void;
    readonly enginecontext_edge_count: (a: number) => number;
    readonly enginecontext_expandIndices: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly enginecontext_from_bytes: (a: number, b: number, c: number) => void;
    readonly enginecontext_listNodes: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly enginecontext_node_count: (a: number) => number;
    readonly enginecontext_schema_version: (a: number) => number;
    readonly parseCfgDetail: (a: number, b: number, c: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export2: (a: number, b: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
