import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [preact()],
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "assets",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        universe: resolve(__dirname, "universe.html"),
      },
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("three")) {
              return "three";
            }
            if (id.includes("@codemirror") || id.includes("/codemirror/")) {
              return "codemirror";
            }
            if (id.includes("graphology-layout-forceatlas2")) {
              return "graph-layout";
            }
            if (id.includes("/sigma/")) {
              return "sigma";
            }
          }
        },
      },
    },
  },
  worker: {
    format: "es",
  },
});
