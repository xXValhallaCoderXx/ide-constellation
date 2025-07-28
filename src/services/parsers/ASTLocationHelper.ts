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
}