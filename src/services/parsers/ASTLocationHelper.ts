import * as t from '@babel/types';
import { SymbolLocation } from '../../types';

/**
 * Utility class for creating location information from AST nodes
 */
export class ASTLocationHelper {
    /**
     * Creates location information from AST node
     * @param node - AST node with location information
     * @param filePath - File path for the symbol
     * @returns SymbolLocation object
     */
    public static createLocation(node: t.Node, filePath: string): SymbolLocation {
        const loc = node.loc;
        if (!loc) {
            // Fallback if location is not available
            return {
                filePath,
                startLine: 1,
                startColumn: 0,
                endLine: 1,
                endColumn: 0
            };
        }

        return {
            filePath,
            startLine: loc.start.line,
            startColumn: loc.start.column,
            endLine: loc.end.line,
            endColumn: loc.end.column
        };
    }

    /**
     * Extracts source text from content based on AST node location
     * @param node - AST node with location information
     * @param sourceContent - Original source code content
     * @returns Extracted source text or undefined if location is not available
     */
    public static extractSourceText(node: t.Node, sourceContent: string): string | undefined {
        const loc = node.loc;
        if (!loc) {
            return undefined;
        }

        const lines = sourceContent.split('\n');

        // Handle single line symbols
        if (loc.start.line === loc.end.line) {
            const line = lines[loc.start.line - 1]; // Convert to 0-based index
            if (line) {
                return line.substring(loc.start.column, loc.end.column);
            }
            return undefined;
        }

        // Handle multi-line symbols
        const result: string[] = [];

        for (let lineNum = loc.start.line; lineNum <= loc.end.line; lineNum++) {
            const line = lines[lineNum - 1]; // Convert to 0-based index
            if (!line) { continue; }

            if (lineNum === loc.start.line) {
                // First line: start from start column
                result.push(line.substring(loc.start.column));
            } else if (lineNum === loc.end.line) {
                // Last line: end at end column
                result.push(line.substring(0, loc.end.column));
            } else {
                // Middle lines: include entire line
                result.push(line);
            }
        }

        return result.join('\n');
    }
}