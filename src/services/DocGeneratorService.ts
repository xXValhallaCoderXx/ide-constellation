import * as vscode from 'vscode';
import * as path from 'path';
import { CodeSymbol } from '../types';

/**
 * Service responsible for generating markdown documentation files
 * from parsed code symbols
 */
export class DocGeneratorService {
    private readonly docsBasePath: string;

    constructor() {
        // Define docs directory path as /docs/api/
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            throw new Error('No workspace folder found');
        }
        this.docsBasePath = path.join(workspaceRoot, 'docs', 'api');
    }

    /**
     * Generate comprehensive markdown documentation for a source file
     * @param filePath - Path to the source file being documented
     * @param symbols - Array of code symbols extracted from the file
     * @returns Generated markdown content as string
     */
    public generateFileDoc(filePath: string, symbols: CodeSymbol[]): string {
        console.log(`📝 DocGeneratorService: Generating documentation for ${filePath}`);
        console.log(`📊 DocGeneratorService: Processing ${symbols.length} symbols`);

        // Extract filename for the header
        const fileName = path.basename(filePath);
        const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));

        // Start building the markdown content
        let markdown = `# API Reference: ${fileName}\n\n`;

        // Add file introduction
        markdown += this.generateFileIntroduction(filePath, symbols);

        // Group symbols by type for organized documentation
        const symbolGroups = this.groupSymbolsByType(symbols);

        // Generate sections for each symbol type
        if (symbolGroups.functions.length > 0) {
            markdown += '\n## Functions\n\n';
            symbolGroups.functions.forEach(symbol => {
                markdown += this.formatFunctionSection(symbol);
            });
        }

        if (symbolGroups.classes.length > 0) {
            markdown += '\n## Classes\n\n';
            symbolGroups.classes.forEach(symbol => {
                markdown += this.formatClassSection(symbol);
            });
        }

        if (symbolGroups.interfaces.length > 0) {
            markdown += '\n## Interfaces\n\n';
            symbolGroups.interfaces.forEach(symbol => {
                markdown += this.formatInterfaceSection(symbol);
            });
        }

        if (symbolGroups.types.length > 0) {
            markdown += '\n## Type Aliases\n\n';
            symbolGroups.types.forEach(symbol => {
                markdown += this.formatTypeSection(symbol);
            });
        }

        if (symbolGroups.variables.length > 0) {
            markdown += '\n## Variables\n\n';
            symbolGroups.variables.forEach(symbol => {
                markdown += this.formatVariableSection(symbol);
            });
        }

        console.log(`✅ DocGeneratorService: Generated ${markdown.length} characters of documentation`);
        return markdown;
    }

    /**
     * Format a function symbol into a markdown section
     * @param symbol - Function symbol to format
     * @returns Formatted markdown section
     */
    public formatFunctionSection(symbol: CodeSymbol): string {
        let section = `### ${symbol.name}\n\n`;

        // Add description from JSDoc or placeholder
        if (symbol.documentation) {
            const description = this.extractDescriptionFromJSDoc(symbol.documentation);
            section += `${description}\n\n`;
        } else {
            section += `Function: ${symbol.name}\n\n`;
        }

        // Add parameters table if function has parameters
        if (symbol.metadata?.parameters && symbol.metadata.parameters.length > 0) {
            section += '#### Parameters\n\n';
            section += this.createParametersTable(symbol);
        }

        // Add return value information
        if (symbol.metadata?.returnType) {
            section += '#### Returns\n\n';
            section += this.createReturnsTable(symbol);
        }

        // Add source code section
        if (symbol.sourceText) {
            section += '#### Source Code\n\n';
            section += '```typescript\n';
            section += symbol.sourceText;
            section += '\n```\n\n';
        }

        return section;
    }

    /**
     * Create a markdown table for function parameters
     * @param symbol - Function symbol with parameter metadata
     * @returns Formatted parameters table
     */
    public createParametersTable(symbol: CodeSymbol): string {
        if (!symbol.metadata?.parameters || symbol.metadata.parameters.length === 0) {
            return '';
        }

        let table = '| Parameter | Type | Description |\n';
        table += '|-----------|------|-------------|\n';

        // Extract parameter information from JSDoc if available
        const paramInfo = this.extractParameterInfo(symbol.documentation || '');

        symbol.metadata.parameters.forEach(param => {
            const paramName = param.split(':')[0].trim();
            const paramType = param.includes(':') ? param.split(':')[1].trim() : 'any';
            const paramDesc = paramInfo[paramName] || 'Parameter description';

            table += `| ${paramName} | ${paramType} | ${paramDesc} |\n`;
        });

        return table + '\n';
    }

    /**
     * Create a markdown table for return value information
     * @param symbol - Function symbol with return type metadata
     * @returns Formatted returns table
     */
    public createReturnsTable(symbol: CodeSymbol): string {
        if (!symbol.metadata?.returnType) {
            return '';
        }

        let table = '| Type | Description |\n';
        table += '|------|-------------|\n';

        // Extract return information from JSDoc if available
        const returnDesc = this.extractReturnInfo(symbol.documentation || '');

        table += `| ${symbol.metadata.returnType} | ${returnDesc} |\n\n`;

        return table;
    }

    /**
     * Ensure the docs/api directory exists
     * @returns Promise that resolves when directory is created
     */
    public async ensureDocsDirectory(): Promise<void> {
        try {
            const docsDirUri = vscode.Uri.file(this.docsBasePath);
            await vscode.workspace.fs.createDirectory(docsDirUri);
            console.log(`📁 DocGeneratorService: Ensured docs directory exists at ${this.docsBasePath}`);
        } catch (error) {
            // VS Code's createDirectory doesn't fail if directory already exists
            if ((error as vscode.FileSystemError).code !== 'FileExists') {
                console.error('❌ DocGeneratorService: Failed to create docs directory:', error);
                throw error;
            }
        }
    }

    /**
     * Write documentation content to a markdown file
     * @param sourceFilePath - Path to the source file being documented
     * @param content - Markdown content to write
     * @returns Promise that resolves when file is written
     */
    public async writeDocumentationFile(sourceFilePath: string, content: string): Promise<void> {
        try {
            // Ensure docs directory exists
            await this.ensureDocsDirectory();

            // Calculate documentation file path
            const docFilePath = this.getDocumentationFilePath(sourceFilePath);
            const docFileUri = vscode.Uri.file(docFilePath);

            // Write content to file
            const contentBuffer = Buffer.from(content, 'utf8');
            await vscode.workspace.fs.writeFile(docFileUri, contentBuffer);

            console.log(`✅ DocGeneratorService: Documentation written to ${docFilePath}`);
        } catch (error) {
            console.error(`❌ DocGeneratorService: Failed to write documentation file:`, error);
            throw error;
        }
    }

    /**
     * Calculate the documentation file path for a given source file
     * @param sourceFilePath - Path to the source file
     * @returns Path where the documentation file should be written
     */
    private getDocumentationFilePath(sourceFilePath: string): string {
        const fileName = path.basename(sourceFilePath);
        const fileNameWithoutExt = path.basename(sourceFilePath, path.extname(fileName));
        return path.join(this.docsBasePath, `${fileNameWithoutExt}.md`);
    }

    /**
     * Generate an introduction section for the file documentation
     * @param filePath - Path to the source file
     * @param symbols - Array of symbols in the file
     * @returns Introduction text
     */
    private generateFileIntroduction(filePath: string, symbols: CodeSymbol[]): string {
        const fileName = path.basename(filePath);
        const symbolCounts = this.getSymbolCounts(symbols);

        let intro = `This document provides API reference documentation for \`${fileName}\`.\n\n`;

        // Add summary of contents
        const contentSummary = [];
        if (symbolCounts.functions > 0) contentSummary.push(`${symbolCounts.functions} function${symbolCounts.functions > 1 ? 's' : ''}`);
        if (symbolCounts.classes > 0) contentSummary.push(`${symbolCounts.classes} class${symbolCounts.classes > 1 ? 'es' : ''}`);
        if (symbolCounts.interfaces > 0) contentSummary.push(`${symbolCounts.interfaces} interface${symbolCounts.interfaces > 1 ? 's' : ''}`);
        if (symbolCounts.types > 0) contentSummary.push(`${symbolCounts.types} type alias${symbolCounts.types > 1 ? 'es' : ''}`);
        if (symbolCounts.variables > 0) contentSummary.push(`${symbolCounts.variables} variable${symbolCounts.variables > 1 ? 's' : ''}`);

        if (contentSummary.length > 0) {
            intro += `**Contents:** ${contentSummary.join(', ')}\n\n`;
        }

        return intro;
    }

    /**
     * Group symbols by their type for organized documentation
     * @param symbols - Array of code symbols
     * @returns Object with symbols grouped by type
     */
    private groupSymbolsByType(symbols: CodeSymbol[]): {
        functions: CodeSymbol[];
        classes: CodeSymbol[];
        interfaces: CodeSymbol[];
        types: CodeSymbol[];
        variables: CodeSymbol[];
        methods: CodeSymbol[];
        properties: CodeSymbol[];
    } {
        return {
            functions: symbols.filter(s => s.type === 'function'),
            classes: symbols.filter(s => s.type === 'class'),
            interfaces: symbols.filter(s => s.type === 'interface'),
            types: symbols.filter(s => s.type === 'type'),
            variables: symbols.filter(s => s.type === 'variable'),
            methods: symbols.filter(s => s.type === 'method'),
            properties: symbols.filter(s => s.type === 'property')
        };
    }

    /**
     * Get counts of different symbol types
     * @param symbols - Array of code symbols
     * @returns Object with counts for each symbol type
     */
    private getSymbolCounts(symbols: CodeSymbol[]): Record<string, number> {
        const counts: Record<string, number> = {
            functions: 0,
            classes: 0,
            interfaces: 0,
            types: 0,
            variables: 0,
            methods: 0,
            properties: 0
        };

        symbols.forEach(symbol => {
            counts[symbol.type + 's'] = (counts[symbol.type + 's'] || 0) + 1;
        });

        return counts;
    }

    /**
     * Format a class symbol into a markdown section
     * @param symbol - Class symbol to format
     * @returns Formatted markdown section
     */
    private formatClassSection(symbol: CodeSymbol): string {
        let section = `### ${symbol.name}\n\n`;

        // Add description from JSDoc or placeholder
        if (symbol.documentation) {
            const description = this.extractDescriptionFromJSDoc(symbol.documentation);
            section += `${description}\n\n`;
        } else {
            section += `Class: ${symbol.name}\n\n`;
        }

        // Add source code section
        if (symbol.sourceText) {
            section += '#### Source Code\n\n';
            section += '```typescript\n';
            section += symbol.sourceText;
            section += '\n```\n\n';
        }

        return section;
    }

    /**
     * Format an interface symbol into a markdown section
     * @param symbol - Interface symbol to format
     * @returns Formatted markdown section
     */
    private formatInterfaceSection(symbol: CodeSymbol): string {
        let section = `### ${symbol.name}\n\n`;

        // Add description from JSDoc or placeholder
        if (symbol.documentation) {
            const description = this.extractDescriptionFromJSDoc(symbol.documentation);
            section += `${description}\n\n`;
        } else {
            section += `Interface: ${symbol.name}\n\n`;
        }

        // Add source code section
        if (symbol.sourceText) {
            section += '#### Source Code\n\n';
            section += '```typescript\n';
            section += symbol.sourceText;
            section += '\n```\n\n';
        }

        return section;
    }

    /**
     * Format a type alias symbol into a markdown section
     * @param symbol - Type symbol to format
     * @returns Formatted markdown section
     */
    private formatTypeSection(symbol: CodeSymbol): string {
        let section = `### ${symbol.name}\n\n`;

        // Add description from JSDoc or placeholder
        if (symbol.documentation) {
            const description = this.extractDescriptionFromJSDoc(symbol.documentation);
            section += `${description}\n\n`;
        } else {
            section += `Type alias: ${symbol.name}\n\n`;
        }

        // Add source code section
        if (symbol.sourceText) {
            section += '#### Source Code\n\n';
            section += '```typescript\n';
            section += symbol.sourceText;
            section += '\n```\n\n';
        }

        return section;
    }

    /**
     * Format a variable symbol into a markdown section
     * @param symbol - Variable symbol to format
     * @returns Formatted markdown section
     */
    private formatVariableSection(symbol: CodeSymbol): string {
        let section = `### ${symbol.name}\n\n`;

        // Add description from JSDoc or placeholder
        if (symbol.documentation) {
            const description = this.extractDescriptionFromJSDoc(symbol.documentation);
            section += `${description}\n\n`;
        } else {
            section += `Variable: ${symbol.name}\n\n`;
        }

        // Add source code section
        if (symbol.sourceText) {
            section += '#### Source Code\n\n';
            section += '```typescript\n';
            section += symbol.sourceText;
            section += '\n```\n\n';
        }

        return section;
    }

    /**
     * Extract description text from JSDoc comment
     * @param jsdoc - JSDoc comment string
     * @returns Extracted description
     */
    private extractDescriptionFromJSDoc(jsdoc: string): string {
        // Remove /** and */ markers
        const content = jsdoc.replace(/^\/\*\*/, '').replace(/\*\/$/, '');

        // Extract the first part before any @tags
        const beforeFirstTag = content.split(/@\w+/)[0];

        // Clean up asterisks and whitespace
        const description = beforeFirstTag
            .split('\n')
            .map(line => line.replace(/^\s*\*\s?/, '').trim())
            .filter(line => line.length > 0)
            .join(' ')
            .trim();

        return description || 'No description available';
    }

    /**
     * Extract parameter information from JSDoc comment
     * @param jsdoc - JSDoc comment string
     * @returns Object mapping parameter names to descriptions
     */
    private extractParameterInfo(jsdoc: string): Record<string, string> {
        const paramInfo: Record<string, string> = {};

        // Match @param tags with various formats
        const paramMatches = jsdoc.match(/@param\s+(?:\{[^}]*\}\s+)?(\w+)\s+([^\n@]*)/g);

        if (paramMatches) {
            paramMatches.forEach(match => {
                const paramMatch = match.match(/@param\s+(?:\{[^}]*\}\s+)?(\w+)\s+([^\n@]*)/);
                if (paramMatch) {
                    const paramName = paramMatch[1];
                    const paramDesc = paramMatch[2].trim();
                    paramInfo[paramName] = paramDesc || 'Parameter description';
                }
            });
        }

        return paramInfo;
    }

    /**
     * Extract return information from JSDoc comment
     * @param jsdoc - JSDoc comment string
     * @returns Return value description
     */
    private extractReturnInfo(jsdoc: string): string {
        // Match @returns or @return tags
        const returnMatch = jsdoc.match(/@returns?\s+(?:\{[^}]*\}\s+)?([^\n@]*)/);

        if (returnMatch) {
            return returnMatch[1].trim() || 'Return value description';
        }

        return 'Return value description';
    }
}