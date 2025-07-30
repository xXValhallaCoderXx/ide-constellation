import * as path from 'path';

/**
 * Normalizes an absolute file path to a workspace-relative path.
 * 
 * This function converts absolute file paths to consistent workspace-relative paths
 * using forward slashes as separators, regardless of the operating system.
 * The returned path will not have a leading slash and will be relative to the workspace root.
 * 
 * @param absolutePath - The absolute file path to normalize
 * @param workspaceRoot - The absolute path to the workspace root directory
 * @returns A normalized workspace-relative path with forward slashes and no leading slash
 * 
 * @example
 * ```typescript
 * // Unix/Linux/macOS example
 * normalizePath('/home/user/project/src/file.ts', '/home/user/project')
 * // Returns: 'src/file.ts'
 * 
 * // Windows example
 * normalizePath('C:\\Users\\User\\project\\src\\file.ts', 'C:\\Users\\User\\project')
 * // Returns: 'src/file.ts'
 * 
 * // Already relative path example
 * normalizePath('./src/file.ts', '/home/user/project')
 * // Returns: 'src/file.ts'
 * ```
 * 
 * @throws {Error} If either parameter is empty or invalid
 */
export function normalizePath(absolutePath: string, workspaceRoot: string): string {
    // Input validation
    if (!absolutePath || typeof absolutePath !== 'string' || absolutePath.trim() === '') {
        throw new Error('absolutePath must be a non-empty string');
    }

    if (!workspaceRoot || typeof workspaceRoot !== 'string' || workspaceRoot.trim() === '') {
        throw new Error('workspaceRoot must be a non-empty string');
    }

    // Normalize both paths to handle different separators and resolve relative components
    const normalizedAbsolute = path.resolve(absolutePath.trim());
    const normalizedWorkspaceRoot = path.resolve(workspaceRoot.trim());

    // Calculate relative path from workspace root to the file
    const relativePath = path.relative(normalizedWorkspaceRoot, normalizedAbsolute);

    // Ensure the file is within the workspace (relative path shouldn't start with '..')
    if (relativePath.startsWith('..')) {
        throw new Error(`File path "${absolutePath}" is outside the workspace root "${workspaceRoot}"`);
    }

    // Convert to forward slashes for consistency across platforms
    const normalizedRelative = relativePath.split(path.sep).join('/');

    return normalizedRelative;
}

export default normalizePath;
