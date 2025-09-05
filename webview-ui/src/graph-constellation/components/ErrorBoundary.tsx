/**
 * Error Boundary Component for Graph Layout Operations
 * Task 9.3: Error boundaries for layout switching failures with user-friendly error messages
 */

import { Component } from "preact";
import { ComponentChildren } from "preact";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: ComponentChildren;
  fallback?: ComponentChildren;
  onError?: (error: Error, errorInfo: string) => void;
  maxRetries?: number;
}

export class GraphErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  private maxRetries: number;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
    this.maxRetries = props.maxRetries || 3;
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Task 9.3: Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error: error,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Task 9.3: Log error details for debugging
    console.error("[GraphErrorBoundary] Layout error caught:", error);
    console.error("[GraphErrorBoundary] Error info:", errorInfo);

    // Task 9.3: Enhanced error context for layout failures
    const isLayoutError =
      error.message?.includes("layout") ||
      error.stack?.includes("layout") ||
      error.stack?.includes("cytoscape");

    if (isLayoutError) {
      console.error("[GraphErrorBoundary] Layout-specific error detected");
    }

    this.setState({
      error: error,
      errorInfo: errorInfo?.componentStack || "No additional info",
    });

    // Task 9.3: Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo?.componentStack || "");
    }
  }

  handleRetry = () => {
    // Task 9.3: Implement retry mechanism with limits
    if (this.state.retryCount < this.maxRetries) {
      console.log(
        `[GraphErrorBoundary] Retrying... (${this.state.retryCount + 1}/${
          this.maxRetries
        })`
      );
      this.setState((prevState) => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
      }));
    } else {
      console.warn("[GraphErrorBoundary] Max retries reached, not retrying");
    }
  };

  handleReset = () => {
    // Task 9.3: Full reset of error state
    console.log("[GraphErrorBoundary] Resetting error boundary");
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    });
  };

  render() {
    if (this.state.hasError) {
      // Task 9.3: User-friendly error UI with recovery options
      const canRetry = this.state.retryCount < this.maxRetries;
      const isLayoutError =
        this.state.error?.message?.includes("layout") ||
        this.state.error?.stack?.includes("layout");

      return (
        this.props.fallback || (
          <div
            style={{
              padding: "20px",
              margin: "10px",
              border: "1px solid var(--vscode-errorForeground)",
              borderRadius: "4px",
              backgroundColor: "var(--vscode-inputValidation-errorBackground)",
              color: "var(--vscode-errorForeground)",
              fontFamily: "var(--vscode-font-family)",
              fontSize: "var(--vscode-font-size)",
            }}
          >
            <h3
              style={{
                margin: "0 0 10px 0",
                color: "var(--vscode-errorForeground)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "18px" }}>⚠️</span>
              {isLayoutError ? "Graph Layout Error" : "Graph Display Error"}
            </h3>

            <p style={{ margin: "0 0 15px 0", lineHeight: "1.4" }}>
              {isLayoutError
                ? "There was an error applying the graph layout. This may be due to invalid data or a layout configuration issue."
                : "An error occurred while displaying the graph. The data may be corrupted or incompatible."}
            </p>

            <details style={{ margin: "10px 0", fontSize: "12px" }}>
              <summary style={{ cursor: "pointer", userSelect: "none" }}>
                Technical Details
              </summary>
              <div
                style={{
                  marginTop: "8px",
                  padding: "8px",
                  backgroundColor: "var(--vscode-textBlockQuote-background)",
                  border: "1px solid var(--vscode-textBlockQuote-border)",
                  borderRadius: "3px",
                  fontFamily: "var(--vscode-editor-font-family)",
                  fontSize: "11px",
                  wordBreak: "break-word",
                }}
              >
                <strong>Error:</strong>{" "}
                {this.state.error?.message || "Unknown error"}
                <br />
                <strong>Retry Count:</strong> {this.state.retryCount}/
                {this.maxRetries}
                <br />
                {this.state.errorInfo && (
                  <>
                    <strong>Stack:</strong>{" "}
                    <pre style={{ whiteSpace: "pre-wrap", margin: "4px 0" }}>
                      {this.state.errorInfo}
                    </pre>
                  </>
                )}
              </div>
            </details>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginTop: "15px",
              }}
            >
              {canRetry && (
                <button
                  onClick={this.handleRetry}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "var(--vscode-button-background)",
                    color: "var(--vscode-button-foreground)",
                    border:
                      "1px solid var(--vscode-button-border, transparent)",
                    borderRadius: "3px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontFamily: "var(--vscode-font-family)",
                  }}
                >
                  🔄 Retry ({this.maxRetries - this.state.retryCount} attempts
                  left)
                </button>
              )}

              <button
                onClick={this.handleReset}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "var(--vscode-button-secondaryBackground)",
                  color: "var(--vscode-button-secondaryForeground)",
                  border: "1px solid var(--vscode-button-border, transparent)",
                  borderRadius: "3px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontFamily: "var(--vscode-font-family)",
                }}
              >
                🔃 Reset
              </button>

              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "var(--vscode-button-background)",
                  color: "var(--vscode-button-foreground)",
                  border: "1px solid var(--vscode-button-border, transparent)",
                  borderRadius: "3px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontFamily: "var(--vscode-font-family)",
                }}
              >
                🔄 Reload Page
              </button>
            </div>

            {isLayoutError && (
              <div
                style={{
                  marginTop: "15px",
                  padding: "10px",
                  backgroundColor:
                    "var(--vscode-inputValidation-warningBackground)",
                  border:
                    "1px solid var(--vscode-inputValidation-warningBorder)",
                  borderRadius: "3px",
                  fontSize: "12px",
                  color: "var(--vscode-inputValidation-warningForeground)",
                }}
              >
                <strong>💡 Suggestions:</strong>
                <ul style={{ margin: "5px 0", paddingLeft: "16px" }}>
                  <li>
                    Try switching to a simpler layout (Force-Directed or Circle)
                  </li>
                  <li>Check if the graph data is valid</li>
                  <li>
                    For large graphs (1000+ nodes), consider using Grid layout
                  </li>
                  <li>Refresh the page to reset the graph state</li>
                </ul>
              </div>
            )}
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default GraphErrorBoundary;
