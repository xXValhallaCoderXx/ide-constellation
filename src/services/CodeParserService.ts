import { parse, ParserOptions } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { CodeSymbol } from '../types';
import { FunctionSymbolExtractor } from './parsers/extractors/FunctionSymbolExtractor';
import { VariableSymbolExtractor } from './parsers/extractors/VariableSymbolExtractor';
import { ClassSymbolExtractor } from './parsers/extractors/ClassSymbolExtractor';
import { InterfaceSymbolExtractor } from './parsers/extractors/InterfaceSymbolExtractor';
import { TypeAliasSymbolExtractor } from './parsers/extractors/TypeAliasSymbolExtractor';

/**
 * Error types for parsing operations
 */
enum ParseErrorType {
    SYNTAX_ERROR = 'SYNTAX_ERROR',
    TIMEOUT_ERROR = 'TIMEOUT_ERROR',
    TRAVERSAL_ERROR = 'TRAVERSAL_ERROR',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Configuration for parsing operations
 */
interface ParseConfig {
    /** Timeout in milliseconds for parsing operations */
    timeoutMs: number;
    /** Maximum file size in bytes to attempt parsing */
    maxFileSizeBytes: number;
}

/**
 * Service responsible for parsing TypeScript/JavaScript code and extracting structural metadata
 */
export class CodeParserService {
    private functionExtractor = new FunctionSymbolExtractor();
    private variableExtractor = new VariableSymbolExtractor();
    private classExtractor = new ClassSymbolExtractor();
    private interfaceExtractor = new InterfaceSymbolExtractor();
    private typeAliasExtractor = new TypeAliasSymbolExtractor();

    private readonly config: ParseConfig = {
        timeoutMs: 10000, // 10 seconds timeout
        maxFileSizeBytes: 1024 * 1024 // 1MB max file size
    };

    /**
     * Parses source code and extracts structural symbols
     * @param content - Source code content
     * @param filePath - File path for location tracking
     * @param fileExtension - File extension to determine parser options
     * @returns Array of extracted code symbols
     */
    public parseCode(content: string, filePath: string, fileExtension: string): CodeSymbol[] {
        const startTime = Date.now();

        try {
            // Check file size before attempting to parse
            if (content.length > this.config.maxFileSizeBytes) {
                this.logParseWarning(filePath, `File size (${content.length} bytes) exceeds maximum (${this.config.maxFileSizeBytes} bytes). Skipping parsing.`);
                return [];
            }

            // Parse with timeout protection
            return this.parseWithTimeout(content, filePath, fileExtension);

        } catch (error) {
            const duration = Date.now() - startTime;
            this.logParseError(filePath, error, ParseErrorType.UNKNOWN_ERROR, duration);
            return [];
        }
    }

    /**
     * Parses code with timeout protection
     * @param content - Source code content
     * @param filePath - File path for location tracking
     * @param fileExtension - File extension to determine parser options
     * @returns Array of extracted code symbols
     */
    private parseWithTimeout(content: string, filePath: string, fileExtension: string): CodeSymbol[] {
        const startTime = Date.now();
        let isTimedOut = false;

        // Set up timeout detection
        const timeoutId = setTimeout(() => {
            isTimedOut = true;
        }, this.config.timeoutMs);

        try {
            // Check for timeout before starting parsing
            if (isTimedOut) {
                throw new Error(`Parsing timeout after ${this.config.timeoutMs}ms`);
            }

            const symbols = this.performParsing(content, filePath, fileExtension, () => isTimedOut);
            clearTimeout(timeoutId);
            return symbols;
        } catch (error) {
            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorType = isTimedOut || errorMessage.includes('timeout') ?
                ParseErrorType.TIMEOUT_ERROR : ParseErrorType.UNKNOWN_ERROR;
            this.logParseError(filePath, error, errorType, duration);
            return [];
        }
    }

    /**
     * Performs the actual parsing and symbol extraction
     * @param content - Source code content
     * @param filePath - File path for location tracking
     * @param fileExtension - File extension to determine parser options
     * @param isTimedOut - Function to check if operation has timed out
     * @returns Array of extracted code symbols
     */
    private performParsing(content: string, filePath: string, fileExtension: string, isTimedOut?: () => boolean): CodeSymbol[] {
        const symbols: CodeSymbol[] = [];
        const startTime = Date.now();

        try {
            // Check for timeout before parsing
            if (isTimedOut && isTimedOut()) {
                throw new Error(`Parsing timeout before AST generation`);
            }

            // Parse the code into an AST
            const ast = this.parseToAST(content, filePath, fileExtension);
            if (!ast) {
                return [];
            }

            // Check for timeout before traversal
            if (isTimedOut && isTimedOut()) {
                throw new Error(`Parsing timeout before AST traversal`);
            }

            // Traverse the AST to extract symbols
            this.traverseAST(ast, filePath, symbols, isTimedOut);

            const duration = Date.now() - startTime;
            if (duration > 1000) { // Log if parsing takes more than 1 second
                this.logParseWarning(filePath, `Parsing took ${duration}ms (longer than expected)`);
            }

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorType = this.determineErrorType(error);
            this.logParseError(filePath, error, errorType, duration);
            return [];
        }

        return symbols;
    }

    /**
     * Parses content to AST with error handling
     * @param content - Source code content
     * @param filePath - File path for error reporting
     * @param fileExtension - File extension to determine parser options
     * @returns Parsed AST or null on error
     */
    private parseToAST(content: string, filePath: string, fileExtension: string): any | null {
        try {
            return parse(content, this.getParserOptions(fileExtension));
        } catch (error) {
            this.logParseError(filePath, error, ParseErrorType.SYNTAX_ERROR);
            return null;
        }
    }

    /**
     * Traverses AST to extract symbols with error handling
     * @param ast - The parsed AST
     * @param filePath - File path for location tracking
     * @param symbols - Array to collect extracted symbols
     * @param isTimedOut - Function to check if operation has timed out
     */
    private traverseAST(ast: any, filePath: string, symbols: CodeSymbol[], isTimedOut?: () => boolean): void {
        try {
            traverse(ast, {
                // Function declarations
                FunctionDeclaration: (path) => {
                    try {
                        // Check for timeout during traversal
                        if (isTimedOut && isTimedOut()) {
                            throw new Error('Parsing timeout during function extraction');
                        }

                        const symbol = this.functionExtractor.extractFunctionDeclaration(path, filePath);
                        if (symbol) {
                            symbols.push(symbol);
                        }
                    } catch (error) {
                        this.logExtractionError(filePath, 'FunctionDeclaration', error);
                    }
                },

                // Arrow functions and function expressions assigned to variables
                VariableDeclarator: (path) => {
                    try {
                        // Check for timeout during traversal
                        if (isTimedOut && isTimedOut()) {
                            throw new Error('Parsing timeout during variable extraction');
                        }

                        if (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init)) {
                            const symbol = this.functionExtractor.extractVariableFunction(path, filePath);
                            if (symbol) {
                                symbols.push(symbol);
                            }
                        } else if (path.node.init) {
                            // Regular variable declarations
                            const symbol = this.variableExtractor.extract(path, filePath);
                            if (symbol) {
                                symbols.push(symbol);
                            }
                        }
                    } catch (error) {
                        this.logExtractionError(filePath, 'VariableDeclarator', error);
                    }
                },

                // Class declarations
                ClassDeclaration: (path) => {
                    try {
                        // Check for timeout during traversal
                        if (isTimedOut && isTimedOut()) {
                            throw new Error('Parsing timeout during class extraction');
                        }

                        const classSymbols = this.classExtractor.extract(path, filePath);
                        symbols.push(...classSymbols);
                    } catch (error) {
                        this.logExtractionError(filePath, 'ClassDeclaration', error);
                    }
                },

                // Interface declarations (TypeScript)
                TSInterfaceDeclaration: (path) => {
                    try {
                        // Check for timeout during traversal
                        if (isTimedOut && isTimedOut()) {
                            throw new Error('Parsing timeout during interface extraction');
                        }

                        const symbol = this.interfaceExtractor.extract(path, filePath);
                        if (symbol) {
                            symbols.push(symbol);
                        }
                    } catch (error) {
                        this.logExtractionError(filePath, 'TSInterfaceDeclaration', error);
                    }
                },

                // Type alias declarations (TypeScript)
                TSTypeAliasDeclaration: (path) => {
                    try {
                        // Check for timeout during traversal
                        if (isTimedOut && isTimedOut()) {
                            throw new Error('Parsing timeout during type alias extraction');
                        }

                        const symbol = this.typeAliasExtractor.extract(path, filePath);
                        if (symbol) {
                            symbols.push(symbol);
                        }
                    } catch (error) {
                        this.logExtractionError(filePath, 'TSTypeAliasDeclaration', error);
                    }
                }
            });
        } catch (error) {
            this.logParseError(filePath, error, ParseErrorType.TRAVERSAL_ERROR);
        }
    }

    /**
     * Determines the type of parsing error
     * @param error - The error object
     * @returns The error type classification
     */
    private determineErrorType(error: any): ParseErrorType {
        if (!error) {
            return ParseErrorType.UNKNOWN_ERROR;
        }

        const errorMessage = error.message?.toLowerCase() || '';

        if (errorMessage.includes('timeout')) {
            return ParseErrorType.TIMEOUT_ERROR;
        }

        if (errorMessage.includes('syntax') ||
            errorMessage.includes('unexpected') ||
            errorMessage.includes('expected') ||
            error.name === 'SyntaxError') {
            return ParseErrorType.SYNTAX_ERROR;
        }

        if (errorMessage.includes('traverse') || errorMessage.includes('visitor')) {
            return ParseErrorType.TRAVERSAL_ERROR;
        }

        return ParseErrorType.UNKNOWN_ERROR;
    }

    /**
     * Logs parsing errors with detailed information
     * @param filePath - File path where error occurred
     * @param error - The error object
     * @param errorType - Classification of the error
     * @param duration - Optional parsing duration in milliseconds
     */
    private logParseError(filePath: string, error: any, errorType: ParseErrorType, duration?: number): void {
        const durationText = duration !== undefined ? ` (${duration}ms)` : '';
        const errorMessage = error?.message || 'Unknown error';

        console.error(`[CodeParserService] ${errorType} in ${filePath}${durationText}:`, errorMessage);

        // Log additional context for specific error types
        switch (errorType) {
            case ParseErrorType.SYNTAX_ERROR:
                if (error.loc) {
                    console.error(`  Syntax error at line ${error.loc.line}, column ${error.loc.column}`);
                }
                break;
            case ParseErrorType.TIMEOUT_ERROR:
                console.error(`  Parsing exceeded timeout of ${this.config.timeoutMs}ms`);
                break;
            case ParseErrorType.TRAVERSAL_ERROR:
                console.error(`  Error occurred during AST traversal`);
                break;
        }

        // Log stack trace for debugging in development
        if (error?.stack && process.env.NODE_ENV === 'development') {
            console.error(`  Stack trace:`, error.stack);
        }
    }

    /**
     * Logs warnings for parsing operations
     * @param filePath - File path where warning occurred
     * @param message - Warning message
     */
    private logParseWarning(filePath: string, message: string): void {
        console.warn(`[CodeParserService] Warning for ${filePath}: ${message}`);
    }

    /**
     * Logs errors that occur during symbol extraction
     * @param filePath - File path where error occurred
     * @param nodeType - Type of AST node being processed
     * @param error - The error object
     */
    private logExtractionError(filePath: string, nodeType: string, error: any): void {
        const errorMessage = error?.message || 'Unknown error';
        console.error(`[CodeParserService] Symbol extraction error in ${filePath} for ${nodeType}:`, errorMessage);

    // Continue processing other symbols instead of failing completely
    }

    /**
     * Determines parser options based on file extension
     * @param fileExtension - File extension (.ts, .js, .tsx, .jsx)
     * @returns Babel parser options
     */
    private getParserOptions(fileExtension: string): ParserOptions {
        const baseOptions: ParserOptions = {
            sourceType: 'module',
            allowImportExportEverywhere: true,
            allowReturnOutsideFunction: true,
            ranges: true,
            tokens: false,
            attachComment: true,
        };

        switch (fileExtension.toLowerCase()) {
            case '.ts':
                return {
                    ...baseOptions,
                    plugins: [
                        'typescript',
                        'decorators-legacy',
                        'classProperties',
                        'objectRestSpread',
                        'asyncGenerators',
                        'functionBind',
                        'exportDefaultFrom',
                        'exportNamespaceFrom',
                        'dynamicImport',
                        'nullishCoalescingOperator',
                        'optionalChaining',
                    ],
                };

            case '.tsx':
                return {
                    ...baseOptions,
                    plugins: [
                        'typescript',
                        'jsx',
                        'decorators-legacy',
                        'classProperties',
                        'objectRestSpread',
                        'asyncGenerators',
                        'functionBind',
                        'exportDefaultFrom',
                        'exportNamespaceFrom',
                        'dynamicImport',
                        'nullishCoalescingOperator',
                        'optionalChaining',
                    ],
                };

            case '.jsx':
                return {
                    ...baseOptions,
                    plugins: [
                        'jsx',
                        'decorators-legacy',
                        'classProperties',
                        'objectRestSpread',
                        'asyncGenerators',
                        'functionBind',
                        'exportDefaultFrom',
                        'exportNamespaceFrom',
                        'dynamicImport',
                        'nullishCoalescingOperator',
                        'optionalChaining',
                    ],
                };

            case '.js':
            default:
                return {
                    ...baseOptions,
                    plugins: [
                        'decorators-legacy',
                        'classProperties',
                        'objectRestSpread',
                        'asyncGenerators',
                        'functionBind',
                        'exportDefaultFrom',
                        'exportNamespaceFrom',
                        'dynamicImport',
                        'nullishCoalescingOperator',
                        'optionalChaining',
                    ],
                };
        }
    }
}