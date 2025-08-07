import { defineConfig } from "vite";
import { copyFileSync, mkdirSync, existsSync, writeFileSync } from "fs";
import { join } from "path";

// Plugin to copy static assets to dist
const copyAssetsPlugin = () => ({
  name: 'copy-assets',
  writeBundle() {
    // Copy webview static files
    const webviewDest = 'dist/src/webview';
    if (!existsSync(webviewDest)) {
      mkdirSync(webviewDest, { recursive: true });
    }
    
    try {
      copyFileSync('src/webview/webview.html', join(webviewDest, 'webview.html'));
      copyFileSync('src/webview/webview.css', join(webviewDest, 'webview.css'));
      // Compile TypeScript to JavaScript manually for webview
      const webviewTs = `// Compiled from webview.ts
const vscodeWebview = acquireVsCodeApi();
console.log('🚀 KIRO-CONSTELLATION: Webview TypeScript loaded');

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 KIRO-CONSTELLATION: Webview DOM ready');
    
    const cyContainer = document.getElementById('cy');
    
    if (cyContainer) {
        console.log('🚀 KIRO-CONSTELLATION: Found cytoscape container');
        initializeArchitectureMap();
        
        const message = {
            type: 'webviewReady',
            data: 'Architecture map webview is ready'
        };
        vscodeWebview.postMessage(message);
    } else {
        console.error('🚀 KIRO-CONSTELLATION: Could not find cytoscape container');
    }
});

function initializeArchitectureMap() {
    console.log('🚀 KIRO-CONSTELLATION: Initializing architecture map visualization');
    
    const cyContainer = document.getElementById('cy');
    if (cyContainer) {
        cyContainer.innerHTML = \`
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                text-align: center;
                color: var(--vscode-foreground);
            ">
                <div style="font-size: 48px; margin-bottom: 16px;">🌟</div>
                <h3>Architecture Map Ready</h3>
                <p>Webview is now active and ready for visualization</p>
                <div style="margin-top: 20px; padding: 10px; border: 1px dashed var(--vscode-focusBorder); border-radius: 4px;">
                    <small>This will show your project's architecture<br/>components and connections</small>
                </div>
            </div>
        \`;
    }
}`;
      writeFileSync(join(webviewDest, 'webview.js'), webviewTs);
    } catch (error) {
      console.warn('Warning: Could not copy webview assets:', error.message);
    }

    // Copy sidebar static files
    const sidebarDest = 'dist/src/sidebar';
    if (!existsSync(sidebarDest)) {
      mkdirSync(sidebarDest, { recursive: true });
    }
    
    try {
      copyFileSync('src/sidebar/sidebar.html', join(sidebarDest, 'sidebar.html'));
      copyFileSync('src/sidebar/sidebar.css', join(sidebarDest, 'sidebar.css'));
      // Compile TypeScript to JavaScript manually for sidebar
      const sidebarTs = `// Compiled from sidebar.ts
const vscodeSidebar = acquireVsCodeApi();
console.log('🚀 KIRO-CONSTELLATION: Sidebar TypeScript loaded');

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 KIRO-CONSTELLATION: Sidebar DOM ready');
    
    const showMapBtn = document.getElementById('showMapBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    
    if (showMapBtn) {
        showMapBtn.addEventListener('click', function() {
            console.log('🚀 KIRO-CONSTELLATION: Show Map button clicked in sidebar');
            
            const message = {
                type: 'showMap'
            };
            vscodeSidebar.postMessage(message);
            
            showMapBtn.textContent = '🔄 Opening...';
            showMapBtn.disabled = true;
            
            setTimeout(() => {
                showMapBtn.textContent = '📊 Show Architecture Map';
                showMapBtn.disabled = false;
            }, 1000);
        });
    }
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            console.log('🚀 KIRO-CONSTELLATION: Refresh button clicked in sidebar');
            
            const message = {
                type: 'log',
                data: 'Sidebar refreshed by user'
            };
            vscodeSidebar.postMessage(message);
            
            refreshBtn.style.transform = 'rotate(360deg)';
            refreshBtn.style.transition = 'transform 0.5s ease';
            
            setTimeout(() => {
                refreshBtn.style.transform = 'rotate(0deg)';
            }, 500);
            
            updateStats();
        });
    }
    
    initializeSidebar();
});

function initializeSidebar() {
    console.log('🚀 KIRO-CONSTELLATION: Initializing sidebar interface');
    
    const message = {
        type: 'log',
        data: 'Sidebar interface initialized'
    };
    vscodeSidebar.postMessage(message);
    
    updateStats();
}

function updateStats() {
    const componentCount = Math.floor(Math.random() * 10) + 1;
    const connectionCount = Math.floor(Math.random() * 20) + 1;
    
    const componentStat = document.querySelector('.stat-item:first-child .stat-number');
    const connectionStat = document.querySelector('.stat-item:last-child .stat-number');
    
    if (componentStat) {
        animateNumber(componentStat, parseInt(componentStat.textContent || '0'), componentCount);
    }
    
    if (connectionStat) {
        animateNumber(connectionStat, parseInt(connectionStat.textContent || '0'), connectionCount);
    }
}

function animateNumber(element, from, to) {
    const duration = 500;
    const steps = 20;
    const stepValue = (to - from) / steps;
    const stepDuration = duration / steps;
    
    let current = from;
    let step = 0;
    
    const timer = setInterval(() => {
        step++;
        current += stepValue;
        element.textContent = Math.round(current).toString();
        
        if (step >= steps) {
            clearInterval(timer);
            element.textContent = to.toString();
        }
    }, stepDuration);
}`;
      writeFileSync(join(sidebarDest, 'sidebar.js'), sidebarTs);
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