import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
      '@webview': path.resolve(__dirname, '../src/webview'),
    },
  },
  build: {
    outDir: '../dist/webview',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'graph-constellation': path.resolve(__dirname, 'src/graph-constellation/index.html'),
        'extension-sidebar': path.resolve(__dirname, 'src/extension-sidebar/index.html'),
        'dashboard-health': path.resolve(__dirname, 'src/dashboard-health/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name][extname]'
      }
    }
  },
  server: {
    port: 5173,
    host: 'localhost'
  }
})