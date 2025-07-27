/**
 * Represents a code symbol extracted from source files
 */
export interface CodeSymbol {
    /** Symbol name (function name, class name, etc.) */
    name: string;
    /** Type of symbol (function, class, interface, etc.) */
    type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'method' | 'property';
    /** JSDoc comment content, if present */
    documentation?: string;
    /** Location information */
    location: SymbolLocation;
    /** Additional metadata specific to symbol type */
    metadata?: SymbolMetadata;
}

/**
 * Location information for a code symbol
 */
export interface SymbolLocation {
    /** File path relative to workspace root */
    filePath: string;
    /** Starting line number (1-based) */
    startLine: number;
    /** Starting column number (0-based) */
    startColumn: number;
    /** Ending line number (1-based) */
    endLine: number;
    /** Ending column number (0-based) */
    endColumn: number;
}

/**
 * Additional metadata for different symbol types
 */
export interface SymbolMetadata {
    /** Function parameters (for functions/methods) */
    parameters?: string[];
    /** Return type (for functions/methods) */
    returnType?: string;
    /** Parent class/interface (for methods/properties) */
    parent?: string;
    /** Access modifier (public, private, protected) */
    accessibility?: 'public' | 'private' | 'protected';
}

/**
 * Structure of the manifest.json file
 */
export interface Manifest {
    /** Timestamp of last update */
    lastUpdated: string;
    /** Version of the manifest format */
    version: string;
    /** Map of file paths to their extracted symbols */
    files: Record<string, CodeSymbol[]>;
}