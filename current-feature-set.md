# Kiro Constellation - Current Feature Set

*Last Updated: January 2025*

## 🎯 Overview

Kiro Constellation is a VS Code extension that provides architecture visualization and dependency analysis for JavaScript/TypeScript projects. It creates interactive maps showing file dependencies and project structure to help developers understand and navigate complex codebases.

---

## 🔧 Core Features

### **1. Dependency Analysis Engine**
- **Powered by dependency-cruiser** for comprehensive code analysis
- **Multi-language support**: JavaScript, TypeScript, JSX, TSX, CJS, MJS
- **Smart filtering**: Excludes node_modules, build artifacts, and common non-code files
- **Circular dependency detection** and reporting
- **Syntax error resilience** - continues analysis even with broken files
- **Real-time updates** when files are saved

### **2. Interactive Architecture Visualization**
- **Cytoscape.js-powered** interactive dependency graphs
- **Dual interface options**:
  - Full-screen webview panel for detailed exploration
  - Compact sidebar panel for quick reference
- **Node and edge visualization** showing file relationships
- **Zoom and pan controls** for navigating large codebases
- **Visual indicators** for different file types and dependency strengths

### **3. Project Insights & Statistics**
- **Module count** and dependency metrics
- **Violation reporting** for architecture constraints
- **File type breakdown** and analysis scope
- **Dependency depth** and complexity metrics
- **Error reporting** with graceful fallback handling

---

## 🌐 External Integration Capabilities

### **4. MCP (Model Context Protocol) Server**
- **HTTP REST API** running on localhost:6170 (configurable)
- **Multiple endpoints** for comprehensive dependency analysis
- **JSON response format** with rich metadata and timestamps
- **Automatic port conflict resolution** (tries ports 6170-6179)
- **Graceful error handling** with structured error responses
- **Request ID tracking** for debugging and monitoring

#### **Available API Endpoints:**

##### **File Search: `POST /query`**
- **Case-insensitive search** across all analyzed files
- **Partial path matching** for flexible queries
- **Real-time data** from the latest dependency analysis
- **Duplicate filtering** and result optimization

```bash
# Find React components
curl -X POST http://localhost:6170/query \
  -H "Content-Type: application/json" \
  -d '{"query": "react"}'

# Response: {"matches": ["src/App.tsx", "src/components/Button.tsx"], "total": 2, "timestamp": "..."}
```

##### **Dependencies: `POST /dependencies`**
- **Get all dependencies** for a specific file
- **Excludes core modules** (Node.js built-ins like 'fs', 'path')
- **Returns resolved file paths** that the target file imports

```bash
# Get dependencies of App.tsx
curl -X POST http://localhost:6170/dependencies \
  -H "Content-Type: application/json" \
  -d '{"file": "src/App.tsx"}'

# Response: {"file": "src/App.tsx", "dependencies": ["src/components/Button.tsx", "src/utils/helper.ts"], "total": 2, "timestamp": "..."}
```

##### **Dependents: `POST /dependents`**
- **Get all dependents** for a specific file
- **Shows which files import** the target file
- **Useful for impact analysis** before making changes

```bash
# Get dependents of helper.ts
curl -X POST http://localhost:6170/dependents \
  -H "Content-Type: application/json" \
  -d '{"file": "src/utils/helper.ts"}'

# Response: {"file": "src/utils/helper.ts", "dependents": ["src/App.tsx", "src/components/Button.tsx"], "total": 2, "timestamp": "..."}
```

##### **Dependency Chain: `POST /dependency-chain`**
- **Find dependency path** between two files
- **Uses breadth-first search** for shortest path
- **Returns empty array** if no connection exists
- **Perfect for understanding** how modules are connected

```bash
# Find path from App.tsx to helper.ts
curl -X POST http://localhost:6170/dependency-chain \
  -H "Content-Type: application/json" \
  -d '{"from": "src/App.tsx", "to": "src/utils/helper.ts"}'

# Response: {"from": "src/App.tsx", "to": "src/utils/helper.ts", "chain": ["src/App.tsx", "src/components/Button.tsx", "src/utils/helper.ts"], "found": true, "timestamp": "..."}
```

##### **Circular Dependencies: `GET /circular-dependencies`**
- **Detects circular dependency loops** in your codebase
- **Returns all cycles found** with complete paths
- **Critical for identifying** architecture problems
- **No request body required** - analyzes entire project

```bash
# Find all circular dependencies
curl http://localhost:6170/circular-dependencies

# Response: {"cycles": [["src/A.tsx", "src/B.tsx", "src/A.tsx"]], "total": 1, "timestamp": "..."}
```

#### **Advanced Use Cases:**
- **Refactoring tools**: Query dependents before changing a file
- **Build optimization**: Analyze dependency chains for bundling
- **Architecture validation**: Check for circular dependencies in CI/CD
- **Impact analysis**: Understand blast radius of changes
- **Documentation generation**: Map module relationships automatically
- **Code quality tools**: Validate dependency patterns and constraints

---

## 📊 Monitoring & Observability

### **5. Comprehensive Logging System**
- **Structured JSON logging** with rich context information
- **Request ID tracking** through the entire pipeline
- **Performance metrics** (duration, response sizes, module counts)
- **Error logging** with detailed context and stack traces
- **Server lifecycle monitoring** (startup, shutdown, port conflicts)
- **Security-conscious logging** with sanitized sensitive data

#### **Log Categories:**
- **Server Events**: Startup, shutdown, port management
- **Request/Response**: HTTP request tracking with timing
- **Query Processing**: Dependency graph analysis metrics
- **Error Handling**: Validation, processing, and system errors
- **Data Provider**: Analysis engine integration monitoring

---

## 🎮 User Interface

### **6. VS Code Integration**
- **Command palette integration** with `kiro-constellation.showMap`
- **Automatic workspace detection** and analysis
- **File save triggers** for real-time dependency updates
- **Status indicators** showing analysis progress and results
- **Error notifications** with actionable feedback

### **7. Webview Components**
- **Responsive design** adapting to different panel sizes
- **Message passing** between extension and webview
- **State management** for visualization preferences
- **Loading states** and error boundaries
- **Theme integration** with VS Code appearance

---

## 🔒 Reliability & Error Handling

### **8. Robust Error Management**
- **Graceful degradation** when analysis fails
- **Comprehensive input validation** for all API endpoints
- **Timeout handling** for long-running operations
- **Memory management** for large codebases
- **Connection management** with proper cleanup

### **9. Testing Coverage**
- **Unit tests** for core functionality (67+ tests passing)
- **Mock data providers** for isolated testing
- **Error scenario coverage** for edge cases
- **Dependency endpoint testing** with comprehensive validation
- **Integration test framework** (in development)
- **Automated test execution** in CI/CD pipeline

#### **Test Categories:**
- **MCP Server Tests**: All endpoints, error handling, validation
- **Dependency Analysis Tests**: Graph processing, edge cases, resilience
- **Query Processing Tests**: Search functionality, filtering, performance
- **Circular Dependency Tests**: Detection algorithms, complex cycles
- **Error Handling Tests**: Graceful failures, structured logging

---

## 🚀 Performance Characteristics

### **10. Scalability Features**
- **Configurable analysis depth** (max 10 levels)
- **Smart file filtering** to reduce analysis scope
- **Debounced file watching** to prevent excessive re-analysis
- **Efficient graph data structures** for large projects
- **Memory-conscious processing** with cleanup routines

---

## 🔧 Configuration & Customization

### **11. Flexible Configuration**
- **Port configuration** for MCP server
- **Analysis scope control** via file patterns
- **Exclusion rules** for irrelevant files and directories
- **Module system support** (AMD, CJS, ES6, TypeScript)
- **Dependency resolution options** with TypeScript pre-compilation

---

## 📈 Development & Maintenance

### **12. Development Workflow**
- **TypeScript-first** development with strict type checking
- **Vite-based build system** for fast development cycles
- **ESLint integration** for code quality
- **Automated testing** with Vitest framework
- **Comprehensive documentation** and inline comments

---

## 🎯 Target Use Cases

### **Primary Users:**
- **Developers** working with complex JavaScript/TypeScript codebases
- **Teams** needing to understand project architecture and dependencies
- **Code reviewers** analyzing impact of changes
- **New team members** onboarding to existing projects

### **Integration Scenarios:**
- **Build tools** querying dependency information and optimization opportunities
- **CI/CD pipelines** validating architecture constraints and detecting circular dependencies
- **Documentation generators** mapping module relationships and dependency flows
- **Refactoring tools** identifying affected files and impact analysis
- **Code quality analyzers** examining dependency patterns and architectural violations
- **Migration scripts** finding dependency chains and planning update sequences
- **Bundle analyzers** optimizing module splitting and lazy loading strategies

---

## 🔮 Current Limitations

- **Language support** limited to JavaScript/TypeScript ecosystem
- **Single workspace** analysis (no multi-root workspace support yet)
- **Local-only operation** (no remote repository analysis)
- **Basic visualization** (advanced graph layouts in development)

---

*This document will be updated as new features are added and existing capabilities are enhanced.*