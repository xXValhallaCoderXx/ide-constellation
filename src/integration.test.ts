import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as path from 'path';
import { Manifest, CodeSymbol } from './types';

// Mock VS Code API
vi.mock('vscode', () => ({
    workspace: {
        fs: {
            readFile: vi.fn(),
            writeFile: vi.fn(),
            stat: vi.fn(),
            createDirectory: vi.fn(),
        },
        getWorkspaceFolder: vi.fn(),
        onDidSaveTextDocument: vi.fn(),
    },
    Uri: {
        joinPath: vi.fn(),
        file: vi.fn(),
    },
    FileSystemError: class extends Error {
        code: string;
        constructor(message: string, code: string = 'Unknown') {
            super(message);
            this.code = code;
        }
    },
}));

describe('Comprehensive Integration Tests', () => {
    let mockWorkspaceFolder: vscode.WorkspaceFolder;
    let mockDocument: vscode.TextDocument;
    let originalConsoleLog: typeof console.log;
    let originalConsoleError: typeof console.error;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Clear file modification cache for clean test state
        const { clearFileModificationCache } = await import('./extension-handlers');
        clearFileModificationCache();

        // Mock console methods to reduce test noise
        originalConsoleLog = console.log;
        originalConsoleError = console.error;
        console.log = vi.fn();
        console.error = vi.fn();

        // Setup mock workspace folder
        mockWorkspaceFolder = {
            uri: { fsPath: '/test/workspace', scheme: 'file' } as vscode.Uri,
            name: 'test-workspace',
            index: 0,
        };

        // Setup mock document
        mockDocument = {
            uri: { fsPath: '/test/workspace/src/test.ts', scheme: 'file' } as vscode.Uri,
            fileName: '/test/workspace/src/test.ts',
            getText: vi.fn(),
            version: 1, // Add version for file change detection
        } as any;

        // Mock vscode.Uri.joinPath
        (vscode.Uri.joinPath as any).mockImplementation((base: vscode.Uri, ...segments: string[]) => ({
            fsPath: path.join(base.fsPath, ...segments),
            scheme: 'file',
        }));

        // Mock vscode.Uri.file
        (vscode.Uri.file as any).mockImplementation((fsPath: string) => ({
            fsPath,
            scheme: 'file',
        }));

        // Mock workspace.getWorkspaceFolder
        (vscode.workspace.getWorkspaceFolder as any).mockReturnValue(mockWorkspaceFolder);
    });

    afterEach(() => {
        // Restore console methods
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        vi.restoreAllMocks();
    });

    describe('Manifest Creation on First TypeScript File Save (Requirement 1.1, 1.2)', () => {
        it('should create manifest.json on first TypeScript file save', async () => {
            // Arrange
            const testCode = `
/**
 * Test function with documentation
 */
function testFunction() {
  return 'hello';
}

/**
 * Test class with documentation
 */
class TestClass {
  /**
   * Test method with documentation
   */
  testMethod() {
    return 'world';
  }
}

/**
 * Arrow function variable
 */
const arrowFunction = () => 'arrow';

/**
 * Regular variable
 */
const regularVariable = 'value';
`;

            (mockDocument.getText as any).mockReturnValue(testCode);

            // Mock file system - manifest doesn't exist initially
            (vscode.workspace.fs.readFile as any).mockRejectedValue(
                new (vscode as any).FileSystemError('File not found', 'FileNotFound')
            );
            (vscode.workspace.fs.stat as any).mockRejectedValue(new Error('Directory not found'));
            (vscode.workspace.fs.createDirectory as any).mockResolvedValue(undefined);
            (vscode.workspace.fs.writeFile as any).mockResolvedValue(undefined);

            // Import the handler function
            const { handleFileSave } = await import('./extension-handlers');

            // Act
            await handleFileSave(mockDocument);

            // Assert - Directory creation
            expect(vscode.workspace.fs.createDirectory).toHaveBeenCalledWith({
                fsPath: '/test/workspace/.constellation',
                scheme: 'file',
            });

            // Assert - Manifest file creation
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
                { fsPath: '/test/workspace/.constellation/manifest.json', scheme: 'file' },
                expect.any(Buffer)
            );

            // Verify the manifest content structure
            const writeCall = (vscode.workspace.fs.writeFile as any).mock.calls[0];
            const manifestContent = Buffer.from(writeCall[1]).toString('utf8');
            const manifest = JSON.parse(manifestContent);

            expect(manifest).toHaveProperty('src/test.ts');
            expect(manifest['src/test.ts']).toHaveLength(5); // function, class, method, arrow function, regular variable

            const symbols = manifest['src/test.ts'];
            const functionSymbol = symbols.find((s: CodeSymbol) => s.name === 'testFunction');
            const classSymbol = symbols.find((s: CodeSymbol) => s.name === 'TestClass');
            const methodSymbol = symbols.find((s: CodeSymbol) => s.name === 'testMethod');
            const arrowSymbol = symbols.find((s: CodeSymbol) => s.name === 'arrowFunction');

            // Verify function symbol
            expect(functionSymbol).toBeDefined();
            expect(functionSymbol.kind).toBe('function');
            expect(functionSymbol.id).toBe('src/test.ts#testFunction');
            expect(functionSymbol.docstring).toContain('Test function with documentation');
            expect(functionSymbol.position.start.line).toBeGreaterThanOrEqual(0);

            // Verify class symbol
            expect(classSymbol).toBeDefined();
            expect(classSymbol.kind).toBe('class');
            expect(classSymbol.id).toBe('src/test.ts#TestClass');
            expect(classSymbol.docstring).toContain('Test class with documentation');

            // Verify method symbol
            expect(methodSymbol).toBeDefined();
            expect(methodSymbol.kind).toBe('method');
            expect(methodSymbol.id).toBe('src/test.ts#TestClass.testMethod');
            expect(methodSymbol.docstring).toContain('Test method with documentation');

            // Verify arrow function symbol
            expect(arrowSymbol).toBeDefined();
            expect(arrowSymbol.kind).toBe('function');
            expect(arrowSymbol.id).toBe('src/test.ts#arrowFunction');

            // Verify regular variable symbol
            const variableSymbol = symbols.find((s: CodeSymbol) => s.name === 'regularVariable');
            expect(variableSymbol).toBeDefined();
            expect(variableSymbol.kind).toBe('variable');
            expect(variableSymbol.id).toBe('src/test.ts#regularVariable');
        });

        it('should create empty manifest when directory creation fails gracefully', async () => {
            // Arrange
            const testCode = `function test() { return 'test'; }`;
            (mockDocument.getText as any).mockReturnValue(testCode);

            // Mock file system - directory creation fails
            (vscode.workspace.fs.readFile as any).mockRejectedValue(
                new (vscode as any).FileSystemError('File not found', 'FileNotFound')
            );
            (vscode.workspace.fs.stat as any).mockRejectedValue(new Error('Directory not found'));
            (vscode.workspace.fs.createDirectory as any).mockRejectedValue(new Error('Permission denied'));
            (vscode.workspace.fs.writeFile as any).mockRejectedValue(new Error('Cannot write'));

            const { handleFileSave } = await import('./extension-handlers');

            // Act & Assert - should not throw
            await expect(handleFileSave(mockDocument)).resolves.not.toThrow();

            // Verify that directory creation was attempted
            expect(vscode.workspace.fs.createDirectory).toHaveBeenCalled();
        });
    });

    describe('Manifest Updates on Multiple File Saves (Requirement 1.4)', () => {
        it('should update existing manifest when file is saved multiple times', async () => {
            // Arrange
            const updatedCode = `
/**
 * Updated function
 */
function newFunction() {
  return 'new';
}

/**
 * New class added
 */
class NewClass {
  /**
   * New method
   */
  newMethod() {
    return 'method';
  }
}

const newVariable = 'updated';
`;

            // Mock existing manifest with other files
            const existingManifest: Manifest = {
                'src/test.ts': [
                    {
                        id: 'src/test.ts#oldFunction',
                        name: 'oldFunction',
                        kind: 'function',
                        filePath: 'src/test.ts',
                        position: { start: { line: 1, character: 0 }, end: { line: 3, character: 1 } },
                        docstring: null,
                    },
                ],
                'src/other.ts': [
                    {
                        id: 'src/other.ts#otherFunction',
                        name: 'otherFunction',
                        kind: 'function',
                        filePath: 'src/other.ts',
                        position: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
                        docstring: null,
                    },
                ],
            };

            (mockDocument.getText as any).mockReturnValue(updatedCode);

            // Mock file system - manifest exists
            (vscode.workspace.fs.readFile as any).mockResolvedValue(
                Buffer.from(JSON.stringify(existingManifest), 'utf8')
            );
            (vscode.workspace.fs.stat as any).mockResolvedValue({ type: 1 }); // Directory exists
            (vscode.workspace.fs.writeFile as any).mockResolvedValue(undefined);

            const { handleFileSave } = await import('./extension-handlers');

            // Act
            await handleFileSave(mockDocument);

            // Assert
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();

            const writeCall = (vscode.workspace.fs.writeFile as any).mock.calls[0];
            const manifestContent = Buffer.from(writeCall[1]).toString('utf8');
            const updatedManifest = JSON.parse(manifestContent);

            // Verify that src/test.ts symbols were updated (replaced old symbols)
            expect(updatedManifest['src/test.ts']).toHaveLength(4); // newFunction, NewClass, newMethod, newVariable
            expect(updatedManifest['src/test.ts'].find((s: CodeSymbol) => s.name === 'newFunction')).toBeDefined();
            expect(updatedManifest['src/test.ts'].find((s: CodeSymbol) => s.name === 'NewClass')).toBeDefined();
            expect(updatedManifest['src/test.ts'].find((s: CodeSymbol) => s.name === 'newMethod')).toBeDefined();
            expect(updatedManifest['src/test.ts'].find((s: CodeSymbol) => s.name === 'newVariable')).toBeDefined();

            // Verify that old symbols are gone
            expect(updatedManifest['src/test.ts'].find((s: CodeSymbol) => s.name === 'oldFunction')).toBeUndefined();

            // Verify that other files' symbols were preserved (atomic updates)
            expect(updatedManifest['src/other.ts']).toEqual(existingManifest['src/other.ts']);
        });

        it('should handle multiple saves of the same file efficiently', async () => {
            // Arrange
            const testCode = `function sameFunction() { return 'same'; }`;
            (mockDocument.getText as any).mockReturnValue(testCode);

            // Mock existing manifest
            const existingManifest: Manifest = {};
            (vscode.workspace.fs.readFile as any).mockResolvedValue(
                Buffer.from(JSON.stringify(existingManifest), 'utf8')
            );
            (vscode.workspace.fs.stat as any).mockResolvedValue({ type: 1 });
            (vscode.workspace.fs.writeFile as any).mockResolvedValue(undefined);

            const { handleFileSave } = await import('./extension-handlers');

            // Act - Save the same file multiple times
            await handleFileSave(mockDocument);
            await handleFileSave(mockDocument);
            await handleFileSave(mockDocument);

            // Assert - Should only process the first save (due to file change detection)
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalledTimes(1);
        });
    });

    describe('Non-Target File Filtering (Requirement 3.1)', () => {
        it('should skip non-TypeScript files (.js)', async () => {
            // Arrange
            const jsDocument = {
                ...mockDocument,
                fileName: '/test/workspace/src/test.js',
                uri: { fsPath: '/test/workspace/src/test.js', scheme: 'file' } as vscode.Uri,
            };

            const { handleFileSave } = await import('./extension-handlers');

            // Act
            await handleFileSave(jsDocument as vscode.TextDocument);

            // Assert - no file system operations should occur
            expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
            expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
            expect(vscode.workspace.fs.createDirectory).not.toHaveBeenCalled();
        });

        it('should skip non-TypeScript files (.json)', async () => {
            // Arrange
            const jsonDocument = {
                ...mockDocument,
                fileName: '/test/workspace/package.json',
                uri: { fsPath: '/test/workspace/package.json', scheme: 'file' } as vscode.Uri,
            };

            const { handleFileSave } = await import('./extension-handlers');

            // Act
            await handleFileSave(jsonDocument as vscode.TextDocument);

            // Assert - no file system operations should occur
            expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
            expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
        });

        it('should process .tsx files', async () => {
            // Arrange
            const tsxDocument = {
                ...mockDocument,
                fileName: '/test/workspace/src/component.tsx',
                uri: { fsPath: '/test/workspace/src/component.tsx', scheme: 'file' } as vscode.Uri,
            };

            const testCode = `
function Component() {
  return <div>Hello</div>;
}
`;

            (tsxDocument.getText as any) = vi.fn().mockReturnValue(testCode);

            // Mock file system
            (vscode.workspace.fs.readFile as any).mockRejectedValue(
                new (vscode as any).FileSystemError('File not found', 'FileNotFound')
            );
            (vscode.workspace.fs.stat as any).mockRejectedValue(new Error('Directory not found'));
            (vscode.workspace.fs.createDirectory as any).mockResolvedValue(undefined);
            (vscode.workspace.fs.writeFile as any).mockResolvedValue(undefined);

            const { handleFileSave } = await import('./extension-handlers');

            // Act
            await handleFileSave(tsxDocument as vscode.TextDocument);

            // Assert - should process .tsx files
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();

            const writeCall = (vscode.workspace.fs.writeFile as any).mock.calls[0];
            const manifestContent = Buffer.from(writeCall[1]).toString('utf8');
            const manifest = JSON.parse(manifestContent);

            expect(manifest).toHaveProperty('src/component.tsx');
            expect(manifest['src/component.tsx']).toHaveLength(1);
            expect(manifest['src/component.tsx'][0].name).toBe('Component');
        });

        it('should skip files in excluded directories (node_modules)', async () => {
            // Arrange
            const nodeModulesDocument = {
                ...mockDocument,
                fileName: '/test/workspace/node_modules/package/index.ts',
                uri: { fsPath: '/test/workspace/node_modules/package/index.ts', scheme: 'file' } as vscode.Uri,
            };

            const { handleFileSave } = await import('./extension-handlers');

            // Act
            await handleFileSave(nodeModulesDocument as vscode.TextDocument);

            // Assert - no file system operations should occur
            expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
            expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
        });

        it('should skip files outside workspace', async () => {
            // Arrange
            (vscode.workspace.getWorkspaceFolder as any).mockReturnValue(null);

            const { handleFileSave } = await import('./extension-handlers');

            // Act
            await handleFileSave(mockDocument);

            // Assert - no file system operations should occur
            expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
            expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
        });
    });

    describe('Error Recovery and Graceful Degradation (Requirements 5.1, 5.2, 5.3)', () => {
        it('should handle parsing errors gracefully', async () => {
            // Arrange
            const invalidCode = `
function invalidFunction() {
  return 'unclosed string;
  // Missing closing quote and brace
`;

            (mockDocument.getText as any).mockReturnValue(invalidCode);

            // Mock file system
            (vscode.workspace.fs.readFile as any).mockResolvedValue(Buffer.from('{}', 'utf8'));
            (vscode.workspace.fs.stat as any).mockResolvedValue({ type: 1 });
            (vscode.workspace.fs.writeFile as any).mockResolvedValue(undefined);

            const { handleFileSave } = await import('./extension-handlers');

            // Act & Assert - should not throw
            await expect(handleFileSave(mockDocument)).resolves.not.toThrow();

            // Verify that manifest is still updated (with empty symbols array due to parsing failure)
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();

            const writeCall = (vscode.workspace.fs.writeFile as any).mock.calls[0];
            const manifestContent = Buffer.from(writeCall[1]).toString('utf8');
            const manifest = JSON.parse(manifestContent);

            expect(manifest['src/test.ts']).toEqual([]); // Empty due to parsing error
        });

        it('should handle file system read errors gracefully', async () => {
            // Arrange
            const testCode = `function test() { return 'test'; }`;
            (mockDocument.getText as any).mockReturnValue(testCode);

            // Mock file system read error
            (vscode.workspace.fs.readFile as any).mockRejectedValue(new Error('Disk error'));
            (vscode.workspace.fs.stat as any).mockResolvedValue({ type: 1 });
            (vscode.workspace.fs.writeFile as any).mockResolvedValue(undefined);

            const { handleFileSave } = await import('./extension-handlers');

            // Act & Assert - should not throw, should start with empty manifest
            await expect(handleFileSave(mockDocument)).resolves.not.toThrow();

            // Verify that write was still attempted with empty manifest
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
        });

        it('should handle file system write errors gracefully', async () => {
            // Arrange
            const testCode = `function test() { return 'test'; }`;
            (mockDocument.getText as any).mockReturnValue(testCode);

            // Mock file system write error
            (vscode.workspace.fs.readFile as any).mockResolvedValue(Buffer.from('{}', 'utf8'));
            (vscode.workspace.fs.stat as any).mockResolvedValue({ type: 1 });
            (vscode.workspace.fs.writeFile as any).mockRejectedValue(new Error('Permission denied'));

            const { handleFileSave } = await import('./extension-handlers');

            // Act & Assert - should not throw, but should log error
            await expect(handleFileSave(mockDocument)).resolves.not.toThrow();

            // Verify that write was attempted
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
        });

        it('should handle directory creation errors gracefully', async () => {
            // Arrange
            const testCode = `function test() { return 'test'; }`;
            (mockDocument.getText as any).mockReturnValue(testCode);

            // Mock directory creation error
            (vscode.workspace.fs.readFile as any).mockRejectedValue(
                new (vscode as any).FileSystemError('File not found', 'FileNotFound')
            );
            (vscode.workspace.fs.stat as any).mockRejectedValue(new Error('Directory not found'));
            (vscode.workspace.fs.createDirectory as any).mockRejectedValue(new Error('Permission denied'));
            (vscode.workspace.fs.writeFile as any).mockRejectedValue(new Error('Cannot write'));

            const { handleFileSave } = await import('./extension-handlers');

            // Act & Assert - should not throw
            await expect(handleFileSave(mockDocument)).resolves.not.toThrow();

            // Verify that directory creation was attempted
            expect(vscode.workspace.fs.createDirectory).toHaveBeenCalled();
        });

        it('should handle large files gracefully (performance optimization)', async () => {
            // Arrange - Create a very large file content
            const largeCode = 'function test() { return "test"; }\n'.repeat(50000); // Large file
            (mockDocument.getText as any).mockReturnValue(largeCode);

            // Mock file system
            (vscode.workspace.fs.readFile as any).mockResolvedValue(Buffer.from('{}', 'utf8'));
            (vscode.workspace.fs.stat as any).mockResolvedValue({ type: 1 });
            (vscode.workspace.fs.writeFile as any).mockResolvedValue(undefined);

            const { handleFileSave } = await import('./extension-handlers');

            // Act & Assert - should not throw and should skip processing
            await expect(handleFileSave(mockDocument)).resolves.not.toThrow();

            // Large files should be skipped, so no manifest update should occur
            expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
        });

        it('should handle corrupted manifest files gracefully', async () => {
            // Arrange
            const testCode = `function test() { return 'test'; }`;
            (mockDocument.getText as any).mockReturnValue(testCode);

            // Mock corrupted manifest file
            (vscode.workspace.fs.readFile as any).mockResolvedValue(
                Buffer.from('{ invalid json content', 'utf8')
            );
            (vscode.workspace.fs.stat as any).mockResolvedValue({ type: 1 });
            (vscode.workspace.fs.writeFile as any).mockResolvedValue(undefined);

            const { handleFileSave } = await import('./extension-handlers');

            // Act & Assert - should not throw, should start with empty manifest
            await expect(handleFileSave(mockDocument)).resolves.not.toThrow();

            // Verify that write was attempted with new manifest
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();

            const writeCall = (vscode.workspace.fs.writeFile as any).mock.calls[0];
            const manifestContent = Buffer.from(writeCall[1]).toString('utf8');
            const manifest = JSON.parse(manifestContent);

            expect(manifest['src/test.ts']).toHaveLength(1);
            expect(manifest['src/test.ts'][0].name).toBe('test');
        });
    });

    describe('JSON Serialization and Data Integrity', () => {
        it('should serialize manifest with proper formatting', async () => {
            // Arrange
            const testCode = `
/**
 * Test function with special characters: "quotes" and \\backslashes
 */
function testFunction() {
  return 'test';
}
`;

            (mockDocument.getText as any).mockReturnValue(testCode);

            // Mock file system
            (vscode.workspace.fs.readFile as any).mockRejectedValue(
                new (vscode as any).FileSystemError('File not found', 'FileNotFound')
            );
            (vscode.workspace.fs.stat as any).mockRejectedValue(new Error('Directory not found'));
            (vscode.workspace.fs.createDirectory as any).mockResolvedValue(undefined);
            (vscode.workspace.fs.writeFile as any).mockResolvedValue(undefined);

            const { handleFileSave } = await import('./extension-handlers');

            // Act
            await handleFileSave(mockDocument);

            // Assert
            const writeCall = (vscode.workspace.fs.writeFile as any).mock.calls[0];
            const manifestContent = Buffer.from(writeCall[1]).toString('utf8');

            // Verify it's valid JSON
            const manifest = JSON.parse(manifestContent);
            expect(manifest).toBeDefined();

            // Verify proper formatting (should be pretty-printed)
            expect(manifestContent).toContain('  '); // Should have indentation
            expect(manifestContent).toContain('\n'); // Should have newlines

            // Verify special characters are properly escaped
            const symbol = manifest['src/test.ts'][0];
            expect(symbol.docstring).toContain('"quotes"');
            expect(symbol.docstring).toContain('\\backslashes');
        });

        it('should maintain data integrity across multiple operations', async () => {
            // Arrange
            const testCode1 = `function func1() { return 1; }`;
            const testCode2 = `function func2() { return 2; }`;

            // Mock different documents
            const doc1 = {
                ...mockDocument,
                fileName: '/test/workspace/src/file1.ts',
                uri: { fsPath: '/test/workspace/src/file1.ts', scheme: 'file' } as vscode.Uri,
                getText: vi.fn().mockReturnValue(testCode1),
                version: 1,
            };

            const doc2 = {
                ...mockDocument,
                fileName: '/test/workspace/src/file2.ts',
                uri: { fsPath: '/test/workspace/src/file2.ts', scheme: 'file' } as vscode.Uri,
                getText: vi.fn().mockReturnValue(testCode2),
                version: 1,
            };

            // Mock file system
            let manifestState: Manifest = {};
            (vscode.workspace.fs.readFile as any).mockImplementation(() => {
                return Promise.resolve(Buffer.from(JSON.stringify(manifestState), 'utf8'));
            });
            (vscode.workspace.fs.writeFile as any).mockImplementation((uri: vscode.Uri, content: Buffer) => {
                manifestState = JSON.parse(content.toString('utf8'));
                return Promise.resolve();
            });
            (vscode.workspace.fs.stat as any).mockResolvedValue({ type: 1 });

            const { handleFileSave } = await import('./extension-handlers');

            // Act - Process multiple files
            await handleFileSave(doc1 as vscode.TextDocument);
            await handleFileSave(doc2 as vscode.TextDocument);

            // Assert - Both files should be in manifest
            expect(manifestState).toHaveProperty('src/file1.ts');
            expect(manifestState).toHaveProperty('src/file2.ts');
            expect(manifestState['src/file1.ts']).toHaveLength(1);
            expect(manifestState['src/file2.ts']).toHaveLength(1);
            expect(manifestState['src/file1.ts'][0].name).toBe('func1');
            expect(manifestState['src/file2.ts'][0].name).toBe('func2');
        });
    });

    describe('Performance and Edge Cases', () => {
        it('should handle empty files gracefully', async () => {
            // Arrange
            const emptyCode = '';
            (mockDocument.getText as any).mockReturnValue(emptyCode);

            // Mock file system
            (vscode.workspace.fs.readFile as any).mockResolvedValue(Buffer.from('{}', 'utf8'));
            (vscode.workspace.fs.stat as any).mockResolvedValue({ type: 1 });
            (vscode.workspace.fs.writeFile as any).mockResolvedValue(undefined);

            const { handleFileSave } = await import('./extension-handlers');

            // Act
            await handleFileSave(mockDocument);

            // Assert
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();

            const writeCall = (vscode.workspace.fs.writeFile as any).mock.calls[0];
            const manifestContent = Buffer.from(writeCall[1]).toString('utf8');
            const manifest = JSON.parse(manifestContent);

            expect(manifest['src/test.ts']).toEqual([]); // Empty array for empty file
        });

        it('should handle files with only comments', async () => {
            // Arrange
            const commentOnlyCode = `
// This is just a comment file
/* 
 * Block comment
 */
/**
 * JSDoc comment
 */
`;
            (mockDocument.getText as any).mockReturnValue(commentOnlyCode);

            // Mock file system
            (vscode.workspace.fs.readFile as any).mockResolvedValue(Buffer.from('{}', 'utf8'));
            (vscode.workspace.fs.stat as any).mockResolvedValue({ type: 1 });
            (vscode.workspace.fs.writeFile as any).mockResolvedValue(undefined);

            const { handleFileSave } = await import('./extension-handlers');

            // Act
            await handleFileSave(mockDocument);

            // Assert
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();

            const writeCall = (vscode.workspace.fs.writeFile as any).mock.calls[0];
            const manifestContent = Buffer.from(writeCall[1]).toString('utf8');
            const manifest = JSON.parse(manifestContent);

            expect(manifest['src/test.ts']).toEqual([]); // No symbols in comment-only file
        });

        it('should handle complex TypeScript constructs', async () => {
            // Arrange
            const complexCode = `
interface TestInterface {
  prop: string;
}

type TestType = string | number;

enum TestEnum {
  VALUE1,
  VALUE2
}

namespace TestNamespace {
  export function namespacedFunction() {
    return 'namespaced';
  }
}

abstract class AbstractClass {
  abstract abstractMethod(): void;
  
  concreteMethod() {
    return 'concrete';
  }
}

class GenericClass<T> {
  private value: T;
  
  constructor(value: T) {
    this.value = value;
  }
  
  getValue(): T {
    return this.value;
  }
}

const asyncFunction = async () => {
  return Promise.resolve('async');
};

function* generatorFunction() {
  yield 1;
  yield 2;
}
`;

            (mockDocument.getText as any).mockReturnValue(complexCode);

            // Mock file system
            (vscode.workspace.fs.readFile as any).mockResolvedValue(Buffer.from('{}', 'utf8'));
            (vscode.workspace.fs.stat as any).mockResolvedValue({ type: 1 });
            (vscode.workspace.fs.writeFile as any).mockResolvedValue(undefined);

            const { handleFileSave } = await import('./extension-handlers');

            // Act
            await handleFileSave(mockDocument);

            // Assert
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();

            const writeCall = (vscode.workspace.fs.writeFile as any).mock.calls[0];
            const manifestContent = Buffer.from(writeCall[1]).toString('utf8');
            const manifest = JSON.parse(manifestContent);

            const symbols = manifest['src/test.ts'];
            expect(symbols.length).toBeGreaterThan(0);

            // Should capture classes and functions, but not interfaces, types, enums
            const classSymbols = symbols.filter((s: CodeSymbol) => s.kind === 'class');
            const functionSymbols = symbols.filter((s: CodeSymbol) => s.kind === 'function');
            const methodSymbols = symbols.filter((s: CodeSymbol) => s.kind === 'method');

            expect(classSymbols.length).toBeGreaterThan(0);
            expect(functionSymbols.length).toBeGreaterThan(0);
            expect(methodSymbols.length).toBeGreaterThan(0);
        });
    });
});