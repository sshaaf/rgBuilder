import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const contentRoot = join(process.cwd(), "content/docs");

export function docsRoot(): string {
  return contentRoot;
}

export function listDocSlugs(): string[][] {
  if (!existsSync(contentRoot)) return [];
  const out: string[][] = [];
  function walk(dir: string, parts: string[]) {
    for (const name of readdirSync(dir)) {
      const fp = join(dir, name);
      if (statSync(fp).isDirectory()) {
        walk(fp, [...parts, name]);
        continue;
      }
      if (!name.endsWith(".md")) continue;
      const stem = name.replace(/\.md$/, "");
      out.push([...parts, stem]);
    }
  }
  walk(contentRoot, []);
  return out;
}

export function readDoc(slug: string[]): string | null {
  const candidates = [
    join(contentRoot, ...slug) + ".md",
    join(contentRoot, ...slug, "README.md"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return readFileSync(c, "utf8");
  }
  return null;
}

/** Rewrite repo-relative markdown links for the site `/docs/` tree. */
export function rewriteDocLinks(md: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const prefix = `${base}/docs`;

  return md.replace(/\]\(([^)]+)\)/g, (full, target: string) => {
    if (/^(https?:|mailto:|#|\/)/i.test(target)) return full;
    const hashIdx = target.indexOf("#");
    const pathPart = hashIdx >= 0 ? target.slice(0, hashIdx) : target;
    const hash = hashIdx >= 0 ? target.slice(hashIdx) : "";
    if (!pathPart.endsWith(".md") && pathPart !== "../AGENTS.md") {
      return full;
    }
    let rel = pathPart.replace(/^\.\//, "");
    if (rel === "../AGENTS.md" || rel === "AGENTS.md") {
      return `](${prefix}/AGENTS/${hash})`;
    }
    rel = rel.replace(/\.md$/, "");
    return `](${prefix}/${rel}/${hash})`;
  });
}
