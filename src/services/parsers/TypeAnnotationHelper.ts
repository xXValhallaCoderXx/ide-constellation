import * as t from '@babel/types';

/**
 * Utility class for handling TypeScript type annotations
 */
export class TypeAnnotationHelper {
    /**
     * Extracts return type from function-like nodes
     * @param node - Function-like AST node
     * @returns Return type as string or undefined
     */
    public static extractReturnType(node: t.Function): string | undefined {
        if (t.isTSTypeAnnotation(node.returnType)) {
            return this.typeAnnotationToString(node.returnType.typeAnnotation);
        }
        return undefined;
    }

    /**
     * Extracts accessibility modifier from class members
     * @param node - Class member node
     * @returns Accessibility modifier or undefined
     */
    public static extractAccessibility(node: t.ClassMethod | t.ClassProperty): 'public' | 'private' | 'protected' | undefined {
        if ('accessibility' in node && node.accessibility) {
            return node.accessibility as 'public' | 'private' | 'protected';
        }
        return undefined;
    }

    /**
     * Converts TypeScript type annotation to string representation
     * @param typeAnnotation - TypeScript type annotation
     * @returns String representation of the type
     */
    public static typeAnnotationToString(typeAnnotation: t.TSType): string {
        if (t.isTSStringKeyword(typeAnnotation)) {
            return 'string';
        } else if (t.isTSNumberKeyword(typeAnnotation)) {
            return 'number';
        } else if (t.isTSBooleanKeyword(typeAnnotation)) {
            return 'boolean';
        } else if (t.isTSVoidKeyword(typeAnnotation)) {
            return 'void';
        } else if (t.isTSAnyKeyword(typeAnnotation)) {
            return 'any';
        } else if (t.isTSUnknownKeyword(typeAnnotation)) {
            return 'unknown';
        } else if (t.isTSTypeReference(typeAnnotation) && t.isIdentifier(typeAnnotation.typeName)) {
            return typeAnnotation.typeName.name;
        }
        return 'unknown';
    }
}