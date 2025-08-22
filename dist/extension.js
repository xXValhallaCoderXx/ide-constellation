"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode3 = __toESM(require("vscode"));

// src/webview/webviewManager.ts
var vscode = __toESM(require("vscode"));
var WebviewManager = class {
  currentPanel = void 0;
  output;
  constructor(_mcpServer, output) {
    this.output = output;
  }
  createOrShowPanel(context) {
    this.output?.appendLine(`[${(/* @__PURE__ */ new Date()).toISOString()}] Creating or showing webview panel...`);
    const columnToShowIn = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : void 0;
    if (this.currentPanel) {
      this.currentPanel.reveal(columnToShowIn);
      return;
    }
    this.currentPanel = vscode.window.createWebviewPanel(
      "kiroConstellation",
      "Kiro Constellation",
      columnToShowIn || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "dist"),
          vscode.Uri.joinPath(context.extensionUri, "src", "webview", "styles")
        ]
      }
    );
    this.currentPanel.webview.html = this.getWebviewContent(context);
    this.output?.appendLine(`[${(/* @__PURE__ */ new Date()).toISOString()}] Webview HTML set.`);
    this.currentPanel.webview.onDidReceiveMessage(
      async (message) => {
        this.output?.appendLine(`[${(/* @__PURE__ */ new Date()).toISOString()}] Webview message received: ${JSON.stringify(message)}`);
        await this.handleWebviewMessage(message);
      },
      void 0,
      context.subscriptions
    );
    this.currentPanel.onDidDispose(
      () => {
        this.output?.appendLine(`[${(/* @__PURE__ */ new Date()).toISOString()}] Webview panel disposed.`);
        this.currentPanel = void 0;
      },
      null,
      context.subscriptions
    );
  }
  async handleWebviewMessage(message) {
    switch (message.command) {
      case "checkStatus":
        await this.handleStatusCheck();
        break;
      default:
        console.warn("Unknown webview message command:", message.command);
    }
  }
  async handleStatusCheck() {
    const statusMessage = {
      command: "statusUpdate",
      data: {
        status: "ok",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
    this.currentPanel?.webview.postMessage(statusMessage);
    this.output?.appendLine(`[${(/* @__PURE__ */ new Date()).toISOString()}] Sent statusUpdate to webview: ${JSON.stringify(statusMessage.data)}`);
    const serverInfoMessage = {
      command: "serverInfo",
      data: {
        isRunning: true
      }
    };
    this.currentPanel?.webview.postMessage(serverInfoMessage);
    this.output?.appendLine(`[${(/* @__PURE__ */ new Date()).toISOString()}] Sent serverInfo to webview: ${JSON.stringify(serverInfoMessage.data)}`);
  }
  getWebviewContent(context) {
    const webview = this.currentPanel?.webview;
    const nonce = this.getNonce();
    const cspSource = webview.cspSource;
    const webviewUri = webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, "dist", "webview.js")
    );
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, "src", "webview", "styles", "main.css")
    );
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kiro Constellation</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; script-src 'nonce-${nonce}' ${cspSource}; style-src ${cspSource} 'unsafe-inline'; font-src ${cspSource};" />
    <link href="${cssUri}" rel="stylesheet">
    <style>
        body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background-color: var(--vscode-editor-background); margin: 0; padding: 0; }
        #root { min-height: 100vh; }
        .fallback-message { padding: 20px; text-align: center; color: var(--vscode-descriptionForeground); }
    </style>
</head>
<body>
    <div id="root">
        <div class="fallback-message">
            <h1>Kiro Constellation POC</h1>
            <p>Loading...</p>
        </div>
    </div>

    <script nonce="${nonce}">
        window.vscode = acquireVsCodeApi();
        setTimeout(() => {
            const root = document.getElementById('root');
            if (root && root.innerHTML.includes('Loading...')) {
                root.innerHTML = \`
                    <div style="padding: 20px; font-family: var(--vscode-font-family);">
                        <h1>Kiro Constellation POC</h1>
                        <div style="margin: 20px 0; padding: 15px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; background-color: var(--vscode-panel-background);">
                            <div id="status" style="margin-bottom: 10px; padding: 8px; background-color: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 2px;">Status: Unknown</div>
                            <button id="checkButton" style="background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; border-radius: 2px; cursor: pointer;">Check Server Status</button>
                        </div>
                    </div>
                \`;
                const statusElement = document.getElementById('status');
                const checkButton = document.getElementById('checkButton');
                checkButton.addEventListener('click', () => {
                    checkButton.disabled = true;
                    statusElement.textContent = 'Status: Checking...';
                    window.vscode.postMessage({ command: 'checkStatus' });
                });
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'statusUpdate') {
                        const data = message.data;
                        let statusText = \`Status: \${data.status}\`;
                        if (data.timestamp) { statusText += \` (Last checked: \${new Date(data.timestamp).toLocaleTimeString()})\`; }
                        if (data.error) { statusText += \` - Error: \${data.error}\`; }
                        statusElement.textContent = statusText;
                        checkButton.disabled = false;
                    }
                });
            }
        }, 2000);
    </script>
    ${webviewUri ? `<script src="${webviewUri}" nonce="${nonce}"></script>` : ""}
</body>
</html>`;
  }
  dispose() {
    if (this.currentPanel) {
      this.currentPanel.dispose();
      this.currentPanel = void 0;
    }
  }
  updateMCPServer(_mcpServer) {
  }
  getNonce() {
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let text = "";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
};

// src/mcp/mcpProvider.ts
var vscode2 = __toESM(require("vscode"));
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
var KiroConstellationMCPProvider = class {
  extensionContext;
  outputChannel;
  constructor(context, outputChannel) {
    this.extensionContext = context;
    this.outputChannel = outputChannel;
  }
  /**
   * Register the MCP provider with VS Code
   * This is the main entry point for the POC test
   */
  async registerProvider() {
    try {
      this.log("[POC] Testing VS Code MCP API availability...");
      if (!vscode2.lm || typeof vscode2.lm.registerMcpServerDefinitionProvider !== "function") {
        this.log("[FAILURE] vscode.lm.registerMcpServerDefinitionProvider is not available");
        this.log("[FAILURE] The standard MCP API is not supported in this IDE");
        await this.offerCreateWorkspaceMcpConfig();
        return false;
      }
      this.log("[SUCCESS] VS Code MCP API is available!");
      this.log("[POC] Registering MCP server definition provider...");
      this.log('[DEBUG] Attempting to register provider with ID: "kiro-constellation"');
      const disposable = vscode2.lm.registerMcpServerDefinitionProvider(
        "kiro-constellation",
        {
          provideMcpServerDefinitions: () => this.provideMcpServerDefinitions()
        }
      );
      this.extensionContext.subscriptions.push(disposable);
      this.log("[SUCCESS] MCP provider registered successfully");
      this.log("[POC] Waiting for IDE to call provideMcpServerDefinitions...");
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`[FAILURE] Error registering MCP provider: ${errorMessage}`);
      if (errorMessage.includes("package.json")) {
        this.log("[DEBUG] This suggests the package.json mcpServerDefinitionProviders needs to match the registration ID");
        this.log('[DEBUG] Current registration ID: "kiro-constellation"');
        this.log("[DEBUG] Check package.json contributes.mcpServerDefinitionProviders array");
      }
      return false;
    }
  }
  /**
   * Offer to create or update a Kiro MCP config pointing to the bundled stdio server.
   * Workspace level: .kiro/settings/mcp.json
   * User level: ~/.kiro/settings/mcp.json
   */
  async offerCreateWorkspaceMcpConfig() {
    try {
      const folders = vscode2.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        this.log("[FALLBACK] No workspace folder is open; cannot create workspace-level Kiro MCP config");
        return;
      }
      let targetFolder = folders[0];
      if (folders.length > 1) {
        const picked = await vscode2.window.showQuickPick(
          folders.map((f) => ({ label: f.name, description: f.uri.fsPath, folder: f })),
          { placeHolder: "Select a workspace folder for .kiro/settings/mcp.json" }
        );
        if (!picked) {
          this.log("[FALLBACK] Creation cancelled (no folder selected)");
          return;
        }
        targetFolder = picked.folder;
      }
      const wsPath = targetFolder.uri.fsPath;
      const kiroDir = path.join(wsPath, ".kiro", "settings");
      if (!fs.existsSync(kiroDir)) {
        fs.mkdirSync(kiroDir, { recursive: true });
      }
      const mcpJsonPath = path.join(kiroDir, "mcp.json");
      const targetName = targetFolder.name;
      const serverScriptPath = this.getServerScriptPath();
      if (!fs.existsSync(serverScriptPath)) {
        this.log(`[FALLBACK] MCP server script missing at ${serverScriptPath}. Run: npm run compile:mcp`);
        vscode2.window.showWarningMessage("Constellation MCP server bundle not found. Run the build first (npm run compile:mcp).");
        return;
      }
      let current = {};
      try {
        if (fs.existsSync(mcpJsonPath)) {
          const raw = fs.readFileSync(mcpJsonPath, "utf8");
          current = JSON.parse(raw || "{}");
        }
      } catch (e) {
        this.log(`[FALLBACK] Failed to parse existing mcp.json, will overwrite: ${e instanceof Error ? e.message : String(e)}`);
        current = {};
      }
      if (!current || typeof current !== "object") {
        current = {};
      }
      if (!current.mcpServers || typeof current.mcpServers !== "object") {
        current.mcpServers = {};
      }
      const serverId = "constellation-stdio";
      const existing = current.mcpServers[serverId] || {};
      const suggestedAutoApprove = ["constellation_ping", "constellation_example_tool"];
      const mergedAutoApprove = Array.from(/* @__PURE__ */ new Set([...existing.autoApprove || [], ...suggestedAutoApprove]));
      current.mcpServers[serverId] = {
        type: "stdio",
        // Use system Node from PATH to run the bundled server
        command: "node",
        args: [serverScriptPath],
        env: existing.env || {},
        disabled: typeof existing.disabled === "boolean" ? existing.disabled : false,
        autoApprove: mergedAutoApprove
      };
      fs.writeFileSync(mcpJsonPath, JSON.stringify(current, null, 2) + "\n", "utf8");
      this.log(`[FALLBACK] Wrote MCP config to ${mcpJsonPath}`);
      vscode2.window.showInformationMessage(`Created/updated MCP config at '${targetName}'.`);
    } catch (err) {
      this.log(`[FALLBACK] Failed to create Kiro MCP config: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  /**
   * Provide MCP server definitions to VS Code
   * This method is called by VS Code when it needs to discover MCP servers
   */
  async provideMcpServerDefinitions() {
    try {
      this.log("[POC] provideMcpServerDefinitions called by IDE - this is a SUCCESS indicator!");
      const serverScriptPath = this.getServerScriptPath();
      this.log(`[POC] MCP server script path: ${serverScriptPath}`);
      const label = "Constellation MCP";
      const finalLabel = typeof label === "string" && label.trim().length > 0 ? label.trim() : "Constellation MCP (default)";
      const serverDefinition = {
        id: "constellation-poc",
        transport: "stdio",
        command: process.execPath,
        args: [serverScriptPath],
        label: finalLabel,
        cwd: this.extensionContext.extensionPath,
        env: {}
      };
      this.log(`[DEBUG] Server definition label: "${serverDefinition.label}" (type=${typeof serverDefinition.label})`);
      this.log(`[DEBUG] Server definition command: "${serverDefinition.command}"`);
      this.log(`[DEBUG] Server definition transport: "${serverDefinition.transport}"`);
      this.log(`[DEBUG] Server definition cwd: "${serverDefinition.cwd}"`);
      this.log(`[DEBUG] Server definition args: [${serverDefinition.args.join(", ")}]`);
      this.log(`[DEBUG] Full serverDefinition JSON: ${JSON.stringify(serverDefinition)}`);
      const absoluteServerPath = path.resolve(this.extensionContext.extensionPath, "out", "mcp-server.js");
      const exists = fs.existsSync(absoluteServerPath);
      this.log(`[DEBUG] Checking if server script exists at: ${absoluteServerPath} (exists=${exists})`);
      if (!exists) {
        this.log("[ERROR] MCP server script not found. Did the MCP build complete? Run: npm run compile:mcp");
      }
      this.log("[SUCCESS] Returning MCP server definition to IDE");
      return [serverDefinition];
    } catch (error) {
      this.log(`[FAILURE] Error in provideMcpServerDefinitions: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  /**
   * Get the absolute path to the bundled MCP server script
   */
  getServerScriptPath() {
    const serverScriptPath = path.join(this.extensionContext.extensionPath, "out", "mcp-server.js");
    this.log(`[POC] Bundled MCP server script path: ${serverScriptPath}`);
    return serverScriptPath;
  }
  /**
   * Log messages to the output channel with timestamp
   */
  log(message) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    this.outputChannel.appendLine(logMessage);
  }
  /**
   * Test method to validate the provider can be called
   */
  async testProvider() {
    this.log("[POC] Testing provider functionality...");
    try {
      const definitions = await this.provideMcpServerDefinitions();
      this.log(`[POC] Provider test successful, returned ${definitions.length} server definition(s)`);
    } catch (error) {
      this.log(`[POC] Provider test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};

// src/extension.ts
var path2 = __toESM(require("path"));
var import_child_process = require("child_process");
var USE_STANDARD_PROVIDER_POC = true;
var webviewManager = null;
var mcpProvider = null;
var IS_DEV = process.env.NODE_ENV !== "production";
async function activate(context) {
  const output = vscode3.window.createOutputChannel("Kiro Constellation");
  context.subscriptions.push(output);
  const log = (msg) => {
    const line = `[${(/* @__PURE__ */ new Date()).toISOString()}] ${msg}`;
    console.log(line);
    output.appendLine(line);
  };
  log("Extension activating...");
  if (USE_STANDARD_PROVIDER_POC) {
    log("[POC] VS Code Standard MCP Provider POC mode enabled");
    log("[POC] Starting VS Code Standard MCP Provider POC...");
    try {
      mcpProvider = new KiroConstellationMCPProvider(context, output);
      const success = await mcpProvider.registerProvider();
      if (success) {
        log("[POC] MCP Provider registration completed successfully");
        log("[POC] Testing provider functionality...");
        await mcpProvider.testProvider();
      } else {
        log("[POC] MCP Provider registration failed - API may not be available");
      }
    } catch (error) {
      log(`[POC] Error in MCP Provider setup: ${error instanceof Error ? error.message : String(error)}`);
    }
    webviewManager = new WebviewManager(null, output);
  } else {
    log("[PRODUCTION] MCP provider path active");
    webviewManager = new WebviewManager(null, output);
  }
  const helloWorldDisposable = vscode3.commands.registerCommand("kiro-constellation.helloWorld", () => {
    log("Hello World command executed");
    vscode3.window.showInformationMessage("Hello World from kiro-constellation!");
  });
  const showPanelDisposable = vscode3.commands.registerCommand("kiro-constellation.showPanel", () => {
    log("Show Panel command executed");
    webviewManager?.createOrShowPanel(context);
  });
  const debugLaunchDisposable = vscode3.commands.registerCommand("kiro-constellation.debugLaunchMcp", async () => {
    if (!IS_DEV) {
      log("[DEBUG] Debug launch is disabled in production builds");
      return;
    }
    try {
      const serverScriptPath = path2.join(context.extensionPath, "out", "mcp-server.js");
      log(`[DEBUG] Spawning MCP server with: ${process.execPath} ${serverScriptPath}`);
      const child = (0, import_child_process.spawn)(process.execPath, [serverScriptPath], {
        cwd: context.extensionPath,
        env: process.env
      });
      child.stdout.on("data", (data) => {
        output.appendLine(`[MCP STDOUT] ${data.toString().trim()}`);
      });
      child.stderr.on("data", (data) => {
        output.appendLine(`[MCP STDERR] ${data.toString().trim()}`);
      });
      child.on("exit", (code, signal) => {
        output.appendLine(`[MCP EXIT] code=${code} signal=${signal ?? ""}`);
      });
      const init = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "kiro-constellation", version: "dev" } }
      };
      const list = { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} };
      const call = { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "constellation_example_tool", arguments: { message: "Hello from debug command" } } };
      const ping = { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "constellation_ping", arguments: {} } };
      child.stdin.write(`${JSON.stringify(init)}
`);
      child.stdin.write(`${JSON.stringify(list)}
`);
      child.stdin.write(`${JSON.stringify(call)}
`);
      child.stdin.write(`${JSON.stringify(ping)}
`);
    } catch (err) {
      log(`[DEBUG] Failed to launch MCP server: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  context.subscriptions.push(helloWorldDisposable, showPanelDisposable, debugLaunchDisposable);
}
async function deactivate() {
  console.log("Kiro Constellation extension is deactivating...");
  if (webviewManager) {
    webviewManager.dispose();
    webviewManager = null;
  }
  if (USE_STANDARD_PROVIDER_POC) {
    console.log("[POC] Cleaning up MCP Provider POC...");
    mcpProvider = null;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
