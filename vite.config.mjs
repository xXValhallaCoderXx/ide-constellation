import { defineConfig } from "vite";
import { copyFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

// Plugin to copy static assets to dist
const copyAssetsPlugin = () => ({
  name: 'copy-assets',
  writeBundle() {
    // Copy webview folder
    const webviewSrc = 'webview';
    const webviewDest = 'dist/webview';
    if (!existsSync(webviewDest)) {
      mkdirSync(webviewDest, { recursive: true });
    }
    
    try {
      copyFileSync(join(webviewSrc, 'webview.html'), join(webviewDest, 'webview.html'));
      copyFileSync(join(webviewSrc, 'styles.css'), join(webviewDest, 'styles.css'));
      copyFileSync(join(webviewSrc, 'main.js'), join(webviewDest, 'main.js'));
    } catch (error) {
      console.warn('Warning: Could not copy webview assets:', error.message);
    }

    // Copy sidebar folder
    const sidebarSrc = 'sidebar';
    const sidebarDest = 'dist/sidebar';
    if (!existsSync(sidebarDest)) {
      mkdirSync(sidebarDest, { recursive: true });
    }
    
    try {
      copyFileSync(join(sidebarSrc, 'sidebar.html'), join(sidebarDest, 'sidebar.html'));
      copyFileSync(join(sidebarSrc, 'styles.css'), join(sidebarDest, 'styles.css'));
      copyFileSync(join(sidebarSrc, 'main.js'), join(sidebarDest, 'main.js'));
    } catch (error) {
      console.warn('Warning: Could not copy sidebar assets:', error.message);
    }

    // Copy media folder
    const mediaSrc = 'media';
    const mediaDest = 'dist/media';
    if (!existsSync(mediaDest)) {
      mkdirSync(mediaDest, { recursive: true });
    }
    
    try {
      copyFileSync(join(mediaSrc, 'icon.svg'), join(mediaDest, 'icon.svg'));
    } catch (error) {
      console.warn('Warning: Could not copy media assets:', error.message);
    }
  }
});

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
        entryFileNames: "extension.js"
      }
    },
    sourcemap: true,
    outDir: "dist",
  },
  plugins: [copyAssetsPlugin()],
});