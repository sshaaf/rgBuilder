export interface UniverseCommandDef {
  id: string;
  label: string;
  buildCli: (repo?: string) => string;
  /** When true, POST /api/universe/actions may run this action while served. */
  runnable: boolean;
}

export type UniverseActionEventType = "started" | "stdout" | "completed" | "error";

export interface UniverseActionEvent {
  type: UniverseActionEventType;
  action?: string;
  command?: string;
  line?: string;
  exit_code?: number;
  message?: string;
}

export const DEFAULT_REPO_PLACEHOLDER = "$REPO";

export const UNIVERSE_COMMANDS: UniverseCommandDef[] = [
  {
    id: "semantic_index",
    label: "Build search index",
    buildCli: (repo = DEFAULT_REPO_PLACEHOLDER) =>
      `rg-build -r ${repo} semantic index --embedder vocab`,
    runnable: true,
  },
  {
    id: "discover_refresh",
    label: "Discover refresh",
    buildCli: (repo = DEFAULT_REPO_PLACEHOLDER) =>
      `rg-build -r ${repo} discover . --with-universe`,
    runnable: true,
  },
  {
    id: "cfg_refresh",
    label: "CFG refresh",
    buildCli: (repo = DEFAULT_REPO_PLACEHOLDER) =>
      `rg-build -r ${repo} discover . --with-universe --with-cfg`,
    runnable: true,
  },
  {
    id: "communities_label",
    label: "Communities label",
    buildCli: (repo = DEFAULT_REPO_PLACEHOLDER) => `rg-build -r ${repo} communities label`,
    runnable: false,
  },
];

export function commandById(id: string): UniverseCommandDef | undefined {
  return UNIVERSE_COMMANDS.find((c) => c.id === id);
}

export async function fetchServeAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.location.protocol === "file:") return false;
  try {
    const res = await fetch("/api/health");
    return res.ok;
  } catch {
    return false;
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through */
    }
  }
  return false;
}

function parseSseChunk(chunk: string, onEvent: (ev: UniverseActionEvent) => void) {
  const blocks = chunk.split("\n\n");
  for (const block of blocks) {
    for (const line of block.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        onEvent(JSON.parse(payload) as UniverseActionEvent);
      } catch {
        /* ignore malformed frames */
      }
    }
  }
}

export async function runUniverseAction(
  action: string,
  onEvent: (ev: UniverseActionEvent) => void,
): Promise<void> {
  const res = await fetch("/api/universe/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, args: [] }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `HTTP ${res.status}`);
  }
  if (!res.body) throw new Error("missing response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    parseSseChunk(buffer, onEvent);
    if (buffer.endsWith("\n\n")) buffer = "";
  }
  if (buffer.trim()) parseSseChunk(`${buffer}\n\n`, onEvent);
}
