// Dynamic import for @xenova/transformers to handle ES module compatibility

/**
 * Service for generating vector embeddings from text using local transformer models
 * Implements singleton pattern to ensure model is loaded only once during extension lifecycle
 */
export class EmbeddingService {
    private static instance: EmbeddingService | null = null;
    private static pipeline: any = null;
    private static isInitialized: boolean = false;
    private static initializationPromise: Promise<void> | null = null;

    /**
     * Private constructor to enforce singleton pattern
     */
    private constructor() {
        // Private constructor prevents direct instantiation
    }

    /**
     * Initialize the embedding service with the transformer model
     * This method should be called once during extension activation
     * @returns Promise<void> Resolves when model is loaded successfully
     */
    public static async initialize(): Promise<void> {
        const startTime = Date.now();
        const initId = `init-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        console.log(`[${initId}] 🔧 EmbeddingService: Starting initialization process...`);

        // Return existing initialization promise if already in progress
        if (EmbeddingService.initializationPromise) {
            console.log(`[${initId}] ⏳ EmbeddingService: Initialization already in progress, waiting...`);
            return EmbeddingService.initializationPromise;
        }

        // Return immediately if already initialized
        if (EmbeddingService.isInitialized) {
            console.log(`[${initId}] ✅ EmbeddingService: Already initialized, skipping...`);
            return Promise.resolve();
        }

        // Create and store initialization promise
        EmbeddingService.initializationPromise = EmbeddingService.performInitialization(initId, startTime);

        try {
            await EmbeddingService.initializationPromise;
            console.log(`[${initId}] ✅ EmbeddingService: Initialization completed successfully`);
        } catch (error) {
            // Reset initialization promise on failure to allow retry
            EmbeddingService.initializationPromise = null;
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
            console.log(`[${initId}] 🤖 EmbeddingService: Loading Xenova/all-MiniLM-L6-v2 model...`);
            console.log(`[${initId}] 📋 EmbeddingService: Model configuration - feature-extraction pipeline`);

            // Load the sentence-transformer model with specific configuration using dynamic import
            const modelLoadStart = Date.now();
            console.log(`[${initId}] 📦 EmbeddingService: Dynamically importing @xenova/transformers...`);

            const { pipeline } = await import('@xenova/transformers');
            console.log(`[${initId}] ✅ EmbeddingService: Transformers library imported successfully`);

            EmbeddingService.pipeline = await pipeline(
                'feature-extraction',
                'Xenova/all-MiniLM-L6-v2'
            );

            const modelLoadDuration = Date.now() - modelLoadStart;
            console.log(`[${initId}] ✅ EmbeddingService: Model loaded successfully (${modelLoadDuration}ms)`);
            console.log(`[${initId}] 📊 EmbeddingService: Model details - Expected output dimensions: 384`);

            // Mark as initialized
            EmbeddingService.isInitialized = true;

            const totalDuration = Date.now() - startTime;
            console.log(`[${initId}] 🎉 EmbeddingService: Initialization completed (${totalDuration}ms)`);

        } catch (error) {
            const totalDuration = Date.now() - startTime;
            console.error(`[${initId}] ❌ EmbeddingService: Model loading failed (${totalDuration}ms):`, error);

            // Enhanced error logging with categorization
            if (error instanceof Error) {
                console.error(`[${initId}] ⚠️ EmbeddingService: Error type: ${error.constructor.name}`);
                console.error(`[${initId}] 📋 EmbeddingService: Error message: ${error.message}`);

                // Log stack trace for debugging
                if (error.stack) {
                    console.error(`[${initId}] 📚 EmbeddingService: Error stack:`, error.stack);
                }

                // Categorize error types for better monitoring
                let errorCategory = 'unknown';
                if (error.message.includes('network') || error.message.includes('fetch')) {
                    errorCategory = 'network';
                    console.error(`[${initId}] 🌐 EmbeddingService: Network error - check internet connection for model download`);
                } else if (error.message.includes('memory') || error.message.includes('allocation')) {
                    errorCategory = 'memory';
                    console.error(`[${initId}] 💾 EmbeddingService: Memory error - insufficient memory for model loading`);
                } else if (error.message.includes('model') || error.message.includes('pipeline')) {
                    errorCategory = 'model';
                    console.error(`[${initId}] 🤖 EmbeddingService: Model error - issue with transformer model loading`);
                } else if (error.message.includes('permission') || error.message.includes('access')) {
                    errorCategory = 'permission';
                    console.error(`[${initId}] 🔒 EmbeddingService: Permission error - check file system permissions`);
                }

                console.error(`[${initId}] 🏷️ EmbeddingService: Error category: ${errorCategory}`);

                // Throw enhanced error with category information
                throw new Error(`EmbeddingService initialization failed (${errorCategory}): ${error.message}`);
            } else {
                console.error(`[${initId}] ❓ EmbeddingService: Unknown error type: ${typeof error}`);
                console.error(`[${initId}] 📋 EmbeddingService: Error details: ${String(error)}`);
                throw new Error(`EmbeddingService initialization failed with unknown error: ${String(error)}`);
            }
        }
    }

    /**
     * Get the singleton instance of EmbeddingService
     * @returns EmbeddingService The singleton instance
     * @throws Error if service has not been initialized
     */
    public static getInstance(): EmbeddingService {
        if (!EmbeddingService.isInitialized) {
            console.error('❌ EmbeddingService: Attempting to get instance before initialization');
            throw new Error('EmbeddingService must be initialized before getting instance. Call EmbeddingService.initialize() first.');
        }

        // Create instance if it doesn't exist (lazy instantiation)
        if (!EmbeddingService.instance) {
            console.log('🔧 EmbeddingService: Creating singleton instance...');
            EmbeddingService.instance = new EmbeddingService();
            console.log('✅ EmbeddingService: Singleton instance created');
        }

        return EmbeddingService.instance;
    }

    /**
     * Check if the service has been initialized
     * @returns boolean True if initialized, false otherwise
     */
    public static isServiceInitialized(): boolean {
        return EmbeddingService.isInitialized;
    }

    /**
     * Generate vector embedding from text input
     * @param text The text to generate embedding for
     * @returns Promise<number[]> The generated embedding vector (384 dimensions)
     * @throws Error if service is not initialized or embedding generation fails
     */
    public async generateEmbedding(text: string): Promise<number[]> {
        const startTime = Date.now();
        const requestId = `embed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        console.log(`[${requestId}] 🔧 EmbeddingService: Starting embedding generation...`);
        console.log(`[${requestId}] 📝 EmbeddingService: Text length: ${text.length} characters`);
        console.log(`[${requestId}] 📋 EmbeddingService: Text preview: ${text.substring(0, 100) + (text.length > 100 ? '...' : '')}`);

        // Validate service initialization
        if (!EmbeddingService.isInitialized || !EmbeddingService.pipeline) {
            console.error(`[${requestId}] ❌ EmbeddingService: Service not initialized`);
            throw new Error('EmbeddingService is not initialized. Call initialize() first.');
        }

        // Validate input
        if (!text || typeof text !== 'string') {
            console.error(`[${requestId}] ❌ EmbeddingService: Invalid input - text must be a non-empty string`);
            throw new Error('Invalid input: text must be a non-empty string');
        }

        if (text.trim().length === 0) {
            console.error(`[${requestId}] ❌ EmbeddingService: Invalid input - text cannot be empty or whitespace only`);
            throw new Error('Invalid input: text cannot be empty or whitespace only');
        }

        // Check for very large text that might cause issues
        if (text.length > 10000) { // 10KB
            console.warn(`[${requestId}] ⚠️ EmbeddingService: Large text detected (${text.length} characters), may impact performance`);
        }

        try {
            // Preprocess text
            const preprocessStartTime = Date.now();
            const preprocessedText = this.preprocessText(text);
            const preprocessDuration = Date.now() - preprocessStartTime;

            console.log(`[${requestId}] 🧹 EmbeddingService: Text preprocessed (${preprocessDuration}ms)`);
            console.log(`[${requestId}] 📏 EmbeddingService: Preprocessed length: ${preprocessedText.length} characters`);

            // Generate embedding using the pipeline
            const embeddingStartTime = Date.now();
            console.log(`[${requestId}] 🤖 EmbeddingService: Generating embedding with transformer model...`);

            const result = await EmbeddingService.pipeline(preprocessedText, {
                pooling: 'mean',
                normalize: true
            });
            const embeddingDuration = Date.now() - embeddingStartTime;

            console.log(`[${requestId}] ✅ EmbeddingService: Embedding generated successfully (${embeddingDuration}ms)`);

            // Extract and validate the embedding vector
            const extractStartTime = Date.now();
            const embedding = this.extractEmbeddingVector(result, requestId);
            const extractDuration = Date.now() - extractStartTime;

            console.log(`[${requestId}] 🔍 EmbeddingService: Embedding vector extracted and validated (${extractDuration}ms)`);
            console.log(`[${requestId}] 📊 EmbeddingService: Vector dimensions: ${embedding.length}`);
            console.log(`[${requestId}] 📈 EmbeddingService: Vector sample: [${embedding.slice(0, 3).map(n => n.toFixed(4)).join(', ')}...]`);

            const totalDuration = Date.now() - startTime;
            console.log(`[${requestId}] 🎉 EmbeddingService: Embedding generation completed (${totalDuration}ms)`);

            return embedding;

        } catch (error) {
            const totalDuration = Date.now() - startTime;
            console.error(`[${requestId}] ❌ EmbeddingService: Embedding generation failed (${totalDuration}ms):`, error);

            // Enhanced error handling with categorization
            if (error instanceof Error) {
                console.error(`[${requestId}] ⚠️ EmbeddingService: Error type: ${error.constructor.name}`);
                console.error(`[${requestId}] 📋 EmbeddingService: Error message: ${error.message}`);

                // Log stack trace for debugging
                if (error.stack) {
                    console.error(`[${requestId}] 📚 EmbeddingService: Error stack:`, error.stack);
                }

                // Categorize error types for better monitoring
                let errorCategory = 'unknown';
                if (error.message.includes('Invalid input')) {
                    errorCategory = 'validation';
                } else if (error.message.includes('memory') || error.message.includes('allocation')) {
                    errorCategory = 'memory';
                } else if (error.message.includes('model') || error.message.includes('pipeline')) {
                    errorCategory = 'model';
                } else if (error.message.includes('timeout')) {
                    errorCategory = 'timeout';
                }

                console.error(`[${requestId}] 🏷️ EmbeddingService: Error category: ${errorCategory}`);

                // Re-throw with enhanced error message
                throw new Error(`Embedding generation failed (${errorCategory}): ${error.message}`);
            } else {
                console.error(`[${requestId}] ❓ EmbeddingService: Unknown error type: ${typeof error}`);
                console.error(`[${requestId}] 📋 EmbeddingService: Error details: ${String(error)}`);
                throw new Error(`Embedding generation failed with unknown error: ${String(error)}`);
            }
        }
    }

    /**
     * Preprocess text before embedding generation
     * @param text Raw input text
     * @returns string Preprocessed text
     */
    private preprocessText(text: string): string {
        // Normalize whitespace and remove excessive line breaks
        let processed = text
            .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
            .replace(/\n+/g, ' ')  // Replace line breaks with spaces
            .trim();               // Remove leading/trailing whitespace

        // Truncate if too long (transformer models have token limits)
        const maxLength = 512; // Conservative limit for sentence transformers
        if (processed.length > maxLength) {
            processed = processed.substring(0, maxLength);
            console.log('✂️ EmbeddingService: Text truncated to fit model limits');
        }

        return processed;
    }

    /**
     * Extract embedding vector from transformer pipeline result
     * @param result Raw result from transformer pipeline
     * @param requestId Request ID for logging
     * @returns number[] The embedding vector
     */
    private extractEmbeddingVector(result: any, requestId: string): number[] {
        console.log(`[${requestId}] 🔍 EmbeddingService: Extracting embedding vector from result...`);

        try {
            // Handle different possible result formats from @xenova/transformers
            let embedding: number[];

            if (Array.isArray(result)) {
                // Result is directly an array
                embedding = result;
            } else if (result && typeof result === 'object' && 'data' in result) {
                // Result has a data property
                embedding = Array.from(result.data);
            } else if (result && typeof result === 'object' && 'tensor' in result) {
                // Result has a tensor property
                embedding = Array.from(result.tensor);
            } else {
                console.error(`[${requestId}] ❌ EmbeddingService: Unexpected result format:`, typeof result);
                throw new Error(`Unexpected embedding result format: ${typeof result}`);
            }

            // Validate embedding vector
            if (!Array.isArray(embedding)) {
                throw new Error('Embedding result is not an array');
            }

            if (embedding.length === 0) {
                throw new Error('Embedding vector is empty');
            }

            // Validate that all elements are numbers
            const invalidElements = embedding.filter(val => typeof val !== 'number' || isNaN(val));
            if (invalidElements.length > 0) {
                throw new Error(`Embedding contains invalid elements: ${invalidElements.length} non-numeric values`);
            }

            // Validate expected dimensions (all-MiniLM-L6-v2 should produce 384-dimensional vectors)
            const expectedDimensions = 384;
            if (embedding.length !== expectedDimensions) {
                console.warn(`[${requestId}] ⚠️ EmbeddingService: Unexpected vector dimensions: ${embedding.length} (expected ${expectedDimensions})`);
            }

            console.log(`[${requestId}] ✅ EmbeddingService: Embedding vector validated successfully`);
            return embedding;

        } catch (error) {
            console.error(`[${requestId}] ❌ EmbeddingService: Failed to extract embedding vector:`, error);
            throw new Error(`Failed to extract embedding vector: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}