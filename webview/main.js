// Kiro Constellation Webview JavaScript
console.log("Hello World from webview!");

// DOM ready logic
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 KIRO-CONSTELLATION: Webview content loaded successfully");
    
    // Initialize any webview-specific functionality here
    const cyContainer = document.getElementById('cy');
    if (cyContainer) {
        console.log("🚀 KIRO-CONSTELLATION: Cytoscape container found and ready");
    }
});
