/**
 * Utility class for extracting JSDoc comments from AST nodes
 */
export class JSDocExtractor {
    /**
     * Extracts JSDoc comment from AST node
     * @param node - AST node
     * @returns JSDoc comment content or undefined
     */
    public static extractJSDoc(node: any): string | undefined {
        // Check if the node has leading comments
        if (!node.leadingComments || node.leadingComments.length === 0) {
            return undefined;
        }

        // Find the last comment that is a JSDoc comment (starts with /**)
        for (let i = node.leadingComments.length - 1; i >= 0; i--) {
            const comment = node.leadingComments[i];
            if (comment.type === 'CommentBlock' && comment.value.startsWith('*')) {
                // Extract the JSDoc content, removing the leading * from each line
                const lines = comment.value.split('\n');
                const cleanedLines = lines.map((line: string) => {
                    // Remove leading whitespace and asterisk
                    const trimmed = line.trim();
                    if (trimmed.startsWith('*')) {
                        return trimmed.substring(1).trim();
                    }
                    return trimmed;
                }).filter((line: string) => line.length > 0); // Remove empty lines

                return cleanedLines.join('\n');
            }
        }

        return undefined;
    }
}