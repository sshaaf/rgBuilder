import { describe, expect, it, vi } from "vitest";
import {
  commandById,
  copyToClipboard,
  DEFAULT_REPO_PLACEHOLDER,
  UNIVERSE_COMMANDS,
} from "./universeCommands";

describe("UNIVERSE_COMMANDS", () => {
  it("includes build search index with rg-build semantic index", () => {
    const cmd = commandById("semantic_index");
    expect(cmd?.label).toBe("Build search index");
    expect(cmd?.buildCli("myrepo")).toMatch(/^rg-build -r myrepo semantic index/);
  });

  it("marks communities label copy-only", () => {
    const cmd = commandById("communities_label");
    expect(cmd?.runnable).toBe(false);
  });
});

describe("copyToClipboard", () => {
  it("writes semantic index CLI via clipboard API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const text = commandById("semantic_index")!.buildCli(DEFAULT_REPO_PLACEHOLDER);
    expect(await copyToClipboard(text)).toBe(true);
    expect(writeText).toHaveBeenCalledWith(text);
    expect(text).toContain("semantic index");
    expect(text.startsWith("rg-build")).toBe(true);
    vi.unstubAllGlobals();
  });
});
