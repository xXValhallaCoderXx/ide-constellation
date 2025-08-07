import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      'node_modules', 
      'dist', 
      'out', 
      '.vscode-test',
      'src/test/extension.test.ts', // VS Code specific test
      'src/ui/webview/WebviewManager.test.ts' // VS Code specific test
    ],
  },
});