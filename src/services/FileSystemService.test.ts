import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { FileSystemService } from './FileSystemService';

// Mock vscode module
vi.mock('vscode', () => ({
  workspace: {
    fs: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      stat: vi.fn(),
      createDirectory: vi.fn(),
    },
  },
  Uri: {
    file: vi.fn((path: string) => ({ fsPath: path })),
  },
}));

describe('FileSystemService', () => {
  const mockUri = { fsPath: '/test/path/file.txt' } as vscode.Uri;
  const mockDirUri = { fsPath: '/test/path' } as vscode.Uri;

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mock for Uri.file
    vi.mocked(vscode.Uri.file).mockReturnValue(mockDirUri);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('readFile', () => {
    it('should successfully read file content', async () => {
      const testContent = 'test file content';
      const mockBuffer = Buffer.from(testContent, 'utf8');
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(mockBuffer);

      const result = await FileSystemService.readFile(mockUri);

      expect(result).toBe(testContent);
      expect(vscode.workspace.fs.readFile).toHaveBeenCalledWith(mockUri);
    });

    it('should handle file read errors gracefully', async () => {
      const errorMessage = 'File not found';
      vi.mocked(vscode.workspace.fs.readFile).mockRejectedValue(new Error(errorMessage));

      await expect(FileSystemService.readFile(mockUri)).rejects.toThrow(
        `Failed to read file ${mockUri.fsPath}: ${errorMessage}`
      );
    });

    it('should handle unknown errors gracefully', async () => {
      vi.mocked(vscode.workspace.fs.readFile).mockRejectedValue('Unknown error');

      await expect(FileSystemService.readFile(mockUri)).rejects.toThrow(
        `Failed to read file ${mockUri.fsPath}: Unknown error`
      );
    });
  });

  describe('writeFile', () => {
    it('should successfully write file content', async () => {
      const testContent = 'test content to write';
      
      // Mock directory exists
      vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({} as any);
      vi.mocked(vscode.workspace.fs.writeFile).mockResolvedValue();

      await FileSystemService.writeFile(mockUri, testContent);

      expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
        mockUri,
        Buffer.from(testContent, 'utf8')
      );
    });

    it('should create directory before writing if it does not exist', async () => {
      const testContent = 'test content';
      
      // Mock directory doesn't exist, then gets created
      vi.mocked(vscode.workspace.fs.stat).mockRejectedValue(new Error('Directory not found'));
      vi.mocked(vscode.workspace.fs.createDirectory).mockResolvedValue();
      vi.mocked(vscode.workspace.fs.writeFile).mockResolvedValue();

      await FileSystemService.writeFile(mockUri, testContent);

      expect(vscode.workspace.fs.createDirectory).toHaveBeenCalledWith(mockDirUri);
      expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
        mockUri,
        Buffer.from(testContent, 'utf8')
      );
    });

    it('should handle write errors gracefully', async () => {
      const testContent = 'test content';
      const errorMessage = 'Permission denied';
      
      // Mock directory exists
      vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({} as any);
      vi.mocked(vscode.workspace.fs.writeFile).mockRejectedValue(new Error(errorMessage));

      await expect(FileSystemService.writeFile(mockUri, testContent)).rejects.toThrow(
        `Failed to write file ${mockUri.fsPath}: ${errorMessage}`
      );
    });

    it('should handle directory creation errors gracefully', async () => {
      const testContent = 'test content';
      const errorMessage = 'Cannot create directory';
      
      // Mock directory doesn't exist and creation fails
      vi.mocked(vscode.workspace.fs.stat).mockRejectedValue(new Error('Directory not found'));
      vi.mocked(vscode.workspace.fs.createDirectory).mockRejectedValue(new Error(errorMessage));

      await expect(FileSystemService.writeFile(mockUri, testContent)).rejects.toThrow(
        `Failed to write file ${mockUri.fsPath}: Failed to ensure directory exists /test/path: ${errorMessage}`
      );
    });
  });

  describe('ensureDirectoryExists', () => {
    it('should not create directory if it already exists', async () => {
      vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({} as any);

      await FileSystemService.ensureDirectoryExists(mockUri);

      expect(vscode.workspace.fs.stat).toHaveBeenCalledWith(mockDirUri);
      expect(vscode.workspace.fs.createDirectory).not.toHaveBeenCalled();
    });

    it('should create directory if it does not exist', async () => {
      vi.mocked(vscode.workspace.fs.stat).mockRejectedValue(new Error('Directory not found'));
      vi.mocked(vscode.workspace.fs.createDirectory).mockResolvedValue();

      await FileSystemService.ensureDirectoryExists(mockUri);

      expect(vscode.workspace.fs.stat).toHaveBeenCalledWith(mockDirUri);
      expect(vscode.workspace.fs.createDirectory).toHaveBeenCalledWith(mockDirUri);
    });

    it('should handle directory creation errors gracefully', async () => {
      const errorMessage = 'Permission denied';
      vi.mocked(vscode.workspace.fs.stat).mockRejectedValue(new Error('Directory not found'));
      vi.mocked(vscode.workspace.fs.createDirectory).mockRejectedValue(new Error(errorMessage));

      await expect(FileSystemService.ensureDirectoryExists(mockUri)).rejects.toThrow(
        `Failed to ensure directory exists /test/path: ${errorMessage}`
      );
    });

    it('should handle unknown errors gracefully', async () => {
      vi.mocked(vscode.workspace.fs.stat).mockRejectedValue(new Error('Directory not found'));
      vi.mocked(vscode.workspace.fs.createDirectory).mockRejectedValue('Unknown error');

      await expect(FileSystemService.ensureDirectoryExists(mockUri)).rejects.toThrow(
        `Failed to ensure directory exists /test/path: Unknown error`
      );
    });
  });
});