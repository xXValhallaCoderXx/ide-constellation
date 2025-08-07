import { defineConfig } from "vite";
import { copyFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";

// Plugin to copy static assets to dist
const copyAssetsPlugin = () => ({
  name: 'copy-assets',
  async writeBundle() {
    // First, compile the webview TypeScript files asynchronously
    try {
      console.log('🔧 Compiling webview TypeScript files...');
      await new Promise((resolve, reject) => {
        const tsc = spawn('npx', ['tsc', '-p', 'tsconfig.webview.json'], {
          stdio: 'inherit'
        });
        
        tsc.on('close', (code) => {
          if (code === 0) {
            console.log('✅ Webview TypeScript compilation successful');
            resolve();
          } else {
            reject(new Error(`TypeScript compilation failed with exit code ${code}`));
          }
        });
        
        tsc.on('error', (error) => {
          reject(new Error(`Failed to start TypeScript compiler: ${error.message}`));
        });
      });
    } catch (error) {
      console.error('❌ Failed to compile webview TypeScript:', error.message);
      throw error; // This will fail the build
    }

    // Copy webview static files
    const webviewDest = 'dist/src/ui/webview';
    if (!existsSync(webviewDest)) {
      mkdirSync(webviewDest, { recursive: true });
    }
    
    try {
      copyFileSync('src/ui/webview/webview.html', join(webviewDest, 'webview.html'));
      copyFileSync('src/ui/webview/webview.css', join(webviewDest, 'webview.css'));
      // The compiled JavaScript will already be in dist/src/ui/webview/webview.js
    } catch (error) {
      console.warn('Warning: Could not copy webview assets:', error.message);
    }

    // Copy sidebar static files
    const sidebarDest = 'dist/src/ui/sidebar';
    if (!existsSync(sidebarDest)) {
      mkdirSync(sidebarDest, { recursive: true });
    }
    
    try {
      copyFileSync('src/ui/sidebar/sidebar.html', join(sidebarDest, 'sidebar.html'));
      copyFileSync('src/ui/sidebar/sidebar.css', join(sidebarDest, 'sidebar.css'));
      // The compiled JavaScript will already be in dist/src/ui/sidebar/sidebar.js
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
        "querystring",
        "dependency-cruiser",
        "enhanced-resolve",
        "graceful-fs",
        "tsconfig-paths",
        "tsconfig-paths-webpack-plugin",
        "watskeburt",
        "semver",
        "acorn",
        "module",
        "assert",
        "constants",
        "console"
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