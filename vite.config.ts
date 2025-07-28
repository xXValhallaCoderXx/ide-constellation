import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "./src/extension.ts",
      formats: ["cjs"],
      fileName: "extension",
    },
    rollupOptions: {
      external: ["vscode", "path", "fs", "os", "crypto"],
      output: {
        entryFileNames: "extension.cjs"
      }
    },
    sourcemap: true,
    outDir: "out",
  },
  plugins: [],
});