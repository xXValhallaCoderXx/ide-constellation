/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx,html}',
    './index.html'
  ],
  theme: {
    extend: {
      colors: {
        // VS Code theme integration - these can be used directly with Tailwind utilities
        'vscode': {
          'foreground': 'var(--vscode-foreground)',
          'background': 'var(--vscode-editor-background)',
          'button': {
            'background': 'var(--vscode-button-background)',
            'foreground': 'var(--vscode-button-foreground)',
            'hover': 'var(--vscode-button-hoverBackground)'
          },
          'input': {
            'background': 'var(--vscode-input-background)',
            'foreground': 'var(--vscode-input-foreground)',
            'border': 'var(--vscode-input-border)'
          },
          'panel': {
            'background': 'var(--vscode-panel-background)',
            'border': 'var(--vscode-panel-border)'
          },
          'list': {
            'hover': 'var(--vscode-list-hoverBackground)',
            'active': 'var(--vscode-list-activeSelectionBackground)'
          }
        }
      }
    },
  },
  plugins: [
    require('daisyui')
  ],
  daisyui: {
    themes: [
      {
        'vscode': {
          // Use fallback colors that will work with DaisyUI validation
          'primary': '#007ACC',           // VS Code blue
          'primary-content': '#ffffff',   
          'secondary': '#6C6C6C',         // VS Code gray  
          'secondary-content': '#ffffff',
          'accent': '#007ACC',            // Focus border color
          'neutral': '#2D2D30',           // Dark theme panel
          'neutral-content': '#CCCCCC',   // Light text
          'base-100': '#1E1E1E',          // Dark editor background
          'base-200': '#2D2D30',          // Panel background
          'base-300': '#3C3C3C',          // Input background
          'base-content': '#CCCCCC',      // Main text
          'info': '#3794FF',              // Info blue
          'success': '#89D185',           // Success green
          'warning': '#FFCC02',           // Warning yellow
          'error': '#F85149',             // Error red
        }
      }
    ],
    base: false, // Disable DaisyUI base styles to avoid conflicts with VS Code
    styled: true,
    utils: true,
  }
}