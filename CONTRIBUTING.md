# Contributing to rgBuilder

Thanks for helping improve rgBuilder. This guide covers local setup, tests, and where to put changes.

**Documentation map:** [docs/README.md](docs/README.md)

---

## Prerequisites

- **Rust** stable (via [rustup](https://rustup.rs/))
- **Node.js 18+** and npm (dashboard UI only)
- **git**

Optional: **Playwright** (dashboard browser tests) — installed via `dashboard/` npm scripts.

---

## Clone and build

```bash
git clone https://github.com/sshaaf/rgBuilder.git
cd rgBuilder
cargo build --release
./target/release/rg-build --version
```

### Universe UI (when changing `dashboard/src/universe/`)

```bash
cd dashboard
pnpm install   # or npm ci
pnpm run build:universe
cd ..
cargo build --release   # embeds dashboard/dist-universe
```

Legacy tabbed dashboard (`dashboard/src/App.tsx`) is deprecated — universe is the primary UI.

### Dashboard dist (legacy embed)

```bash
cd dashboard
npm ci
npm run build
cd ..
cargo build --release   # embeds dashboard/dist (still used by shared WASM build)
```

WASM worker:

```bash
# from repo root — see dashboard/wasm/ or project scripts if present
cargo build -p rgbuilder-wasm --target wasm32-unknown-unknown --release
```

---

## Running tests

```bash
# Unit / integration (workspace)
cargo test

# Release-mode CLI golden paths (slower)
cargo test --release --test subprocess_golden_path
cargo test --release --test all_commands_sanity

# Dashboard bundle assertions (universe export path)
cargo test dashboard_harness
cargo test --test with_universe_cli --test universe_ecommerce_java --test universe_deep_manifest
cargo test --test universe_export_baseline -- --ignored --nocapture  # optional perf gate

# Golden repos (optional, long)
./scripts/validate-golden-repos.sh
```

### Universe Playwright + Vitest

```bash
cd dashboard
pnpm run test:universe
# E2E (requires discovered bundle):
export UNIVERSE_BUNDLE_DIR=/path/to/.rgbuilder/universe
pnpm run test:e2e:universe
```

---

## Project layout (short)

| Area | Path |
|------|------|
| CLI entry | `src/cli/` |
| Analysis (CFG, PDG, taint) | `crates/rgbuilder-analysis/` |
| Graph storage | `crates/rgbuilder-graph/` |
| Dashboard export | `crates/rgbuilder-dashboard/` |
| Browser UI | `dashboard/src/` |
| WASM engine | `crates/rgbuilder-wasm/` |
| Language plugins | `crates/rgbuilder-lang-*/` |

Full map: [docs/Code_structure.md](docs/Code_structure.md)

---

## Adding or improving a language

Follow [docs/tier-1-language-support.md](docs/tier-1-language-support.md) and update [docs/languages.md](docs/languages.md).

---

## Documentation changes

- **User-facing:** `docs/Introduction.md`, `docs/user-guide.md`, `docs/dashboard-user-guide.md`
- **Agents:** `AGENTS.md`, `docs/json-api.md`, `docs/agent-recipes.md`
- **Accuracy:** keep CLI examples aligned with `dashboard/scripts/validate-guide-cli-gbuilder.sh` where possible

---

## Pull requests

1. Branch from `main` (or the active integration branch).
2. Keep commits focused; match existing Rust style and `cargo fmt` / `clippy` expectations.
3. CI runs on PRs when a maintainer adds the **`ci`** label (see [.github/workflows/ci.yml](.github/workflows/ci.yml)).
4. Fill in the PR template with test commands you ran.

---

## Releases

Maintainers: [docs/releasing.md](docs/releasing.md)
