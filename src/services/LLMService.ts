// Request interfaces
interface OpenRouterMessage {
    role: string;
    content: string;
}

interface OpenRouterRequest {
    model: string;
    messages: OpenRouterMessage[];
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    stream?: boolean;
}

// Response interfaces
interface OpenRouterChoice {
    message: OpenRouterMessage;
    finish_reason?: string;
    index?: number;
}

interface OpenRouterUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

interface OpenRouterResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: OpenRouterChoice[];
    usage?: OpenRouterUsage;
}

// Error interfaces
interface OpenRouterError {
    error: {
        message: string;
        type: string;
        code?: string;
    };
}

export class LLMService {
    private readonly apiKey: string;
    private readonly baseUrl: string = 'https://openrouter.ai/api/v1';

    constructor() {
        console.log('🔧 LLMService: Initializing service...');

        // Read API key from environment variables
        this.apiKey = process.env.OPENROUTER_API_KEY || '';

        if (!this.apiKey) {
            console.error('❌ LLMService: OPENROUTER_API_KEY environment variable not found');
            console.error('💡 LLMService: Please ensure your .env file contains OPENROUTER_API_KEY=your_api_key_here');
            throw new Error('OPENROUTER_API_KEY environment variable is required');
        }

        console.log('✅ LLMService: API key loaded successfully');
        console.log(`🔑 LLMService: API key length: ${this.apiKey.length} characters`);
        console.log(`🌐 LLMService: Base URL: ${this.baseUrl}`);
    }

    /**
     * Test the connection to OpenRouter API
     * @returns Promise<string> The response content from the API
     */
    public async testConnection(): Promise<string> {
        console.log('🔧 LLMService: Building request headers and body...');

        try {
            const headers = this.buildRequestHeaders();
            const body = this.buildRequestBody();
            const url = `${this.baseUrl}/chat/completions`;

            console.log(`🌐 LLMService: Making POST request to ${url}`);
            console.log('📋 LLMService: Request model:', body.model);
            console.log('💬 LLMService: Request message:', body.messages[0].content);

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            console.log(`📡 LLMService: Received response with status ${response.status} ${response.statusText}`);

            const result = await this.parseResponse(response);
            console.log('✅ LLMService: Successfully parsed response');

            return result;
        } catch (error) {
            console.error('❌ LLMService: Error during API connection test:', error);

            // Handle different types of errors with enhanced logging
            if (error instanceof TypeError) {
                // Network errors (DNS, connection refused, etc.)
                console.error('🌐 LLMService: Network error detected:', error.message);
                throw new Error(`Network error: Unable to connect to OpenRouter API. Please check your internet connection. Details: ${error.message}`);
            } else if (error instanceof Error) {
                // Re-throw known errors (from parseResponse or other sources)
                console.error('⚠️ LLMService: Known error type:', error.constructor.name);
                throw error;
            } else {
                // Unknown error types
                console.error('❓ LLMService: Unknown error type:', typeof error);
                throw new Error(`Unexpected error during API connection test: ${String(error)}`);
            }
        }
    }

    /**
     * Build request headers with authorization
     * @returns Record<string, string> Headers object
     */
    private buildRequestHeaders(): Record<string, string> {
        console.log('🔧 LLMService: Building request headers...');

        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/your-repo', // Optional: helps with rate limiting
            'X-Title': 'VS Code Extension' // Optional: helps identify your app
        };

        console.log('✅ LLMService: Headers built successfully');
        console.log('🔑 LLMService: Authorization header configured');

        return headers;
    }

    /**
     * Build minimal test request body
     * @returns OpenRouterRequest Request payload for OpenRouter API
     */
    private buildRequestBody(): OpenRouterRequest {
        console.log('🔧 LLMService: Building request body...');

        const body = {
            model: 'mistralai/mistral-7b-instruct',
            messages: [
                {
                    role: 'user',
                    content: 'Respond with only the word "OK"'
                }
            ]
        };

        console.log('✅ LLMService: Request body built successfully');
        console.log('🤖 LLMService: Using model:', body.model);
        console.log('💬 LLMService: Test message:', body.messages[0].content);

        return body;
    }

    /**
     * Parse the API response and extract message content
     * @param response Response object from fetch
     * @returns Promise<string> The extracted message content
     */
    private async parseResponse(response: Response): Promise<string> {
        console.log(`🔍 LLMService: Parsing response with status ${response.status}`);

        if (!response.ok) {
            console.error(`❌ LLMService: API request failed with status ${response.status} ${response.statusText}`);

            let errorMessage = `API request failed: ${response.status} ${response.statusText}`;

            // Handle specific HTTP status codes
            switch (response.status) {
                case 401:
                    console.error('🔐 LLMService: Authentication error - invalid API key');
                    errorMessage = 'Authentication failed: Invalid API key. Please check your OPENROUTER_API_KEY in the .env file.';
                    break;
                case 403:
                    console.error('🚫 LLMService: Access forbidden - insufficient permissions');
                    errorMessage = 'Access forbidden: Your API key may not have permission to access this endpoint.';
                    break;
                case 429:
                    console.error('⏱️ LLMService: Rate limit exceeded');
                    errorMessage = 'Rate limit exceeded: Too many requests. Please wait before trying again.';
                    break;
                case 500:
                    console.error('🔧 LLMService: Server error - API temporarily unavailable');
                    errorMessage = 'OpenRouter API server error: The service is temporarily unavailable.';
                    break;
                case 502:
                case 503:
                case 504:
                    console.error('🔧 LLMService: Service unavailable - API down');
                    errorMessage = 'OpenRouter API service unavailable: Please try again later.';
                    break;
                default:
                    console.error(`❓ LLMService: Unhandled HTTP status ${response.status}`);
                    // Try to get more detailed error information from the response
                    try {
                        const errorData = await response.json() as OpenRouterError;
                        if (errorData.error && errorData.error.message) {
                            console.error('📋 LLMService: API error details:', errorData.error.message);
                            errorMessage += ` - ${errorData.error.message}`;
                        }
                    } catch {
                        // If we can't parse the error as JSON, fall back to text
                        try {
                            const errorText = await response.text();
                            if (errorText) {
                                console.error('📄 LLMService: Error response text:', errorText);
                                errorMessage += ` - ${errorText}`;
                            }
                        } catch {
                            // If even text parsing fails, use the basic error message
                            console.error('❌ LLMService: Unable to parse error response');
                        }
                    }
            }

            throw new Error(errorMessage);
        }

        try {
            console.log('📋 LLMService: Parsing successful response JSON...');
            const data = await response.json() as OpenRouterResponse;

            console.log('🔍 LLMService: Validating response structure...');
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                console.error('❌ LLMService: Invalid response structure - missing choices or message');
                console.error('📋 LLMService: Response data:', JSON.stringify(data, null, 2));
                throw new Error('Invalid response format from OpenRouter API: Missing expected response structure');
            }

            const content = data.choices[0].message.content;
            if (typeof content !== 'string') {
                console.error('❌ LLMService: Invalid message content type:', typeof content);
                console.error('📋 LLMService: Message content:', content);
                throw new Error('Invalid response format from OpenRouter API: Message content is not a string');
            }

            console.log('✅ LLMService: Successfully extracted message content');
            console.log('💬 LLMService: Response content:', content);

            // Log usage information if available
            if (data.usage) {
                console.log('📊 LLMService: Token usage:', {
                    prompt: data.usage.prompt_tokens,
                    completion: data.usage.completion_tokens,
                    total: data.usage.total_tokens
                });
            }

            return content;
        } catch (error) {
            console.error('❌ LLMService: Error parsing response:', error);

            if (error instanceof SyntaxError) {
                console.error('📋 LLMService: JSON parsing error - invalid response format');
                throw new Error('Invalid JSON response from OpenRouter API: Unable to parse response');
            } else if (error instanceof Error) {
                console.error('⚠️ LLMService: Known error during parsing:', error.message);
                throw error;
            } else {
                console.error('❓ LLMService: Unknown error during parsing:', typeof error);
                throw new Error('Unexpected error while parsing OpenRouter API response');
            }
        }
    }
}