import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { CodeSymbol } from '../types';

/**
 * Service for parsing TypeScript code and extracting code symbols using Babel AST
 */
export class CodeParserService {
    // Performance optimization: File size limit for parsing
    private static readonly MAX_PARSE_SIZE_BYTES = 1024 * 1024; // 1MB limit

    /**
     * Parse TypeScript code and extract code symbols (functions, classes, methods)
     * @param filePath - Relative path from workspace root
     * @param code - TypeScript source code
     * @returns Array of CodeSymbol objects
     */
    static parse(filePath: string, code: string): CodeSymbol[] {
        const symbols: CodeSymbol[] = [];

        // Performance optimization: Check file size before parsing
        const codeSize = Buffer.byteLength(code, 'utf8');
        if (codeSize > this.MAX_PARSE_SIZE_BYTES) {
            console.warn(`Skipping parsing of large file (${codeSize} bytes): ${filePath}`);
            return symbols;
        }

        try {
            // Configure Babel parser with TypeScript support and module source type
            const ast = parse(code, {
                sourceType: 'module',
                plugins: ['typescript', 'jsx'],
                allowImportExportEverywhere: true,
                allowReturnOutsideFunction: true,
            });

            // Traverse AST targeting FunctionDeclaration, ClassDeclaration, and MethodDefinition nodes
            traverse(ast, {
                FunctionDeclaration(path) {
                    const node = path.node;

                    // Extract function name
                    if (!node.id || !node.id.name) {
                        return; // Skip anonymous functions
                    }

                    const functionName = node.id.name;

                    // Extract position information
                    if (!node.loc) {
                        return; // Skip if no location info
                    }

                    const position = {
                        start: {
                            line: node.loc.start.line - 1, // Convert to 0-based
                            character: node.loc.start.column
                        },
                        end: {
                            line: node.loc.end.line - 1, // Convert to 0-based
                            character: node.loc.end.column
                        }
                    };

                    // Extract docstring from leading comments
                    const docstring = CodeParserService.extractDocstring(node);

                    // Create CodeSymbol for the function
                    const symbol: CodeSymbol = {
                        id: `${filePath}#${functionName}`,
                        name: functionName,
                        kind: 'function',
                        filePath,
                        position,
                        docstring
                    };

                    symbols.push(symbol);
                },

                ClassDeclaration(path) {
                    const node = path.node;

                    // Extract class name
                    if (!node.id || !node.id.name) {
                        return; // Skip anonymous classes
                    }

                    const className = node.id.name;

                    // Extract position information
                    if (!node.loc) {
                        return; // Skip if no location info
                    }

                    const position = {
                        start: {
                            line: node.loc.start.line - 1, // Convert to 0-based
                            character: node.loc.start.column
                        },
                        end: {
                            line: node.loc.end.line - 1, // Convert to 0-based
                            character: node.loc.end.column
                        }
                    };

                    // Extract docstring from leading comments
                    const docstring = CodeParserService.extractDocstring(node);

                    // Create CodeSymbol for the class
                    const symbol: CodeSymbol = {
                        id: `${filePath}#${className}`,
                        name: className,
                        kind: 'class',
                        filePath,
                        position,
                        docstring
                    };

                    symbols.push(symbol);
                },

                ClassMethod(path) {
                    const node = path.node;

                    // Extract method name
                    if (!t.isIdentifier(node.key)) {
                        return; // Skip computed or non-identifier keys
                    }

                    const methodName = node.key.name;

                    // Skip constructor methods as they're not separate symbols
                    if (methodName === 'constructor') {
                        return;
                    }

                    // Extract position information
                    if (!node.loc) {
                        return; // Skip if no location info
                    }

                    const position = {
                        start: {
                            line: node.loc.start.line - 1, // Convert to 0-based
                            character: node.loc.start.column
                        },
                        end: {
                            line: node.loc.end.line - 1, // Convert to 0-based
                            character: node.loc.end.column
                        }
                    };

                    // Extract docstring from leading comments
                    const docstring = CodeParserService.extractDocstring(node);

                    // Get the parent class name for unique ID generation
                    const parentClass = path.findParent((parent) => parent.isClassDeclaration());
                    let className = 'UnknownClass';

                    if (parentClass && t.isClassDeclaration(parentClass.node) && parentClass.node.id) {
                        className = parentClass.node.id.name;
                    }

                    // Create CodeSymbol for the method with class context in ID
                    const symbol: CodeSymbol = {
                        id: `${filePath}#${className}.${methodName}`,
                        name: methodName,
                        kind: 'method',
                        filePath,
                        position,
                        docstring
                    };

                    symbols.push(symbol);
                },

                VariableDeclarator(path) {
                    const node = path.node;

                    // Extract variable name
                    if (!t.isIdentifier(node.id)) {
                        return; // Skip destructuring patterns and other complex patterns
                    }

                    const variableName = node.id.name;

                    // Extract position information
                    if (!node.loc) {
                        return; // Skip if no location info
                    }

                    const position = {
                        start: {
                            line: node.loc.start.line - 1, // Convert to 0-based
                            character: node.loc.start.column
                        },
                        end: {
                            line: node.loc.end.line - 1, // Convert to 0-based
                            character: node.loc.end.column
                        }
                    };

                    // Determine if this is an arrow function or regular variable
                    let kind: 'function' | 'variable' = 'variable';

                    if (node.init) {
                        // Check if the initializer is an arrow function
                        if (t.isArrowFunctionExpression(node.init)) {
                            kind = 'function';
                        }
                        // Check if the initializer is a function expression
                        else if (t.isFunctionExpression(node.init)) {
                            kind = 'function';
                        }
                    }

                    // Extract docstring from leading comments of the parent declaration
                    const parentDeclaration = path.findParent((parent) =>
                        parent.isVariableDeclaration()
                    );

                    let docstring: string | null = null;
                    if (parentDeclaration && parentDeclaration.node) {
                        docstring = CodeParserService.extractDocstring(parentDeclaration.node);
                    }

                    // Create CodeSymbol for the variable or arrow function
                    const symbol: CodeSymbol = {
                        id: `${filePath}#${variableName}`,
                        name: variableName,
                        kind,
                        filePath,
                        position,
                        docstring
                    };

                    symbols.push(symbol);
                }
            });

        } catch (error) {
            // Log parsing errors but don't throw - graceful degradation
            console.error(`Failed to parse file ${filePath}:`, error);
        }

        return symbols;
    }

    /**
     * Extract docstring from leading comments of an AST node
     * @param node - AST node to extract docstring from
     * @returns Docstring content or null if none found
     */
    private static extractDocstring(node: any): string | null {
        if (!node.leadingComments || node.leadingComments.length === 0) {
            return null;
        }

        // Look for JSDoc comments (/** ... */)
        const jsdocComment = node.leadingComments.find((comment: any) =>
            comment.type === 'CommentBlock' && comment.value.startsWith('*')
        );

        if (jsdocComment) {
            return `/*${jsdocComment.value}*/`;
        }

        return null;
    }
}