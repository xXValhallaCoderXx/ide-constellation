import * as path from 'path';

/**
 * Normalize a workspace-relative file identifier into an absolute path and determine if it remains within the workspace.
 * FR3 / FR13: Security guard preventing path traversal attempts from escaping the workspace root.
 */
export function resolveWorkspacePath(workspaceRoot: string, fileId: string): { abs: string; within: boolean } {
    const normalized = fileId.replace(/\\/g, '/');
    const abs = path.resolve(workspaceRoot, normalized);
    const rootWithSep = workspaceRoot.endsWith(path.sep) ? workspaceRoot : workspaceRoot + path.sep;
    const within = abs.startsWith(rootWithSep);
    return { abs, within };
}

export function isPathWithinWorkspace(workspaceRoot: string, fileId: string): boolean {
    return resolveWorkspacePath(workspaceRoot, fileId).within;
}
