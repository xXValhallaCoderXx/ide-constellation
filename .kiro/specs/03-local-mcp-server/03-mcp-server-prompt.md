Of course. Here is the detailed technical specification for building the Local MCP Server.

# Tech Spec: The Local MCP Server

-----

### 🎯 Objective

To implement a lightweight, local Express.js server within the extension that acts as a bridge, exposing an API endpoint for querying the workspace's dependency graph data.

### ⚙️ Technical Approach

We will encapsulate all server-related logic in a new `src/mcpServer.ts` module. This module will export `startServer` and `stopServer` functions to manage the server's lifecycle, which will be hooked into the extension's `activate` and `deactivate` events. The server will expose a single `POST /query` endpoint. To decouple the server from the analysis state, the `startServer` function will accept a callback function that provides it with the latest dependency graph data on demand. The query handler will then perform a simple text search on this data and return the results.

**Key Files:**

  * **Modify:** `package.json` (to add Express.js)
  * **Create:** `src/mcpServer.ts`
  * **Enhance:** `src/extension.ts` (to manage server lifecycle and data state)

-----

### 📝 Implementation Plan (Checkpoints)

#### 1\. Checkpoint 1: Dependency Setup and Module Scaffolding

This step prepares the project by adding the server framework and creating the necessary files.

  * **Install Dependencies:** Open your terminal and run `npm install express` and `npm install --save-dev @types/express`.
  * **Create Server Module:** Create a new file at `src/mcpServer.ts`.
  * **Define Function Signatures:** Inside `src/mcpServer.ts`, add the exported function boilerplate. We'll also define a type for the data provider function for clarity.
    ```typescript
    // src/mcpServer.ts
    import { IReporterOutput } from 'dependency-cruiser';

    export type GraphDataProvider = () => IReporterOutput;

    export function startServer(graphDataProvider: GraphDataProvider) {
      // Logic to be added
    }

    export function stopServer() {
      // Logic to be added
    }
    ```

#### 2\. Checkpoint 2: Implement Server Lifecycle & Endpoint Boilerplate

This step focuses on getting a basic server running and stopping correctly.

  * **Implement Lifecycle in `mcpServer.ts`:**
      * Import `express` and `http`.
      * Create a module-level variable `let server: http.Server | undefined;`.
      * In `startServer`, initialize an Express app, use the `express.json()` middleware for parsing POST bodies, and define a placeholder `/query` endpoint.
      * Start the server on a fixed port (e.g., 6170) and assign the instance to the `server` variable.
      * In `stopServer`, check if `server` exists and call `server.close()`.
  * **Hook into `extension.ts`:**
      * In `activate`, import and call `startServer`. You'll pass a dummy function for now: `startServer(() => ({ modules: [], summary: {} }))`.
      * Ensure your `package.json` has `"activationEvents": ["*"]` or similar, and export a `deactivate` function from `extension.ts` where you'll call `stopServer()`.

#### 3\. Checkpoint 3: Implement the Query Logic

Now we'll implement the core functionality of the `/query` endpoint.

  * **Manage Graph State in `extension.ts`:**
      * Create a module-level variable to hold the latest graph data: `let currentGraph: IReporterOutput = { modules: [], summary: {} };`.
      * In the `onDidSaveTextDocument` handler (specifically, in your debounced `triggerAnalysis` function), update `currentGraph` with the result from `generateDependencyGraph`.
      * When calling `startServer`, pass a function that returns this variable: `startServer(() => currentGraph)`.
  * **Implement Endpoint Logic in `mcpServer.ts`:**
      * In the `POST /query` handler:
        1.  Get the query term from the request body: `const query = req.body.query as string;`. Add a check to ensure it's a valid string.
        2.  Get the latest graph data by calling the provider function: `const graph = graphDataProvider();`.
        3.  Filter the `graph.modules` array to find file paths that match the query (case-insensitive).
        4.  Map the results to an array of strings (the file paths).
        5.  Send the resulting array back as a JSON response.

#### 4\. Checkpoint 4: End-to-End Testing

This final step verifies the entire workflow using an external HTTP client.

  * **Action:** Ensure your extension is running with a sample project open and that you've saved at least one file to trigger an initial analysis.
  * **Action:** Use a tool like `curl` or an API client (e.g., Postman, Thunder Client) to send a request.
      * **Method:** `POST`
      * **URL:** `http://localhost:6170/query`
      * **Headers:** `Content-Type: application/json`
      * **Body:** `{ "query": "some_term" }` (e.g., `"analyzer"`, `"service"`)

-----
