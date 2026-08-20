#!/usr/bin/env node
/**
 * Copy fresh dist-universe assets into an offline bundle dir (e.g. .rgbuilder/universe)
 * and inject manifest.json into index.html for file:// / http.server e2e.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, "..", "dist-universe");
const target = process.argv[2] ?? process.env.UNIVERSE_BUNDLE_DIR;

if (!target) {
  console.error("usage: node sync-universe-fixture.mjs <bundle-dir>");
  console.error("  or set UNIVERSE_BUNDLE_DIR");
  process.exit(1);
}

if (!fs.existsSync(path.join(dist, "index.html"))) {
  console.error("missing dist-universe — run npm run build:universe first");
  process.exit(1);
}

const manifestPath = path.join(target, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error(`missing ${manifestPath}`);
  process.exit(1);
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

const assetsSrc = path.join(dist, "assets");
const assetsDst = path.join(target, "assets");
if (fs.existsSync(assetsDst)) fs.rmSync(assetsDst, { recursive: true, force: true });
copyDir(assetsSrc, assetsDst);

let html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const manifestJson = fs.readFileSync(manifestPath, "utf8").trim();
const script = `<script id="rgbuilder-manifest" type="application/json">${manifestJson}</script>`;
if (html.includes('id="rgbuilder-manifest"')) {
  html = html.replace(
    /<script id="rgbuilder-manifest" type="application\/json">[\s\S]*?<\/script>/,
    script,
  );
} else {
  html = html.replace("</head>", `${script}\n  </head>`);
}

fs.writeFileSync(path.join(target, "index.html"), html);
console.log(`synced universe UI → ${target}`);
