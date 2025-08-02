import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "./src/extension.ts",
      formats: ["cjs"],
      fileName: "extension",
    },
    rollupOptions: {
      external: [
        "vscode",
        "path",
        "fs",
        "os",
        "crypto",
        "@lancedb/lancedb",
        "@xenova/transformers",
        "child_process",
        "util",
        "stream",
        "buffer",
        "events",
        "url",
        "http",
        "https",
        "zlib",
        "querystring"
      ],
      output: {
        entryFileNames: "extension.cjs"
      }
    },
    sourcemap: true,
    outDir: "out",
  },
  plugins: [],
});