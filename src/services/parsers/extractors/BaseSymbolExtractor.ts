import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { CodeSymbol } from '../../../types';
import { JSDocExtractor } from '../JSDocExtractor';
import { ASTLocationHelper } from '../ASTLocationHelper';

/**
 * Base class for symbol extractors providing common functionality
 */
export abstract class BaseSymbolExtractor {
    /**
     * Extracts JSDoc documentation from a node
     */
    protected extractJSDoc(node: any): string | undefined {
        return JSDocExtractor.extractJSDoc(node);
    }

    /**
     * Creates location information from AST node
     */
    protected createLocation(node: t.Node, filePath: string) {
        return ASTLocationHelper.createLocation(node, filePath);
    }

    /**
     * Extracts source text from AST node
     */
    protected extractSourceText(node: t.Node, sourceContent: string): string | undefined {
        return ASTLocationHelper.extractSourceText(node, sourceContent);
    }

    /**
     * Extracts parameter names from function parameters
     */
    protected extractParameters(params: t.Function['params']): string[] {
        return params.map(param => {
            if (t.isIdentifier(param)) {
                return param.name;
            } else if (t.isAssignmentPattern(param) && t.isIdentifier(param.left)) {
                return `${param.left.name}?`;
            }
            return 'unknown';
        });
    }

    /**
     * Abstract method that each extractor must implement
     */
    public abstract extract(path: NodePath<any>, filePath: string, sourceContent?: string): CodeSymbol | CodeSymbol[] | null;
}