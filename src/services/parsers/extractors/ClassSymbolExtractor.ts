import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { CodeSymbol, SymbolMetadata } from '../../../types';
import { BaseSymbolExtractor } from './BaseSymbolExtractor';
import { TypeAnnotationHelper } from '../TypeAnnotationHelper';

/**
 * Extractor for class declarations and their members
 */
export class ClassSymbolExtractor extends BaseSymbolExtractor {
    /**
     * Extracts class symbol from class declaration
     */
    public extractClass(path: NodePath<t.ClassDeclaration>, filePath: string, sourceContent?: string): CodeSymbol | null {
        const node = path.node;
        if (!node.id?.name) {
            return null;
        }

        const documentation = this.extractJSDoc(node);
        const sourceText = sourceContent ? this.extractSourceText(node, sourceContent) : undefined;

        return {
            name: node.id.name,
            type: 'class',
            documentation,
            location: this.createLocation(node, filePath),
            sourceText
        };
    }

    /**
     * Extracts class members (methods and properties) from class declaration
     */
    public extractClassMembers(path: NodePath<t.ClassDeclaration>, filePath: string, sourceContent?: string): CodeSymbol[] {
        const node = path.node;
        const className = node.id?.name;
        if (!className) {
            return [];
        }

        const members: CodeSymbol[] = [];

        node.body.body.forEach(member => {
            if (t.isClassMethod(member) && t.isIdentifier(member.key)) {
                const parameters = this.extractParameters(member.params);
                const accessibility = TypeAnnotationHelper.extractAccessibility(member);
                const documentation = this.extractJSDoc(member);
                const sourceText = sourceContent ? this.extractSourceText(member, sourceContent) : undefined;

                const metadata: SymbolMetadata = {
                    parameters,
                    returnType: TypeAnnotationHelper.extractReturnType(member),
                    parent: className,
                    accessibility,
                };

                members.push({
                    name: member.key.name,
                    type: 'method',
                    documentation,
                    location: this.createLocation(member, filePath),
                    metadata,
                    sourceText
                });
            } else if (t.isClassProperty(member) && t.isIdentifier(member.key)) {
                const accessibility = TypeAnnotationHelper.extractAccessibility(member);
                const documentation = this.extractJSDoc(member);
                const sourceText = sourceContent ? this.extractSourceText(member, sourceContent) : undefined;

                const metadata: SymbolMetadata = {
                    parent: className,
                    accessibility,
                };

                members.push({
                    name: member.key.name,
                    type: 'property',
                    documentation,
                    location: this.createLocation(member, filePath),
                    metadata,
                    sourceText
                });
            }
        });

        return members;
    }

    public extract(path: NodePath<t.ClassDeclaration>, filePath: string, sourceContent?: string): CodeSymbol[] {
        const classSymbol = this.extractClass(path, filePath, sourceContent);
        if (!classSymbol) {
            return [];
        }

        const members = this.extractClassMembers(path, filePath, sourceContent);
        return [classSymbol, ...members];
    }
}