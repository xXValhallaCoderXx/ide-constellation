// VS Code API available as acquireVsCodeApi()
const vscode = acquireVsCodeApi();

console.log('🚀 KIRO-CONSTELLATION: Sidebar JavaScript loaded');

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 KIRO-CONSTELLATION: Sidebar DOM ready');
    
    // Get button elements
    const showMapBtn = document.getElementById('showMapBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    
    // Show Architecture Map button
    if (showMapBtn) {
        showMapBtn.addEventListener('click', function() {
            console.log('🚀 KIRO-CONSTELLATION: Show Map button clicked in sidebar');
            
            // Send message to the extension
            vscode.postMessage({
                type: 'showMap'
            });
            
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
            
            vscode.postMessage({
                type: 'log',
                data: 'Sidebar refreshed by user'
            });
            
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

function initializeSidebar() {
    console.log('🚀 KIRO-CONSTELLATION: Initializing sidebar interface');
    
    // Send initial log message
    vscode.postMessage({
        type: 'log',
        data: 'Sidebar interface initialized'
    });
    
    // Load initial stats
    updateStats();
}

function updateStats() {
    // Placeholder function to update project statistics
    // In a real implementation, this would fetch actual project data
    const componentCount = Math.floor(Math.random() * 10) + 1;
    const connectionCount = Math.floor(Math.random() * 20) + 1;
    
    const componentStat = document.querySelector('.stat-item:first-child .stat-number');
    const connectionStat = document.querySelector('.stat-item:last-child .stat-number');
    
    if (componentStat) {
        animateNumber(componentStat, parseInt(componentStat.textContent) || 0, componentCount);
    }
    
    if (connectionStat) {
        animateNumber(connectionStat, parseInt(connectionStat.textContent) || 0, connectionCount);
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
        element.textContent = Math.round(current);
        
        if (step >= steps) {
            clearInterval(timer);
            element.textContent = to;
        }
    }, stepDuration);
}
