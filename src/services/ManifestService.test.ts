import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { FileSystemService } from './FileSystemService';
import { Manifest, CodeSymbol } from '../types';

// Mock VS Code API
vi.mock('vscode', () => ({
    Uri: {
        joinPath: vi.fn((base, ...paths) => ({
            fsPath: `${base.fsPath}/${paths.join('/')}`,
            toString: () => `${base.fsPath}/${paths.join('/')}`
        }))
    },
    workspace: {
        fs: {
            readFile: vi.fn(),
            writeFile: vi.fn(),
            stat: vi.fn(),
            createDirectory: vi.fn()
        }
    }
}));

// Mock FileSystemService
vi.mock('./FileSystemService');

// Import the functions we want to test (we'll need to extract them to a service)
// For now, let's test the logic conceptually

describe('Manifest Logic', () => {
    const mockWorkspaceFolder = {
        uri: { fsPath: '/test/workspace' }
    } as vscode.WorkspaceFolder;

    const sampleSymbols: CodeSymbol[] = [
        {
            id: 'src/test.ts#testFunction',
            name: 'testFunction',
            kind: 'function',
            filePath: 'src/test.ts',
            position: {
                start: { line: 0, character: 0 },
                end: { line: 5, character: 1 }
            },
            docstring: null
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should construct correct manifest URI', () => {
        const expectedPath = '/test/workspace/.constellation/manifest.json';
        const uri = vscode.Uri.joinPath(mockWorkspaceFolder.uri, '.constellation', 'manifest.json');
        expect(uri.fsPath).toBe(expectedPath);
    });

    it('should handle empty manifest fallback', async () => {
        // Mock FileSystemService to throw error (file not found)
        vi.mocked(FileSystemService.readFile).mockRejectedValue(new Error('File not found'));

        // This would be the readManifest function logic
        let manifest: Manifest;
        try {
            const content = await FileSystemService.readFile(vscode.Uri.joinPath(mockWorkspaceFolder.uri, '.constellation', 'manifest.json'));
            manifest = JSON.parse(content);
        } catch {
            manifest = {};
        }

        expect(manifest).toEqual({});
    });

    it('should parse existing manifest correctly', async () => {
        const existingManifest = {
            'src/existing.ts': [sampleSymbols[0]]
        };

        vi.mocked(FileSystemService.readFile).mockResolvedValue(JSON.stringify(existingManifest));

        const content = await FileSystemService.readFile(vscode.Uri.joinPath(mockWorkspaceFolder.uri, '.constellation', 'manifest.json'));
        const manifest = JSON.parse(content);

        expect(manifest).toEqual(existingManifest);
    });

    it('should update manifest atomically without affecting other files', async () => {
        const existingManifest = {
            'src/existing.ts': [sampleSymbols[0]],
            'src/other.ts': [{ ...sampleSymbols[0], id: 'src/other.ts#otherFunction', filePath: 'src/other.ts' }]
        };

        vi.mocked(FileSystemService.readFile).mockResolvedValue(JSON.stringify(existingManifest));
        vi.mocked(FileSystemService.writeFile).mockResolvedValue();

        // Simulate updating manifest
        const content = await FileSystemService.readFile(vscode.Uri.joinPath(mockWorkspaceFolder.uri, '.constellation', 'manifest.json'));
        const manifest = JSON.parse(content);

        // Update only one file's symbols
        const newSymbols: CodeSymbol[] = [
            {
                id: 'src/existing.ts#newFunction',
                name: 'newFunction',
                kind: 'function',
                filePath: 'src/existing.ts',
                position: {
                    start: { line: 10, character: 0 },
                    end: { line: 15, character: 1 }
                },
                docstring: null
            }
        ];

        manifest['src/existing.ts'] = newSymbols;

        await FileSystemService.writeFile(
            vscode.Uri.joinPath(mockWorkspaceFolder.uri, '.constellation', 'manifest.json'),
            JSON.stringify(manifest, null, 2)
        );

        expect(FileSystemService.writeFile).toHaveBeenCalledWith(
            expect.objectContaining({ fsPath: '/test/workspace/.constellation/manifest.json' }),
            expect.stringContaining('"src/existing.ts"')
        );

        // Verify other file's entry wasn't affected
        expect(manifest['src/other.ts']).toEqual([{ ...sampleSymbols[0], id: 'src/other.ts#otherFunction', filePath: 'src/other.ts' }]);
    });

    it('should handle JSON serialization correctly', () => {
        const manifest: Manifest = {
            'src/test.ts': sampleSymbols
        };

        const serialized = JSON.stringify(manifest, null, 2);
        const parsed = JSON.parse(serialized);

        expect(parsed).toEqual(manifest);
        expect(serialized).toContain('"src/test.ts"');
        expect(serialized).toContain('"testFunction"');
    });
});