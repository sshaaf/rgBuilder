import { defineConfig } from "@playwright/test";

const bundleDir = process.env.UNIVERSE_BUNDLE_DIR;
const port = process.env.UNIVERSE_SERVE_PORT ?? "8765";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: {
    baseURL: bundleDir ? `http://127.0.0.1:${port}` : undefined,
    trace: "on-first-retry",
  },
  webServer: bundleDir
    ? {
        command: `python3 -m http.server ${port}`,
        cwd: bundleDir,
        url: `http://127.0.0.1:${port}/index.html`,
        reuseExistingServer: true,
        timeout: 15_000,
      }
    : undefined,
});
