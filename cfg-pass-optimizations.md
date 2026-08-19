# CFG Pass (`--with-cfg`) Refactoring Plan

## Current Architecture

```
  preload_file_sources()             Rayon par_iter per unique file path
         |                           → fs::read_to_string → Arc<String>
         v
  flatten_work_items()               Build (func_idx, file_path, language) tuples
         |
         v
  Rayon par_iter.map_init()          Per-worker HashMap<String, ParsedSourceFile>
         |
         +-- per function:
         |     analyze_function_in_file()
         |       try_fast_cache_hit()     → check stable_key in analysis index
         |       try_remap_cached()       → same hash, different UUID
         |       compute_function_cfg()
         |         ParsedSourceFile::parse() or cache hit
         |         build_cfg()            → CfgBuilder on tree-sitter AST
         |         DominatorTree::build() → iterative Cooper-Harvey-Kennedy
         |         PDG::build()           → reaching defs + data deps
         |         TaintAnalyzer          → optional source/sink pattern match
         |         archive_record_from_analysis() → clone CFG + Arc<PDG>
         |
         v
  Sequential collect + save          saves.par_iter → storage.save_function_no_index()
         |
         v
  sync + purge                       Align analysis index UUIDs, remove orphans
```

Key properties:
- File I/O is parallelized and cached (one `Arc<String>` per file path)
- Tree-sitter parse is cached per worker via `map_init(HashMap<String, ParsedSourceFile>)`
- The per-function pipeline is embarrassingly parallel (no shared mutable state)
- Incremental: functions with matching `stable_key` (file+name+code_hash) skip recompute
- `language_profile::parse_source` already uses `thread_local!` parser pooling

---

## Issue 1: `DominatorTree::build` iterates reachable blocks in HashSet order

**File:** `crates/rgbuilder-analysis/src/dominance.rs:24-57`

```rust
let reachable = cfg.reachable_blocks();           // HashSet<BlockId>
let block_order = compute_block_order(cfg, &reachable);  // DFS order map

let mut changed = true;
while changed {
    changed = false;
    for &block_id in reachable.iter() {           // ← HashSet iteration = random order
        // ...
        new_idom = intersect(&idom, &block_order, new_idom, pred);
        // ...
    }
}
```

The Cooper-Harvey-Kennedy algorithm converges faster (often in 2 passes) when blocks are
visited in **reverse post-order (RPO)**. Iterating `HashSet` gives random order, which
can require 5-10+ passes on graphs with nested loops.

`compute_block_order` already computes a DFS traversal order — but it uses a stack-based
DFS that doesn't yield RPO. And the result (`HashMap<BlockId, usize>`) is only used by
`intersect` for ordering, not for iteration.

**Refactoring:**

1. Compute RPO during `compute_block_order` using standard DFS-finish-time reversal:
```rust
fn compute_rpo(cfg: &ControlFlowGraph, reachable: &HashSet<BlockId>) -> Vec<BlockId> {
    let mut visited = HashSet::new();
    let mut post_order = Vec::new();
    fn dfs(cfg: &ControlFlowGraph, block: BlockId, reachable: &HashSet<BlockId>,
           visited: &mut HashSet<BlockId>, post_order: &mut Vec<BlockId>) {
        if !visited.insert(block) { return; }
        for &succ in cfg.successors(block) {
            if reachable.contains(&succ) {
                dfs(cfg, succ, reachable, visited, post_order);
            }
        }
        post_order.push(block);
    }
    dfs(cfg, cfg.entry, reachable, &mut visited, &mut post_order);
    post_order.reverse();
    post_order
}
```

2. Replace `for &block_id in reachable.iter()` with `for &block_id in &rpo_order`.

3. Build `block_order` from the RPO `Vec` instead of a separate DFS.

**Impact:** Reduces dominator convergence iterations from 5-10+ to 2-3 on typical
software CFGs. On functions with deeply nested loops (common in C kernel code), this
can be a 3-5x speedup per function.

---

## Issue 2: `archive_record_from_analysis` clones the entire CFG and PDG

**File:** `src/cli/discover_cfg.rs:653-670`

```rust
fn archive_record_from_analysis(...) -> Option<CfgPdgRecord> {
    match (&analysis.cfg, &analysis.pdg) {
        (Some(cfg), Some(pdg)) => Some(CfgPdgRecord {
            cfg: cfg.clone(),           // full deep clone of ControlFlowGraph
            pdg: Arc::new(pdg.clone()), // full deep clone of ProgramDependenceGraph
            // ...
        }),
        _ => None,
    }
}
```

The CFG and PDG are cloned to create an archive record, then the originals are stored in
`FunctionAnalysis`. Both the `FunctionAnalysis` and the `CfgPdgRecord` are kept alive
until after the parallel phase completes — the analysis is saved to storage, then the
archive records are written.

For a Linux kernel function with 200 blocks and 1000 data dependencies, the CFG clone
copies ~200 `BasicBlock` structs (each containing `Vec<Statement>` with `HashSet<String>`
def/use sets) and ~200 edges. The PDG clone copies ~1000 `DataDependency` structs.

**Refactoring:**

Move the CFG/PDG into the archive record instead of cloning:

```rust
fn compute_from_cfg(...) -> Option<CfgFunctionWork> {
    // ... build cfg_data, dom_data, pdg_data, taint_data ...

    let archive_record = match (&cfg_data, &pdg_data) {
        (cfg, Some(pdg)) => Some(CfgPdgRecord {
            cfg: cfg.clone(),       // still need one copy for archive
            pdg: Arc::new(pdg.clone()),
            // ...
        }),
        _ => None,
    };

    // The analysis keeps the originals — but we only need CFG/PDG for the archive.
    // After saving to storage, neither is needed again.
    let analysis = FunctionAnalysis {
        cfg: if archive_record.is_some() { None } else { Some(cfg_data) },
        pdg: if archive_record.is_some() { None } else { pdg_data },
        // ...
    };
```

Actually the cleaner approach: build `CfgPdgRecord` directly from the computed data,
then extract what `FunctionAnalysis` needs (just the code_hash and flow counts for the
index):

```rust
// Build archive record, consuming cfg_data and pdg_data
let archive_record = Some(CfgPdgRecord {
    cfg: cfg_data,                    // move, not clone
    pdg: Arc::new(pdg_data.unwrap()), // move, not clone
    // ...
});

// FunctionAnalysis only needs metadata for storage index
let analysis = FunctionAnalysis {
    cfg: None,     // archive owns it
    pdg: None,     // archive owns it
    code_hash: Some(code_hash.to_string()),
    taint: taint_data,
    // ...
};
```

This requires the storage save path to handle `cfg: None` / `pdg: None` when the archive
is the canonical owner. Check whether `save_function_no_index` actually serializes the
CFG/PDG or just the metadata.

**Impact:** Eliminates one full deep clone per function. On 50K functions with average
~100 blocks + 500 deps: saves ~50K CFG clones and ~50K PDG clones.

---

## Issue 3: `DominatorTree` uses `HashMap` for everything

**File:** `crates/rgbuilder-analysis/src/dominance.rs:10-20`

```rust
pub struct DominatorTree {
    pub idom: HashMap<BlockId, BlockId>,
    pub frontiers: HashMap<BlockId, HashSet<BlockId>>,
    pub reachable: HashSet<BlockId>,
    block_order: HashMap<BlockId, usize>,
}
```

`BlockId` is `Uuid` — 128-bit random values. Every `idom.get()` and `block_order.get()`
call inside the `intersect` loop does a 128-bit hash + comparison. The `intersect` function
is the innermost loop of dominator computation and runs thousands of times per function.

**Refactoring:**

Since the CFG builder now uses sequential `Uuid::from_u128(counter)` for block IDs (the
R15 fix from earlier), we can map blocks to dense `u32` indices and use `Vec<u32>` for
`idom` and `block_order`:

```rust
pub struct DominatorTree {
    block_to_idx: HashMap<BlockId, u32>,
    idx_to_block: Vec<BlockId>,
    idom: Vec<u32>,                    // idom[i] = immediate dominator index
    frontiers: Vec<Vec<u32>>,          // frontiers[i] = frontier block indices
    reachable_count: usize,
}
```

The `intersect` function becomes:
```rust
fn intersect(idom: &[u32], order: &[u32], mut b1: u32, mut b2: u32) -> u32 {
    while b1 != b2 {
        while order[b1 as usize] > order[b2 as usize] {
            b1 = idom[b1 as usize];
        }
        while order[b2 as usize] > order[b1 as usize] {
            b2 = idom[b2 as usize];
        }
    }
    b1
}
```

Pure array indexing — no hashing, no branching on hash collisions.

**Impact:** Eliminates all HashMap overhead from the dominator inner loop. On a function
with 200 blocks and 5 convergence iterations: ~1000 `intersect` calls, each doing 2-4
`HashMap::get` → replaced with array reads. Likely 5-10x faster per function.

---

## Issue 4: `ParsedSourceFile` cache is per-worker, causing redundant parses

**File:** `src/cli/discover_cfg.rs:193-201`

```rust
let flat: Vec<Option<CfgFunctionWork>> = with_pool(options.thread_count, || {
    work_items
        .par_iter()
        .map_init(
            HashMap::<String, ParsedSourceFile>::new,
            |parse_cache, item| process_function_work_item(parse_cache, item, &ctx),
        )
        .collect()
});
```

`map_init` creates one `HashMap<String, ParsedSourceFile>` per Rayon worker thread. If
file `A.c` has 50 functions and those 50 work items land on 8 different threads, file `A.c`
gets parsed 8 times (once per thread's first encounter).

On the Linux kernel, a single `.c` file can have 100+ functions. With 16 Rayon threads,
the same file may be parsed up to 16 times.

**Refactoring:**

Group work items by file path, then process each file group as a single Rayon task:

```rust
// Group functions by file
let by_file: HashMap<&str, Vec<&FunctionWorkItem>> = work_items
    .iter()
    .fold(HashMap::new(), |mut acc, item| {
        acc.entry(item.file_path.as_str()).or_default().push(item);
        acc
    });

// Process file groups in parallel — one parse per file
let flat: Vec<Option<CfgFunctionWork>> = with_pool(options.thread_count, || {
    by_file
        .par_iter()
        .flat_map(|(file_path, items)| {
            let source = ctx.sources.get(file_path).unwrap();
            let parsed = ParsedSourceFile::parse(&items[0].language, source.as_bytes()).ok();
            items.iter().map(move |item| {
                // All functions in this file share the same parsed tree
                analyze_with_parsed(item, &parsed, &ctx)
            }).collect::<Vec<_>>()
        })
        .collect()
});
```

This ensures each file is parsed exactly once, regardless of thread count.

**Impact:** On a codebase with 5000 files averaging 20 functions each and 16 threads:
reduces tree-sitter parses from potentially 80K (16 * 5000) to exactly 5000.

---

## Issue 5: `save_function_no_index` serializes and writes one file per function

**File:** `src/cli/discover_cfg.rs:240-244`

```rust
with_pool(options.thread_count, || {
    saves.par_iter().for_each(|analysis| {
        let _ = storage.save_function_no_index(analysis);
    });
});
```

Each save does `bincode::serialize` + `fs::write` for one function. On a repo with 50K
functions, this creates 50K small files under `.rgbuilder/analysis/`. The filesystem
metadata overhead (inode creation, directory entry update) dominates over the actual data.

**Refactoring:**

Since the archive (`cfg_pdg.archive.bin`) already bundles all CFG/PDG records into a single
file, the per-function bincode files are redundant for the common case. Only the
incremental index needs to survive between runs.

Option A: **Write only the index, skip per-function files.** The archive is the canonical
store; per-function files are only needed for `cpg function` CLI queries, which can read
from the archive.

Option B: **Batch the saves into a single buffered write** using the same length-prefixed
record format as `SegmentedSpill`:

```rust
let mut writer = BufWriter::with_capacity(8 * 1024 * 1024, File::create(batch_path)?);
for analysis in &saves {
    let blob = bincode::serialize(analysis)?;
    writer.write_all(&(blob.len() as u64).to_le_bytes())?;
    writer.write_all(&blob)?;
}
```

**Impact:** Eliminates 50K filesystem metadata operations. On ext4 with default settings,
creating 50K files can take 2-5 seconds of pure metadata I/O.

---

## Issue 6: `compute_from_cfg` stores `DominatorTree` result but never uses it

**File:** `src/cli/discover_cfg.rs:630-639`

```rust
let analysis = FunctionAnalysis {
    // ...
    dominance: None,    // explicitly None!
    // ...
};
```

The dominator tree (`dom_data`) is computed, used to build the PDG, then dropped. The
`FunctionAnalysis` struct has a `dominance` field but it's always set to `None` in the
discover path. The dominator tree is never persisted.

However, the PDG build method `build_with_dominator_options` takes `&DominatorTree`
by reference, so the dom tree must live until PDG construction completes. This is fine.

But the dominator tree's `frontiers` field (used only during PDG construction) allocates
`HashSet<BlockId>` per block. If the PDG build doesn't actually use frontiers (check
the PDG code), the frontier computation could be deferred or skipped entirely.

**Action:** Verify whether `ProgramDependenceGraph::build_with_dominator_options` uses
`dom.frontiers`. If not, add a `build_without_frontiers` variant to `DominatorTree` that
skips `compute_dominance_frontiers`.

---

## Issue 7: `CfgBuilder::new_block` UUID generation is now sequential but still 128-bit

**File:** `crates/rgbuilder-analysis/src/cfg_builder.rs:304-305` (from our earlier fix)

```rust
fn new_block(&mut self) -> BlockId {
    let id = BlockId::from_u128(self.next_block_serial as u128);
    self.next_block_serial += 1;
```

The block IDs are now sequential, which is good. But `BlockId` is still `Uuid` (128 bits),
and all the dominator/CFG data structures hash it as a UUID. Since block IDs are function-
local and sequential, a plain `u32` would be sufficient and would make all the `HashMap`
lookups O(1) array accesses instead.

**Refactoring:** This is a larger change that touches the `cfg.rs` type definitions. Keep
as-is for now but note that the dominator refactoring (Issue 3) can map UUIDs to dense
`u32` indices at the boundary.

---

## Issue 8: `cfg_pdg_archive.rs` deserializes entire archive at load time

From the earlier review, `CfgPdgArchive::load_from_path` does `bincode::deserialize` on
the full mmap payload, materializing all `HashMap<Uuid, CfgPdgRecord>` entries. This is
not in the `--with-cfg` discover hot path (the archive is written, not read), but it
affects downstream `cpg` commands.

**Defer:** Not on the `--with-cfg` discover timer. Addressed in the optimization plan's
Phase 3 (TOC-based lazy archive).

---

## Summary Priority Table

| # | Issue | Impact | Effort | Where |
|---|-------|--------|--------|-------|
| 4 | Per-worker parse cache → per-file grouping | HIGH | Medium | discover_cfg.rs |
| 1 | HashSet iteration → RPO in dominator | HIGH | Low | dominance.rs |
| 3 | HashMap-based dominator → dense Vec | HIGH | Medium | dominance.rs |
| 2 | CFG/PDG clone for archive → move | MEDIUM | Low | discover_cfg.rs |
| 5 | 50K per-function file writes → batch | MEDIUM | Medium | discover_cfg.rs, storage.rs |
| 6 | Skip dominance frontiers if unused | LOW | Low | dominance.rs, pdg.rs |
| 7 | UUID block IDs → u32 | LOW (deferred) | High | cfg.rs, everywhere |
| 8 | Archive full deserialization | LOW (not on timer) | High | cfg_pdg_archive.rs |

## Recommended Execution Order

**Phase A (immediate, low-risk):**
- Issue 1: RPO ordering in dominator (one function rewrite)
- Issue 2: Move CFG/PDG into archive record instead of cloning

**Phase B (medium effort, high impact):**
- Issue 4: Group work items by file for one-parse-per-file guarantee
- Issue 3: Dense Vec-based dominator tree

**Phase C (cleanup):**
- Issue 5: Batch persistence writes
- Issue 6: Conditional frontier computation
