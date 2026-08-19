# Large local example checkouts (not in git)

`/example/` is **gitignored**. Clone stress corpora here for manual profile and integration gates.

| Path | Fetch | Gate |
|------|-------|------|
| `linux/` | Linux kernel tree (maintainer checkout) | `cargo test --release --test cold_profile_gates linux_cold_discover_within_baseline -- --ignored` |
| `kafka/` | Kafka source tree | `cold_profile_gates` `kafka_cold_discover_within_baseline` |
| `k8s-website/` | [kubernetes/website](https://github.com/kubernetes/website) `content/en` | `./scripts/fetch-profile-repos.sh` then `cold_profile_gates` `k8s_website_markdown_cold_discover_within_baseline -- --ignored` or `k8s_website_obsidian_export_to_vault -- --ignored` (after discover) |

**k8s Obsidian export (manual):**

```bash
./scripts/fetch-profile-repos.sh
export REPO="$(pwd)/example/k8s-website"
cargo build --release --bin rg-build
rg-build -r "$REPO" discover . -l markdown
rg-build -r "$REPO" export --export-format obsidian --export-output "$REPO/vault" --query all
# Open example/k8s-website/vault in Obsidian
```

The fetch script now pulls all large profiling fixtures in one go:

- `example/linux`
- `example/kafka`
- `example/metasfresh-4.9.8b`
- `example/coolstore-weblogic`
- `example/kubernetes`
- `example/k8s-website` (sparse `content/en`)

Override paths with `RGBUILDER_LINUX_REPO`, `RGBUILDER_KAFKA_REPO`, or `RGBUILDER_K8S_WEBSITE_REPO`.

**Cold profile:** gates remove `example/<repo>/.rgbuilder/` before discover and require `target/release/rg-build` (`cargo build --release --bin rg-build`). Do not profile against a warm or partial cache — numbers will be wrong.
