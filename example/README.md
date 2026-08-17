# Large local example checkouts (not in git)

`/example/` is **gitignored**. Clone stress corpora here for manual profile and integration gates.

| Path | Fetch | Gate |
|------|-------|------|
| `linux/` | Linux kernel tree (maintainer checkout) | `cargo test --release --test cold_profile_gates linux_cold_discover_within_baseline -- --ignored` |
| `kafka/` | Kafka source tree | `cold_profile_gates` `kafka_cold_discover_within_baseline` |
| `k8s-website/` | [kubernetes/website](https://github.com/kubernetes/website) `content/en` | `./scripts/fetch-k8s-website-example.sh` then `cold_profile_gates` `k8s_website_markdown_cold_discover_within_baseline -- --ignored` |

Override paths with `RGBUILDER_LINUX_REPO`, `RGBUILDER_KAFKA_REPO`, or `RGBUILDER_K8S_WEBSITE_REPO`.

**Cold profile:** gates remove `example/<repo>/.rgbuilder/` before discover and require `target/release/rg-build` (`cargo build --release --bin rg-build`). Do not profile against a warm or partial cache — numbers will be wrong.
