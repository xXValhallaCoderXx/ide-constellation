import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { CodeSymbol } from '../../../types';
import { BaseSymbolExtractor } from './BaseSymbolExtractor';

/**
 * Extractor for variable declarations
 */
export class VariableSymbolExtractor extends BaseSymbolExtractor {
    /**
     * Extracts variable symbol from variable declarator
     */
    public extract(path: NodePath<t.VariableDeclarator>, filePath: string, sourceContent?: string): CodeSymbol | null {
        const node = path.node;
        if (!t.isIdentifier(node.id)) {
            return null;
        }

        const documentation = this.extractJSDoc(node);
        const sourceText = sourceContent ? this.extractSourceText(node, sourceContent) : undefined;

        return {
            name: node.id.name,
            type: 'variable',
            documentation,
            location: this.createLocation(node, filePath),
            sourceText
        };
    }
}