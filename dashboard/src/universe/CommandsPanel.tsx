import { useEffect, useState } from "preact/hooks";
import {
  copyToClipboard,
  DEFAULT_REPO_PLACEHOLDER,
  fetchServeAvailable,
  runUniverseAction,
  UNIVERSE_COMMANDS,
  type UniverseActionEvent,
  type UniverseCommandDef,
} from "./universeCommands";

export interface CommandsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function CommandsPanel({ open, onClose }: CommandsPanelProps) {
  const [served, setServed] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void fetchServeAvailable().then(setServed);
  }, [open]);

  if (!open) return null;

  const onCopy = async (cmd: UniverseCommandDef) => {
    const ok = await copyToClipboard(cmd.buildCli());
    if (ok) {
      setCopiedId(cmd.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    }
  };

  const appendEvent = (ev: UniverseActionEvent) => {
    if (ev.type === "stdout" && ev.line) {
      setLog((prev) => [...prev.slice(-40), ev.line!]);
    } else if (ev.type === "started" && ev.command) {
      setLog((prev) => [...prev.slice(-40), `$ ${ev.command}`]);
    } else if (ev.type === "error" && ev.message) {
      setLog((prev) => [...prev.slice(-40), `error: ${ev.message}`]);
      setError(ev.message);
    } else if (ev.type === "completed") {
      setLog((prev) => [...prev.slice(-40), `completed (exit ${ev.exit_code ?? 0})`]);
    }
  };

  const onRun = async (cmd: UniverseCommandDef) => {
    if (!cmd.runnable || !served || runningId) return;
    setError(null);
    setRunningId(cmd.id);
    setLog([]);
    try {
      await runUniverseAction(cmd.id, appendEvent);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div class="universe-commands-backdrop" role="presentation" onClick={onClose}>
      <aside
        class="universe-commands-panel"
        role="dialog"
        aria-labelledby="universe-commands-title"
        onClick={(e) => e.stopPropagation()}
        data-testid="universe-commands-panel"
      >
        <header class="universe-commands-header">
          <h2 id="universe-commands-title">Universe commands</h2>
          <button type="button" class="universe-commands-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <p class="universe-context-muted">
          {served
            ? "Copy CLI for offline use, or Run while served."
            : "Offline bundle — copy commands to run in your terminal."}
        </p>
        <table class="universe-commands-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>CLI</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {UNIVERSE_COMMANDS.map((cmd) => (
              <tr key={cmd.id}>
                <td>{cmd.label}</td>
                <td>
                  <code class="universe-command-cli">{cmd.buildCli()}</code>
                </td>
                <td class="universe-commands-actions">
                  <button
                    type="button"
                    class="universe-commands-btn"
                    data-testid={`copy-${cmd.id}`}
                    onClick={() => void onCopy(cmd)}
                  >
                    {copiedId === cmd.id ? "Copied" : "Copy"}
                  </button>
                  {cmd.runnable && served ? (
                    <button
                      type="button"
                      class="universe-commands-btn universe-commands-btn-run"
                      disabled={runningId != null}
                      data-testid={`run-${cmd.id}`}
                      onClick={() => void onRun(cmd)}
                    >
                      {runningId === cmd.id ? "Running…" : "Run"}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {error ? (
          <p class="universe-context-error" role="alert">
            {error}
          </p>
        ) : null}
        {log.length > 0 ? (
          <pre class="universe-commands-log" aria-live="polite">
            {log.join("\n")}
          </pre>
        ) : null}
        <p class="universe-context-muted">
          Replace {DEFAULT_REPO_PLACEHOLDER} with your repository root before running offline.
        </p>
      </aside>
    </div>
  );
}
