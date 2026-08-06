import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../..");
const srcDocs = join(repoRoot, "docs");
const destDocs = join(here, "../content/docs");

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    if (name === "internal" || name === "videos" || name === "images") {
      // videos/images handled separately or skipped for v1 text docs
      if (name === "images") {
        const imgFrom = join(from, name);
        const imgTo = join(to, name);
        cpSync(imgFrom, imgTo, { recursive: true });
      }
      continue;
    }
    const fp = join(from, name);
    const tp = join(to, name);
    if (statSync(fp).isDirectory()) {
      copyTree(fp, tp);
    } else if (name.endsWith(".md") || name.endsWith(".txt")) {
      cpSync(fp, tp);
    }
  }
}

if (!existsSync(srcDocs)) {
  console.warn("[copy-docs] missing docs/ — skip");
  process.exit(0);
}

mkdirSync(destDocs, { recursive: true });
// clean slate
cpSync(srcDocs, destDocs, {
  recursive: true,
  filter: (src) => {
    const rel = relative(srcDocs, src);
    if (!rel) return true;
    if (rel.startsWith("internal")) return false;
    if (rel.startsWith("videos")) return false;
    // keep md/txt/images
    if (statSync(src).isDirectory()) return true;
    return (
      src.endsWith(".md") ||
      src.endsWith(".txt") ||
      /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(src)
    );
  },
});

// Also copy AGENTS.md as agents.md for site
const agents = join(repoRoot, "AGENTS.md");
if (existsSync(agents)) {
  cpSync(agents, join(destDocs, "AGENTS.md"));
}

console.log(`[copy-docs] docs/ → website/content/docs (excl. internal/videos binaries)`);
