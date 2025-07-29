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
     * Generate comprehensive markdown documentation for a source file with professional formatting
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

        // Start building the markdown content with professional header
        let markdown = `# 📚 API Reference: ${fileName}\n\n`;

        // Add file introduction with enhanced formatting
        markdown += this.generateEnhancedFileIntroduction(filePath, symbols);

        // Add table of contents for better navigation
        markdown += this.generateTableOfContents(symbols);

        // Group symbols by type for organized documentation
        const symbolGroups = this.groupSymbolsByType(symbols);

        // Generate sections for each symbol type with proper hierarchy
        if (symbolGroups.functions.length > 0) {
            markdown += '\n## 🔧 Functions\n\n';
            markdown += `*This section documents ${symbolGroups.functions.length} function${symbolGroups.functions.length > 1 ? 's' : ''} available in this module.*\n\n`;
            symbolGroups.functions.forEach(symbol => {
                markdown += this.formatFunctionSection(symbol);
            });
        }

        if (symbolGroups.classes.length > 0) {
            markdown += '\n## 🏗️ Classes\n\n';
            markdown += `*This section documents ${symbolGroups.classes.length} class${symbolGroups.classes.length > 1 ? 'es' : ''} available in this module.*\n\n`;
            symbolGroups.classes.forEach(symbol => {
                markdown += this.formatClassSection(symbol);
            });
        }

        if (symbolGroups.interfaces.length > 0) {
            markdown += '\n## 📋 Interfaces\n\n';
            markdown += `*This section documents ${symbolGroups.interfaces.length} interface${symbolGroups.interfaces.length > 1 ? 's' : ''} available in this module.*\n\n`;
            symbolGroups.interfaces.forEach(symbol => {
                markdown += this.formatInterfaceSection(symbol);
            });
        }

        if (symbolGroups.types.length > 0) {
            markdown += '\n## 🏷️ Type Aliases\n\n';
            markdown += `*This section documents ${symbolGroups.types.length} type alias${symbolGroups.types.length > 1 ? 'es' : ''} available in this module.*\n\n`;
            symbolGroups.types.forEach(symbol => {
                markdown += this.formatTypeSection(symbol);
            });
        }

        if (symbolGroups.variables.length > 0) {
            markdown += '\n## 📦 Variables\n\n';
            markdown += `*This section documents ${symbolGroups.variables.length} variable${symbolGroups.variables.length > 1 ? 's' : ''} available in this module.*\n\n`;
            symbolGroups.variables.forEach(symbol => {
                markdown += this.formatVariableSection(symbol);
            });
        }

        // Add footer with generation info
        markdown += this.generateDocumentationFooter();

        console.log(`✅ DocGeneratorService: Generated ${markdown.length} characters of documentation`);
        return markdown;
    }

    /**
     * Format a function symbol into a markdown section with professional styling
     * @param symbol - Function symbol to format
     * @returns Formatted markdown section
     */
    public formatFunctionSection(symbol: CodeSymbol): string {
        let section = `### ${symbol.name}\n\n`;

        // Add function signature as a code block for clarity
        if (symbol.sourceText) {
            const signature = this.extractFunctionSignature(symbol.sourceText);
            if (signature) {
                section += `\`\`\`typescript\n${signature}\n\`\`\`\n\n`;
            }
        }

        // Add description from JSDoc with enhanced formatting
        if (symbol.documentation) {
            const parsedDoc = this.parseJSDocContent(symbol.documentation);
            section += `${parsedDoc.description}\n\n`;

            // Add examples if present in JSDoc
            if (parsedDoc.examples && parsedDoc.examples.length > 0) {
                section += '#### Examples\n\n';
                parsedDoc.examples.forEach(example => {
                    section += '```typescript\n';
                    section += example;
                    section += '\n```\n\n';
                });
            }
        } else {
            section += `Function: ${symbol.name}\n\n`;
        }

        // Add parameters table with enhanced formatting
        if (symbol.metadata?.parameters && symbol.metadata.parameters.length > 0) {
            section += '#### Parameters\n\n';
            section += this.createEnhancedParametersTable(symbol);
        }

        // Add return value information with enhanced formatting
        if (symbol.metadata?.returnType) {
            section += '#### Returns\n\n';
            section += this.createEnhancedReturnsTable(symbol);
        }

        // Add source code section with proper formatting
        if (symbol.sourceText) {
            section += '#### Source Code\n\n';
            section += '```typescript\n';
            section += symbol.sourceText.trim();
            section += '\n```\n\n';
        }

        // Add horizontal rule for visual separation
        section += '---\n\n';

        return section;
    }

    /**
     * Create an enhanced markdown table for function parameters with professional formatting
     * @param symbol - Function symbol with parameter metadata
     * @returns Formatted parameters table
     */
    public createEnhancedParametersTable(symbol: CodeSymbol): string {
        if (!symbol.metadata?.parameters || symbol.metadata.parameters.length === 0) {
            return '';
        }

        let table = '| Parameter | Type | Required | Description |\n';
        table += '|-----------|------|----------|-------------|\n';

        // Extract parameter information from JSDoc if available
        const paramInfo = this.extractParameterInfo(symbol.documentation || '');

        symbol.metadata.parameters.forEach(param => {
            const paramName = param.split(':')[0].trim();
            let paramType = param.includes(':') ? param.split(':')[1].trim() : 'any';

            // Check if parameter is optional
            const isOptional = paramName.includes('?') || paramType.includes('undefined') || paramType.includes('?');
            const cleanParamName = paramName.replace('?', '');
            const cleanParamType = paramType.replace('?', '').replace(' | undefined', '');

            // Format type with code styling
            const formattedType = `\`${cleanParamType}\``;
            const required = isOptional ? '❌ No' : '✅ Yes';
            const paramDesc = paramInfo[cleanParamName] || paramInfo[paramName] || 'Parameter description';

            table += `| **${cleanParamName}** | ${formattedType} | ${required} | ${paramDesc} |\n`;
        });

        return table + '\n';
    }

    /**
     * Legacy method for backward compatibility
     * @deprecated Use createEnhancedParametersTable instead
     */
    public createParametersTable(symbol: CodeSymbol): string {
        return this.createEnhancedParametersTable(symbol);
    }

    /**
     * Create an enhanced markdown table for return value information with professional formatting
     * @param symbol - Function symbol with return type metadata
     * @returns Formatted returns table
     */
    public createEnhancedReturnsTable(symbol: CodeSymbol): string {
        if (!symbol.metadata?.returnType) {
            return '';
        }

        let table = '| Type | Description | Possible Values |\n';
        table += '|------|-------------|----------------|\n';

        // Extract return information from JSDoc if available
        const returnInfo = this.extractEnhancedReturnInfo(symbol.documentation || '');
        const formattedType = `\`${symbol.metadata.returnType}\``;

        table += `| ${formattedType} | ${returnInfo.description} | ${returnInfo.possibleValues} |\n\n`;

        return table;
    }

    /**
     * Legacy method for backward compatibility
     * @deprecated Use createEnhancedReturnsTable instead
     */
    public createReturnsTable(symbol: CodeSymbol): string {
        return this.createEnhancedReturnsTable(symbol);
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
     * Generate an enhanced introduction section for the file documentation
     * @param filePath - Path to the source file
     * @param symbols - Array of symbols in the file
     * @returns Enhanced introduction text
     */
    private generateEnhancedFileIntroduction(filePath: string, symbols: CodeSymbol[]): string {
        const fileName = path.basename(filePath);
        const symbolCounts = this.getSymbolCounts(symbols);
        const totalSymbols = symbols.length;

        let intro = `> **File:** \`${fileName}\`  \n`;
        intro += `> **Total Symbols:** ${totalSymbols}  \n`;
        intro += `> **Generated:** ${new Date().toISOString().split('T')[0]}  \n\n`;

        intro += `## 📖 Overview\n\n`;
        intro += `This document provides comprehensive API reference documentation for \`${fileName}\`. `;
        intro += `The file contains ${totalSymbols} exported symbol${totalSymbols !== 1 ? 's' : ''} `;
        intro += `that ${totalSymbols === 1 ? 'is' : 'are'} documented below with detailed information including parameters, return values, and source code.\n\n`;

        // Add enhanced summary of contents
        const contentSummary = [];
        if (symbolCounts.functions > 0) contentSummary.push(`**${symbolCounts.functions}** function${symbolCounts.functions > 1 ? 's' : ''}`);
        if (symbolCounts.classes > 0) contentSummary.push(`**${symbolCounts.classes}** class${symbolCounts.classes > 1 ? 'es' : ''}`);
        if (symbolCounts.interfaces > 0) contentSummary.push(`**${symbolCounts.interfaces}** interface${symbolCounts.interfaces > 1 ? 's' : ''}`);
        if (symbolCounts.types > 0) contentSummary.push(`**${symbolCounts.types}** type alias${symbolCounts.types > 1 ? 'es' : ''}`);
        if (symbolCounts.variables > 0) contentSummary.push(`**${symbolCounts.variables}** variable${symbolCounts.variables > 1 ? 's' : ''}`);

        if (contentSummary.length > 0) {
            intro += `### 📊 Contents Summary\n\n`;
            intro += `This module exports: ${contentSummary.join(', ')}\n\n`;
        }

        return intro;
    }

    /**
     * Legacy method for backward compatibility
     * @deprecated Use generateEnhancedFileIntroduction instead
     */
    private generateFileIntroduction(filePath: string, symbols: CodeSymbol[]): string {
        return this.generateEnhancedFileIntroduction(filePath, symbols);
    }

    /**
     * Generate a table of contents for better navigation
     * @param symbols - Array of symbols in the file
     * @returns Table of contents markdown
     */
    private generateTableOfContents(symbols: CodeSymbol[]): string {
        const symbolGroups = this.groupSymbolsByType(symbols);
        let toc = `## 📑 Table of Contents\n\n`;

        const sections = [];
        if (symbolGroups.functions.length > 0) {
            sections.push(`- [🔧 Functions](#-functions) (${symbolGroups.functions.length})`);
            symbolGroups.functions.forEach(symbol => {
                sections.push(`  - [${symbol.name}](#${symbol.name.toLowerCase()})`);
            });
        }

        if (symbolGroups.classes.length > 0) {
            sections.push(`- [🏗️ Classes](#️-classes) (${symbolGroups.classes.length})`);
            symbolGroups.classes.forEach(symbol => {
                sections.push(`  - [${symbol.name}](#${symbol.name.toLowerCase()})`);
            });
        }

        if (symbolGroups.interfaces.length > 0) {
            sections.push(`- [📋 Interfaces](#-interfaces) (${symbolGroups.interfaces.length})`);
            symbolGroups.interfaces.forEach(symbol => {
                sections.push(`  - [${symbol.name}](#${symbol.name.toLowerCase()})`);
            });
        }

        if (symbolGroups.types.length > 0) {
            sections.push(`- [🏷️ Type Aliases](#️-type-aliases) (${symbolGroups.types.length})`);
            symbolGroups.types.forEach(symbol => {
                sections.push(`  - [${symbol.name}](#${symbol.name.toLowerCase()})`);
            });
        }

        if (symbolGroups.variables.length > 0) {
            sections.push(`- [📦 Variables](#-variables) (${symbolGroups.variables.length})`);
            symbolGroups.variables.forEach(symbol => {
                sections.push(`  - [${symbol.name}](#${symbol.name.toLowerCase()})`);
            });
        }

        if (sections.length > 0) {
            toc += sections.join('\n') + '\n\n';
        } else {
            toc += '*No symbols found in this file.*\n\n';
        }

        return toc;
    }

    /**
     * Generate a footer for the documentation
     * @returns Footer markdown
     */
    private generateDocumentationFooter(): string {
        const timestamp = new Date().toISOString();
        return `\n---\n\n` +
            `## 📄 Documentation Info\n\n` +
            `- **Generated:** ${timestamp}\n` +
            `- **Generator:** Polaris API Reference Agent\n` +
            `- **Format:** Markdown with TypeScript syntax highlighting\n\n` +
            `> This documentation was automatically generated. Please do not edit manually.\n`;
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
     * Format a class symbol into a markdown section with professional styling
     * @param symbol - Class symbol to format
     * @returns Formatted markdown section
     */
    private formatClassSection(symbol: CodeSymbol): string {
        let section = `### ${symbol.name}\n\n`;

        // Add class signature as a code block for clarity
        if (symbol.sourceText) {
            const classSignature = this.extractClassSignature(symbol.sourceText);
            if (classSignature) {
                section += `\`\`\`typescript\n${classSignature}\n\`\`\`\n\n`;
            }
        }

        // Add description from JSDoc with enhanced formatting
        if (symbol.documentation) {
            const parsedDoc = this.parseJSDocContent(symbol.documentation);
            section += `${parsedDoc.description}\n\n`;

            // Add examples if present in JSDoc
            if (parsedDoc.examples && parsedDoc.examples.length > 0) {
                section += '#### Examples\n\n';
                parsedDoc.examples.forEach(example => {
                    section += '```typescript\n';
                    section += example;
                    section += '\n```\n\n';
                });
            }
        } else {
            section += `**Class:** ${symbol.name}\n\n`;
        }

        // Add constructor information if available
        const constructorInfo = this.extractConstructorInfo(symbol.sourceText || '');
        if (constructorInfo) {
            section += '#### Constructor\n\n';
            section += constructorInfo;
        }

        // Add methods and properties summary
        const membersInfo = this.extractClassMembersInfo(symbol.sourceText || '');
        if (membersInfo.methods.length > 0 || membersInfo.properties.length > 0) {
            section += '#### Members\n\n';

            if (membersInfo.properties.length > 0) {
                section += '**Properties:**\n';
                membersInfo.properties.forEach(prop => {
                    section += `- \`${prop}\`\n`;
                });
                section += '\n';
            }

            if (membersInfo.methods.length > 0) {
                section += '**Methods:**\n';
                membersInfo.methods.forEach(method => {
                    section += `- \`${method}\`\n`;
                });
                section += '\n';
            }
        }

        // Add source code section with proper formatting
        if (symbol.sourceText) {
            section += '#### Source Code\n\n';
            section += '```typescript\n';
            section += symbol.sourceText.trim();
            section += '\n```\n\n';
        }

        // Add horizontal rule for visual separation
        section += '---\n\n';

        return section;
    }

    /**
     * Format an interface symbol into a markdown section with professional styling
     * @param symbol - Interface symbol to format
     * @returns Formatted markdown section
     */
    private formatInterfaceSection(symbol: CodeSymbol): string {
        let section = `### ${symbol.name}\n\n`;

        // Add interface signature as a code block for clarity
        if (symbol.sourceText) {
            const interfaceSignature = this.extractInterfaceSignature(symbol.sourceText);
            if (interfaceSignature) {
                section += `\`\`\`typescript\n${interfaceSignature}\n\`\`\`\n\n`;
            }
        }

        // Add description from JSDoc with enhanced formatting
        if (symbol.documentation) {
            const parsedDoc = this.parseJSDocContent(symbol.documentation);
            section += `${parsedDoc.description}\n\n`;

            // Add examples if present in JSDoc
            if (parsedDoc.examples && parsedDoc.examples.length > 0) {
                section += '#### Examples\n\n';
                parsedDoc.examples.forEach(example => {
                    section += '```typescript\n';
                    section += example;
                    section += '\n```\n\n';
                });
            }
        } else {
            section += `**Interface:** ${symbol.name}\n\n`;
        }

        // Add properties table for interface
        const properties = this.extractInterfaceProperties(symbol.sourceText || '');
        if (properties.length > 0) {
            section += '#### Properties\n\n';
            section += '| Property | Type | Required | Description |\n';
            section += '|----------|------|----------|-------------|\n';

            properties.forEach(prop => {
                const required = prop.optional ? '❌ No' : '✅ Yes';
                section += `| **${prop.name}** | \`${prop.type}\` | ${required} | ${prop.description} |\n`;
            });
            section += '\n';
        }

        // Add source code section with proper formatting
        if (symbol.sourceText) {
            section += '#### Source Code\n\n';
            section += '```typescript\n';
            section += symbol.sourceText.trim();
            section += '\n```\n\n';
        }

        // Add horizontal rule for visual separation
        section += '---\n\n';

        return section;
    }

    /**
     * Format a type alias symbol into a markdown section with professional styling
     * @param symbol - Type symbol to format
     * @returns Formatted markdown section
     */
    private formatTypeSection(symbol: CodeSymbol): string {
        let section = `### ${symbol.name}\n\n`;

        // Add type signature as a code block for clarity
        if (symbol.sourceText) {
            const typeSignature = this.extractTypeSignature(symbol.sourceText);
            if (typeSignature) {
                section += `\`\`\`typescript\n${typeSignature}\n\`\`\`\n\n`;
            }
        }

        // Add description from JSDoc with enhanced formatting
        if (symbol.documentation) {
            const parsedDoc = this.parseJSDocContent(symbol.documentation);
            section += `${parsedDoc.description}\n\n`;

            // Add examples if present in JSDoc
            if (parsedDoc.examples && parsedDoc.examples.length > 0) {
                section += '#### Examples\n\n';
                parsedDoc.examples.forEach(example => {
                    section += '```typescript\n';
                    section += example;
                    section += '\n```\n\n';
                });
            }
        } else {
            section += `**Type Alias:** ${symbol.name}\n\n`;
        }

        // Add type information table
        const typeInfo = this.extractTypeInfo(symbol.sourceText || '');
        if (typeInfo) {
            section += '#### Type Information\n\n';
            section += '| Property | Value |\n';
            section += '|----------|-------|\n';
            section += `| **Base Type** | \`${typeInfo.baseType}\` |\n`;
            section += `| **Category** | ${typeInfo.category} |\n`;
            if (typeInfo.unionTypes && typeInfo.unionTypes.length > 0) {
                section += `| **Union Types** | ${typeInfo.unionTypes.map(t => `\`${t}\``).join(', ')} |\n`;
            }
            section += '\n';
        }

        // Add source code section with proper formatting
        if (symbol.sourceText) {
            section += '#### Source Code\n\n';
            section += '```typescript\n';
            section += symbol.sourceText.trim();
            section += '\n```\n\n';
        }

        // Add horizontal rule for visual separation
        section += '---\n\n';

        return section;
    }

    /**
     * Format a variable symbol into a markdown section with professional styling
     * @param symbol - Variable symbol to format
     * @returns Formatted markdown section
     */
    private formatVariableSection(symbol: CodeSymbol): string {
        let section = `### ${symbol.name}\n\n`;

        // Add variable signature as a code block for clarity
        if (symbol.sourceText) {
            const variableSignature = this.extractVariableSignature(symbol.sourceText);
            if (variableSignature) {
                section += `\`\`\`typescript\n${variableSignature}\n\`\`\`\n\n`;
            }
        }

        // Add description from JSDoc with enhanced formatting
        if (symbol.documentation) {
            const parsedDoc = this.parseJSDocContent(symbol.documentation);
            section += `${parsedDoc.description}\n\n`;

            // Add examples if present in JSDoc
            if (parsedDoc.examples && parsedDoc.examples.length > 0) {
                section += '#### Examples\n\n';
                parsedDoc.examples.forEach(example => {
                    section += '```typescript\n';
                    section += example;
                    section += '\n```\n\n';
                });
            }
        } else {
            section += `**Variable:** ${symbol.name}\n\n`;
        }

        // Add variable information table
        const variableInfo = this.extractVariableInfo(symbol.sourceText || '');
        if (variableInfo) {
            section += '#### Variable Information\n\n';
            section += '| Property | Value |\n';
            section += '|----------|-------|\n';
            section += `| **Type** | \`${variableInfo.type}\` |\n`;
            section += `| **Declaration** | ${variableInfo.declaration} |\n`;
            section += `| **Scope** | ${variableInfo.scope} |\n`;
            if (variableInfo.initialValue) {
                section += `| **Initial Value** | \`${variableInfo.initialValue}\` |\n`;
            }
            section += '\n';
        }

        // Add source code section with proper formatting
        if (symbol.sourceText) {
            section += '#### Source Code\n\n';
            section += '```typescript\n';
            section += symbol.sourceText.trim();
            section += '\n```\n\n';
        }

        // Add horizontal rule for visual separation
        section += '---\n\n';

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

    /**
     * Extract enhanced return information from JSDoc comment
     * @param jsdoc - JSDoc comment string
     * @returns Enhanced return information object
     */
    private extractEnhancedReturnInfo(jsdoc: string): { description: string; possibleValues: string } {
        // Match @returns or @return tags
        const returnMatch = jsdoc.match(/@returns?\s+(?:\{[^}]*\}\s+)?([^\n@]*)/);

        let description = 'Return value description';
        let possibleValues = 'See type definition';

        if (returnMatch) {
            description = returnMatch[1].trim() || description;
        }

        // Look for possible values or examples in the description
        if (description.includes('true') || description.includes('false')) {
            possibleValues = '`true`, `false`';
        } else if (description.includes('null') || description.includes('undefined')) {
            possibleValues = 'Value or `null`/`undefined`';
        } else if (description.toLowerCase().includes('array')) {
            possibleValues = 'Array of values';
        } else if (description.toLowerCase().includes('object')) {
            possibleValues = 'Object instance';
        }

        return { description, possibleValues };
    }

    /**
     * Parse JSDoc content into structured format
     * @param jsdoc - JSDoc comment string
     * @returns Parsed JSDoc content
     */
    private parseJSDocContent(jsdoc: string): { description: string; examples: string[] } {
        const description = this.extractDescriptionFromJSDoc(jsdoc);
        const examples: string[] = [];

        // Extract @example tags
        const exampleMatches = jsdoc.match(/@example\s*\n([\s\S]*?)(?=@\w+|\*\/|$)/g);
        if (exampleMatches) {
            exampleMatches.forEach(match => {
                const exampleContent = match
                    .replace(/@example\s*\n/, '')
                    .split('\n')
                    .map(line => line.replace(/^\s*\*\s?/, '').trim())
                    .filter(line => line.length > 0)
                    .join('\n');

                if (exampleContent.trim()) {
                    examples.push(exampleContent.trim());
                }
            });
        }

        return { description, examples };
    }

    /**
     * Extract function signature from source text
     * @param sourceText - Function source code
     * @returns Function signature
     */
    private extractFunctionSignature(sourceText: string): string {
        // Extract just the function declaration line(s)
        const lines = sourceText.split('\n');
        let signature = '';
        let braceCount = 0;
        let foundStart = false;

        for (const line of lines) {
            if (!foundStart && (line.includes('function') || line.includes('=>') || line.includes('const') || line.includes('let'))) {
                foundStart = true;
            }

            if (foundStart) {
                signature += line + '\n';
                braceCount += (line.match(/\{/g) || []).length;
                braceCount -= (line.match(/\}/g) || []).length;

                if (braceCount > 0 || line.includes('{')) {
                    break;
                }
            }
        }

        return signature.trim();
    }

    /**
     * Extract class signature from source text
     * @param sourceText - Class source code
     * @returns Class signature
     */
    private extractClassSignature(sourceText: string): string {
        const lines = sourceText.split('\n');
        const signatureLines = [];

        for (const line of lines) {
            signatureLines.push(line);
            if (line.includes('{')) {
                break;
            }
        }

        return signatureLines.join('\n').trim();
    }

    /**
     * Extract interface signature from source text
     * @param sourceText - Interface source code
     * @returns Interface signature
     */
    private extractInterfaceSignature(sourceText: string): string {
        const lines = sourceText.split('\n');
        const signatureLines = [];

        for (const line of lines) {
            signatureLines.push(line);
            if (line.includes('{')) {
                break;
            }
        }

        return signatureLines.join('\n').trim();
    }

    /**
     * Extract type signature from source text
     * @param sourceText - Type source code
     * @returns Type signature
     */
    private extractTypeSignature(sourceText: string): string {
        // For type aliases, usually the entire declaration is the signature
        return sourceText.split('\n')[0].trim();
    }

    /**
     * Extract variable signature from source text
     * @param sourceText - Variable source code
     * @returns Variable signature
     */
    private extractVariableSignature(sourceText: string): string {
        // For variables, usually the first line is the signature
        return sourceText.split('\n')[0].trim();
    }

    /**
     * Extract constructor information from class source text
     * @param sourceText - Class source code
     * @returns Constructor information
     */
    private extractConstructorInfo(sourceText: string): string {
        const constructorMatch = sourceText.match(/constructor\s*\([^)]*\)[^{]*\{/);
        if (constructorMatch) {
            return `\`\`\`typescript\n${constructorMatch[0].replace('{', '{ ... }\n')}\`\`\`\n\n`;
        }
        return '';
    }

    /**
     * Extract class members information
     * @param sourceText - Class source code
     * @returns Object with methods and properties arrays
     */
    private extractClassMembersInfo(sourceText: string): { methods: string[]; properties: string[] } {
        const methods: string[] = [];
        const properties: string[] = [];

        // Simple regex patterns to find methods and properties
        const methodMatches = sourceText.match(/^\s*(?:public|private|protected)?\s*(\w+)\s*\([^)]*\)\s*:/gm);
        const propertyMatches = sourceText.match(/^\s*(?:public|private|protected)?\s*(\w+)\s*:\s*[^;=]+[;=]/gm);

        if (methodMatches) {
            methodMatches.forEach(match => {
                const methodName = match.match(/(\w+)\s*\(/)?.[1];
                if (methodName && methodName !== 'constructor') {
                    methods.push(methodName);
                }
            });
        }

        if (propertyMatches) {
            propertyMatches.forEach(match => {
                const propertyName = match.match(/(\w+)\s*:/)?.[1];
                if (propertyName) {
                    properties.push(propertyName);
                }
            });
        }

        return { methods, properties };
    }

    /**
     * Extract interface properties information
     * @param sourceText - Interface source code
     * @returns Array of property information
     */
    private extractInterfaceProperties(sourceText: string): Array<{ name: string; type: string; optional: boolean; description: string }> {
        const properties: Array<{ name: string; type: string; optional: boolean; description: string }> = [];

        // Match property declarations in interface
        const propertyMatches = sourceText.match(/^\s*(\w+)(\?)?:\s*([^;]+);?/gm);

        if (propertyMatches) {
            propertyMatches.forEach(match => {
                const propMatch = match.match(/^\s*(\w+)(\?)?:\s*([^;]+);?/);
                if (propMatch) {
                    const name = propMatch[1];
                    const optional = !!propMatch[2];
                    const type = propMatch[3].trim();

                    properties.push({
                        name,
                        type,
                        optional,
                        description: 'Property description'
                    });
                }
            });
        }

        return properties;
    }

    /**
     * Extract type information from type alias source text
     * @param sourceText - Type source code
     * @returns Type information object
     */
    private extractTypeInfo(sourceText: string): { baseType: string; category: string; unionTypes?: string[] } | null {
        const typeMatch = sourceText.match(/type\s+\w+\s*=\s*(.+)/);
        if (!typeMatch) return null;

        const typeDefinition = typeMatch[1].trim();
        let category = 'Simple Type';
        let unionTypes: string[] | undefined;

        if (typeDefinition.includes('|')) {
            category = 'Union Type';
            unionTypes = typeDefinition.split('|').map(t => t.trim());
        } else if (typeDefinition.includes('{')) {
            category = 'Object Type';
        } else if (typeDefinition.includes('[]') || typeDefinition.includes('Array<')) {
            category = 'Array Type';
        }

        return {
            baseType: typeDefinition,
            category,
            unionTypes
        };
    }

    /**
     * Extract variable information from variable source text
     * @param sourceText - Variable source code
     * @returns Variable information object
     */
    private extractVariableInfo(sourceText: string): { type: string; declaration: string; scope: string; initialValue?: string } | null {
        const line = sourceText.split('\n')[0];

        let declaration = 'const';
        let scope = 'Module';
        let type = 'any';
        let initialValue: string | undefined;

        if (line.includes('const ')) {
            declaration = 'const';
        } else if (line.includes('let ')) {
            declaration = 'let';
        } else if (line.includes('var ')) {
            declaration = 'var';
        }

        // Extract type annotation
        const typeMatch = line.match(/:\s*([^=]+)(?:=|$)/);
        if (typeMatch) {
            type = typeMatch[1].trim();
        }

        // Extract initial value
        const valueMatch = line.match(/=\s*(.+)$/);
        if (valueMatch) {
            initialValue = valueMatch[1].trim().replace(/;$/, '');
        }

        return {
            type,
            declaration,
            scope,
            initialValue
        };
    }
}