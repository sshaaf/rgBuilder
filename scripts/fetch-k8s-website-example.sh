#!/usr/bin/env bash
# Sparse clone kubernetes/website content/en → example/k8s-website (gitignored).
#
# Same idea as checking out example/linux locally: large corpus, not in git.
# Source: https://github.com/kubernetes/website/tree/main/content/en
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/example/k8s-website"
TMP="$ROOT/example/.k8s-website-clone"
URL="https://github.com/kubernetes/website.git"

if [[ -d "$DEST/docs" || -f "$DEST/search.md" ]]; then
  echo "Already present: $DEST"
  exit 0
fi

rm -rf "$TMP"
mkdir -p "$(dirname "$TMP")"
git clone --depth 1 --filter=blob:none --sparse "$URL" "$TMP"
(
  cd "$TMP"
  git sparse-checkout set content/en
)
rm -rf "$DEST"
mv "$TMP/content/en" "$DEST"
rm -rf "$TMP"
echo "Ready: $DEST"
echo "Build:       cargo build --release --bin rg-build"
echo "Cold profile: cargo test --release --test cold_profile_gates k8s_website_markdown_cold_discover_within_baseline -- --ignored --nocapture"
echo "Manual:      rg-build -r \"$DEST\" discover . -l markdown -v"
