# MCP-Webview Bridge Test

## Setup
1. Build extension: `npm run compile`
2. Launch extension (F5)
3. Open a workspace with code
4. Run "Constellation: Show Codebase Map"

## Test Steps

1. Trigger Ping Tool via MCP
   - Open Kiro chat
   - Type: "ping the constellation server"
   - Watch for response

2. Verify Communication Chain
   - [ ] MCP server logs show ping execution
   - [ ] Extension logs show instruction extraction
   - [ ] Webview console shows "Visual instruction received"
   - [ ] Graph shows visual feedback (sequential highlights)

3. Expected Console Output
```
[MCP DEBUG] PING tool executed
[VI][INFO] Embedded visualInstruction detected action=applyTraceAnimation
[WebView] 🎯 [POC] Visual instruction received
[WebView] 🚀 [POC] Starting trace animation
```

## Success Criteria
- Complete chain from MCP → Extension → Webview works
- No errors in any console
- Visual feedback appears (even if basic)
