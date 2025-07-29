import { CodeParserService } from './src/services/CodeParserService';

// Test source text extraction
const parser = new CodeParserService();

const testCode = `
/**
 * A test function
 * @param name - The name parameter
 * @returns A greeting string
 */
function greet(name: string): string {
    return \`Hello, \${name}!\`;
}

/**
 * A test class
 */
class TestClass {
    /**
     * A test method
     */
    public testMethod(): void {
        console.log('test');
    }
}
`;

const symbols = parser.parseCode(testCode, 'test.ts', '.ts');

console.log('Extracted symbols:');
symbols.forEach(symbol => {
    console.log(`\nSymbol: ${symbol.name} (${symbol.type})`);
    console.log(`Documentation: ${symbol.documentation || 'None'}`);
    console.log(`Source text: ${symbol.sourceText || 'None'}`);
    console.log('---');
});