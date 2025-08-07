# Tech Spec: Automated Triggering & Data Pipeline

-----

### 🎯 Objective

To make the architecture map "live" by automatically triggering the analysis engine when a file is saved and establishing a data pipeline to send the resulting dependency graph from the extension's backend to the webview frontend.

-----

### ⚙️ Technical Approach

We will leverage the VS Code API's `workspace.onDidSaveTextDocument` event to listen for file save actions. To prevent excessive processing during rapid saves, this trigger will be wrapped in a `debounce` function from the Lodash library. Once the `dependency-cruiser` analysis is complete, the resulting JSON data will be sent over a message bus to the webview using the `webview.postMessage()` method. The frontend script (`main.js`) will listen for these messages, preparing it to render the data in the next phase.

**Key Files:**

  * **Modify:** `package.json` (to add Lodash)
  * **Enhance:** `src/extension.ts` (to add listener and data pipeline logic)
  * **Enhance:** `webview/main.js` (to receive data from the pipeline)

-----

### 📝 Implementation Plan (Checkpoints)

#### 1\. Checkpoint 1: Register the Save Listener

First, we'll hook into the VS Code environment to detect when files are saved.

  * **Action:** In `src/extension.ts`, inside the `activate` function, register the listener.
  * **Logic:**
    1.  Get the current workspace folder path. Ensure you handle the case where no folder is open.
    2.  Call our existing `generateDependencyGraph` function from the `analyzer` module.
    3.  For this checkpoint, simply `console.log` the returned graph object to the **Debug Console** to confirm the trigger is working correctly.
    <!-- end list -->
    ```typescript
    // In src/extension.ts activate function
    vscode.workspace.onDidSaveTextDocument(async (document) => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            console.log("No workspace folder open.");
            return;
        }
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        
        console.log(`File saved, running analysis on: ${workspaceRoot}`);
        const graph = await generateDependencyGraph(workspaceRoot);
        
        // Log to the main extension's debug console for now
        console.log("Analysis complete. Graph data:", graph);
    });
    ```

#### 2\. Checkpoint 2: Establish the Data Pipeline

Next, we will send the data from the extension backend to our webview frontend.

  * **Refactor `extension.ts`:**
      * The `WebviewPanel` instance needs to be accessible to the `onDidSaveTextDocument` listener. Store the panel in a module-level variable (e.g., `let webviewPanel: vscode.WebviewPanel | undefined;`) when it's created, and set it to `undefined` in the panel's `onDidDispose` event.
      * Inside the save listener, after the graph is generated, check if `webviewPanel` exists and then send the data using `postMessage`.
        ```typescript
        // Inside onDidSaveTextDocument, after generating the graph
        if (webviewPanel) {
            webviewPanel.webview.postMessage({
                command: 'updateGraph',
                data: graph
            });
        }
        ```
  * **Update `webview/main.js`:** Add a message listener to receive the data.
    ```javascript
    // In webview/main.js
    window.addEventListener('message', event => {
        const message = event.data; // The JSON data from the extension
        switch (message.command) {
            case 'updateGraph':
                console.log('Received graph data from extension:', message.data);
                // We will render the graph here in the next phase
                break;
        }
    });
    ```

#### 3\. Checkpoint 3: Implement Performance Guardrail (Debounce)

To prevent performance issues from rapid-fire saves, we'll add a debounce mechanism.

  * **Install Dependency:** Run `npm install lodash` and `npm install --save-dev @types/lodash`.
  * **Refactor `extension.ts`:**
      * Import `debounce` from `lodash`.
      * Wrap the analysis and `postMessage` logic in a debounced function. **Crucially, this debounced function should be created only once** within the `activate` function scope.
    <!-- end list -->
    ```typescript
    // In src/extension.ts
    import { debounce } from 'lodash';

    // In the activate function...
    const triggerAnalysis = debounce(async () => {
        // All the logic from Checkpoint 1 & 2 goes in here...
        // 1. Get workspace root
        // 2. Call generateDependencyGraph
        // 3. Post message to webview
    }, 500); // 500ms delay

    // The listener now just calls the debounced function
    vscode.workspace.onDidSaveTextDocument(() => {
        triggerAnalysis();
    });
    ```

-----

### ✅ Manual Testing Guide

  * **After Checkpoint 1:**

      * ✅ Run the extension (`F5`) and open a project folder.
      * ✅ Open the **Debug Console** (for the extension host).
      * ✅ Make a small change to any file in your project and save it (`Ctrl+S`).
      * ✅ Verify that the full JSON dependency graph is printed to the debug console.

  * **After Checkpoint 2:**

      * ✅ Run the extension (`F5`).
      * ✅ Open the Architecture Map panel by clicking the Activity Bar icon.
      * ✅ Open the **Webview Developer Tools** (`Developer: Open Webview Developer Tools` from the command palette).
      * ✅ Save a file in your workspace.
      * ✅ Check the console tab within the Webview Dev Tools. Verify that the message `Received graph data from extension:` appears, followed by the JSON graph object.

  * **After Checkpoint 3 (Final Verification):**

      * ✅ Run the extension (`F5`) and have the **Debug Console** visible.
      * ✅ Press `Ctrl+S` rapidly 5-10 times on an open file.
      * ✅ Observe the debug console. Verify that the "File saved, running analysis..." message appears **only once**, approximately 500ms after you stop saving, not 5-10 times.