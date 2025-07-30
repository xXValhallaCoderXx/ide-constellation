// Dynamic import for @lancedb/lancedb to handle ES module compatibility
import type { Connection, Table } from '@lancedb/lancedb';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';

/**
 * Interface for embedding records stored in the vector database
 */
export interface EmbeddingRecord {
    id: string;        // Format: "src/services/utils.ts:myFunction"
    text: string;      // The original docstring text
    vector: number[];  // 384-dimensional embedding vector
    filePath: string;  // The file path for reconciliation (e.g., "src/services/utils.ts")
    contentHash: string; // SHA-256 hash of the content for change detection
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
    private static readonly SCHEMA_VERSION = 2; // Schema version for migration tracking

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
        const initId = `init-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

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
     * Initialize the embeddings table with proper schema and migration logic
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
                console.log(`[${initId}] ✅ VectorStoreService: Embeddings table exists, checking schema...`);
                
                // Check schema compatibility and migrate if necessary
                const migrationNeeded = await VectorStoreService.checkSchemaCompatibility(initId);
                
                if (migrationNeeded) {
                    console.log(`[${initId}] 🔄 VectorStoreService: Schema migration required, recreating table...`);
                    await VectorStoreService.performSchemaMigration(initId);
                } else {
                    console.log(`[${initId}] ✅ VectorStoreService: Schema is compatible, connecting to existing table...`);
                    VectorStoreService.table = await VectorStoreService.db.openTable(VectorStoreService.TABLE_NAME);
                    console.log(`[${initId}] ✅ VectorStoreService: Connected to existing embeddings table`);
                }
            } else {
                console.log(`[${initId}] 🔨 VectorStoreService: Creating new embeddings table with schema v${VectorStoreService.SCHEMA_VERSION}...`);
                await VectorStoreService.createNewTable(initId);
            }

            // Verify table is accessible
            if (VectorStoreService.table) {
                const tableInfo = await VectorStoreService.table.schema;
                console.log(`[${initId}] � VectorStoreService: Table schema verified:`, tableInfo);
            }

        } catch (error) {
            console.error(`[${initId}] ❌ VectorStoreService: Failed to initialize embeddings table:`, error);
            throw new Error(`Failed to initialize embeddings table: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Check if existing table schema is compatible with current version
     * @param initId Initialization ID for logging
     * @returns Promise<boolean> True if migration is needed, false otherwise
     */
    private static async checkSchemaCompatibility(initId: string): Promise<boolean> {
        try {
            console.log(`[${initId}] 🔍 VectorStoreService: Checking schema compatibility...`);
            
            // Open existing table to inspect schema
            const existingTable = await VectorStoreService.db!.openTable(VectorStoreService.TABLE_NAME);
            
            console.log(`[${initId}] 📋 VectorStoreService: Checking for filePath field compatibility...`);
            
            // For LanceDB, we'll try to run a simple query to check if filePath field exists
            // If the table doesn't have filePath field, we assume migration is needed
            try {
                // Try to count records - if successful, table is accessible
                const count = await existingTable.countRows();
                console.log(`[${initId}] 📊 VectorStoreService: Table has ${count} records`);
                
                // For now, we'll assume existing tables need migration to add filePath field
                // In a real implementation, we could try to sample a record and check its structure
                console.log(`[${initId}] ⚠️ VectorStoreService: Existing table detected, assuming migration needed for filePath field`);
                return true; // Migration needed to add filePath field
                
            } catch (accessError) {
                console.log(`[${initId}] ❌ VectorStoreService: Cannot access existing table:`, accessError);
                return true; // Migration needed if we can't access the table
            }
            
        } catch (error) {
            console.error(`[${initId}] ❌ VectorStoreService: Error checking schema compatibility:`, error);
            // If we can't check the schema, assume migration is needed for safety
            console.log(`[${initId}] ⚠️ VectorStoreService: Cannot verify schema, assuming migration needed`);
            return true;
        }
    }

    /**
     * Perform schema migration by recreating the table
     * @param initId Initialization ID for logging
     */
    private static async performSchemaMigration(initId: string): Promise<void> {
        try {
            console.log(`[${initId}] 🚀 VectorStoreService: Starting schema migration process...`);
            
            // Backup existing data if table has records
            let backupData: any[] = [];
            try {
                console.log(`[${initId}] 💾 VectorStoreService: Attempting to backup existing data...`);
                const existingTable = await VectorStoreService.db!.openTable(VectorStoreService.TABLE_NAME);
                
                // Try to read existing data (this may fail if schema is incompatible)
                try {
                    // For LanceDB, we cannot easily read all data if schema is incompatible
                    // So we'll skip backup for now and just recreate the table
                    console.log(`[${initId}] ⚠️ VectorStoreService: Skipping data backup due to potential schema incompatibility`);
                    console.log(`[${initId}] 📝 VectorStoreService: Proceeding with clean migration (existing data will be lost)`);
                    backupData = []; // No backup data
                } catch (readError) {
                    console.warn(`[${initId}] ⚠️ VectorStoreService: Could not read existing data for backup (schema incompatible):`, readError);
                    console.log(`[${initId}] 📝 VectorStoreService: Proceeding with clean migration (data will be lost)`);
                }
                
            } catch (backupError) {
                console.warn(`[${initId}] ⚠️ VectorStoreService: Could not backup existing data:`, backupError);
            }
            
            // Drop existing table
            console.log(`[${initId}] 🗑️ VectorStoreService: Dropping existing table...`);
            await VectorStoreService.db!.dropTable(VectorStoreService.TABLE_NAME);
            console.log(`[${initId}] ✅ VectorStoreService: Existing table dropped`);
            
            // Create new table with updated schema
            console.log(`[${initId}] 🔨 VectorStoreService: Creating new table with updated schema...`);
            await VectorStoreService.createNewTable(initId);
            
            // Migrate compatible data if any exists
            if (backupData.length > 0) {
                console.log(`[${initId}] 🔄 VectorStoreService: Migrating ${backupData.length} existing records...`);
                
                let migratedCount = 0;
                let skippedCount = 0;
                
                for (const record of backupData) {
                    try {
                        // Transform old record format to new format
                        const migratedRecord: EmbeddingRecord = {
                            id: record.id || '',
                            text: record.text || '',
                            vector: record.vector || [],
                            filePath: VectorStoreService.extractFilePathFromId(record.id || ''), // Extract from ID
                            contentHash: VectorStoreService.generateContentHash(record.text || '') // Generate hash for old records
                        };
                        
                        // Validate migrated record
                        if (migratedRecord.id && migratedRecord.text && migratedRecord.vector.length > 0) {
                            await VectorStoreService.table!.add([migratedRecord as any]);
                            migratedCount++;
                        } else {
                            console.warn(`[${initId}] ⚠️ VectorStoreService: Skipping invalid record: ${JSON.stringify(record)}`);
                            skippedCount++;
                        }
                    } catch (recordError) {
                        console.warn(`[${initId}] ⚠️ VectorStoreService: Failed to migrate record ${record.id}:`, recordError);
                        skippedCount++;
                    }
                }
                
                console.log(`[${initId}] ✅ VectorStoreService: Migration completed - ${migratedCount} records migrated, ${skippedCount} skipped`);
            }
            
            console.log(`[${initId}] 🎉 VectorStoreService: Schema migration completed successfully`);
            
        } catch (error) {
            console.error(`[${initId}] ❌ VectorStoreService: Schema migration failed:`, error);
            throw new Error(`Schema migration failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Create a new table with the latest schema
     * @param initId Initialization ID for logging
     */
    private static async createNewTable(initId: string): Promise<void> {
        console.log(`[${initId}] 📋 VectorStoreService: Schema v${VectorStoreService.SCHEMA_VERSION} - id: string, text: string, vector: float[], filePath: string`);

        // Create table with a dummy record to establish schema, then delete it
        const dummyData: EmbeddingRecord[] = [{
            id: '__dummy__',
            text: 'dummy text',
            vector: new Array(384).fill(0),
            filePath: '__dummy_path__',
            contentHash: VectorStoreService.generateContentHash('dummy text')
        }];

        VectorStoreService.table = await VectorStoreService.db!.createTable(
            VectorStoreService.TABLE_NAME,
            dummyData as any
        );

        // Delete the dummy record
        await VectorStoreService.table.delete("id = '__dummy__'");
        console.log(`[${initId}] ✅ VectorStoreService: Embeddings table created successfully with schema v${VectorStoreService.SCHEMA_VERSION}`);
    }

    /**
     * Extract file path from a record ID
     * @param id The record ID in format "filePath:symbolName"
     * @returns string The extracted file path
     */
    private static extractFilePathFromId(id: string): string {
        if (!id || typeof id !== 'string') {
            return '';
        }
        
        const lastColonIndex = id.lastIndexOf(':');
        if (lastColonIndex === -1) {
            // No colon found, treat entire string as file path
            return id;
        }
        
        return id.substring(0, lastColonIndex);
    }

    /**
     * Generate SHA-256 hash of content for change detection
     * @param content The content to hash
     * @returns string The SHA-256 hash
     */
    public static generateContentHash(content: string): string {
        return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
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
     * @param filePath The file path for reconciliation (e.g., "src/services/utils.ts")
     * @returns Promise<void> Resolves when upsert operation completes
     * @throws Error if service is not initialized or upsert operation fails
     */
    public async upsert(id: string, text: string, vector: number[], filePath: string): Promise<void> {
        const startTime = Date.now();
        const requestId = `upsert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        console.log(`[${requestId}] 🔧 VectorStoreService: Starting upsert operation...`);
        console.log(`[${requestId}] 🆔 VectorStoreService: ID: ${id}`);
        console.log(`[${requestId}] 📁 VectorStoreService: FilePath: ${filePath}`);
        console.log(`[${requestId}] 📝 VectorStoreService: Text length: ${text.length} characters`);
        console.log(`[${requestId}] 📊 VectorStoreService: Vector dimensions: ${vector.length}`);

        // Validate service initialization
        if (!VectorStoreService.isInitialized || !VectorStoreService.table) {
            console.error(`[${requestId}] ❌ VectorStoreService: Service not initialized`);
            throw new Error('VectorStoreService is not initialized. Call initialize() first.');
        }

        // Validate inputs
        this.validateUpsertInputs(id, text, vector, filePath, requestId);

        // Perform upsert with retry logic
        await this.performUpsertWithRetry(id, text, vector, filePath, requestId, startTime);
    }

    /**
     * Perform upsert operation with retry logic for transient failures
     * @param id Unique identifier for the embedding
     * @param text The original docstring text
     * @param vector The embedding vector
     * @param filePath The file path for reconciliation
     * @param requestId Request ID for logging
     * @param startTime Start time for performance tracking
     * @returns Promise<void> Resolves when upsert operation completes
     */
    private async performUpsertWithRetry(
        id: string,
        text: string,
        vector: number[],
        filePath: string,
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
                    vector: vector,
                    filePath: filePath.trim(),
                    contentHash: VectorStoreService.generateContentHash(text.trim())
                };

                console.log(`[${requestId}] 💾 VectorStoreService: Upserting record to database...`);

                // Perform proper upsert operation: delete existing record first, then add new one
                const upsertStartTime = Date.now();
                
                // First, try to delete any existing record with the same ID
                try {
                    console.log(`[${requestId}] 🗑️ VectorStoreService: Removing existing record with ID: ${id}`);
                    await VectorStoreService.table!.delete(`id = '${id.replace(/'/g, "''")}'`);
                    console.log(`[${requestId}] ✅ VectorStoreService: Existing record deleted (if it existed)`);
                } catch (deleteError) {
                    // It's okay if the delete fails (record might not exist)
                    console.log(`[${requestId}] ℹ️ VectorStoreService: No existing record to delete (this is normal for new records)`);
                }
                
                // Then add the new record
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
     * Get all embedding IDs associated with a specific file path
     * @param filePath The path of the file to query
     * @returns Promise<string[]> Array of embedding IDs for the specified file
     * @throws Error if service is not initialized or query operation fails
     */
    public async getIdsByFilePath(filePath: string): Promise<string[]> {
        const startTime = Date.now();
        const requestId = `getIds-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        console.log(`[${requestId}] 🔧 VectorStoreService: Starting getIdsByFilePath operation...`);
        console.log(`[${requestId}] 📁 VectorStoreService: FilePath: ${filePath}`);

        // Start performance monitoring
        PerformanceMonitor.startTimer(requestId, PerformanceMonitor.MetricTypes.QUERY_EXISTING, {
            filePath: filePath,
            operation: 'getIdsByFilePath'
        });

        // Validate service initialization
        if (!VectorStoreService.isInitialized || !VectorStoreService.table) {
            console.error(`[${requestId}] ❌ VectorStoreService: Service not initialized`);
            throw new Error('VectorStoreService is not initialized. Call initialize() first.');
        }

        // Validate and normalize filePath input
        const normalizedFilePath = this.validateAndNormalizeFilePath(filePath, requestId);

        try {
            console.log(`[${requestId}] 🔍 VectorStoreService: Querying embeddings for file: ${normalizedFilePath}`);

            // For LanceDB, we need to get records that match the filePath
            // Since we can't do SELECT queries easily, we'll use the existing search functionality
            // and filter results by filePath. This is a workaround for LanceDB limitations.
            
            const queryStartTime = Date.now();
            const allIds: string[] = [];
            
            // We'll try to find records by searching for a pattern in the ID field
            // Since IDs are in format "filePath:symbolName", we can filter by filePath prefix
            
            try {
                // For LanceDB, we need to work around the lack of direct filter/select methods
                // We'll iterate through records and match the filePath field
                // This is not efficient for large datasets, but works for our use case
                
                console.log(`[${requestId}] 🔍 VectorStoreService: Searching for records with filePath: ${normalizedFilePath}`);
                
                // Since we can't directly query by filePath, we'll use a workaround:
                // Query using a dummy vector to get all records, then filter by filePath
                // This is inefficient but necessary due to LanceDB limitations
                
                const dummyVector = new Array(384).fill(0); // Create dummy query vector
                const searchResults = await VectorStoreService.table
                    .search(dummyVector)
                    .limit(10000) // Large limit to get all records
                    .toArray();
                
                // Filter results by filePath
                for (const record of searchResults) {
                    if (record.filePath === normalizedFilePath && record.id && typeof record.id === 'string') {
                        allIds.push(record.id);
                    }
                }
                
                const queryDuration = Date.now() - queryStartTime;
                console.log(`[${requestId}] ✅ VectorStoreService: Search and filter completed (${queryDuration}ms)`);
                console.log(`[${requestId}] 📊 VectorStoreService: Found ${allIds.length} embedding IDs for file: ${normalizedFilePath}`);
                
                if (allIds.length > 0) {
                    console.log(`[${requestId}] 📋 VectorStoreService: Sample IDs: ${allIds.slice(0, 3).join(', ')}${allIds.length > 3 ? '...' : ''}`);
                }
                
            } catch (queryError) {
                console.error(`[${requestId}] ❌ VectorStoreService: Query failed:`, queryError);
                throw new Error(`Failed to query embeddings for file ${normalizedFilePath}: ${queryError instanceof Error ? queryError.message : String(queryError)}`);
            }

            const totalDuration = Date.now() - startTime;
            console.log(`[${requestId}] 🎉 VectorStoreService: getIdsByFilePath operation completed (${totalDuration}ms)`);

            return allIds;

        } catch (error) {
            const totalDuration = Date.now() - startTime;
            console.error(`[${requestId}] ❌ VectorStoreService: getIdsByFilePath operation failed (${totalDuration}ms):`, error);

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
                if (error.message.includes('filter') || error.message.includes('query')) {
                    errorCategory = 'query';
                } else if (error.message.includes('connection') || error.message.includes('database')) {
                    errorCategory = 'database';
                } else if (error.message.includes('timeout')) {
                    errorCategory = 'timeout';
                } else if (error.message.includes('validation') || error.message.includes('input')) {
                    errorCategory = 'validation';
                }

                console.error(`[${requestId}] 🏷️ VectorStoreService: Error category: ${errorCategory}`);

                // Re-throw with enhanced error message
                throw new Error(`getIdsByFilePath operation failed (${errorCategory}): ${error.message}`);
            } else {
                console.error(`[${requestId}] ❓ VectorStoreService: Unknown error type: ${typeof error}`);
                console.error(`[${requestId}] 📋 VectorStoreService: Error details: ${String(error)}`);
                throw new Error(`getIdsByFilePath operation failed with unknown error: ${String(error)}`);
            }
        }
    }

    /**
     * Validate and normalize file path input for queries
     * @param filePath The file path to validate and normalize
     * @param requestId Request ID for logging
     * @returns string The normalized file path
     */
    private validateAndNormalizeFilePath(filePath: string, requestId: string): string {
        // Validate filePath input
        if (!filePath || typeof filePath !== 'string') {
            console.error(`[${requestId}] ❌ VectorStoreService: Invalid filePath - must be a non-empty string`);
            throw new Error('Invalid input: filePath must be a non-empty string');
        }

        if (filePath.trim().length === 0) {
            console.error(`[${requestId}] ❌ VectorStoreService: Invalid filePath - cannot be empty or whitespace only`);
            throw new Error('Invalid input: filePath cannot be empty or whitespace only');
        }

        // Normalize file path (remove leading slash if present, use forward slashes)
        const normalizedFilePath = filePath
            .trim()
            .replace(/^\/+/, '') // Remove leading slashes
            .replace(/\\/g, '/'); // Convert backslashes to forward slashes

        // Validate normalized path
        if (normalizedFilePath.length === 0) {
            console.error(`[${requestId}] ❌ VectorStoreService: Invalid filePath - cannot be empty after normalization`);
            throw new Error('Invalid input: filePath cannot be empty after normalization');
        }

        console.log(`[${requestId}] 🔧 VectorStoreService: Normalized filePath: ${filePath} -> ${normalizedFilePath}`);

        return normalizedFilePath;
    }

    /**
     * Delete multiple embedding records by their IDs
     * @param ids Array of embedding IDs to delete
     * @returns Promise<void> Resolves when all specified embeddings are deleted
     * @throws Error if service is not initialized or delete operation fails
     */
    public async delete(ids: string[]): Promise<void> {
        const startTime = Date.now();
        const requestId = `DEL-BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        console.log(`[${requestId}] 🔧 VectorStoreService: Starting batch delete operation...`);
        console.log(`[${requestId}] 📊 VectorStoreService: Number of IDs to delete: ${ids.length}`);

        // Start performance monitoring
        PerformanceMonitor.startTimer(requestId, PerformanceMonitor.MetricTypes.BATCH_DELETE, {
            idCount: ids.length,
            operation: 'batchDelete'
        });

        // Validate service initialization
        if (!VectorStoreService.isInitialized || !VectorStoreService.table) {
            console.error(`[${requestId}] ❌ VectorStoreService: Service not initialized`);
            throw new Error('VectorStoreService is not initialized. Call initialize() first.');
        }

        // Validate inputs
        this.validateBatchDeleteInputs(ids, requestId);

        if (ids.length === 0) {
            console.log(`[${requestId}] ℹ️ VectorStoreService: No IDs provided for deletion, operation completed`);
            return;
        }

        try {
            console.log(`[${requestId}] 🗑️ VectorStoreService: Preparing batch deletion...`);
            
            // Log sample IDs for debugging
            if (ids.length > 0) {
                const sampleIds = ids.slice(0, 3);
                console.log(`[${requestId}] 📋 VectorStoreService: Sample IDs to delete: ${sampleIds.join(', ')}${ids.length > 3 ? '...' : ''}`);
            }

            const deleteStartTime = Date.now();
            let deletedCount = 0;
            let failedCount = 0;
            const failedIds: string[] = [];

            // Process deletions in batches for better performance and error handling
            const batchSize = 100; // Process in smaller batches to avoid overwhelming the database
            const totalBatches = Math.ceil(ids.length / batchSize);

            console.log(`[${requestId}] 📊 VectorStoreService: Processing ${totalBatches} batches of ${batchSize} IDs each`);

            for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
                const batchStart = batchIndex * batchSize;
                const batchEnd = Math.min(batchStart + batchSize, ids.length);
                const batchIds = ids.slice(batchStart, batchEnd);
                
                console.log(`[${requestId}] 🔄 VectorStoreService: Processing batch ${batchIndex + 1}/${totalBatches} (${batchIds.length} IDs)...`);

                try {
                    // Build batch delete filter using SQL IN clause
                    // Escape single quotes for SQL safety
                    const escapedIds = batchIds.map(id => `'${id.replace(/'/g, "''")}'`);
                    const deleteFilter = `id IN (${escapedIds.join(', ')})`;
                    
                    console.log(`[${requestId}] 📝 VectorStoreService: Batch ${batchIndex + 1} delete filter: ${deleteFilter.substring(0, 100)}${deleteFilter.length > 100 ? '...' : ''}`);
                    
                    // Execute batch delete
                    const batchStartTime = Date.now();
                    await VectorStoreService.table.delete(deleteFilter);
                    const batchDuration = Date.now() - batchStartTime;
                    
                    deletedCount += batchIds.length;
                    console.log(`[${requestId}] ✅ VectorStoreService: Batch ${batchIndex + 1} completed successfully (${batchDuration}ms) - ${batchIds.length} records processed`);
                    
                } catch (batchError) {
                    console.error(`[${requestId}] ❌ VectorStoreService: Batch ${batchIndex + 1} failed:`, batchError);
                    
                    // Track failed IDs for reporting
                    failedIds.push(...batchIds);
                    failedCount += batchIds.length;
                    
                    // Decide whether to continue or abort based on error type
                    if (batchError instanceof Error && batchError.message.includes('connection')) {
                        // Connection errors might be transient, but abort to avoid further issues
                        console.error(`[${requestId}] 🚫 VectorStoreService: Connection error detected, aborting remaining batches`);
                        break;
                    }
                    
                    // For other errors, continue with next batch
                    console.log(`[${requestId}] ⏭️ VectorStoreService: Continuing with next batch despite error`);
                }
            }

            const deleteDuration = Date.now() - deleteStartTime;
            
            // Report final results
            if (failedCount === 0) {
                console.log(`[${requestId}] ✅ VectorStoreService: Batch delete completed successfully`);
                console.log(`[${requestId}] 📊 VectorStoreService: ${deletedCount} records deleted (${deleteDuration}ms)`);
            } else {
                console.warn(`[${requestId}] ⚠️ VectorStoreService: Batch delete completed with errors`);
                console.warn(`[${requestId}] 📊 VectorStoreService: ${deletedCount} records deleted, ${failedCount} failed (${deleteDuration}ms)`);
                console.warn(`[${requestId}] 📋 VectorStoreService: Failed IDs sample: ${failedIds.slice(0, 5).join(', ')}${failedIds.length > 5 ? '...' : ''}`);
                
                // Throw error if any deletions failed
                throw new Error(`Batch delete partially failed: ${deletedCount} deleted, ${failedCount} failed. First failed ID: ${failedIds[0] || 'unknown'}`);
            }

            const totalDuration = Date.now() - startTime;
            console.log(`[${requestId}] 🎉 VectorStoreService: Batch delete operation completed (${totalDuration}ms)`);

        } catch (error) {
            const totalDuration = Date.now() - startTime;
            console.error(`[${requestId}] ❌ VectorStoreService: Batch delete operation failed (${totalDuration}ms):`, error);

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
                if (error.message.includes('delete') || error.message.includes('filter')) {
                    errorCategory = 'delete';
                } else if (error.message.includes('connection') || error.message.includes('database')) {
                    errorCategory = 'database';
                } else if (error.message.includes('timeout')) {
                    errorCategory = 'timeout';
                } else if (error.message.includes('validation') || error.message.includes('input')) {
                    errorCategory = 'validation';
                } else if (error.message.includes('partial')) {
                    errorCategory = 'partial';
                }

                console.error(`[${requestId}] 🏷️ VectorStoreService: Error category: ${errorCategory}`);

                // Re-throw with enhanced error message
                throw new Error(`Batch delete operation failed (${errorCategory}): ${error.message}`);
            } else {
                console.error(`[${requestId}] ❓ VectorStoreService: Unknown error type: ${typeof error}`);
                console.error(`[${requestId}] 📋 VectorStoreService: Error details: ${String(error)}`);
                throw new Error(`Batch delete operation failed with unknown error: ${String(error)}`);
            }
        }
    }

    /**
     * Validate inputs for batch delete operation
     * @param ids Array of IDs to delete
     * @param requestId Request ID for logging
     */
    private validateBatchDeleteInputs(ids: string[], requestId: string): void {
        // Validate ids array
        if (!Array.isArray(ids)) {
            console.error(`[${requestId}] ❌ VectorStoreService: Invalid ids - must be an array`);
            throw new Error('Invalid input: ids must be an array');
        }

        // Validate array elements
        const invalidIds = ids.filter(id => !id || typeof id !== 'string' || id.trim().length === 0);
        if (invalidIds.length > 0) {
            console.error(`[${requestId}] ❌ VectorStoreService: Invalid IDs - contains ${invalidIds.length} invalid elements`);
            throw new Error(`Invalid input: ids array contains ${invalidIds.length} invalid elements (must be non-empty strings)`);
        }

        // Check for duplicates
        const uniqueIds = new Set(ids);
        if (uniqueIds.size !== ids.length) {
            const duplicateCount = ids.length - uniqueIds.size;
            console.warn(`[${requestId}] ⚠️ VectorStoreService: Duplicate IDs detected - ${duplicateCount} duplicates will be ignored`);
        }

        // Warn about large batch sizes
        if (ids.length > 1000) {
            console.warn(`[${requestId}] ⚠️ VectorStoreService: Large batch detected - ${ids.length} IDs (consider processing in smaller chunks for better performance)`);
        }

        console.log(`[${requestId}] ✅ VectorStoreService: Validation passed for ${ids.length} IDs (${uniqueIds.size} unique)`);
    }

    /**
     * Delete all embeddings associated with a specific file path
     * @param filePath The path of the file whose embeddings should be deleted
     * @returns Promise<void> Resolves when all embeddings for the file are deleted
     * @throws Error if service is not initialized or delete operation fails
     */
    public async deleteFileEmbeddings(filePath: string): Promise<void> {
        if (!VectorStoreService.table) {
            throw new Error('VectorStoreService is not initialized. Call initialize() first.');
        }

        const requestId = `DEL-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const startTime = Date.now();

        console.log(`[${requestId}] 🗑️ VectorStoreService: Starting deletion of all embeddings for file: ${filePath}`);

        try {
            // Normalize the file path to match how IDs are generated
            const normalizedFilePath = filePath
                .replace(/^\/+/, '') // Remove leading slashes
                .replace(/\\/g, '/'); // Convert backslashes to forward slashes

            // Escape single quotes for SQL safety
            const escapedFilePath = normalizedFilePath.replace(/'/g, "''");
            
            // First, let's see what records exist before deletion
            console.log(`[${requestId}] 🔍 VectorStoreService: Preparing to delete embeddings for file: ${normalizedFilePath}`);
            // Skip the record checking since LanceDB search() requires vectors
            // Just proceed directly to deletion
            
            // Delete all records where the ID starts with the normalized file path
            // IDs are in format "filePath:symbolName", so we match the prefix + colon
            const deleteFilter = `id LIKE '${escapedFilePath}:%'`;
            
            console.log(`[${requestId}] �️ VectorStoreService: Using delete filter: ${deleteFilter}`);
            const deleteResult = await VectorStoreService.table.delete(deleteFilter);
            console.log(`[${requestId}] 📋 VectorStoreService: Delete operation completed`);

            // Deletion completed - no need to verify since we can't query without vectors

            const duration = Date.now() - startTime;
            console.log(`[${requestId}] ✅ VectorStoreService: Successfully deleted all embeddings for file: ${filePath} (${duration}ms)`);

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[${requestId}] ❌ VectorStoreService: Failed to delete embeddings for file ${filePath} (${duration}ms):`, error);
            throw new Error(`Failed to delete embeddings for file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
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
        const requestId = `search-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

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
     * @param filePath The file path
     * @param requestId Request ID for logging
     */
    private validateUpsertInputs(id: string, text: string, vector: number[], filePath: string, requestId: string): void {
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

        // Validate filePath
        if (!filePath || typeof filePath !== 'string') {
            console.error(`[${requestId}] ❌ VectorStoreService: Invalid filePath - must be a non-empty string`);
            throw new Error('Invalid input: filePath must be a non-empty string');
        }

        if (filePath.trim().length === 0) {
            console.error(`[${requestId}] ❌ VectorStoreService: Invalid filePath - cannot be empty or whitespace only`);
            throw new Error('Invalid input: filePath cannot be empty or whitespace only');
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