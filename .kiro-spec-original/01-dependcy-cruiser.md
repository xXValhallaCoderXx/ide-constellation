# Core Analysis Engine

### 🎯 Objective

To build a robust, standalone analysis engine capable of scanning a user's workspace using `dependency-cruiser` and generating a structured JSON object representing the file dependency graph.

### ⚙️ Technical Approach

We will encapsulate all analysis logic within a new `src/analyzer.ts` module. This module will export a single, asynchronous function, `generateDependencyGraph`, which programmatically invokes the `dependency-cruiser` API. The function will be designed for resilience, using a `try...catch` block to gracefully handle common issues like syntax errors or empty directories. We will verify its correctness in isolation by creating a simple test script before integrating it into the main extension workflow.

**Key Files:**

  * **Modify:** `package.json` (to add dependencies)
  * **Create:** `src/analyzer.ts`
  * **Create:** `scripts/test-analyzer.ts` (for isolated testing)
  * **Create:** A `sample-project` directory for testing purposes.

### 📝 Implementation Plan (Checkpoints)

#### 1\. Checkpoint 1: Dependency Setup and Module Scaffolding

This step prepares the project by adding the necessary library and creating the file structure for our engine.

  * **Install Dependency:** Open your terminal and run `npm install dependency-cruiser`.
  * **Create Analyzer Module:** Create a new file at `src/analyzer.ts`.
  * **Define Function Signature:** Inside `src/analyzer.ts`, add the exported function boilerplate.

#### 2\. Checkpoint 2: Implement the Core Dependency Analysis

Now, we'll implement the primary logic that calls `dependency-cruiser`.

  * **Update `generateDependencyGraph`:**
      * Use the imported `cruise` function from `dependency-cruiser`.
      * Configure it to use an `outputType` of `"json"`.
      * `await` the result and return the `output` property.

#### 3\. Checkpoint 3: Implement Graceful Error Handling

To meet the acceptance criteria, the function must not crash.

  * **Wrap Logic in `try...catch`:** Encapsulate the entire `cruise` call within a `try...catch` block.
  * **Handle Errors:** In the `catch` block, log the error for debugging purposes and return a valid, empty graph object. This ensures that any consumer of our function receives a predictable and safe value even when analysis fails.

#### 4\. Checkpoint 4: Create an Isolated Test Script

We'll verify the analyzer works correctly before connecting it to the rest of the extension.

  * **Create a Sample Project:** In your project root, create a `sample-project` folder with a few files that import each other (e.g., `a.js` imports `b.js`).
  * **Create the Test Script:** Create `scripts/test-analyzer.ts` which imports `generateDependencyGraph`, calls it with the path to your sample project, and logs the JSON result to the console.
  * **Add a `package.json` Script:** To easily run this, add `ts-node` (`npm install --save-dev ts-node`) and a script to your `package.json`: `"test:analyzer": "ts-node ./scripts/test-analyzer.ts"`.