import { useEffect, useState } from "preact/hooks";
import { loadManifest } from "./types";

/** Legacy dashboard entry — universe is the primary UI (`universe.html`). */
export function App() {
  const [manifestError, setManifestError] = useState<string | null>(null);

  useEffect(() => {
    loadManifest().catch((e) => {
      setManifestError(e instanceof Error ? e.message : String(e));
    });
  }, []);

  return (
    <div class="rb-app container-fluid py-5 text-center">
      <h1 class="h3 mb-3">Legacy dashboard replaced by rg Universe</h1>
      <p class="text-muted mb-4">
        The tabbed dashboard has been retired. Use the full-screen 3D cosmos instead.
      </p>
      <pre class="text-start d-inline-block bg-dark text-light p-3 rounded small">
        {`rg-build discover . --with-universe
rg-build serve --open`}
      </pre>
      {manifestError ? (
        <p class="text-danger small mt-3" role="alert">
          {manifestError}
        </p>
      ) : null}
    </div>
  );
}
