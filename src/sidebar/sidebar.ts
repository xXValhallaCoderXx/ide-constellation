// Sidebar TypeScript for VS Code Webview
import type { Message, VSCodeApi } from '../types/webview.types';

const vscodeSidebar: VSCodeApi = acquireVsCodeApi();

console.log('🚀 KIRO-CONSTELLATION: Sidebar TypeScript loaded');

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 KIRO-CONSTELLATION: Sidebar DOM ready');
    
    // Get button elements
    const showMapBtn = document.getElementById('showMapBtn') as HTMLButtonElement;
    const refreshBtn = document.getElementById('refreshBtn') as HTMLButtonElement;
    
    // Show Architecture Map button
    if (showMapBtn) {
        showMapBtn.addEventListener('click', function() {
            console.log('🚀 KIRO-CONSTELLATION: Show Map button clicked in sidebar');
            
            // Send message to the extension
            const message: Message = {
                type: 'showMap'
            };
            vscodeSidebar.postMessage(message);
            
            // Provide visual feedback
            showMapBtn.textContent = '🔄 Opening...';
            showMapBtn.disabled = true;
            
            setTimeout(() => {
                showMapBtn.textContent = '📊 Show Architecture Map';
                showMapBtn.disabled = false;
            }, 1000);
        });
    }
    
    // Refresh button
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            console.log('🚀 KIRO-CONSTELLATION: Refresh button clicked in sidebar');
            
            const message: Message = {
                type: 'log',
                data: 'Sidebar refreshed by user'
            };
            vscodeSidebar.postMessage(message);
            
            // Animate refresh button
            refreshBtn.style.transform = 'rotate(360deg)';
            refreshBtn.style.transition = 'transform 0.5s ease';
            
            setTimeout(() => {
                refreshBtn.style.transform = 'rotate(0deg)';
            }, 500);
            
            // Update stats (placeholder)
            updateStats();
        });
    }
    
    // Initialize the sidebar
    initializeSidebar();
});

function initializeSidebar(): void {
    console.log('🚀 KIRO-CONSTELLATION: Initializing sidebar interface');
    
    // Send initial log message
    const message: Message = {
        type: 'log',
        data: 'Sidebar interface initialized'
    };
    vscodeSidebar.postMessage(message);
    
    // Load initial stats
    updateStats();
}

function updateStats(): void {
    // Placeholder function to update project statistics
    // In a real implementation, this would fetch actual project data
    const componentCount = Math.floor(Math.random() * 10) + 1;
    const connectionCount = Math.floor(Math.random() * 20) + 1;
    
    const componentStat = document.querySelector('.stat-item:first-child .stat-number') as HTMLElement;
    const connectionStat = document.querySelector('.stat-item:last-child .stat-number') as HTMLElement;
    
    if (componentStat) {
        animateNumber(componentStat, parseInt(componentStat.textContent || '0'), componentCount);
    }
    
    if (connectionStat) {
        animateNumber(connectionStat, parseInt(connectionStat.textContent || '0'), connectionCount);
    }
}

function animateNumber(element: HTMLElement, from: number, to: number): void {
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
}
