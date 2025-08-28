// Browser-compatible path utilities (no Node.js dependencies)

/**
 * Browser-compatible path utilities
 */
const pathUtils = {
  extname: (filePath: string): string => {
    const lastDot = filePath.lastIndexOf('.');
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    
    if (lastDot === -1 || lastDot < lastSlash) {
      return '';
    }
    
    return filePath.slice(lastDot);
  },
  
  resolve: (base: string, relative: string): string => {
    // Simple path resolution for browser
    if (relative.startsWith('/') || relative.includes(':\\')) {
      return relative; // Absolute path
    }
    
    // Normalize separators
    const normalizedBase = base.replace(/\\/g, '/');
    const normalizedRelative = relative.replace(/\\/g, '/');
    
    // Join paths
    const joined = normalizedBase.endsWith('/') 
      ? normalizedBase + normalizedRelative
      : normalizedBase + '/' + normalizedRelative;
    
    // Resolve . and .. segments
    const segments = joined.split('/');
    const resolved: string[] = [];
    
    for (const segment of segments) {
      if (segment === '.' || segment === '') {
        continue;
      } else if (segment === '..') {
        resolved.pop();
      } else {
        resolved.push(segment);
      }
    }
    
    return resolved.join('/');
  },
  
  sep: '/'
};

/**
 * Normalize a workspace-relative file identifier into an absolute path and determine if it remains within the workspace.
 * FR3 / FR13: Security guard preventing path traversal attempts from escaping the workspace root.
 */
export function resolveWorkspacePath(workspaceRoot: string, fileId: string): { abs: string; within: boolean } {
    const normalized = fileId.replace(/\\/g, '/');
    const abs = pathUtils.resolve(workspaceRoot, normalized);
    const rootWithSep = workspaceRoot.endsWith(pathUtils.sep) ? workspaceRoot : workspaceRoot + pathUtils.sep;
    const within = abs.startsWith(rootWithSep);
    return { abs, within };
}

export function isPathWithinWorkspace(workspaceRoot: string, fileId: string): boolean {
    return resolveWorkspacePath(workspaceRoot, fileId).within;
}

/**
 * Truncate a file path intelligently for display in tooltips and UI components.
 * Preserves the filename and parent directory while shortening middle sections.
 * 
 * @param filePath - The full file path to truncate
 * @param maxLength - Maximum desired length for the truncated path (default: 50)
 * @returns Truncated path with ellipsis indicating omitted sections
 * 
 * @example
 * truncateFilePath('/very/long/path/to/some/nested/file.ts', 30)
 * // Returns: '/very/.../nested/file.ts'
 */
export function truncateFilePath(filePath: string, maxLength: number = 50): string {
    if (filePath.length <= maxLength) {
        return filePath;
    }

    const pathSeparator = filePath.includes('/') ? '/' : '\\';
    const parts = filePath.split(pathSeparator);
    
    if (parts.length <= 2) {
        // For very short paths, just truncate the filename if needed
        const dir = parts[0] || '';
        const filename = parts[1] || parts[0];
        const maxFilenameLength = maxLength - dir.length - 1;
        
        if (filename.length > maxFilenameLength && maxFilenameLength > 3) {
            const truncatedFilename = filename.substring(0, maxFilenameLength - 3) + '...';
            return dir ? `${dir}${pathSeparator}${truncatedFilename}` : truncatedFilename;
        }
        return filePath;
    }

    const filename = parts[parts.length - 1];
    const firstDir = parts[0];
    const parentDir = parts[parts.length - 2];
    
    // Always preserve filename and immediate parent
    const preservedPart = `${parentDir}${pathSeparator}${filename}`;
    const ellipsis = '...';
    
    // Calculate remaining space for the beginning
    const remainingLength = maxLength - preservedPart.length - ellipsis.length - 1; // -1 for separator
    
    if (remainingLength <= 0) {
        // If even the preserved part is too long, just show ellipsis + preserved part
        return `${ellipsis}${pathSeparator}${preservedPart}`;
    }
    
    // Build the beginning part
    let beginningPart = firstDir;
    for (let i = 1; i < parts.length - 2; i++) {
        const nextPart = `${pathSeparator}${parts[i]}`;
        if (beginningPart.length + nextPart.length <= remainingLength) {
            beginningPart += nextPart;
        } else {
            break;
        }
    }
    
    return `${beginningPart}${pathSeparator}${ellipsis}${pathSeparator}${preservedPart}`;
}

/**
 * Format file size in bytes to human-readable format (B, KB, MB, GB).
 * 
 * @param bytes - File size in bytes
 * @param decimals - Number of decimal places to show (default: 1)
 * @returns Formatted size string with appropriate unit
 * 
 * @example
 * formatFileSize(1024) // Returns: '1.0 KB'
 * formatFileSize(1536, 0) // Returns: '2 KB'
 * formatFileSize(2097152) // Returns: '2.0 MB'
 */
export function formatFileSize(bytes: number, decimals: number = 1): string {
    if (bytes === 0) {
        return '0 B';
    }
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    const value = bytes / Math.pow(k, i);
    const formattedValue = decimals === 0 ? Math.round(value) : value.toFixed(decimals);
    
    return `${formattedValue} ${sizes[i]}`;
}

/**
 * Extract file extension information including type categorization.
 * 
 * @param filePath - The file path to analyze
 * @returns Object containing extension, type category, and display information
 * 
 * @example
 * getFileExtensionInfo('component.tsx') 
 * // Returns: { extension: 'tsx', type: 'source', displayName: 'TypeScript React' }
 */
export function getFileExtensionInfo(filePath: string): {
    extension: string;
    type: 'source' | 'config' | 'asset' | 'documentation' | 'unknown';
    displayName: string;
} {
    const extension = pathUtils.extname(filePath).toLowerCase().slice(1); // Remove the dot
    
    if (!extension) {
        return {
            extension: '',
            type: 'unknown',
            displayName: 'File'
        };
    }

    // Source code files
    const sourceExtensions: Record<string, string> = {
        'ts': 'TypeScript',
        'tsx': 'TypeScript React',
        'js': 'JavaScript',
        'jsx': 'JavaScript React',
        'py': 'Python',
        'java': 'Java',
        'cpp': 'C++',
        'c': 'C',
        'cs': 'C#',
        'php': 'PHP',
        'rb': 'Ruby',
        'go': 'Go',
        'rs': 'Rust',
        'swift': 'Swift',
        'kt': 'Kotlin',
        'scala': 'Scala',
        'vue': 'Vue',
        'svelte': 'Svelte'
    };

    // Configuration files
    const configExtensions: Record<string, string> = {
        'json': 'JSON Config',
        'yaml': 'YAML Config',
        'yml': 'YAML Config',
        'toml': 'TOML Config',
        'ini': 'INI Config',
        'conf': 'Configuration',
        'config': 'Configuration',
        'env': 'Environment',
        'lock': 'Lock File'
    };

    // Asset files
    const assetExtensions: Record<string, string> = {
        'png': 'PNG Image',
        'jpg': 'JPEG Image',
        'jpeg': 'JPEG Image',
        'gif': 'GIF Image',
        'svg': 'SVG Image',
        'webp': 'WebP Image',
        'ico': 'Icon',
        'css': 'Stylesheet',
        'scss': 'Sass Stylesheet',
        'sass': 'Sass Stylesheet',
        'less': 'Less Stylesheet',
        'html': 'HTML',
        'htm': 'HTML',
        'xml': 'XML',
        'pdf': 'PDF Document',
        'mp4': 'MP4 Video',
        'mp3': 'MP3 Audio',
        'wav': 'WAV Audio',
        'font': 'Font File',
        'woff': 'Web Font',
        'woff2': 'Web Font',
        'ttf': 'TrueType Font',
        'otf': 'OpenType Font'
    };

    // Documentation files
    const docExtensions: Record<string, string> = {
        'md': 'Markdown',
        'txt': 'Text Document',
        'rtf': 'Rich Text',
        'doc': 'Word Document',
        'docx': 'Word Document',
        'readme': 'README',
        'changelog': 'Changelog',
        'license': 'License'
    };

    if (sourceExtensions[extension]) {
        return {
            extension,
            type: 'source',
            displayName: sourceExtensions[extension]
        };
    }

    if (configExtensions[extension]) {
        return {
            extension,
            type: 'config',
            displayName: configExtensions[extension]
        };
    }

    if (assetExtensions[extension]) {
        return {
            extension,
            type: 'asset',
            displayName: assetExtensions[extension]
        };
    }

    if (docExtensions[extension]) {
        return {
            extension,
            type: 'documentation',
            displayName: docExtensions[extension]
        };
    }

    return {
        extension,
        type: 'unknown',
        displayName: extension.toUpperCase() + ' File'
    };
}
