"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMService = void 0;
var LLMService = /** @class */ (function () {
    function LLMService() {
        this.baseUrl = 'https://openrouter.ai/api/v1';
        console.log('🔧 LLMService: Initializing service...');
        // Read API key from environment variables
        this.apiKey = process.env.OPENROUTER_API_KEY || '';
        if (!this.apiKey) {
            console.error('❌ LLMService: OPENROUTER_API_KEY environment variable not found');
            console.error('💡 LLMService: Please ensure your .env file contains OPENROUTER_API_KEY=your_api_key_here');
            throw new Error('OPENROUTER_API_KEY environment variable is required');
        }
        console.log('✅ LLMService: API key loaded successfully');
        console.log("\uD83D\uDD11 LLMService: API key length: ".concat(this.apiKey.length, " characters"));
        console.log("\uD83C\uDF10 LLMService: Base URL: ".concat(this.baseUrl));
    }
    /**
     * Generate JSDoc documentation for a given code snippet
     * @param codeSnippet The TypeScript code snippet to generate documentation for
     * @returns Promise<string> The generated JSDoc comment
     */
    LLMService.prototype.generateDocstring = function (codeSnippet) {
        return __awaiter(this, void 0, void 0, function () {
            var systemPrompt, finalPrompt, headers, requestBody, url, response, apiResponseContent, validatedJSDoc, error_1, fallbackJSDoc, fallbackJSDoc;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('🔧 LLMService: Starting JSDoc generation process...');
                        console.log('📝 LLMService: Code snippet length:', codeSnippet.length, 'characters');
                        console.log('📋 LLMService: Code snippet preview:', codeSnippet.substring(0, 100) + (codeSnippet.length > 100 ? '...' : ''));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        console.log('⚙️ LLMService: Building prompt engineering system...');
                        systemPrompt = "You are an expert technical writer specializing in TypeScript and JSDoc documentation. Your task is to analyze the provided TypeScript code and generate comprehensive, accurate JSDoc comments.\n\nRequirements for your JSDoc output:\n- Start with /** and end with */\n- Include a clear, concise description of the function's purpose\n- Document all parameters using @param tags with types and descriptions\n- Document the return value using @returns tag with type and description\n- Use proper JSDoc syntax and formatting\n- Be thorough but concise in descriptions\n- Focus on what the function does, not how it does it\n- Include edge cases or important behavior notes when relevant\n\nRespond with ONLY the JSDoc comment block. Do not include the original code or any additional text.";
                        console.log('📝 LLMService: System prompt created successfully');
                        console.log('📏 LLMService: System prompt length:', systemPrompt.length, 'characters');
                        finalPrompt = "".concat(systemPrompt, "\n\nHere is the TypeScript code to document:\n\n```typescript\n").concat(codeSnippet, "\n```");
                        console.log('🔧 LLMService: Final prompt constructed successfully');
                        console.log('📏 LLMService: Final prompt length:', finalPrompt.length, 'characters');
                        console.log('📋 LLMService: Final prompt preview:', finalPrompt.substring(0, 200) + (finalPrompt.length > 200 ? '...' : ''));
                        // Implement API request construction using existing buildRequestHeaders method
                        console.log('🔧 LLMService: Building API request...');
                        headers = this.buildRequestHeaders();
                        requestBody = {
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
                        url = "".concat(this.baseUrl, "/chat/completions");
                        console.log("\uD83C\uDF10 LLMService: Making POST request to ".concat(url));
                        return [4 /*yield*/, fetch(url, {
                                method: 'POST',
                                headers: headers,
                                body: JSON.stringify(requestBody)
                            })];
                    case 2:
                        response = _a.sent();
                        console.log("\uD83D\uDCE1 LLMService: Received response with status ".concat(response.status, " ").concat(response.statusText));
                        return [4 /*yield*/, this.parseResponse(response)];
                    case 3:
                        apiResponseContent = _a.sent();
                        console.log('✅ LLMService: Successfully generated JSDoc from API');
                        console.log('💬 LLMService: Generated JSDoc:', apiResponseContent);
                        validatedJSDoc = this.validateAndProcessJSDocResponse(apiResponseContent, codeSnippet);
                        console.log('🔍 LLMService: JSDoc validation completed successfully');
                        console.log('📝 LLMService: Final validated JSDoc:', validatedJSDoc);
                        return [2 /*return*/, validatedJSDoc];
                    case 4:
                        error_1 = _a.sent();
                        console.error('❌ LLMService: Error during JSDoc generation:', error_1);
                        // Enhanced error handling with fallback JSDoc generation
                        if (error_1 instanceof Error) {
                            console.error('⚠️ LLMService: Known error type:', error_1.constructor.name);
                            console.error('📋 LLMService: Error message:', error_1.message);
                            // Generate fallback JSDoc for API failures
                            console.log('🔄 LLMService: Generating fallback JSDoc due to error...');
                            fallbackJSDoc = this.generateFallbackJSDoc(codeSnippet);
                            console.log('✅ LLMService: Fallback JSDoc generated successfully');
                            console.log('📝 LLMService: Fallback JSDoc:', fallbackJSDoc);
                            return [2 /*return*/, fallbackJSDoc];
                        }
                        else {
                            console.error('❓ LLMService: Unknown error type:', typeof error_1);
                            console.error('📋 LLMService: Error details:', String(error_1));
                            // Generate fallback JSDoc for unknown errors
                            console.log('🔄 LLMService: Generating fallback JSDoc due to unknown error...');
                            fallbackJSDoc = this.generateFallbackJSDoc(codeSnippet);
                            console.log('✅ LLMService: Fallback JSDoc generated successfully');
                            return [2 /*return*/, fallbackJSDoc];
                        }
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Test the connection to OpenRouter API
     * @returns Promise<string> The response content from the API
     */
    LLMService.prototype.testConnection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var headers, body, url, response, result, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('🔧 LLMService: Building request headers and body...');
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        headers = this.buildRequestHeaders();
                        body = this.buildRequestBody();
                        url = "".concat(this.baseUrl, "/chat/completions");
                        console.log("\uD83C\uDF10 LLMService: Making POST request to ".concat(url));
                        console.log('📋 LLMService: Request model:', body.model);
                        console.log('💬 LLMService: Request message:', body.messages[0].content);
                        return [4 /*yield*/, fetch(url, {
                                method: 'POST',
                                headers: headers,
                                body: JSON.stringify(body)
                            })];
                    case 2:
                        response = _a.sent();
                        console.log("\uD83D\uDCE1 LLMService: Received response with status ".concat(response.status, " ").concat(response.statusText));
                        return [4 /*yield*/, this.parseResponse(response)];
                    case 3:
                        result = _a.sent();
                        console.log('✅ LLMService: Successfully parsed response');
                        return [2 /*return*/, result];
                    case 4:
                        error_2 = _a.sent();
                        console.error('❌ LLMService: Error during API connection test:', error_2);
                        // Handle different types of errors with enhanced logging
                        if (error_2 instanceof TypeError) {
                            // Network errors (DNS, connection refused, etc.)
                            console.error('🌐 LLMService: Network error detected:', error_2.message);
                            throw new Error("Network error: Unable to connect to OpenRouter API. Please check your internet connection. Details: ".concat(error_2.message));
                        }
                        else if (error_2 instanceof Error) {
                            // Re-throw known errors (from parseResponse or other sources)
                            console.error('⚠️ LLMService: Known error type:', error_2.constructor.name);
                            throw error_2;
                        }
                        else {
                            // Unknown error types
                            console.error('❓ LLMService: Unknown error type:', typeof error_2);
                            throw new Error("Unexpected error during API connection test: ".concat(String(error_2)));
                        }
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Parse raw JSDoc string into structured components
     * @param rawString The raw JSDoc comment string to parse
     * @returns ParsedJSDoc Structured JSDoc components
     */
    LLMService.prototype.parseRawDocstring = function (rawString) {
        var _a;
        console.log('🔧 LLMService: Starting JSDoc parsing process...');
        console.log('📝 LLMService: Raw JSDoc length:', rawString.length, 'characters');
        console.log('📋 LLMService: Raw JSDoc preview:', rawString.substring(0, 100) + (rawString.length > 100 ? '...' : ''));
        try {
            // Validate input
            if (!rawString || typeof rawString !== 'string') {
                console.warn('⚠️ LLMService: Invalid input - empty or non-string JSDoc');
                throw new Error('Invalid input: JSDoc string is required');
            }
            // Clean and normalize the JSDoc string
            var cleanedJSDoc = this.cleanJSDocString(rawString);
            console.log('🧹 LLMService: JSDoc cleaned successfully');
            // Extract description
            var description = this.extractDescription(cleanedJSDoc);
            console.log('📝 LLMService: Description extracted:', description.substring(0, 50) + (description.length > 50 ? '...' : ''));
            // Extract parameters
            var params = this.extractParameters(cleanedJSDoc);
            console.log('📋 LLMService: Parameters extracted:', params.length, 'parameters');
            // Extract return information
            var returns = this.extractReturns(cleanedJSDoc);
            console.log('🔄 LLMService: Returns extracted:', returns ? 'yes' : 'no');
            // Extract examples (optional)
            var examples = this.extractExamples(cleanedJSDoc);
            console.log('📚 LLMService: Examples extracted:', examples.length, 'examples');
            var result = {
                description: description,
                params: params,
                returns: returns,
                examples: examples.length > 0 ? examples : undefined
            };
            console.log('✅ LLMService: JSDoc parsing completed successfully');
            console.log('📊 LLMService: Parsing results summary:');
            console.log('  - Description length:', result.description.length);
            console.log('  - Parameters count:', result.params.length);
            console.log('  - Has returns:', !!result.returns);
            console.log('  - Examples count:', ((_a = result.examples) === null || _a === void 0 ? void 0 : _a.length) || 0);
            return result;
        }
        catch (error) {
            console.error('❌ LLMService: Error during JSDoc parsing:', error);
            if (error instanceof Error) {
                console.error('⚠️ LLMService: Known error type:', error.constructor.name);
                console.error('📋 LLMService: Error message:', error.message);
                // Re-throw validation errors
                if (error.message.includes('Invalid input')) {
                    throw error;
                }
            }
            // For parsing errors, return a minimal valid structure
            console.log('🔄 LLMService: Generating fallback parsed JSDoc due to error...');
            var fallbackResult = {
                description: 'Documentation parsing failed - manual review required',
                params: [],
                returns: undefined,
                examples: undefined
            };
            console.log('✅ LLMService: Fallback parsed JSDoc generated');
            return fallbackResult;
        }
    };
    /**
     * Clean and normalize JSDoc string for parsing
     * @param rawJSDoc Raw JSDoc string
     * @returns string Cleaned JSDoc content
     */
    LLMService.prototype.cleanJSDocString = function (rawJSDoc) {
        console.log('🧹 LLMService: Cleaning JSDoc string...');
        // Remove /** and */ markers
        var cleaned = rawJSDoc.replace(/^\/\*\*/, '').replace(/\*\/$/, '');
        // Split into lines and clean each line
        var lines = cleaned.split('\n').map(function (line) {
            // Remove leading asterisks and whitespace
            return line.replace(/^\s*\*\s?/, '').trim();
        }).filter(function (line) { return line.length > 0; }); // Remove empty lines
        // Join back into a single string
        var result = lines.join('\n');
        console.log('✅ LLMService: JSDoc string cleaned');
        console.log('📏 LLMService: Original length:', rawJSDoc.length, '-> Cleaned length:', result.length);
        return result;
    };
    /**
     * Extract description from cleaned JSDoc content
     * @param cleanedJSDoc Cleaned JSDoc content
     * @returns string The extracted description
     */
    LLMService.prototype.extractDescription = function (cleanedJSDoc) {
        console.log('📝 LLMService: Extracting description...');
        // Split content by lines
        var lines = cleanedJSDoc.split('\n');
        var descriptionLines = [];
        // Collect lines until we hit the first @tag
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var line = lines_1[_i];
            if (line.startsWith('@')) {
                break;
            }
            descriptionLines.push(line);
        }
        // Join description lines and clean up
        var description = descriptionLines.join(' ').trim();
        console.log('📝 LLMService: Description extraction completed');
        console.log('📏 LLMService: Description length:', description.length);
        return description || 'No description provided';
    };
    /**
     * Extract parameter information from JSDoc content
     * @param cleanedJSDoc Cleaned JSDoc content
     * @returns Array of parameter objects
     */
    LLMService.prototype.extractParameters = function (cleanedJSDoc) {
        console.log('📋 LLMService: Extracting parameters...');
        var params = [];
        var lines = cleanedJSDoc.split('\n');
        for (var _i = 0, lines_2 = lines; _i < lines_2.length; _i++) {
            var line = lines_2[_i];
            // Match @param patterns: @param {type} name description or @param name description
            var paramWithTypeMatch = line.match(/^@param\s+\{([^}]+)\}\s+(\w+)\s*(.*)/);
            var paramWithoutTypeMatch = line.match(/^@param\s+(\w+)\s*(.*)/);
            if (paramWithTypeMatch) {
                var type = paramWithTypeMatch[1], name_1 = paramWithTypeMatch[2], description = paramWithTypeMatch[3];
                params.push({
                    name: name_1.trim(),
                    type: type.trim(),
                    description: description.trim() || 'No description provided'
                });
                console.log('📋 LLMService: Found parameter with type:', name_1, ':', type);
            }
            else if (paramWithoutTypeMatch) {
                var name_2 = paramWithoutTypeMatch[1], description = paramWithoutTypeMatch[2];
                params.push({
                    name: name_2.trim(),
                    description: description.trim() || 'No description provided'
                });
                console.log('📋 LLMService: Found parameter without type:', name_2);
            }
        }
        console.log('✅ LLMService: Parameter extraction completed, found', params.length, 'parameters');
        return params;
    };
    /**
     * Extract return information from JSDoc content
     * @param cleanedJSDoc Cleaned JSDoc content
     * @returns Return object or undefined
     */
    LLMService.prototype.extractReturns = function (cleanedJSDoc) {
        console.log('🔄 LLMService: Extracting return information...');
        var lines = cleanedJSDoc.split('\n');
        for (var _i = 0, lines_3 = lines; _i < lines_3.length; _i++) {
            var line = lines_3[_i];
            // Match @returns or @return patterns: @returns {type} description or @returns description
            var returnsWithTypeMatch = line.match(/^@returns?\s+\{([^}]+)\}\s*(.*)/);
            var returnsWithoutTypeMatch = line.match(/^@returns?\s+(.*)/);
            if (returnsWithTypeMatch) {
                var type = returnsWithTypeMatch[1], description = returnsWithTypeMatch[2];
                console.log('🔄 LLMService: Found return with type:', type);
                return {
                    type: type.trim(),
                    description: description.trim() || 'No description provided'
                };
            }
            else if (returnsWithoutTypeMatch) {
                var description = returnsWithoutTypeMatch[1];
                console.log('🔄 LLMService: Found return without type');
                return {
                    description: description.trim() || 'No description provided'
                };
            }
        }
        console.log('🔄 LLMService: No return information found');
        return undefined;
    };
    /**
     * Extract example code from JSDoc content
     * @param cleanedJSDoc Cleaned JSDoc content
     * @returns Array of example strings
     */
    LLMService.prototype.extractExamples = function (cleanedJSDoc) {
        console.log('📚 LLMService: Extracting examples...');
        var examples = [];
        var lines = cleanedJSDoc.split('\n');
        var inExample = false;
        var currentExample = [];
        for (var _i = 0, lines_4 = lines; _i < lines_4.length; _i++) {
            var line = lines_4[_i];
            if (line.startsWith('@example')) {
                // Start of a new example
                if (inExample && currentExample.length > 0) {
                    // Save previous example
                    examples.push(currentExample.join('\n').trim());
                }
                inExample = true;
                currentExample = [];
                // Check if there's content on the same line as @example
                var exampleContent = line.replace(/^@example\s*/, '');
                if (exampleContent) {
                    currentExample.push(exampleContent);
                }
                console.log('📚 LLMService: Found @example tag');
            }
            else if (inExample) {
                if (line.startsWith('@')) {
                    // End of example, start of new tag
                    if (currentExample.length > 0) {
                        examples.push(currentExample.join('\n').trim());
                        currentExample = [];
                    }
                    inExample = false;
                }
                else {
                    // Continue collecting example content
                    currentExample.push(line);
                }
            }
        }
        // Don't forget the last example if we were still in one
        if (inExample && currentExample.length > 0) {
            examples.push(currentExample.join('\n').trim());
        }
        console.log('✅ LLMService: Example extraction completed, found', examples.length, 'examples');
        return examples;
    };
    /**
     * Build request headers with authorization
     * @returns Record<string, string> Headers object
     */
    LLMService.prototype.buildRequestHeaders = function () {
        console.log('🔧 LLMService: Building request headers...');
        var headers = {
            'Authorization': "Bearer ".concat(this.apiKey),
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/your-repo', // Optional: helps with rate limiting
            'X-Title': 'VS Code Extension' // Optional: helps identify your app
        };
        console.log('✅ LLMService: Headers built successfully');
        console.log('🔑 LLMService: Authorization header configured');
        return headers;
    };
    /**
     * Build minimal test request body
     * @returns OpenRouterRequest Request payload for OpenRouter API
     */
    LLMService.prototype.buildRequestBody = function () {
        console.log('🔧 LLMService: Building request body...');
        var body = {
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
    };
    /**
     * Validate and process JSDoc response from API
     * @param apiResponse The raw response content from the API
     * @param originalCode The original code snippet for context
     * @returns string The validated and processed JSDoc comment
     */
    LLMService.prototype.validateAndProcessJSDocResponse = function (apiResponse, originalCode) {
        console.log('🔍 LLMService: Starting JSDoc response validation...');
        console.log('📝 LLMService: API response length:', apiResponse.length, 'characters');
        console.log('📋 LLMService: API response preview:', apiResponse.substring(0, 200) + (apiResponse.length > 200 ? '...' : ''));
        // Clean up the response (remove extra whitespace, newlines at start/end)
        var cleanedResponse = apiResponse.trim();
        console.log('🧹 LLMService: Response cleaned, new length:', cleanedResponse.length, 'characters');
        // Validate JSDoc format - must start with /** and end with */
        var isValidFormat = this.validateJSDocFormat(cleanedResponse);
        if (!isValidFormat) {
            console.warn('⚠️ LLMService: Invalid JSDoc format detected in API response');
            console.warn('📋 LLMService: Response does not start with /** or end with */');
            console.log('🔄 LLMService: Attempting to fix JSDoc format...');
            var fixedResponse = this.fixJSDocFormat(cleanedResponse);
            console.log('✅ LLMService: JSDoc format fixed successfully');
            return this.validateContentAndFallback(fixedResponse, originalCode);
        }
        // Validate content quality
        return this.validateContentAndFallback(cleanedResponse, originalCode);
    };
    /**
     * Validate JSDoc format (starts with /** and ends with *\/)
     * @param jsdoc The JSDoc string to validate
     * @returns boolean True if format is valid
     */
    LLMService.prototype.validateJSDocFormat = function (jsdoc) {
        console.log('🔍 LLMService: Validating JSDoc format...');
        var startsCorrectly = jsdoc.startsWith('/**');
        var endsCorrectly = jsdoc.endsWith('*/');
        console.log('📋 LLMService: Format validation results:');
        console.log('  - Starts with "/**":', startsCorrectly);
        console.log('  - Ends with "*/":', endsCorrectly);
        var isValid = startsCorrectly && endsCorrectly;
        console.log('✅ LLMService: JSDoc format is', isValid ? 'valid' : 'invalid');
        return isValid;
    };
    /**
     * Attempt to fix JSDoc format by adding missing /** and *\/ markers
     * @param content The content to fix
     * @returns string The content with proper JSDoc format
     */
    LLMService.prototype.fixJSDocFormat = function (content) {
        console.log('🔧 LLMService: Fixing JSDoc format...');
        var fixed = content;
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
    };
    /**
     * Validate JSDoc content quality and provide fallback if needed
     * @param jsdoc The JSDoc to validate
     * @param originalCode The original code for fallback generation
     * @returns string The validated JSDoc or fallback
     */
    LLMService.prototype.validateContentAndFallback = function (jsdoc, originalCode) {
        console.log('🔍 LLMService: Validating JSDoc content quality...');
        var contentValidation = this.validateJSDocContent(jsdoc);
        console.log('📊 LLMService: Content validation results:');
        console.log('  - Has description:', contentValidation.hasDescription);
        console.log('  - Has @param tags:', contentValidation.hasParams);
        console.log('  - Has @returns tag:', contentValidation.hasReturns);
        console.log('  - Overall quality score:', contentValidation.qualityScore, '/ 3');
        // If quality is too low (less than 2 out of 3 criteria), use fallback
        if (contentValidation.qualityScore < 2) {
            console.warn('⚠️ LLMService: JSDoc content quality is too low, using fallback');
            console.warn('📋 LLMService: Missing critical JSDoc elements');
            var fallbackJSDoc = this.generateFallbackJSDoc(originalCode);
            console.log('🔄 LLMService: Generated fallback JSDoc due to low quality');
            return fallbackJSDoc;
        }
        console.log('✅ LLMService: JSDoc content quality is acceptable');
        return jsdoc;
    };
    /**
     * Validate JSDoc content for required elements
     * @param jsdoc The JSDoc string to validate
     * @returns object Validation results with quality metrics
     */
    LLMService.prototype.validateJSDocContent = function (jsdoc) {
        console.log('🔍 LLMService: Analyzing JSDoc content...');
        // Check for function description (content between /** and first @tag or */)
        var hasDescription = this.hasJSDocDescription(jsdoc);
        // Check for @param tags
        var hasParams = /@param\s+\{[^}]*\}\s+\w+/.test(jsdoc) || /@param\s+\w+/.test(jsdoc);
        // Check for @returns or @return tag
        var hasReturns = /@returns?\s+\{[^}]*\}/.test(jsdoc) || /@returns?\s+\w+/.test(jsdoc);
        var qualityScore = (hasDescription ? 1 : 0) + (hasParams ? 1 : 0) + (hasReturns ? 1 : 0);
        console.log('📊 LLMService: Content analysis completed');
        return {
            hasDescription: hasDescription,
            hasParams: hasParams,
            hasReturns: hasReturns,
            qualityScore: qualityScore
        };
    };
    /**
     * Check if JSDoc has a meaningful description
     * @param jsdoc The JSDoc string to check
     * @returns boolean True if description is present
     */
    LLMService.prototype.hasJSDocDescription = function (jsdoc) {
        // Remove the /** and */ markers and extract the first part before any @tags
        var content = jsdoc.replace(/^\/\*\*/, '').replace(/\*\/$/, '');
        var beforeFirstTag = content.split(/@\w+/)[0];
        // Clean up asterisks and whitespace
        var description = beforeFirstTag
            .split('\n')
            .map(function (line) { return line.replace(/^\s*\*\s?/, '').trim(); })
            .join(' ')
            .trim();
        // Consider it a valid description if it has at least 10 characters and some meaningful content
        var hasValidDescription = description.length >= 10 && /\w+.*\w+/.test(description);
        console.log('📝 LLMService: Description analysis:');
        console.log('  - Extracted description:', description.substring(0, 50) + (description.length > 50 ? '...' : ''));
        console.log('  - Description length:', description.length);
        console.log('  - Has valid description:', hasValidDescription);
        return hasValidDescription;
    };
    /**
     * Generate a fallback JSDoc comment when API response is invalid or unavailable
     * @param codeSnippet The original code snippet
     * @returns string A basic but properly formatted JSDoc comment
     */
    LLMService.prototype.generateFallbackJSDoc = function (codeSnippet) {
        console.log('🔄 LLMService: Generating fallback JSDoc...');
        console.log('📝 LLMService: Analyzing code snippet for fallback generation...');
        try {
            // Extract function name and basic structure for a more contextual fallback
            var functionMatch = codeSnippet.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=|(\w+)\s*\()/);
            var functionName = functionMatch ? (functionMatch[1] || functionMatch[2] || functionMatch[3]) : 'function';
            // Extract parameters
            var paramMatch = codeSnippet.match(/\(([^)]*)\)/);
            var params = paramMatch ? paramMatch[1].split(',').map(function (p) { return p.trim(); }).filter(function (p) { return p; }) : [];
            // Check if function has a return statement
            var hasReturn = /return\s+/.test(codeSnippet);
            console.log('📊 LLMService: Fallback analysis results:');
            console.log('  - Function name:', functionName);
            console.log('  - Parameters found:', params.length);
            console.log('  - Has return statement:', hasReturn);
            // Build fallback JSDoc
            var fallbackJSDoc_1 = '/**\n';
            fallbackJSDoc_1 += " * ".concat(functionName, " function - Documentation generated automatically\n");
            fallbackJSDoc_1 += ' * TODO: Add proper description\n';
            // Add parameter documentation
            if (params.length > 0) {
                fallbackJSDoc_1 += ' *\n';
                params.forEach(function (param) {
                    var paramName = param.split(':')[0].trim(); // Handle TypeScript type annotations
                    fallbackJSDoc_1 += " * @param ".concat(paramName, " TODO: Add parameter description\n");
                });
            }
            // Add return documentation if function has return statement
            if (hasReturn) {
                fallbackJSDoc_1 += ' *\n';
                fallbackJSDoc_1 += ' * @returns TODO: Add return value description\n';
            }
            fallbackJSDoc_1 += ' */';
            console.log('✅ LLMService: Fallback JSDoc generated successfully');
            console.log('📝 LLMService: Fallback JSDoc preview:', fallbackJSDoc_1.substring(0, 100) + '...');
            return fallbackJSDoc_1;
        }
        catch (error) {
            console.error('❌ LLMService: Error generating fallback JSDoc:', error);
            console.log('🔄 LLMService: Using minimal fallback JSDoc...');
            // Minimal fallback if even the smart fallback fails
            var minimalFallback = '/**\n * Function documentation\n * TODO: Add proper description\n */';
            console.log('✅ LLMService: Minimal fallback JSDoc generated');
            return minimalFallback;
        }
    };
    /**
     * Parse the API response and extract message content
     * @param response Response object from fetch
     * @returns Promise<string> The extracted message content
     */
    LLMService.prototype.parseResponse = function (response) {
        return __awaiter(this, void 0, void 0, function () {
            var errorMessage, _a, errorData, _b, errorText, _c, data, content, error_3;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        console.log("\uD83D\uDD0D LLMService: Parsing response with status ".concat(response.status));
                        if (!!response.ok) return [3 /*break*/, 15];
                        console.error("\u274C LLMService: API request failed with status ".concat(response.status, " ").concat(response.statusText));
                        errorMessage = "API request failed: ".concat(response.status, " ").concat(response.statusText);
                        _a = response.status;
                        switch (_a) {
                            case 401: return [3 /*break*/, 1];
                            case 403: return [3 /*break*/, 2];
                            case 429: return [3 /*break*/, 3];
                            case 500: return [3 /*break*/, 4];
                            case 502: return [3 /*break*/, 5];
                            case 503: return [3 /*break*/, 5];
                            case 504: return [3 /*break*/, 5];
                        }
                        return [3 /*break*/, 6];
                    case 1:
                        console.error('🔐 LLMService: Authentication error - invalid API key');
                        errorMessage = 'Authentication failed: Invalid API key. Please check your OPENROUTER_API_KEY in the .env file.';
                        return [3 /*break*/, 14];
                    case 2:
                        console.error('🚫 LLMService: Access forbidden - insufficient permissions');
                        errorMessage = 'Access forbidden: Your API key may not have permission to access this endpoint.';
                        return [3 /*break*/, 14];
                    case 3:
                        console.error('⏱️ LLMService: Rate limit exceeded');
                        errorMessage = 'Rate limit exceeded: Too many requests. Please wait before trying again.';
                        return [3 /*break*/, 14];
                    case 4:
                        console.error('🔧 LLMService: Server error - API temporarily unavailable');
                        errorMessage = 'OpenRouter API server error: The service is temporarily unavailable.';
                        return [3 /*break*/, 14];
                    case 5:
                        console.error('🔧 LLMService: Service unavailable - API down');
                        errorMessage = 'OpenRouter API service unavailable: Please try again later.';
                        return [3 /*break*/, 14];
                    case 6:
                        console.error("\u2753 LLMService: Unhandled HTTP status ".concat(response.status));
                        _d.label = 7;
                    case 7:
                        _d.trys.push([7, 9, , 14]);
                        return [4 /*yield*/, response.json()];
                    case 8:
                        errorData = _d.sent();
                        if (errorData.error && errorData.error.message) {
                            console.error('📋 LLMService: API error details:', errorData.error.message);
                            errorMessage += " - ".concat(errorData.error.message);
                        }
                        return [3 /*break*/, 14];
                    case 9:
                        _b = _d.sent();
                        _d.label = 10;
                    case 10:
                        _d.trys.push([10, 12, , 13]);
                        return [4 /*yield*/, response.text()];
                    case 11:
                        errorText = _d.sent();
                        if (errorText) {
                            console.error('📄 LLMService: Error response text:', errorText);
                            errorMessage += " - ".concat(errorText);
                        }
                        return [3 /*break*/, 13];
                    case 12:
                        _c = _d.sent();
                        // If even text parsing fails, use the basic error message
                        console.error('❌ LLMService: Unable to parse error response');
                        return [3 /*break*/, 13];
                    case 13: return [3 /*break*/, 14];
                    case 14: throw new Error(errorMessage);
                    case 15:
                        _d.trys.push([15, 17, , 18]);
                        console.log('📋 LLMService: Parsing successful response JSON...');
                        return [4 /*yield*/, response.json()];
                    case 16:
                        data = _d.sent();
                        console.log('🔍 LLMService: Validating response structure...');
                        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                            console.error('❌ LLMService: Invalid response structure - missing choices or message');
                            console.error('📋 LLMService: Response data:', JSON.stringify(data, null, 2));
                            throw new Error('Invalid response format from OpenRouter API: Missing expected response structure');
                        }
                        content = data.choices[0].message.content;
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
                        return [2 /*return*/, content];
                    case 17:
                        error_3 = _d.sent();
                        console.error('❌ LLMService: Error parsing response:', error_3);
                        if (error_3 instanceof SyntaxError) {
                            console.error('📋 LLMService: JSON parsing error - invalid response format');
                            throw new Error('Invalid JSON response from OpenRouter API: Unable to parse response');
                        }
                        else if (error_3 instanceof Error) {
                            console.error('⚠️ LLMService: Known error during parsing:', error_3.message);
                            throw error_3;
                        }
                        else {
                            console.error('❓ LLMService: Unknown error during parsing:', typeof error_3);
                            throw new Error('Unexpected error while parsing OpenRouter API response');
                        }
                        return [3 /*break*/, 18];
                    case 18: return [2 /*return*/];
                }
            });
        });
    };
    return LLMService;
}());
exports.LLMService = LLMService;
