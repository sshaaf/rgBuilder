import type { Metadata } from "next";
import Link from "next/link";
import { TerminalBlock } from "@/components/terminal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GITHUB_RELEASES, GITHUB_REPO } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Install",
};

export default function InstallPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <Badge className="mb-4">Get started</Badge>
      <h1 className="font-[family-name:var(--font-serif)] text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
        Install rgBuilder
      </h1>
      <p className="mt-3 text-[var(--body)]">
        Prefer a release binary for day-to-day use. Build from source when you
        need the latest main — and pull Git LFS if you want the default semantic
        embedder.
      </p>

      <section className="mt-10 space-y-3">
        <h2 className="text-lg text-[var(--ink)]">Option A — GitHub Releases</h2>
        <p className="text-sm text-[var(--body)]">
          Download the latest asset for your platform from{" "}
          <a
            href={GITHUB_RELEASES}
            className="text-[var(--primary)] underline"
            target="_blank"
            rel="noreferrer"
          >
            Releases
          </a>
          , put <code className="font-mono text-[var(--body-strong)]">rg-build</code>{" "}
          on your <code className="font-mono">PATH</code>, then:
        </p>
        <TerminalBlock lines={["rg-build --version"]} />
        <Button variant="ghost" asChild>
          <a href={GITHUB_RELEASES} target="_blank" rel="noreferrer">
            Open releases
          </a>
        </Button>
      </section>

      <section className="mt-12 space-y-3">
        <h2 className="text-lg text-[var(--ink)]">Option B — Build from source</h2>
        <TerminalBlock
          lines={[
            "git clone https://github.com/sshaaf/rgBuilder.git",
            "cd rgBuilder",
            "# Optional: default semantic embedder (code-daemon ONNX ~206 MB)",
            "# Skip if you only use: semantic index --embedder vocab|hash",
            "git lfs pull",
            "cargo build --release",
            "./target/release/rg-build --version",
          ]}
        />
      </section>

      <section className="mt-12 space-y-3">
        <h2 className="text-lg text-[var(--ink)]">First hour</h2>
        <p className="text-sm text-[var(--body)]">
          Use the in-tree{" "}
          <code className="font-mono text-[var(--body-strong)]">
            rgbuilder-tests/ecommerce-java
          </code>{" "}
          fixture (canonical walkthrough in the User Guide).
        </p>
        <TerminalBlock
          lines={[
            "cd rgbuilder-tests/ecommerce-java",
            "rg-build discover .",
            "rg-build -f json gql --macro-name all_functions unused | jq '.count'",
            'rg-build -f json blast-radius "priceShoppingCart" --depth 2',
          ]}
        />
        <p className="text-sm text-[var(--mute)]">
          Dashboard and migration JSON are opt-in: add{" "}
          <code className="font-mono">--with-universe</code> /{" "}
          <code className="font-mono">--export-migration-hints</code>.
        </p>
      </section>

      <section className="mt-12 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/docs/">Read the docs</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/demo/">Try demos</Link>
        </Button>
        <Button variant="ghost" asChild>
          <a href={`${GITHUB_REPO}/blob/main/docs/user-guide.md`} target="_blank" rel="noreferrer">
            User Guide on GitHub
          </a>
        </Button>
      </section>
    </div>
  );
}
