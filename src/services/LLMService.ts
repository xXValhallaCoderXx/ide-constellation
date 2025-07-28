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
     * Generate JSDoc documentation for a given code snippet
     * @param codeSnippet The TypeScript code snippet to generate documentation for
     * @returns Promise<string> The generated JSDoc comment
     */
    public async generateDocstring(codeSnippet: string): Promise<string> {
        console.log('🔧 LLMService: Starting JSDoc generation process...');
        console.log('📝 LLMService: Code snippet length:', codeSnippet.length, 'characters');
        console.log('📋 LLMService: Code snippet preview:', codeSnippet.substring(0, 100) + (codeSnippet.length > 100 ? '...' : ''));

        try {
            console.log('⚙️ LLMService: Building prompt engineering system...');

            // Create system prompt with expert technical writer instructions
            const systemPrompt = `You are an expert technical writer specializing in TypeScript and JSDoc documentation. Your task is to analyze the provided TypeScript code and generate comprehensive, accurate JSDoc comments.

Requirements for your JSDoc output:
- Start with /** and end with */
- Include a clear, concise description of the function's purpose
- Document all parameters using @param tags with types and descriptions
- Document the return value using @returns tag with type and description
- Use proper JSDoc syntax and formatting
- Be thorough but concise in descriptions
- Focus on what the function does, not how it does it
- Include edge cases or important behavior notes when relevant

Respond with ONLY the JSDoc comment block. Do not include the original code or any additional text.`;

            console.log('📝 LLMService: System prompt created successfully');
            console.log('📏 LLMService: System prompt length:', systemPrompt.length, 'characters');

            // Build final prompt by combining system prompt with formatted code snippet
            const finalPrompt = `${systemPrompt}

Here is the TypeScript code to document:

\`\`\`typescript
${codeSnippet}
\`\`\``;

            console.log('🔧 LLMService: Final prompt constructed successfully');
            console.log('📏 LLMService: Final prompt length:', finalPrompt.length, 'characters');
            console.log('📋 LLMService: Final prompt preview:', finalPrompt.substring(0, 200) + (finalPrompt.length > 200 ? '...' : ''));

            // Implement API request construction using existing buildRequestHeaders method
            console.log('🔧 LLMService: Building API request...');
            const headers = this.buildRequestHeaders();

            // Create request body with model selection and messages array containing finalPrompt
            const requestBody: OpenRouterRequest = {
                model: 'mistralai/mistral-7b-instruct',
                messages: [
                    {
                        role: 'user',
                        content: finalPrompt
                    }
                ],
                max_tokens: 1000,
                temperature: 0.3
            };

            console.log('🤖 LLMService: Using model:', requestBody.model);
            console.log('⚙️ LLMService: Request configuration - max_tokens:', requestBody.max_tokens, 'temperature:', requestBody.temperature);

            // Add fetch call to OpenRouter API endpoint following existing testConnection pattern
            const url = `${this.baseUrl}/chat/completions`;
            console.log(`🌐 LLMService: Making POST request to ${url}`);

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody)
            });

            console.log(`📡 LLMService: Received response with status ${response.status} ${response.statusText}`);

            // Implement response parsing using existing parseResponse method
            const apiResponseContent = await this.parseResponse(response);

            console.log('✅ LLMService: Successfully generated JSDoc from API');
            console.log('💬 LLMService: Generated JSDoc:', apiResponseContent);

            // Validate and process the JSDoc response
            const validatedJSDoc = this.validateAndProcessJSDocResponse(apiResponseContent, codeSnippet);

            console.log('🔍 LLMService: JSDoc validation completed successfully');
            console.log('📝 LLMService: Final validated JSDoc:', validatedJSDoc);

            return validatedJSDoc;
        } catch (error) {
            console.error('❌ LLMService: Error during JSDoc generation:', error);

            // Enhanced error handling with fallback JSDoc generation
            if (error instanceof Error) {
                console.error('⚠️ LLMService: Known error type:', error.constructor.name);
                console.error('📋 LLMService: Error message:', error.message);

                // Generate fallback JSDoc for API failures
                console.log('🔄 LLMService: Generating fallback JSDoc due to error...');
                const fallbackJSDoc = this.generateFallbackJSDoc(codeSnippet);
                console.log('✅ LLMService: Fallback JSDoc generated successfully');
                console.log('📝 LLMService: Fallback JSDoc:', fallbackJSDoc);

                return fallbackJSDoc;
            } else {
                console.error('❓ LLMService: Unknown error type:', typeof error);
                console.error('📋 LLMService: Error details:', String(error));

                // Generate fallback JSDoc for unknown errors
                console.log('🔄 LLMService: Generating fallback JSDoc due to unknown error...');
                const fallbackJSDoc = this.generateFallbackJSDoc(codeSnippet);
                console.log('✅ LLMService: Fallback JSDoc generated successfully');

                return fallbackJSDoc;
            }
        }
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
     * Validate and process JSDoc response from API
     * @param apiResponse The raw response content from the API
     * @param originalCode The original code snippet for context
     * @returns string The validated and processed JSDoc comment
     */
    private validateAndProcessJSDocResponse(apiResponse: string, originalCode: string): string {
        console.log('🔍 LLMService: Starting JSDoc response validation...');
        console.log('📝 LLMService: API response length:', apiResponse.length, 'characters');
        console.log('📋 LLMService: API response preview:', apiResponse.substring(0, 200) + (apiResponse.length > 200 ? '...' : ''));

        // Clean up the response (remove extra whitespace, newlines at start/end)
        const cleanedResponse = apiResponse.trim();
        console.log('🧹 LLMService: Response cleaned, new length:', cleanedResponse.length, 'characters');

        // Validate JSDoc format - must start with /** and end with */
        const isValidFormat = this.validateJSDocFormat(cleanedResponse);
        if (!isValidFormat) {
            console.warn('⚠️ LLMService: Invalid JSDoc format detected in API response');
            console.warn('📋 LLMService: Response does not start with /** or end with */');
            console.log('🔄 LLMService: Attempting to fix JSDoc format...');

            const fixedResponse = this.fixJSDocFormat(cleanedResponse);
            console.log('✅ LLMService: JSDoc format fixed successfully');

            return this.validateContentAndFallback(fixedResponse, originalCode);
        }

        // Validate content quality
        return this.validateContentAndFallback(cleanedResponse, originalCode);
    }

    /**
     * Validate JSDoc format (starts with /** and ends with *\/)
     * @param jsdoc The JSDoc string to validate
     * @returns boolean True if format is valid
     */
    private validateJSDocFormat(jsdoc: string): boolean {
        console.log('🔍 LLMService: Validating JSDoc format...');

        const startsCorrectly = jsdoc.startsWith('/**');
        const endsCorrectly = jsdoc.endsWith('*/');

        console.log('📋 LLMService: Format validation results:');
        console.log('  - Starts with "/**":', startsCorrectly);
        console.log('  - Ends with "*/":', endsCorrectly);

        const isValid = startsCorrectly && endsCorrectly;
        console.log('✅ LLMService: JSDoc format is', isValid ? 'valid' : 'invalid');

        return isValid;
    }

    /**
     * Attempt to fix JSDoc format by adding missing /** and *\/ markers
     * @param content The content to fix
     * @returns string The content with proper JSDoc format
     */
    private fixJSDocFormat(content: string): string {
        console.log('🔧 LLMService: Fixing JSDoc format...');

        let fixed = content;

        // Add opening /** if missing
        if (!fixed.startsWith('/**')) {
            console.log('🔧 LLMService: Adding missing opening /**');
            fixed = '/**\n' + fixed;
        }

        // Add closing */ if missing
        if (!fixed.endsWith('*/')) {
            console.log('🔧 LLMService: Adding missing closing */');
            fixed = fixed + '\n */';
        }

        console.log('✅ LLMService: JSDoc format fixed');
        console.log('📝 LLMService: Fixed JSDoc preview:', fixed.substring(0, 100) + (fixed.length > 100 ? '...' : ''));

        return fixed;
    }

    /**
     * Validate JSDoc content quality and provide fallback if needed
     * @param jsdoc The JSDoc to validate
     * @param originalCode The original code for fallback generation
     * @returns string The validated JSDoc or fallback
     */
    private validateContentAndFallback(jsdoc: string, originalCode: string): string {
        console.log('🔍 LLMService: Validating JSDoc content quality...');

        const contentValidation = this.validateJSDocContent(jsdoc);

        console.log('📊 LLMService: Content validation results:');
        console.log('  - Has description:', contentValidation.hasDescription);
        console.log('  - Has @param tags:', contentValidation.hasParams);
        console.log('  - Has @returns tag:', contentValidation.hasReturns);
        console.log('  - Overall quality score:', contentValidation.qualityScore, '/ 3');

        // If quality is too low (less than 2 out of 3 criteria), use fallback
        if (contentValidation.qualityScore < 2) {
            console.warn('⚠️ LLMService: JSDoc content quality is too low, using fallback');
            console.warn('📋 LLMService: Missing critical JSDoc elements');

            const fallbackJSDoc = this.generateFallbackJSDoc(originalCode);
            console.log('🔄 LLMService: Generated fallback JSDoc due to low quality');

            return fallbackJSDoc;
        }

        console.log('✅ LLMService: JSDoc content quality is acceptable');
        return jsdoc;
    }

    /**
     * Validate JSDoc content for required elements
     * @param jsdoc The JSDoc string to validate
     * @returns object Validation results with quality metrics
     */
    private validateJSDocContent(jsdoc: string): {
        hasDescription: boolean;
        hasParams: boolean;
        hasReturns: boolean;
        qualityScore: number;
    } {
        console.log('🔍 LLMService: Analyzing JSDoc content...');

        // Check for function description (content between /** and first @tag or */)
        const hasDescription = this.hasJSDocDescription(jsdoc);

        // Check for @param tags
        const hasParams = /@param\s+\{[^}]*\}\s+\w+/.test(jsdoc) || /@param\s+\w+/.test(jsdoc);

        // Check for @returns or @return tag
        const hasReturns = /@returns?\s+\{[^}]*\}/.test(jsdoc) || /@returns?\s+\w+/.test(jsdoc);

        const qualityScore = (hasDescription ? 1 : 0) + (hasParams ? 1 : 0) + (hasReturns ? 1 : 0);

        console.log('📊 LLMService: Content analysis completed');

        return {
            hasDescription,
            hasParams,
            hasReturns,
            qualityScore
        };
    }

    /**
     * Check if JSDoc has a meaningful description
     * @param jsdoc The JSDoc string to check
     * @returns boolean True if description is present
     */
    private hasJSDocDescription(jsdoc: string): boolean {
        // Remove the /** and */ markers and extract the first part before any @tags
        const content = jsdoc.replace(/^\/\*\*/, '').replace(/\*\/$/, '');
        const beforeFirstTag = content.split(/@\w+/)[0];

        // Clean up asterisks and whitespace
        const description = beforeFirstTag
            .split('\n')
            .map(line => line.replace(/^\s*\*\s?/, '').trim())
            .join(' ')
            .trim();

        // Consider it a valid description if it has at least 10 characters and some meaningful content
        const hasValidDescription = description.length >= 10 && /\w+.*\w+/.test(description);

        console.log('📝 LLMService: Description analysis:');
        console.log('  - Extracted description:', description.substring(0, 50) + (description.length > 50 ? '...' : ''));
        console.log('  - Description length:', description.length);
        console.log('  - Has valid description:', hasValidDescription);

        return hasValidDescription;
    }

    /**
     * Generate a fallback JSDoc comment when API response is invalid or unavailable
     * @param codeSnippet The original code snippet
     * @returns string A basic but properly formatted JSDoc comment
     */
    private generateFallbackJSDoc(codeSnippet: string): string {
        console.log('🔄 LLMService: Generating fallback JSDoc...');
        console.log('📝 LLMService: Analyzing code snippet for fallback generation...');

        try {
            // Extract function name and basic structure for a more contextual fallback
            const functionMatch = codeSnippet.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=|(\w+)\s*\()/);
            const functionName = functionMatch ? (functionMatch[1] || functionMatch[2] || functionMatch[3]) : 'function';

            // Extract parameters
            const paramMatch = codeSnippet.match(/\(([^)]*)\)/);
            const params = paramMatch ? paramMatch[1].split(',').map(p => p.trim()).filter(p => p) : [];

            // Check if function has a return statement
            const hasReturn = /return\s+/.test(codeSnippet);

            console.log('📊 LLMService: Fallback analysis results:');
            console.log('  - Function name:', functionName);
            console.log('  - Parameters found:', params.length);
            console.log('  - Has return statement:', hasReturn);

            // Build fallback JSDoc
            let fallbackJSDoc = '/**\n';
            fallbackJSDoc += ` * ${functionName} function - Documentation generated automatically\n`;
            fallbackJSDoc += ' * TODO: Add proper description\n';

            // Add parameter documentation
            if (params.length > 0) {
                fallbackJSDoc += ' *\n';
                params.forEach(param => {
                    const paramName = param.split(':')[0].trim(); // Handle TypeScript type annotations
                    fallbackJSDoc += ` * @param ${paramName} TODO: Add parameter description\n`;
                });
            }

            // Add return documentation if function has return statement
            if (hasReturn) {
                fallbackJSDoc += ' *\n';
                fallbackJSDoc += ' * @returns TODO: Add return value description\n';
            }

            fallbackJSDoc += ' */';

            console.log('✅ LLMService: Fallback JSDoc generated successfully');
            console.log('📝 LLMService: Fallback JSDoc preview:', fallbackJSDoc.substring(0, 100) + '...');

            return fallbackJSDoc;
        } catch (error) {
            console.error('❌ LLMService: Error generating fallback JSDoc:', error);
            console.log('🔄 LLMService: Using minimal fallback JSDoc...');

            // Minimal fallback if even the smart fallback fails
            const minimalFallback = '/**\n * Function documentation\n * TODO: Add proper description\n */';
            console.log('✅ LLMService: Minimal fallback JSDoc generated');

            return minimalFallback;
        }
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