import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { CodeSymbol } from '../../../types';
import { BaseSymbolExtractor } from './BaseSymbolExtractor';

/**
 * Extractor for TypeScript type alias declarations
 */
export class TypeAliasSymbolExtractor extends BaseSymbolExtractor {
    /**
     * Extracts type alias symbol from TypeScript type alias declaration
     */
    public extract(path: NodePath<t.TSTypeAliasDeclaration>, filePath: string, sourceContent?: string): CodeSymbol | null {
        const node = path.node;
        if (!node.id?.name) {
            return null;
        }

        const documentation = this.extractJSDoc(node);
        const sourceText = sourceContent ? this.extractSourceText(node, sourceContent) : undefined;

        return {
            name: node.id.name,
            type: 'type',
            documentation,
            location: this.createLocation(node, filePath),
            sourceText
        };
    }
}