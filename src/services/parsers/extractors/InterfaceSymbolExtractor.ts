import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { CodeSymbol } from '../../../types';
import { BaseSymbolExtractor } from './BaseSymbolExtractor';

/**
 * Extractor for TypeScript interface declarations
 */
export class InterfaceSymbolExtractor extends BaseSymbolExtractor {
    /**
     * Extracts interface symbol from TypeScript interface declaration
     */
    public extract(path: NodePath<t.TSInterfaceDeclaration>, filePath: string, sourceContent?: string): CodeSymbol | null {
        const node = path.node;
        if (!node.id?.name) {
            return null;
        }

        const documentation = this.extractJSDoc(node);
        const sourceText = sourceContent ? this.extractSourceText(node, sourceContent) : undefined;

        return {
            name: node.id.name,
            type: 'interface',
            documentation,
            location: this.createLocation(node, filePath),
            sourceText
        };
    }
}