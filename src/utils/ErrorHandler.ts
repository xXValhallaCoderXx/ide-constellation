import * as vscode from 'vscode';

/**
 * Error category information for better monitoring and user feedback
 */
export interface ErrorInfo {
    category: string;
    userMessage: string;
    isRetryable: boolean;
    severity: 'error' | 'warning' | 'info';
}

/**
 * Performance metrics for operations
 */
export interface PerformanceMetrics {
    operationName: string;
    duration: number;
    success: boolean;
    errorCategory?: string;
    additionalMetrics?: Record<string, number>;
}

/**
 * Centralized error handling and logging utility
 */
export class ErrorHandler {
    private static readonly ERROR_LOG_PREFIX = '🚨 ErrorHandler';

    /**
     * Categorize error types for better monitoring and user feedback
     * @param error The error to categorize
     * @returns ErrorInfo object with categorized error information
     */
    public static categorizeError(error: unknown): ErrorInfo {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
            return {
                category: 'network',
                userMessage: 'Network connection issue. Check your internet connection.',
                isRetryable: true,
                severity: 'warning'
            };
        } else if (errorMessage.includes('memory') || errorMessage.includes('allocation') || errorMessage.includes('out of memory')) {
            return {
                category: 'memory',
                userMessage: 'Insufficient memory. Try closing other applications.',
                isRetryable: false,
                severity: 'error'
            };
        } else if (errorMessage.includes('permission') || errorMessage.includes('access') || errorMessage.includes('EACCES')) {
            return {
                category: 'permission',
                userMessage: 'File permission error. Check folder access rights.',
                isRetryable: false,
                severity: 'error'
            };
        } else if (errorMessage.includes('model') || errorMessage.includes('transformer') || errorMessage.includes('pipeline')) {
            return {
                category: 'model',
                userMessage: 'AI model loading failed. Model may be corrupted or incompatible.',
                isRetryable: true,
                severity: 'warning'
            };
        } else if (errorMessage.includes('database') || errorMessage.includes('vector') || errorMessage.includes('lance')) {
            return {
                category: 'database',
                userMessage: 'Vector database error. Database may be corrupted.',
                isRetryable: true,
                severity: 'warning'
            };
        } else if (errorMessage.includes('timeout')) {
            return {
                category: 'timeout',
                userMessage: 'Operation timed out. Try again later.',
                isRetryable: true,
                severity: 'warning'
            };
        } else if (errorMessage.includes('disk') || errorMessage.includes('space') || errorMessage.includes('ENOSPC')) {
            return {
                category: 'disk',
                userMessage: 'Insufficient disk space. Free up storage space.',
                isRetryable: false,
                severity: 'error'
            };
        } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
            return {
                category: 'rate_limit',
                userMessage: 'Service rate limit exceeded. Please wait before retrying.',
                isRetryable: true,
                severity: 'warning'
            };
        } else if (errorMessage.includes('validation') || errorMessage.includes('invalid input')) {
            return {
                category: 'validation',
                userMessage: 'Invalid input data. Please check your input.',
                isRetryable: false,
                severity: 'error'
            };
        }

        return {
            category: 'unknown',
            userMessage: 'An unexpected error occurred.',
            isRetryable: false,
            severity: 'error'
        };
    }

    /**
     * Log detailed error information with categorization
     * @param operationId Unique identifier for the operation
     * @param operationName Name of the operation that failed
     * @param error The error that occurred
     * @param duration Optional duration of the operation
     * @param additionalContext Optional additional context information
     */
    public static logError(
        operationId: string,
        operationName: string,
        error: unknown,
        duration?: number,
        additionalContext?: Record<string, any>
    ): ErrorInfo {
        const errorInfo = this.categorizeError(error);
        const durationStr = duration !== undefined ? ` (${duration}ms)` : '';

        console.error(`[${operationId}] ${this.ERROR_LOG_PREFIX}: ${operationName} failed${durationStr}`);
        console.error(`[${operationId}] 🏷️ Error category: ${errorInfo.category}`);
        console.error(`[${operationId}] 📋 Error message: ${error instanceof Error ? error.message : String(error)}`);
        console.error(`[${operationId}] 🔄 Retryable: ${errorInfo.isRetryable}`);
        console.error(`[${operationId}] ⚠️ Severity: ${errorInfo.severity}`);

        // Log detailed error information
        if (error instanceof Error) {
            console.error(`[${operationId}] 📋 Error type: ${error.constructor.name}`);
            if (error.stack) {
                console.error(`[${operationId}] 📚 Error stack:`, error.stack);
            }
        } else {
            console.error(`[${operationId}] ❓ Unknown error type: ${typeof error}`);
            console.error(`[${operationId}] 📋 Error details: ${String(error)}`);
        }

        // Log additional context if provided
        if (additionalContext) {
            console.error(`[${operationId}] 📄 Additional context:`, additionalContext);
        }

        return errorInfo;
    }

    /**
     * Show user notification based on error severity and category
     * @param operationName Name of the operation that failed
     * @param errorInfo Categorized error information
     * @param error Original error object
     * @param options Additional options for the notification
     */
    public static async showUserNotification(
        operationName: string,
        errorInfo: ErrorInfo,
        error: unknown,
        options?: {
            showDetails?: boolean;
            showRetry?: boolean;
            customMessage?: string;
            onRetry?: () => void;
        }
    ): Promise<void> {
        const message = options?.customMessage || `${operationName}: ${errorInfo.userMessage}`;
        const actions: string[] = [];

        if (options?.showDetails !== false) {
            actions.push('Details');
        }

        if (options?.showRetry !== false && errorInfo.isRetryable) {
            actions.push('Retry');
        }

        let showFunction: (message: string, ...items: string[]) => Thenable<string | undefined>;

        switch (errorInfo.severity) {
            case 'error':
                showFunction = vscode.window.showErrorMessage;
                break;
            case 'warning':
                showFunction = vscode.window.showWarningMessage;
                break;
            case 'info':
                showFunction = vscode.window.showInformationMessage;
                break;
        }

        const selection = await showFunction(message, ...actions);

        if (selection === 'Details') {
            const errorMsg = error instanceof Error ? error.message : String(error);
            await vscode.window.showErrorMessage(`${operationName} error (${errorInfo.category}): ${errorMsg}`);
        } else if (selection === 'Retry' && options?.onRetry) {
            options.onRetry();
        }
    }

    /**
     * Log performance metrics for monitoring
     * @param operationId Unique identifier for the operation
     * @param metrics Performance metrics to log
     */
    public static logPerformanceMetrics(operationId: string, metrics: PerformanceMetrics): void {
        console.log(`[${operationId}] 📊 Performance: ${metrics.operationName}`);
        console.log(`[${operationId}]   - Duration: ${metrics.duration}ms`);
        console.log(`[${operationId}]   - Success: ${metrics.success}`);

        if (!metrics.success && metrics.errorCategory) {
            console.log(`[${operationId}]   - Error category: ${metrics.errorCategory}`);
        }

        if (metrics.additionalMetrics) {
            Object.entries(metrics.additionalMetrics).forEach(([key, value]) => {
                console.log(`[${operationId}]   - ${key}: ${value}${typeof value === 'number' && key.includes('time') ? 'ms' : ''}`);
            });
        }
    }

    /**
     * Handle critical failures that should not block the main workflow
     * @param operationId Unique identifier for the operation
     * @param operationName Name of the operation that failed
     * @param error The error that occurred
     * @param fallbackAction Optional fallback action to execute
     * @param duration Optional duration of the operation
     */
    public static async handleNonBlockingError(
        operationId: string,
        operationName: string,
        error: unknown,
        fallbackAction?: () => void,
        duration?: number
    ): Promise<void> {
        const errorInfo = this.logError(operationId, operationName, error, duration);

        console.log(`[${operationId}] 🔄 ${this.ERROR_LOG_PREFIX}: Continuing with graceful degradation`);

        // Execute fallback action if provided
        if (fallbackAction) {
            try {
                fallbackAction();
                console.log(`[${operationId}] ✅ ${this.ERROR_LOG_PREFIX}: Fallback action executed successfully`);
            } catch (fallbackError) {
                console.error(`[${operationId}] ❌ ${this.ERROR_LOG_PREFIX}: Fallback action failed:`, fallbackError);
            }
        }

        // Show user notification for critical errors
        if (errorInfo.severity === 'error') {
            await this.showUserNotification(operationName, errorInfo, error, {
                customMessage: `${operationName} failed but processing will continue with reduced functionality.`,
                showRetry: false
            });
        }
    }

    /**
     * Create a standardized operation ID for logging
     * @param operationType Type of operation (e.g., 'embedding', 'vector-search')
     * @returns Unique operation ID
     */
    public static createOperationId(operationType: string): string {
        return `${operationType}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Measure operation performance and handle errors
     * @param operationId Unique identifier for the operation
     * @param operationName Name of the operation
     * @param operation The operation to execute
     * @param options Additional options
     * @returns Result of the operation or undefined if it failed
     */
    public static async measureAndHandle<T>(
        operationId: string,
        operationName: string,
        operation: () => Promise<T>,
        options?: {
            allowFailure?: boolean;
            fallbackValue?: T;
            onError?: (error: unknown, errorInfo: ErrorInfo) => void;
            additionalMetrics?: Record<string, number>;
        }
    ): Promise<T | undefined> {
        const startTime = Date.now();

        try {
            console.log(`[${operationId}] 🔧 Starting ${operationName}...`);
            const result = await operation();
            const duration = Date.now() - startTime;

            this.logPerformanceMetrics(operationId, {
                operationName,
                duration,
                success: true,
                additionalMetrics: options?.additionalMetrics
            });

            console.log(`[${operationId}] ✅ ${operationName} completed successfully (${duration}ms)`);
            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorInfo = this.logError(operationId, operationName, error, duration);

            this.logPerformanceMetrics(operationId, {
                operationName,
                duration,
                success: false,
                errorCategory: errorInfo.category,
                additionalMetrics: options?.additionalMetrics
            });

            // Execute custom error handler if provided
            if (options?.onError) {
                options.onError(error, errorInfo);
            }

            // Return fallback value or undefined based on options
            if (options?.allowFailure) {
                console.log(`[${operationId}] 🔄 ${operationName} failed but continuing with fallback`);
                return options.fallbackValue;
            }

            // Re-throw error if failure is not allowed
            throw error;
        }
    }
}