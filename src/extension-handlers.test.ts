import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { handleFileSave, clearFileModificationCache } from './extension-handlers';
import { CodeParserService } from './services/CodeParserService';
import { FileSystemService } from './services/FileSystemService';

// Mock VS Code API
vi.mock('vscode', () => ({
    workspace: {
        getWorkspaceFolder: vi.fn(),
        fs: {
            readFile: vi.fn(),
            writeFile: vi.fn(),
            createDirectory: vi.fn(),
            stat: vi.fn()
        }
    },
    Uri: {
        joinPath: vi.fn(),
        file: vi.fn()
    },
    FileSystemError: class extends Error {
        code: string;
        constructor(message: string, code: string = 'Unknown') {
            super(message);
            this.code = code;
        }
    }
}));

// Mock services
vi.mock('./services/CodeParserService');
vi.mock('./services/FileSystemService');

describe('Performance Optimizations', () => {
    const mockWorkspaceFolder = {
        uri: { fsPath: '/workspace' },
        name: 'test-workspace',
        index: 0
    } as vscode.WorkspaceFolder;

    const mockDocument = {
        uri: { fsPath: '/workspace/src/test.ts' },
        fileName: '/workspace/src/test.ts',
        getText: vi.fn(),
        version: 1
    } as unknown as vscode.TextDocument;

    beforeEach(() => {
        vi.clearAllMocks();
        clearFileModificationCache();

        // Setup default mocks
        vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue(mockWorkspaceFolder);
        vi.mocked(mockDocument.getText).mockReturnValue('function test() {}');
        vi.mocked(CodeParserService.parse).mockReturnValue([]);
        vi.mocked(FileSystemService.readFile).mockResolvedValue('{}');
        vi.mocked(FileSystemService.writeFile).mockResolvedValue();
    });

    describe('File Size Limits', () => {
        it('should skip files larger than 1MB', async () => {
            // Create a large file content (over 1MB)
            const largeContent = 'a'.repeat(1024 * 1024 + 1);
            vi.mocked(mockDocument.getText).mockReturnValue(largeContent);

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

            await handleFileSave(mockDocument);

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Skipping large file')
            );
            expect(CodeParserService.parse).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should process files within size limits', async () => {
            // Small file content
            const smallContent = 'function test() {}';
            vi.mocked(mockDocument.getText).mockReturnValue(smallContent);

            await handleFileSave(mockDocument);

            expect(CodeParserService.parse).toHaveBeenCalledWith('src/test.ts', smallContent);
        });
    });

    describe('Exclusion Patterns', () => {
        it('should skip files in node_modules', async () => {
            const nodeModulesDocument = {
                ...mockDocument,
                uri: { fsPath: '/workspace/node_modules/package/index.ts' },
                fileName: '/workspace/node_modules/package/index.ts'
            } as unknown as vscode.TextDocument;

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

            await handleFileSave(nodeModulesDocument);

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Skipping excluded file')
            );
            expect(CodeParserService.parse).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should skip files in build directories', async () => {
            const buildDocument = {
                ...mockDocument,
                uri: { fsPath: '/workspace/dist/build.ts' },
                fileName: '/workspace/dist/build.ts'
            } as unknown as vscode.TextDocument;

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

            await handleFileSave(buildDocument);

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Skipping excluded file')
            );
            expect(CodeParserService.parse).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should process files not in excluded patterns', async () => {
            await handleFileSave(mockDocument);

            expect(CodeParserService.parse).toHaveBeenCalled();
        });
    });

    describe('File Change Detection', () => {
        it('should process file on first save', async () => {
            await handleFileSave(mockDocument);

            expect(CodeParserService.parse).toHaveBeenCalledWith('src/test.ts', 'function test() {}');
        });

        it('should skip unchanged files on subsequent saves', async () => {
            // First save
            await handleFileSave(mockDocument);
            expect(CodeParserService.parse).toHaveBeenCalledTimes(1);

            // Second save with same version
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            await handleFileSave(mockDocument);

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Skipping unchanged file')
            );
            expect(CodeParserService.parse).toHaveBeenCalledTimes(1); // Still only called once

            consoleSpy.mockRestore();
        });

        it('should process file when version changes', async () => {
            // First save
            await handleFileSave(mockDocument);
            expect(CodeParserService.parse).toHaveBeenCalledTimes(1);

            // Second save with different version
            const changedDocument = {
                ...mockDocument,
                version: 2
            } as unknown as vscode.TextDocument;

            await handleFileSave(changedDocument);
            expect(CodeParserService.parse).toHaveBeenCalledTimes(2);
        });
    });

    describe('Performance Monitoring', () => {
        it('should log warning for slow processing', async () => {
            // Mock slow parsing
            vi.mocked(CodeParserService.parse).mockImplementation(() => {
                // Simulate slow processing
                const start = Date.now();
                while (Date.now() - start < 150) {
                    // Busy wait for 150ms
                }
                return [];
            });

            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            await handleFileSave(mockDocument);

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('File processing took')
            );

            consoleWarnSpy.mockRestore();
        });

        it('should not log warning for fast processing', async () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            await handleFileSave(mockDocument);

            expect(consoleWarnSpy).not.toHaveBeenCalled();

            consoleWarnSpy.mockRestore();
        });
    });

    describe('Non-TypeScript Files', () => {
        it('should skip JavaScript files', async () => {
            const jsDocument = {
                ...mockDocument,
                uri: { fsPath: '/workspace/src/test.js' },
                fileName: '/workspace/src/test.js'
            } as unknown as vscode.TextDocument;

            await handleFileSave(jsDocument);

            expect(CodeParserService.parse).not.toHaveBeenCalled();
        });

        it('should process TypeScript files', async () => {
            await handleFileSave(mockDocument);

            expect(CodeParserService.parse).toHaveBeenCalled();
        });

        it('should process TSX files', async () => {
            const tsxDocument = {
                ...mockDocument,
                uri: { fsPath: '/workspace/src/component.tsx' },
                fileName: '/workspace/src/component.tsx'
            } as unknown as vscode.TextDocument;

            await handleFileSave(tsxDocument);

            expect(CodeParserService.parse).toHaveBeenCalled();
        });
    });
});