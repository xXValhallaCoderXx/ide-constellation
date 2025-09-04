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
    
    // Handle absolute paths that are missing the leading slash (common issue in graph data)
    let abs: string;
    if (normalized.startsWith('Users/') || normalized.startsWith('home/') || normalized.includes(':/')) {
        // This looks like an absolute path missing the leading slash, add it
        abs = '/' + normalized;
    } else {
        // This is a relative path, resolve it normally
        abs = pathUtils.resolve(workspaceRoot, normalized);
    }
    // BUGFIX(M2 overlay enablement): pathUtils.resolve strips leading slash from absolute base
    // because the split/join removes the empty first segment. This caused security guard to
    // misclassify valid workspace-relative paths (e.g. 'src/ui/App.jsx') as outside the workspace.
    // Reinstate leading slash when workspaceRoot is absolute and result lost it.
    if (workspaceRoot.startsWith('/') && !abs.startsWith('/')) {
        abs = '/' + abs;
    }
    
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
 * Calculate Levenshtein distance between two strings for fuzzy matching.
 * Used to determine similarity between file paths for suggestions.
 * 
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns Number representing edit distance (lower = more similar)
 */
function levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[str2.length][str1.length];
}

/**
 * Calculate confidence score for fuzzy path matching.
 * 
 * @param originalPath - The path being searched for
 * @param candidatePath - The potential match
 * @param matchType - Type of match found
 * @returns Confidence score from 0-100
 */
function calculatePathConfidence(
    originalPath: string,
    candidatePath: string,
    matchType: 'similar_name' | 'partial_path' | 'same_extension'
): number {
    const normalizedOriginal = originalPath.toLowerCase().replace(/\\/g, '/');
    const normalizedCandidate = candidatePath.toLowerCase().replace(/\\/g, '/');

    // Extract filenames for comparison
    const originalFilename = normalizedOriginal.split('/').pop() || '';
    const candidateFilename = normalizedCandidate.split('/').pop() || '';

    switch (matchType) {
        case 'similar_name': {
            const distance = levenshteinDistance(originalFilename, candidateFilename);
            const maxLength = Math.max(originalFilename.length, candidateFilename.length);
            if (maxLength === 0) {
                return 0;
            }

            const similarity = 1 - (distance / maxLength);
            return Math.round(similarity * 100);
        }

        case 'partial_path': {
            // Check how much of the original path is contained in the candidate
            const originalParts = normalizedOriginal.split('/').filter(p => p);
            const candidateParts = normalizedCandidate.split('/').filter(p => p);

            let matchingParts = 0;
            for (const part of originalParts) {
                if (candidateParts.some(cp => cp.includes(part) || part.includes(cp))) {
                    matchingParts++;
                }
            }

            const pathSimilarity = matchingParts / originalParts.length;
            return Math.round(pathSimilarity * 85); // Max 85 for partial matches
        }

        case 'same_extension': {
            const originalExt = pathUtils.extname(originalPath);
            const candidateExt = pathUtils.extname(candidatePath);

            if (originalExt !== candidateExt) {
                return 0;
            }

            // Base score for same extension, boost if filenames are similar
            let score = 30;
            const nameDistance = levenshteinDistance(originalFilename, candidateFilename);
            const maxLength = Math.max(originalFilename.length, candidateFilename.length);

            if (maxLength > 0) {
                const nameSimilarity = 1 - (nameDistance / maxLength);
                score += Math.round(nameSimilarity * 40); // Up to 70 total
            }

            return score;
        }

        default:
            return 0;
    }
}

/**
 * Normalize path for consistent comparison across platforms.
 * 
 * @param path - Path to normalize
 * @returns Normalized path with forward slashes and no trailing slash
 */
export function normalizePath(path: string): string {
    return path
        .replace(/\\/g, '/') // Convert backslashes to forward slashes
        .replace(/\/+/g, '/') // Remove duplicate slashes
        .replace(/\/$/, '') // Remove trailing slash
        .toLowerCase(); // Case insensitive comparison
}

/**
 * Find fuzzy matches for a given path among available file paths.
 * 
 * @param targetPath - The path to find matches for
 * @param availablePaths - Array of available file paths to search
 * @param maxSuggestions - Maximum number of suggestions to return (default: 5)
 * @param minConfidence - Minimum confidence score to include (default: 20)
 * @returns Array of path suggestions sorted by confidence
 */
export function findFuzzyPathMatches(
    targetPath: string,
    availablePaths: string[],
    maxSuggestions: number = 5,
    minConfidence: number = 20
): Array<{ path: string; confidence: number; reason: 'similar_name' | 'partial_path' | 'same_extension' }> {
    const normalizedTarget = normalizePath(targetPath);
    const targetFilename = normalizedTarget.split('/').pop() || '';
    const targetExtension = pathUtils.extname(targetPath);

    const suggestions: Array<{ path: string; confidence: number; reason: 'similar_name' | 'partial_path' | 'same_extension' }> = [];

    for (const candidatePath of availablePaths) {
        const normalizedCandidate = normalizePath(candidatePath);
        const candidateFilename = normalizedCandidate.split('/').pop() || '';
        const candidateExtension = pathUtils.extname(candidatePath);

        // Skip exact matches (should be handled separately)
        if (normalizedTarget === normalizedCandidate) {
            continue;
        }

        // Check for similar filename
        if (targetFilename && candidateFilename) {
            const confidence = calculatePathConfidence(targetPath, candidatePath, 'similar_name');
            if (confidence >= minConfidence) {
                suggestions.push({ path: candidatePath, confidence, reason: 'similar_name' });
                continue;
            }
        }

        // Check for partial path match
        if (normalizedCandidate.includes(targetFilename) ||
            targetFilename.includes(candidateFilename) ||
            normalizedTarget.split('/').some(part => part && normalizedCandidate.includes(part))) {
            const confidence = calculatePathConfidence(targetPath, candidatePath, 'partial_path');
            if (confidence >= minConfidence) {
                suggestions.push({ path: candidatePath, confidence, reason: 'partial_path' });
                continue;
            }
        }

        // Check for same extension
        if (targetExtension && candidateExtension === targetExtension) {
            const confidence = calculatePathConfidence(targetPath, candidatePath, 'same_extension');
            if (confidence >= minConfidence) {
                suggestions.push({ path: candidatePath, confidence, reason: 'same_extension' });
            }
        }
    }

    // Sort by confidence (highest first) and limit results
    return suggestions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxSuggestions);
}

/**
 * Resolve a potentially fuzzy file path to an exact match or suggestions.
 * 
 * @param targetPath - The path to resolve
 * @param availablePaths - Array of available file paths
 * @param workspaceRoot - Workspace root for security validation
 * @returns Path resolution result with exact match or fuzzy suggestions
 */
export function resolveFuzzyPath(
    targetPath: string,
    availablePaths: string[],
    workspaceRoot: string
): {
    originalPath: string;
    resolvedPath: string | null;
    fuzzyMatched: boolean;
    matchConfidence?: number;
    suggestions?: Array<{ path: string; confidence: number; reason: 'similar_name' | 'partial_path' | 'same_extension' }>;
    withinWorkspace: boolean;
} {
    const normalizedTarget = normalizePath(targetPath);

    // Check workspace boundary first
    const { within: withinWorkspace } = resolveWorkspacePath(workspaceRoot, targetPath);

    // Try exact match first
    const exactMatch = availablePaths.find(path => normalizePath(path) === normalizedTarget);
    if (exactMatch) {
        return {
            originalPath: targetPath,
            resolvedPath: exactMatch,
            fuzzyMatched: false,
            withinWorkspace
        };
    }

    // Try fuzzy matching
    const suggestions = findFuzzyPathMatches(targetPath, availablePaths);

    // If we have a high-confidence match, use it as resolved path
    const bestMatch = suggestions[0];
    if (bestMatch && bestMatch.confidence >= 80) {
        return {
            originalPath: targetPath,
            resolvedPath: bestMatch.path,
            fuzzyMatched: true,
            matchConfidence: bestMatch.confidence,
            suggestions: suggestions.slice(1), // Include other suggestions too
            withinWorkspace
        };
    }

    // No good match found, return suggestions only
    return {
        originalPath: targetPath,
        resolvedPath: null,
        fuzzyMatched: false,
        suggestions,
        withinWorkspace
    };
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
