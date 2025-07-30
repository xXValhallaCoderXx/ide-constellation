// Dynamic import for @lancedb/lancedb to handle ES module compatibility
import type { Connection, Table } from '@lancedb/lancedb';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Interface for embedding records stored in the vector database
 */
export interface EmbeddingRecord {
    id: string;        // Format: "src/services/utils.ts:myFunction"
    text: string;      // The original docstring text
    vector: number[];  // 384-dimensional embedding vector
}

/**
 * Interface for search results returned from vector queries
 */
export interface SearchResult {
    id: string;
    text: string;
    score: number;     // Similarity score (0-1)
}

/**
 * Service for managing vector storage operations using LanceDB
 * Implements singleton pattern to ensure database connection is managed efficiently
 */
export class VectorStoreService {
    private static instance: VectorStoreService | null = null;
    private static db: Connection | null = null;
    private static table: Table | null = null;
    private static isInitialized: boolean = false;
    private static initializationPromise: Promise<void> | null = null;

    private static readonly DB_PATH = '.constellation/vector-store';
    private static workspaceRoot: string = '';
    private static readonly TABLE_NAME = 'embeddings';

    /**
     * Private constructor to enforce singleton pattern
     */
    private constructor() {
        // Private constructor prevents direct instantiation
    }

    /**
     * Initialize the vector store service with LanceDB connection
     * This method should be called once during extension activation
     * @param workspaceRoot Optional workspace root path, defaults to current working directory
     * @returns Promise<void> Resolves when database connection is established
     */
    public static async initialize(workspaceRoot?: string): Promise<void> {
        const startTime = Date.now();
        const initId = `init-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        console.log(`[${initId}] 🔧 VectorStoreService: Starting initialization process...`);

        // Set workspace root for path resolution
        if (workspaceRoot) {
            VectorStoreService.workspaceRoot = workspaceRoot;
            console.log(`[${initId}] 📁 VectorStoreService: Using workspace root: ${workspaceRoot}`);
        } else {
            VectorStoreService.workspaceRoot = process.cwd();
            console.log(`[${initId}] 📁 VectorStoreService: Using current working directory: ${VectorStoreService.workspaceRoot}`);
        }

        // Return existing initialization promise if already in progress
        if (VectorStoreService.initializationPromise) {
            console.log(`[${initId}] ⏳ VectorStoreService: Initialization already in progress, waiting...`);
            return VectorStoreService.initializationPromise;
        }

        // Return immediately if already initialized
        if (VectorStoreService.isInitialized) {
            console.log(`[${initId}] ✅ VectorStoreService: Already initialized, skipping...`);
            return Promise.resolve();
        }

        // Create and store initialization promise
        VectorStoreService.initializationPromise = VectorStoreService.performInitialization(initId, startTime);

        try {
            await VectorStoreService.initializationPromise;
            console.log(`[${initId}] ✅ VectorStoreService: Initialization completed successfully`);
        } catch (error) {
            // Reset initialization promise on failure to allow retry
            VectorStoreService.initializationPromise = null;
            throw error;
        }
    }

    /**
     * Perform the actual initialization work
     * @param initId Unique identifier for this initialization attempt
     * @param startTime Start time for performance tracking
     * @returns Promise<void> Resolves when initialization is complete
     */
    private static async performInitialization(initId: string, startTime: number): Promise<void> {
        try {
            console.log(`[${initId}] 🗄️ VectorStoreService: Connecting to LanceDB at ${VectorStoreService.DB_PATH}...`);

            // Ensure the database directory exists
            const dbDirStartTime = Date.now();
            await VectorStoreService.ensureDatabaseDirectory(initId);
            const dbDirDuration = Date.now() - dbDirStartTime;
            console.log(`[${initId}] 📁 VectorStoreService: Database directory prepared (${dbDirDuration}ms)`);

            // Connect to LanceDB using dynamic import
            const connectionStartTime = Date.now();
            console.log(`[${initId}] 📦 VectorStoreService: Dynamically importing @lancedb/lancedb...`);

            const { connect } = await import('@lancedb/lancedb');
            console.log(`[${initId}] ✅ VectorStoreService: LanceDB library imported successfully`);

            const dbPath = path.resolve(VectorStoreService.workspaceRoot, VectorStoreService.DB_PATH);
            VectorStoreService.db = await connect(dbPath);
            const connectionDuration = Date.now() - connectionStartTime;
            console.log(`[${initId}] ✅ VectorStoreService: Database connection established (${connectionDuration}ms)`);

            // Create or connect to embeddings table
            const tableStartTime = Date.now();
            await VectorStoreService.initializeTable(initId);
            const tableDuration = Date.now() - tableStartTime;
            console.log(`[${initId}] 📊 VectorStoreService: Embeddings table initialized (${tableDuration}ms)`);

            // Mark as initialized
            VectorStoreService.isInitialized = true;

            const totalDuration = Date.now() - startTime;
            console.log(`[${initId}] 🎉 VectorStoreService: Initialization completed (${totalDuration}ms)`);

        } catch (error) {
            const totalDuration = Date.now() - startTime;
            console.error(`[${initId}] ❌ VectorStoreService: Initialization failed (${totalDuration}ms):`, error);

            // Enhanced error logging with categorization
            if (error instanceof Error) {
                console.error(`[${initId}] ⚠️ VectorStoreService: Error type: ${error.constructor.name}`);
                console.error(`[${initId}] 📋 VectorStoreService: Error message: ${error.message}`);

                // Log stack trace for debugging
                if (error.stack) {
                    console.error(`[${initId}] 📚 VectorStoreService: Error stack:`, error.stack);
                }

                // Categorize error types for better monitoring
                let errorCategory = 'unknown';
                if (error.message.includes('permission') || error.message.includes('access') || error.message.includes('EACCES')) {
                    errorCategory = 'permission';
                    console.error(`[${initId}] 🔒 VectorStoreService: Permission error - check file system permissions for ${VectorStoreService.DB_PATH}`);
                } else if (error.message.includes('ENOENT') || error.message.includes('directory') || error.message.includes('path')) {
                    errorCategory = 'filesystem';
                    console.error(`[${initId}] 📁 VectorStoreService: Filesystem error - issue with database directory creation`);
                } else if (error.message.includes('connection') || error.message.includes('database')) {
                    errorCategory = 'database';
                    console.error(`[${initId}] 🗄️ VectorStoreService: Database error - issue with LanceDB connection`);
                } else if (error.message.includes('table') || error.message.includes('schema')) {
                    errorCategory = 'table';
                    console.error(`[${initId}] 📊 VectorStoreService: Table error - issue with embeddings table creation`);
                } else if (error.message.includes('memory') || error.message.includes('allocation')) {
                    errorCategory = 'memory';
                    console.error(`[${initId}] 💾 VectorStoreService: Memory error - insufficient memory for database operations`);
                }

                console.error(`[${initId}] 🏷️ VectorStoreService: Error category: ${errorCategory}`);

                // Throw enhanced error with category information
                throw new Error(`VectorStoreService initialization failed (${errorCategory}): ${error.message}`);
            } else {
                console.error(`[${initId}] ❓ VectorStoreService: Unknown error type: ${typeof error}`);
                console.error(`[${initId}] 📋 VectorStoreService: Error details: ${String(error)}`);
                throw new Error(`VectorStoreService initialization failed with unknown error: ${String(error)}`);
            }
        }
    }

    /**
     * Ensure the database directory exists
     * @param initId Initialization ID for logging
     */
    private static async ensureDatabaseDirectory(initId: string): Promise<void> {
        try {
            const absolutePath = path.resolve(VectorStoreService.workspaceRoot, VectorStoreService.DB_PATH);
            console.log(`[${initId}] 📁 VectorStoreService: Ensuring directory exists at: ${absolutePath}`);

            // Check if directory exists
            if (!fs.existsSync(absolutePath)) {
                console.log(`[${initId}] 🔨 VectorStoreService: Creating database directory...`);
                fs.mkdirSync(absolutePath, { recursive: true });
                console.log(`[${initId}] ✅ VectorStoreService: Database directory created successfully`);
            } else {
                console.log(`[${initId}] ✅ VectorStoreService: Database directory already exists`);
            }

            // Verify directory is writable
            fs.accessSync(absolutePath, fs.constants.W_OK);
            console.log(`[${initId}] ✅ VectorStoreService: Database directory is writable`);

        } catch (error) {
            console.error(`[${initId}] ❌ VectorStoreService: Failed to ensure database directory:`, error);
            throw new Error(`Failed to create or access database directory: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Initialize the embeddings table with proper schema
     * @param initId Initialization ID for logging
     */
    private static async initializeTable(initId: string): Promise<void> {
        if (!VectorStoreService.db) {
            throw new Error('Database connection not established');
        }

        try {
            console.log(`[${initId}] 📊 VectorStoreService: Checking for existing embeddings table...`);

            // Check if table already exists
            const tableNames = await VectorStoreService.db.tableNames();
            const tableExists = tableNames.includes(VectorStoreService.TABLE_NAME);

            if (tableExists) {
                console.log(`[${initId}] ✅ VectorStoreService: Embeddings table already exists, connecting...`);
                VectorStoreService.table = await VectorStoreService.db.openTable(VectorStoreService.TABLE_NAME);
                console.log(`[${initId}] ✅ VectorStoreService: Connected to existing embeddings table`);
            } else {
                console.log(`[${initId}] 🔨 VectorStoreService: Creating new embeddings table with schema...`);
                console.log(`[${initId}] 📋 VectorStoreService: Schema - id: string, text: string, vector: float[]`);

                // Create table with a dummy record to establish schema, then delete it
                const dummyData: EmbeddingRecord[] = [{
                    id: '__dummy__',
                    text: 'dummy text',
                    vector: new Array(384).fill(0)
                }];

                VectorStoreService.table = await VectorStoreService.db.createTable(
                    VectorStoreService.TABLE_NAME,
                    dummyData as any
                );

                // Delete the dummy record
                await VectorStoreService.table.delete("id = '__dummy__'");
                console.log(`[${initId}] ✅ VectorStoreService: Embeddings table created successfully`);
            }

            // Verify table is accessible
            if (VectorStoreService.table) {
                const tableInfo = await VectorStoreService.table.schema;
                console.log(`[${initId}] 📊 VectorStoreService: Table schema verified:`, tableInfo);
            }

        } catch (error) {
            console.error(`[${initId}] ❌ VectorStoreService: Failed to initialize embeddings table:`, error);
            throw new Error(`Failed to initialize embeddings table: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get the singleton instance of VectorStoreService
     * @returns VectorStoreService The singleton instance
     * @throws Error if service has not been initialized
     */
    public static getInstance(): VectorStoreService {
        if (!VectorStoreService.isInitialized) {
            console.error('❌ VectorStoreService: Attempting to get instance before initialization');
            throw new Error('VectorStoreService must be initialized before getting instance. Call VectorStoreService.initialize() first.');
        }

        // Create instance if it doesn't exist (lazy instantiation)
        if (!VectorStoreService.instance) {
            console.log('🔧 VectorStoreService: Creating singleton instance...');
            VectorStoreService.instance = new VectorStoreService();
            console.log('✅ VectorStoreService: Singleton instance created');
        }

        return VectorStoreService.instance;
    }

    /**
     * Check if the service has been initialized
     * @returns boolean True if initialized, false otherwise
     */
    public static isServiceInitialized(): boolean {
        return VectorStoreService.isInitialized;
    }

    /**
     * Generate a unique ID for an embedding record using filePath:symbolName format
     * @param filePath The relative file path (e.g., "src/services/LLMService.ts")
     * @param symbolName The symbol name (e.g., "generateDocstring")
     * @returns string The unique ID in format "filePath:symbolName"
     */
    public static generateUniqueId(filePath: string, symbolName: string): string {
        // Validate inputs
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('Invalid filePath: must be a non-empty string');
        }

        if (!symbolName || typeof symbolName !== 'string') {
            throw new Error('Invalid symbolName: must be a non-empty string');
        }

        // Normalize file path (remove leading slash if present, use forward slashes)
        const normalizedFilePath = filePath
            .replace(/^\/+/, '') // Remove leading slashes
            .replace(/\\/g, '/'); // Convert backslashes to forward slashes

        // Normalize symbol name (trim whitespace)
        const normalizedSymbolName = symbolName.trim();

        // Validate normalized inputs
        if (normalizedFilePath.length === 0) {
            throw new Error('Invalid filePath: cannot be empty after normalization');
        }

        if (normalizedSymbolName.length === 0) {
            throw new Error('Invalid symbolName: cannot be empty after normalization');
        }

        // Generate unique ID
        const uniqueId = `${normalizedFilePath}:${normalizedSymbolName}`;

        console.log(`🆔 VectorStoreService: Generated unique ID: ${uniqueId}`);

        return uniqueId;
    }

    /**
     * Upsert an embedding record into the vector database
     * @param id Unique identifier for the embedding (format: filePath:symbolName)
     * @param text The original docstring text
     * @param vector The embedding vector (384 dimensions)
     * @returns Promise<void> Resolves when upsert operation completes
     * @throws Error if service is not initialized or upsert operation fails
     */
    public async upsert(id: string, text: string, vector: number[]): Promise<void> {
        const startTime = Date.now();
        const requestId = `upsert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        console.log(`[${requestId}] 🔧 VectorStoreService: Starting upsert operation...`);
        console.log(`[${requestId}] 🆔 VectorStoreService: ID: ${id}`);
        console.log(`[${requestId}] 📝 VectorStoreService: Text length: ${text.length} characters`);
        console.log(`[${requestId}] 📊 VectorStoreService: Vector dimensions: ${vector.length}`);

        // Validate service initialization
        if (!VectorStoreService.isInitialized || !VectorStoreService.table) {
            console.error(`[${requestId}] ❌ VectorStoreService: Service not initialized`);
            throw new Error('VectorStoreService is not initialized. Call initialize() first.');
        }

        // Validate inputs
        this.validateUpsertInputs(id, text, vector, requestId);

        // Perform upsert with retry logic
        await this.performUpsertWithRetry(id, text, vector, requestId, startTime);
    }

    /**
     * Perform upsert operation with retry logic for transient failures
     * @param id Unique identifier for the embedding
     * @param text The original docstring text
     * @param vector The embedding vector
     * @param requestId Request ID for logging
     * @param startTime Start time for performance tracking
     * @returns Promise<void> Resolves when upsert operation completes
     */
    private async performUpsertWithRetry(
        id: string,
        text: string,
        vector: number[],
        requestId: string,
        startTime: number
    ): Promise<void> {
        const maxRetries = 3;
        const baseDelayMs = 1000; // 1 second base delay
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[${requestId}] 🔄 VectorStoreService: Upsert attempt ${attempt}/${maxRetries}...`);

                // Create embedding record
                const record: EmbeddingRecord = {
                    id: id.trim(),
                    text: text.trim(),
                    vector: vector
                };

                console.log(`[${requestId}] 💾 VectorStoreService: Upserting record to database...`);

                // Perform upsert operation
                const upsertStartTime = Date.now();
                await VectorStoreService.table!.add([record as any]);
                const upsertDuration = Date.now() - upsertStartTime;

                console.log(`[${requestId}] ✅ VectorStoreService: Record upserted successfully (${upsertDuration}ms)`);

                const totalDuration = Date.now() - startTime;
                console.log(`[${requestId}] 🎉 VectorStoreService: Upsert operation completed on attempt ${attempt} (${totalDuration}ms)`);

                return; // Success - exit retry loop

            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                const attemptDuration = Date.now() - startTime;

                console.error(`[${requestId}] ❌ VectorStoreService: Upsert attempt ${attempt}/${maxRetries} failed (${attemptDuration}ms):`, error);

                // Enhanced error handling with categorization
                let errorCategory = 'unknown';
                let isRetryable = false;

                if (error instanceof Error) {
                    console.error(`[${requestId}] ⚠️ VectorStoreService: Error type: ${error.constructor.name}`);
                    console.error(`[${requestId}] 📋 VectorStoreService: Error message: ${error.message}`);

                    // Categorize error types and determine if retryable
                    if (error.message.includes('schema') || error.message.includes('type')) {
                        errorCategory = 'schema';
                        isRetryable = false; // Schema errors are not retryable
                    } else if (error.message.includes('constraint') || error.message.includes('duplicate')) {
                        errorCategory = 'constraint';
                        isRetryable = false; // Constraint violations are not retryable
                    } else if (error.message.includes('connection') || error.message.includes('database')) {
                        errorCategory = 'database';
                        isRetryable = true; // Database connection issues may be transient
                    } else if (error.message.includes('memory') || error.message.includes('allocation')) {
                        errorCategory = 'memory';
                        isRetryable = true; // Memory issues may be transient
                    } else if (error.message.includes('timeout')) {
                        errorCategory = 'timeout';
                        isRetryable = true; // Timeout errors are often transient
                    } else if (error.message.includes('lock') || error.message.includes('busy')) {
                        errorCategory = 'lock';
                        isRetryable = true; // Lock/busy errors are transient
                    } else if (error.message.includes('network') || error.message.includes('io')) {
                        errorCategory = 'network';
                        isRetryable = true; // Network/IO errors may be transient
                    }

                    console.error(`[${requestId}] 🏷️ VectorStoreService: Error category: ${errorCategory}, Retryable: ${isRetryable}`);
                }

                // If this is the last attempt or error is not retryable, throw the error
                if (attempt === maxRetries || !isRetryable) {
                    const totalDuration = Date.now() - startTime;
                    console.error(`[${requestId}] ❌ VectorStoreService: Upsert operation failed after ${attempt} attempts (${totalDuration}ms)`);

                    if (!isRetryable) {
                        console.error(`[${requestId}] 🚫 VectorStoreService: Error is not retryable, failing immediately`);
                    }

                    // Log final error details
                    if (lastError.stack) {
                        console.error(`[${requestId}] 📚 VectorStoreService: Final error stack:`, lastError.stack);
                    }

                    throw new Error(`Upsert operation failed after ${attempt} attempts (${errorCategory}): ${lastError.message}`);
                }

                // Calculate exponential backoff delay
                const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
                console.log(`[${requestId}] ⏳ VectorStoreService: Retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})...`);

                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }

    /**
     * Search for similar embeddings using vector similarity
     * @param queryVector The query vector to search for
     * @param limit Maximum number of results to return (default: 5)
     * @returns Promise<SearchResult[]> Array of similar embeddings with similarity scores
     * @throws Error if service is not initialized or search operation fails
     */
    public async search(queryVector: number[], limit: number = 5): Promise<SearchResult[]> {
        const startTime = Date.now();
        const requestId = `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        console.log(`[${requestId}] 🔧 VectorStoreService: Starting search operation...`);
        console.log(`[${requestId}] 📊 VectorStoreService: Query vector dimensions: ${queryVector.length}`);
        console.log(`[${requestId}] 🔢 VectorStoreService: Result limit: ${limit}`);

        // Validate service initialization
        if (!VectorStoreService.isInitialized || !VectorStoreService.table) {
            console.error(`[${requestId}] ❌ VectorStoreService: Service not initialized`);
            throw new Error('VectorStoreService is not initialized. Call initialize() first.');
        }

        // Validate inputs
        this.validateSearchInputs(queryVector, limit, requestId);

        try {
            console.log(`[${requestId}] 🔍 VectorStoreService: Performing similarity search...`);

            // Perform vector similarity search
            const searchStartTime = Date.now();
            const results = await VectorStoreService.table
                .search(queryVector)
                .limit(limit)
                .toArray();
            const searchDuration = Date.now() - searchStartTime;

            console.log(`[${requestId}] ✅ VectorStoreService: Search completed (${searchDuration}ms)`);
            console.log(`[${requestId}] 📊 VectorStoreService: Found ${results.length} results`);

            // Transform results to SearchResult format
            const transformStartTime = Date.now();
            const searchResults: SearchResult[] = results.map((result: any) => ({
                id: result.id,
                text: result.text,
                score: result._distance ? Math.max(0, 1 / (1 + Math.abs(result._distance))) : 0 // Convert distance to similarity score (0-1)
            }));
            const transformDuration = Date.now() - transformStartTime;

            console.log(`[${requestId}] 🔄 VectorStoreService: Results transformed (${transformDuration}ms)`);

            // Log result summary
            if (searchResults.length > 0) {
                console.log(`[${requestId}] 📈 VectorStoreService: Top result - ID: ${searchResults[0].id}, Score: ${searchResults[0].score.toFixed(4)}`);
                console.log(`[${requestId}] 📝 VectorStoreService: Top result text preview: ${searchResults[0].text.substring(0, 100)}...`);
            } else {
                console.log(`[${requestId}] 📭 VectorStoreService: No results found for query`);
            }

            const totalDuration = Date.now() - startTime;
            console.log(`[${requestId}] 🎉 VectorStoreService: Search operation completed (${totalDuration}ms)`);

            return searchResults;

        } catch (error) {
            const totalDuration = Date.now() - startTime;
            console.error(`[${requestId}] ❌ VectorStoreService: Search operation failed (${totalDuration}ms):`, error);

            // Enhanced error handling with categorization
            if (error instanceof Error) {
                console.error(`[${requestId}] ⚠️ VectorStoreService: Error type: ${error.constructor.name}`);
                console.error(`[${requestId}] 📋 VectorStoreService: Error message: ${error.message}`);

                // Log stack trace for debugging
                if (error.stack) {
                    console.error(`[${requestId}] 📚 VectorStoreService: Error stack:`, error.stack);
                }

                // Categorize error types for better monitoring
                let errorCategory = 'unknown';
                if (error.message.includes('vector') || error.message.includes('dimension')) {
                    errorCategory = 'vector';
                } else if (error.message.includes('connection') || error.message.includes('database')) {
                    errorCategory = 'database';
                } else if (error.message.includes('memory') || error.message.includes('allocation')) {
                    errorCategory = 'memory';
                } else if (error.message.includes('timeout')) {
                    errorCategory = 'timeout';
                } else if (error.message.includes('empty') || error.message.includes('no results')) {
                    errorCategory = 'empty';
                }

                console.error(`[${requestId}] 🏷️ VectorStoreService: Error category: ${errorCategory}`);

                // Re-throw with enhanced error message
                throw new Error(`Search operation failed (${errorCategory}): ${error.message}`);
            } else {
                console.error(`[${requestId}] ❓ VectorStoreService: Unknown error type: ${typeof error}`);
                console.error(`[${requestId}] 📋 VectorStoreService: Error details: ${String(error)}`);
                throw new Error(`Search operation failed with unknown error: ${String(error)}`);
            }
        }
    }

    /**
     * Validate inputs for upsert operation
     * @param id The record ID
     * @param text The text content
     * @param vector The embedding vector
     * @param requestId Request ID for logging
     */
    private validateUpsertInputs(id: string, text: string, vector: number[], requestId: string): void {
        // Validate ID
        if (!id || typeof id !== 'string') {
            console.error(`[${requestId}] ❌ VectorStoreService: Invalid ID - must be a non-empty string`);
            throw new Error('Invalid input: id must be a non-empty string');
        }

        if (id.trim().length === 0) {
            console.error(`[${requestId}] ❌ VectorStoreService: Invalid ID - cannot be empty or whitespace only`);
            throw new Error('Invalid input: id cannot be empty or whitespace only');
        }

        // Validate text
        if (!text || typeof text !== 'string') {
            console.error(`[${requestId}] ❌ VectorStoreService: Invalid text - must be a non-empty string`);
            throw new Error('Invalid input: text must be a non-empty string');
        }

        if (text.trim().length === 0) {
            console.error(`[${requestId}] ❌ VectorStoreService: Invalid text - cannot be empty or whitespace only`);
            throw new Error('Invalid input: text cannot be empty or whitespace only');
        }

        // Validate vector
        if (!Array.isArray(vector)) {
            console.error(`[${requestId}] ❌ VectorStoreService: Invalid vector - must be an array`);
            throw new Error('Invalid input: vector must be an array');
        }

        if (vector.length === 0) {
            console.error(`[${requestId}] ❌ VectorStoreService: Invalid vector - cannot be empty`);
            throw new Error('Invalid input: vector cannot be empty');
        }

        // Validate vector elements
        const invalidElements = vector.filter(val => typeof val !== 'number' || isNaN(val));
        if (invalidElements.length > 0) {
            console.error(`[${requestId}] ❌ VectorStoreService: Invalid vector - contains ${invalidElements.length} non-numeric values`);
            throw new Error(`Invalid input: vector contains invalid elements: ${invalidElements.length} non-numeric values`);
        }

        // Validate expected dimensions (all-MiniLM-L6-v2 should produce 384-dimensional vectors)
        const expectedDimensions = 384;
        if (vector.length !== expectedDimensions) {
            console.warn(`[${requestId}] ⚠️ VectorStoreService: Unexpected vector dimensions: ${vector.length} (expected ${expectedDimensions})`);
        }
    }

    /**
     * Validate inputs for search operation
     * @param queryVector The query vector
     * @param limit The result limit
     * @param requestId Request ID for logging
     */
    private validateSearchInputs(queryVector: number[], limit: number, requestId: string): void {
        // Validate query vector
        if (!Array.isArray(queryVector)) {
            console.error(`[${requestId}] ❌ VectorStoreService: Invalid query vector - must be an array`);
            throw new Error('Invalid input: queryVector must be an array');
        }

        if (queryVector.length === 0) {
            console.error(`[${requestId}] ❌ VectorStoreService: Invalid query vector - cannot be empty`);
            throw new Error('Invalid input: queryVector cannot be empty');
        }

        // Validate vector elements
        const invalidElements = queryVector.filter(val => typeof val !== 'number' || isNaN(val));
        if (invalidElements.length > 0) {
            console.error(`[${requestId}] ❌ VectorStoreService: Invalid query vector - contains ${invalidElements.length} non-numeric values`);
            throw new Error(`Invalid input: queryVector contains invalid elements: ${invalidElements.length} non-numeric values`);
        }

        // Validate limit
        if (typeof limit !== 'number' || isNaN(limit)) {
            console.error(`[${requestId}] ❌ VectorStoreService: Invalid limit - must be a number`);
            throw new Error('Invalid input: limit must be a number');
        }

        if (limit <= 0) {
            console.error(`[${requestId}] ❌ VectorStoreService: Invalid limit - must be greater than 0`);
            throw new Error('Invalid input: limit must be greater than 0');
        }

        if (limit > 100) {
            console.warn(`[${requestId}] ⚠️ VectorStoreService: Large limit detected: ${limit} (consider using smaller values for better performance)`);
        }

        // Validate expected dimensions
        const expectedDimensions = 384;
        if (queryVector.length !== expectedDimensions) {
            console.warn(`[${requestId}] ⚠️ VectorStoreService: Unexpected query vector dimensions: ${queryVector.length} (expected ${expectedDimensions})`);
        }
    }
}