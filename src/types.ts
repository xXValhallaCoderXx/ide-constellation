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
    /** Raw source code text for the symbol */
    sourceText?: string;
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
 * Parsed JSDoc components extracted from raw JSDoc strings
 */
export interface ParsedJSDoc {
    /** Main description of the function/symbol */
    description: string;
    /** Parameter documentation */
    params: Array<{
        /** Parameter name */
        name: string;
        /** Parameter type (optional) */
        type?: string;
        /** Parameter description */
        description: string;
    }>;
    /** Return value documentation (optional) */
    returns?: {
        /** Return type (optional) */
        type?: string;
        /** Return description */
        description: string;
    };
    /** Code examples (optional) */
    examples?: string[];
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

/**
 * Performance and error metrics for monitoring service initialization
 */
export interface ServiceMetrics {
    embeddingService: {
        initializationTime: number;
        initializationSuccess: boolean;
        errorCategory?: string;
        errorMessage?: string;
    };
    vectorStoreService: {
        initializationTime: number;
        initializationSuccess: boolean;
        errorCategory?: string;
        errorMessage?: string;
    };
    totalInitializationTime: number;
}

/**
 * Container for initialized services and metrics
 */
export interface ServiceContainer {
    /** Embedding service instance */
    embeddingService: any; // Will be typed properly when we import the actual service types
    /** Vector store service instance */
    vectorStoreService: any; // Will be typed properly when we import the actual service types
    /** VSCode service instance for user interactions */
    vscodeService: any; // Will be typed properly when we import the actual service types
    /** Service initialization metrics */
    metrics: ServiceMetrics;
}