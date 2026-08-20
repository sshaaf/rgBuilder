#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, "..", "dist");
const out = path.join(root, "..", "dist-universe");

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

if (!fs.existsSync(path.join(dist, "universe.html"))) {
  console.error("missing dist/universe.html — run vite build first");
  process.exit(1);
}

if (fs.existsSync(out)) {
  fs.rmSync(out, { recursive: true, force: true });
}
fs.mkdirSync(out, { recursive: true });

fs.copyFileSync(path.join(dist, "universe.html"), path.join(out, "index.html"));
if (fs.existsSync(path.join(dist, "assets"))) {
  copyDir(path.join(dist, "assets"), path.join(out, "assets"));
}

console.log(`wrote ${out}`);
