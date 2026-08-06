# Releasing rgBuilder

How maintainers publish versioned binaries and GitHub Releases.

---

## Version numbers

- **Crate / CLI version** lives in root [`Cargo.toml`](../Cargo.toml) (`[package].version`).
- **Workspace crates** share the same version in their `Cargo.toml` files and `[workspace.dependencies]` pins.
- **Git tags** use a `v` prefix: `v0.2.0` (not `0.2.0` alone).

Bump all workspace versions together before tagging.

---

## Release workflow (automated)

Pushing a tag matching `v*` triggers [`.github/workflows/release.yml`](../.github/workflows/release.yml):

1. **Build** `rgbuilder` release binaries for:
   - `x86_64-unknown-linux-gnu`
   - `aarch64-apple-darwin`
   - `x86_64-apple-darwin`
   - `x86_64-pc-windows-msvc`
2. **Package** as `rgbuilder-<version>-<target>.tar.gz` (or `.zip` on Windows).
3. **Publish** a GitHub Release with auto-generated notes and `SHA256SUMS.txt`.

### Tag and push

```bash
# On main, with a clean tree and versions already bumped
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin v0.2.0
```

Track the run: **Actions → Release**.

### Manual re-run

From the Actions tab, run **Release** via **workflow_dispatch** with:

- `tag`: e.g. `v0.2.0`
- `ref`: branch or SHA to build (default `main`)
- `draft`: optional draft release

---

## Pre-release checks (local)

```bash
cargo build --release
cargo test --release

# Dashboard asset build (if UI changed)
cd dashboard && npm ci && npm run build && cd ..

# Optional: golden repo validation
./scripts/validate-golden-repos.sh
```

---

## Assets users download

From [GitHub Releases](https://github.com/sshaaf/rgBuilder/releases):

| Platform | Asset pattern |
|----------|----------------|
| macOS Apple Silicon | `rgbuilder-*-aarch64-apple-darwin.tar.gz` |
| macOS Intel | `rgbuilder-*-x86_64-apple-darwin.tar.gz` |
| Linux x86_64 | `rgbuilder-*-x86_64-unknown-linux-gnu.tar.gz` |
| Windows | `rgbuilder-*-x86_64-pc-windows-msvc.zip` |

Extract and run `rgbuilder --version`. See [User Guide §1](user-guide.md#1-installation).

---

## After release

- Verify the Release page lists all four platform archives and checksums.
- Smoke-test `discover` + `gql` on a small repo with the downloaded binary.
- If `RGBUILDER_TESTS_DISPATCH_TOKEN` is configured, CI dispatches `rgbuilder-released` to the external test repo (see workflow comments).

---

## Ops checkpoint: GitHub repository rename (rgbuilder)

The in-repo identity is **rgbuilder** / **rgBuilder**. Renaming the GitHub repository is a **manual ops step** coordinated with a release:

| Item | Target |
|------|--------|
| GitHub repo slug | Prefer `sshaaf/rgbuilder` (URL-stable); display name may remain **rgBuilder** |
| Pages / site | `NEXT_PUBLIC_BASE_PATH=/rgBuilder` (or `/rgbuilder` if Paths are lowercased in the same change) — update `website/` + DNS/Pages settings |
| Clone / badge URLs | Already point at `sshaaf/rgBuilder` or `sshaaf/rgbuilder` in-tree; fix redirects after rename |
| External `rgbuilder-tests` dispatch | Rename or retarget `sshaaf/rgbuilder-tests` when that sibling repo is renamed |
| crates.io | Publish as `rgbuilder` only if/when intentionally published |

Until the GitHub rename lands, clones of `sshaaf/rBuilder` still work; document the redirect in the release BREAKING notes.

---

## See also

- [CONTRIBUTING.md](../CONTRIBUTING.md) — development setup
- [User Guide](user-guide.md) — install from release artifacts
