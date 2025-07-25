import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as path from 'path';
import { CodeParserService } from './services/CodeParserService';
import { FileSystemService } from './services/FileSystemService';
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

describe('End-to-End Integration Tests', () => {
    let mockWorkspaceFolder: vscode.WorkspaceFolder;
    let mockDocument: vscode.TextDocument;
    let originalConsoleLog: typeof console.log;
    let originalConsoleError: typeof console.error;

    beforeEach(() => {
        vi.clearAllMocks();

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

    describe('Complete Flow: File Save to Manifest Update', () => {
        it('should create manifest on first TypeScript file save', async () => {
            // Arrange
            const testCode = `
/**
 * Test function
 */
function testFunction() {
  return 'hello';
}

class TestClass {
  /**
   * Test method
   */
  testMethod() {
    return 'world';
  }
}

const arrowFunction = () => 'arrow';
`;

            (mockDocument.getText as any).mockReturnValue(testCode);

            // Mock file system - manifest doesn't exist initially
            (vscode.workspace.fs.readFile as any).mockRejectedValue(
                new (vscode as any).FileSystemError('File not found', 'FileNotFound')
            );
            (vscode.workspace.fs.stat as any).mockRejectedValue(new Error('Directory not found'));
            (vscode.workspace.fs.createDirectory as any).mockResolvedValue(undefined);
            (vscode.workspace.fs.writeFile as any).mockResolvedValue(undefined);

            // Import the handler function (simulate the actual extension behavior)
            const { handleFileSave } = await import('./extension-handlers');

            // Act
            await handleFileSave(mockDocument);

            // Assert
            expect(vscode.workspace.fs.createDirectory).toHaveBeenCalledWith({
                fsPath: '/test/workspace/.constellation',
                scheme: 'file',
            });

            expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
                { fsPath: '/test/workspace/.constellation/manifest.json', scheme: 'file' },
                expect.any(Buffer)
            );

            // Verify the manifest content
            const writeCall = (vscode.workspace.fs.writeFile as any).mock.calls[0];
            const manifestContent = Buffer.from(writeCall[1]).toString('utf8');
            const manifest = JSON.parse(manifestContent);

            expect(manifest).toHaveProperty('src/test.ts');
            expect(manifest['src/test.ts']).toHaveLength(4); // function, class, method, arrow function

            const symbols = manifest['src/test.ts'];
            const functionSymbol = symbols.find((s: CodeSymbol) => s.name === 'testFunction');
            const classSymbol = symbols.find((s: CodeSymbol) => s.name === 'TestClass');
            const methodSymbol = symbols.find((s: CodeSymbol) => s.name === 'testMethod');
            const arrowSymbol = symbols.find((s: CodeSymbol) => s.name === 'arrowFunction');

            expect(functionSymbol).toBeDefined();
            expect(functionSymbol.kind).toBe('function');
            expect(functionSymbol.docstring).toContain('Test function');

            expect(classSymbol).toBeDefined();
            expect(classSymbol.kind).toBe('class');

            expect(methodSymbol).toBeDefined();
            expect(methodSymbol.kind).toBe('method');
            expect(methodSymbol.docstring).toContain('Test method');

            expect(arrowSymbol).toBeDefined();
            expect(arrowSymbol.kind).toBe('function');
        });

        it('should update existing manifest when file is saved multiple times', async () => {
            // Arrange
            const initialCode = `
function oldFunction() {
  return 'old';
}
`;

            const updatedCode = `
function newFunction() {
  return 'new';
}

class NewClass {
  newMethod() {
    return 'method';
  }
}
`;

            // Mock existing manifest
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

            // Verify that src/test.ts symbols were updated
            expect(updatedManifest['src/test.ts']).toHaveLength(3); // newFunction, NewClass, newMethod
            expect(updatedManifest['src/test.ts'].find((s: CodeSymbol) => s.name === 'newFunction')).toBeDefined();
            expect(updatedManifest['src/test.ts'].find((s: CodeSymbol) => s.name === 'NewClass')).toBeDefined();
            expect(updatedManifest['src/test.ts'].find((s: CodeSymbol) => s.name === 'newMethod')).toBeDefined();

            // Verify that other files' symbols were preserved
            expect(updatedManifest['src/other.ts']).toEqual(existingManifest['src/other.ts']);
        });

        it('should handle parsing errors gracefully', async () => {
            // Arrange
            const invalidCode = `
function invalidFunction() {
  return 'unclosed string;
}
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

        it('should handle file system errors gracefully', async () => {
            // Arrange
            const testCode = `function test() { return 'test'; }`;
            (mockDocument.getText as any).mockReturnValue(testCode);

            // Mock file system errors
            (vscode.workspace.fs.readFile as any).mockResolvedValue(Buffer.from('{}', 'utf8'));
            (vscode.workspace.fs.stat as any).mockResolvedValue({ type: 1 });
            (vscode.workspace.fs.writeFile as any).mockRejectedValue(new Error('Permission denied'));

            const { handleFileSave } = await import('./extension-handlers');

            // Act & Assert - should not throw, but should log error
            await expect(handleFileSave(mockDocument)).resolves.not.toThrow();

            // Verify that write was attempted
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
        });

        it('should skip non-TypeScript files', async () => {
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
        });

        it('should handle files outside workspace gracefully', async () => {
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

    describe('JSON Serialization and Persistence', () => {
        it('should serialize manifest with proper formatting', async () => {
            // Arrange
            const symbols: CodeSymbol[] = [
                {
                    id: 'src/test.ts#testFunction',
                    name: 'testFunction',
                    kind: 'function',
                    filePath: 'src/test.ts',
                    position: { start: { line: 0, character: 0 }, end: { line: 5, character: 1 } },
                    docstring: '/** Test function */',
                },
            ];

            const manifest: Manifest = {
                'src/test.ts': symbols,
            };

            // Act
            const serialized = JSON.stringify(manifest, null, 2);
            const parsed = JSON.parse(serialized);

            // Assert
            expect(parsed).toEqual(manifest);
            expect(serialized).toContain('"testFunction"');
            expect(serialized).toContain('"function"');
            expect(serialized).toContain('"/** Test function */"');
        });

        it('should handle special characters in docstrings', async () => {
            // Arrange
            const symbols: CodeSymbol[] = [
                {
                    id: 'src/test.ts#testFunction',
                    name: 'testFunction',
                    kind: 'function',
                    filePath: 'src/test.ts',
                    position: { start: { line: 0, character: 0 }, end: { line: 5, character: 1 } },
                    docstring: '/** Test with "quotes" and \\backslashes */',
                },
            ];

            const manifest: Manifest = {
                'src/test.ts': symbols,
            };

            // Act
            const serialized = JSON.stringify(manifest, null, 2);
            const parsed = JSON.parse(serialized);

            // Assert
            expect(parsed).toEqual(manifest);
            expect(parsed['src/test.ts'][0].docstring).toBe('/** Test with "quotes" and \\backslashes */');
        });
    });
});