import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { CodeSymbol } from '../types';

/**
 * Service for parsing TypeScript code and extracting code symbols using Babel AST
 */
export class CodeParserService {
  /**
   * Parse TypeScript code and extract function symbols
   * @param filePath - Relative path from workspace root
   * @param code - TypeScript source code
   * @returns Array of CodeSymbol objects for functions
   */
  static parse(filePath: string, code: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];

    try {
      // Configure Babel parser with TypeScript support and module source type
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
      });

      // Traverse AST targeting FunctionDeclaration nodes
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
          let docstring: string | null = null;
          if (node.leadingComments && node.leadingComments.length > 0) {
            // Look for JSDoc comments (/** ... */)
            const jsdocComment = node.leadingComments.find(comment => 
              comment.type === 'CommentBlock' && comment.value.startsWith('*')
            );
            
            if (jsdocComment) {
              docstring = `/*${jsdocComment.value}*/`;
            }
          }

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
        }
      });

    } catch (error) {
      // Log parsing errors but don't throw - graceful degradation
      console.error(`Failed to parse file ${filePath}:`, error);
    }

    return symbols;
  }
}