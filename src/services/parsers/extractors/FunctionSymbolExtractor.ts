import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { CodeSymbol, SymbolMetadata } from '../../../types';
import { BaseSymbolExtractor } from './BaseSymbolExtractor';
import { TypeAnnotationHelper } from '../TypeAnnotationHelper';

/**
 * Extractor for function declarations and function expressions
 */
export class FunctionSymbolExtractor extends BaseSymbolExtractor {
    /**
     * Extracts function symbol from function declaration
     */
    public extractFunctionDeclaration(path: NodePath<t.FunctionDeclaration>, filePath: string): CodeSymbol | null {
        const node = path.node;
        if (!node.id?.name) {
            return null;
        }

        const parameters = this.extractParameters(node.params);
        const metadata: SymbolMetadata = {
            parameters,
            returnType: TypeAnnotationHelper.extractReturnType(node),
        };

        const documentation = this.extractJSDoc(node);

        return {
            name: node.id.name,
            type: 'function',
            documentation,
            location: this.createLocation(node, filePath),
            metadata
        };
    }

    /**
     * Extracts function symbol from variable declarator with function expression
     */
    public extractVariableFunction(path: NodePath<t.VariableDeclarator>, filePath: string): CodeSymbol | null {
        const node = path.node;
        if (!t.isIdentifier(node.id) || !node.init) {
            return null;
        }

        let parameters: string[] = [];
        let returnType: string | undefined;

        if (t.isArrowFunctionExpression(node.init) || t.isFunctionExpression(node.init)) {
            parameters = this.extractParameters(node.init.params);
            returnType = TypeAnnotationHelper.extractReturnType(node.init);
        }

        const metadata: SymbolMetadata = {
            parameters,
            returnType,
        };

        const documentation = this.extractJSDoc(node);

        return {
            name: node.id.name,
            type: 'function',
            documentation,
            location: this.createLocation(node, filePath),
            metadata
        };
    }

    public extract(path: NodePath<any>, filePath: string): CodeSymbol | null {
        if (path.isFunctionDeclaration()) {
            return this.extractFunctionDeclaration(path, filePath);
        } else if (path.isVariableDeclarator()) {
            return this.extractVariableFunction(path, filePath);
        }
        return null;
    }
}