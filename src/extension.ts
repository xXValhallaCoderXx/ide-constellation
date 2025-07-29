// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { shouldProcessDocument, DEFAULT_CONFIG } from './documentFilter';
import { processDocument } from './contentProcessor';
import { CodeParserService } from './services/CodeParserService';
import { DocGeneratorService } from './services/DocGeneratorService';
import { CodeSymbol } from './types';

/**
 * Map to track ongoing processing tasks to handle concurrent saves gracefully
 */
const processingTasks = new Map<string, Promise<void>>();

/**
 * Handles document save events with filtering and processing
 * @param document - The saved text document
 */
async function handleDocumentSave(document: vscode.TextDocument): Promise<void> {
	const startTime = Date.now();
	const filePath = document.fileName;
	
	console.log(`HANDLE DOCUMENT SAVE: ${filePath}`);
	
	try {
		// Apply document filtering to determine if we should process this file
		if (shouldProcessDocument(document, DEFAULT_CONFIG)) {
			// Handle concurrent file save events gracefully
			const existingTask = processingTasks.get(filePath);
			if (existingTask) {
				console.log(`File already being processed, waiting for completion: ${filePath}`);
				await existingTask;
				console.log(`Previous processing completed for: ${filePath}`);
			}

			// Process the document with new file-level documentation workflow
			const processingTask = processFileDocumentationAsync(document, startTime);
			processingTasks.set(filePath, processingTask);

			// Clean up the tracking when processing completes
			processingTask.finally(() => {
				processingTasks.delete(filePath);
			});

			// Don't await here to keep file save operations responsive
			// The processing happens in the background
		} else {
			const endTime = Date.now();
			console.log(`File save completed (filtered out): ${filePath} (${endTime - startTime}ms)`);
		}
	} catch (error) {
		// Ensure extension stability by catching all errors in save event processing
		console.error('Error in file save event handler:', error);

		// Provide fallback logging to indicate an error occurred
		try {
			const endTime = Date.now();
			console.log(`File save event error for: ${filePath} (${endTime - startTime}ms)`);
		} catch (fallbackError) {
			console.error('Critical error in save event handler:', fallbackError);
		}
	}
}

/**
 * Processes a document asynchronously with performance logging
 * @param document - The saved text document
 * @param startTime - When the save event started
 */
async function processDocumentAsync(document: vscode.TextDocument, startTime: number): Promise<void> {
	const filePath = document.fileName;
	const processingStartTime = Date.now();
	
	try {
		console.log(`Starting background processing: ${filePath}`);
		
		// Process the document (includes structural indexing)
		await processDocument(document);
		
		const endTime = Date.now();
		const totalTime = endTime - startTime;
		const processingTime = endTime - processingStartTime;
		
		console.log(`✅ Processing completed: ${filePath} (total: ${totalTime}ms, processing: ${processingTime}ms)`);
		
	} catch (error) {
		const endTime = Date.now();
		const totalTime = endTime - startTime;
		const processingTime = endTime - processingStartTime;
		
		console.error(`❌ Processing failed: ${filePath} (total: ${totalTime}ms, processing: ${processingTime}ms)`, error);
		
		// Don't rethrow - we want background processing errors to be logged but not crash the extension
	}
}

/**
 * Processes a document for file-level documentation generation
 * @param document - The saved text document
 * @param startTime - When the save event started
 */
async function processFileDocumentationAsync(document: vscode.TextDocument, startTime: number): Promise<void> {
	const filePath = document.fileName;
	const processingStartTime = Date.now();

	try {
		console.log(`📝 Starting file-level documentation processing: ${filePath}`);

		// Continue with existing structural indexing for backward compatibility
		await processDocument(document);

		// Parse entire file and extract all symbols using CodeParserService
		const codeParserService = new CodeParserService();
		const fileExtension = path.extname(filePath);
		const sourceContent = document.getText();

		console.log(`🔍 Parsing symbols from ${filePath} (${sourceContent.length} characters)`);
		const allSymbols = codeParserService.parseCode(sourceContent, filePath, fileExtension);
		console.log(`📊 Extracted ${allSymbols.length} symbols from ${filePath}`);

		// Implement symbol classification to separate documented from undocumented symbols
		const { documentedSymbols, undocumentedSymbols } = classifySymbols(allSymbols);
		console.log(`📋 Symbol classification: ${documentedSymbols.length} documented, ${undocumentedSymbols.length} undocumented`);

		// Create documentation directory structure (/docs/api/) if it doesn't exist
		const docGeneratorService = new DocGeneratorService();
		await docGeneratorService.ensureDocsDirectory();

		// Generate and write file-level documentation
		const markdownContent = docGeneratorService.generateFileDoc(filePath, allSymbols);
		await docGeneratorService.writeDocumentationFile(filePath, markdownContent);

		const endTime = Date.now();
		const totalTime = endTime - startTime;
		const processingTime = endTime - processingStartTime;

		console.log(`✅ File-level documentation completed: ${filePath} (total: ${totalTime}ms, processing: ${processingTime}ms)`);

	} catch (error) {
		const endTime = Date.now();
		const totalTime = endTime - startTime;
		const processingTime = endTime - processingStartTime;

		console.error(`❌ File-level documentation failed: ${filePath} (total: ${totalTime}ms, processing: ${processingTime}ms)`, error);

		// Don't rethrow - we want background processing errors to be logged but not crash the extension
	}
}

/**
 * Classifies symbols into documented and undocumented categories
 * @param symbols - Array of code symbols to classify
 * @returns Object containing arrays of documented and undocumented symbols
 */
function classifySymbols(symbols: CodeSymbol[]): { documentedSymbols: CodeSymbol[]; undocumentedSymbols: CodeSymbol[] } {
	const documentedSymbols: CodeSymbol[] = [];
	const undocumentedSymbols: CodeSymbol[] = [];

	symbols.forEach(symbol => {
		// A symbol is considered documented if it has JSDoc documentation
		if (symbol.documentation && symbol.documentation.trim().length > 0) {
			documentedSymbols.push(symbol);
		} else {
			undocumentedSymbols.push(symbol);
		}
	});

	return { documentedSymbols, undocumentedSymbols };
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Load environment variables from .env file
	try {
		// Try multiple paths to find the .env file

		// Possible .env file locations
		const envPaths = [
			'.env',  // Current working directory
			path.join(__dirname, '..', '.env'),  // Parent of out directory
			path.join(__dirname, '..', '..', '.env'),  // Workspace root
			path.join(context.extensionPath, '.env')  // Extension path
		];

		let envLoaded = false;
		for (const envPath of envPaths) {
			try {
				if (fs.existsSync(envPath)) {
					dotenv.config({ path: envPath });
					console.log(`Environment variables loaded successfully from: ${envPath}`);
					envLoaded = true;
					break;
				}
			} catch (pathError) {
				console.log(`Failed to load from ${envPath}:`, pathError);
			}
		}

		if (!envLoaded) {
			console.warn('No .env file found in any of the expected locations');
			console.log('Searched paths:', envPaths);
		}

		// Log environment status for debugging
		console.log(`OPENROUTER_API_KEY present: ${!!process.env.OPENROUTER_API_KEY}`);
		if (process.env.OPENROUTER_API_KEY) {
			console.log(`OPENROUTER_API_KEY length: ${process.env.OPENROUTER_API_KEY.length}`);
		}

	} catch (error) {
		console.error('Failed to load environment variables:', error);
		vscode.window.showWarningMessage('Failed to load environment configuration. Some features may not work properly.');
	}

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Kiro Constellation extension activated!');

	// Show a welcome message
	vscode.window.showInformationMessage('Kiro Constellation extension activated!');

	// Register file save event listener
	const saveListener = vscode.workspace.onDidSaveTextDocument(handleDocumentSave);

	// Add the save listener to context subscriptions for proper disposal
	context.subscriptions.push(saveListener);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('kiro-constellation.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from kiro-constellation!');
	});

	context.subscriptions.push(disposable);

	// Register the LLM connection test command
	const testLlmConnectionCommand = vscode.commands.registerCommand('constellation.testLlmConnection', async () => {
		const startTime = Date.now();
		console.log('🔄 Starting LLM connection test...');

		try {
			// Log environment check
			const hasApiKey = !!process.env.OPENROUTER_API_KEY;
			console.log(`Environment check - API key present: ${hasApiKey}`);

			if (!hasApiKey) {
				console.log('❌ API key not found in environment variables');
			}

			// Dynamically import and instantiate LLMService
			console.log('📡 Initializing LLM service...');
			const { LLMService } = await import('./services/LLMService');
			const llmService = new LLMService();

			console.log('🌐 Making API request to OpenRouter...');
			const response = await llmService.testConnection();

			const endTime = Date.now();
			const duration = endTime - startTime;

			// Show success message with API response
			vscode.window.showInformationMessage(`✅ LLM Connection Test Successful: ${response}`);
			console.log(`✅ LLM connection test completed successfully in ${duration}ms`);
			console.log(`API Response: "${response}"`);

		} catch (error) {
			const endTime = Date.now();
			const duration = endTime - startTime;

			// Handle different types of errors with specific user feedback
			let userMessage = 'LLM Connection Test Failed';
			let errorDetails = '';

			if (error instanceof Error) {
				errorDetails = error.message;

				// Provide more specific user guidance based on error type
				if (error.message.includes('OPENROUTER_API_KEY')) {
					userMessage = '🔑 Configuration Error: Missing API Key';
					console.log('❌ Configuration error detected - missing API key');
				} else if (error.message.includes('Authentication failed') || error.message.includes('Invalid API key')) {
					userMessage = '🔐 Authentication Error: Invalid API Key';
					console.log('❌ Authentication error detected - invalid API key');
				} else if (error.message.includes('Network error') || error.message.includes('Unable to connect')) {
					userMessage = '🌐 Network Error: Connection Failed';
					console.log('❌ Network error detected - connection failed');
				} else if (error.message.includes('Rate limit')) {
					userMessage = '⏱️ Rate Limit Error: Too Many Requests';
					console.log('❌ Rate limit error detected');
				} else if (error.message.includes('server error') || error.message.includes('service unavailable')) {
					userMessage = '🔧 Service Error: API Temporarily Unavailable';
					console.log('❌ Service error detected - API unavailable');
				} else {
					userMessage = '❌ API Error: Request Failed';
					console.log('❌ General API error detected');
				}
			} else {
				errorDetails = 'Unknown error occurred';
				console.log('❌ Unknown error type detected');
			}

			// Display error message to user
			vscode.window.showErrorMessage(`${userMessage}: ${errorDetails}`);

			// Comprehensive error logging for debugging
			console.error(`❌ LLM Connection Test failed after ${duration}ms`);
			console.error('Error details:', error);
			console.error('Error type:', typeof error);
			console.error('Error constructor:', error?.constructor?.name);

			// Log environment state for debugging
			console.log('🔍 Debug info:');
			console.log(`  - API key configured: ${!!process.env.OPENROUTER_API_KEY}`);
			console.log(`  - API key length: ${process.env.OPENROUTER_API_KEY?.length || 0}`);
			console.log(`  - Test duration: ${duration}ms`);
		}
	});

	context.subscriptions.push(testLlmConnectionCommand);

	// Register the docstring generation test command
	const testDocstringGenerationCommand = vscode.commands.registerCommand('constellation.testDocstringGeneration', async () => {
		const startTime = Date.now();
		console.log('🔄 Starting docstring generation test...');

		// Define testFunction constant with multi-line calculateAge function implementation including edge case logic
		const testFunction = `function calculateAge(birthDate: Date, currentDate?: Date): number {
    // Use current date if not provided
    const today = currentDate || new Date();
    
    // Validate input parameters
    if (!(birthDate instanceof Date) || isNaN(birthDate.getTime())) {
        throw new Error('Invalid birth date provided');
    }
    
    if (!(today instanceof Date) || isNaN(today.getTime())) {
        throw new Error('Invalid current date provided');
    }
    
    // Check if birth date is in the future
    if (birthDate > today) {
        throw new Error('Birth date cannot be in the future');
    }
    
    // Calculate age in years
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    
    // Adjust age if birthday hasn't occurred this year yet
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    // Handle edge case where calculated age is negative (shouldn't happen with validation above)
    if (age < 0) {
        throw new Error('Calculated age cannot be negative');
    }
    
    return age;
}`;

		try {
			// Log environment check
			const hasApiKey = !!process.env.OPENROUTER_API_KEY;
			console.log(`Environment check - API key present: ${hasApiKey}`);

			if (!hasApiKey) {
				console.log('❌ API key not found in environment variables');
				vscode.window.showErrorMessage('🔑 Configuration Error: Missing API Key. Please check your .env file.');
				return;
			}

			// Dynamically import and instantiate LLMService
			console.log('📡 Initializing LLM service...');
			const { LLMService } = await import('./services/LLMService');
			const llmService = new LLMService();

			console.log('🔧 Calling generateDocstring with test function...');
			console.log('📝 Test function preview:', testFunction.substring(0, 100) + '...');

			// Implement proper async/await handling for API call
			const generatedJSDoc = await llmService.generateDocstring(testFunction);

			const endTime = Date.now();
			const duration = endTime - startTime;

			// Log the generated JSDoc comment to Debug Console
			console.log(`✅ Docstring generation test completed successfully in ${duration}ms`);
			console.log(`Generated JSDoc:`);
			console.log(generatedJSDoc);

			// Show success message to user with truncated JSDoc for readability
			const truncatedJSDoc = generatedJSDoc.length > 100
				? generatedJSDoc.substring(0, 100) + '...'
				: generatedJSDoc;
			vscode.window.showInformationMessage(`✅ Docstring Generation Test Successful! Check Debug Console for full output. Preview: ${truncatedJSDoc}`);

		} catch (error) {
			const endTime = Date.now();
			const duration = endTime - startTime;

			// Add error handling and user feedback messages for command execution success/failure
			let userMessage = 'Docstring Generation Test Failed';
			let errorDetails = '';

			if (error instanceof Error) {
				errorDetails = error.message;

				// Provide more specific user guidance based on error type
				if (error.message.includes('OPENROUTER_API_KEY')) {
					userMessage = '🔑 Configuration Error: Missing API Key';
					console.log('❌ Configuration error detected - missing API key');
				} else if (error.message.includes('Authentication failed') || error.message.includes('Invalid API key')) {
					userMessage = '🔐 Authentication Error: Invalid API Key';
					console.log('❌ Authentication error detected - invalid API key');
				} else if (error.message.includes('Network error') || error.message.includes('Unable to connect')) {
					userMessage = '🌐 Network Error: Connection Failed';
					console.log('❌ Network error detected - connection failed');
				} else if (error.message.includes('Rate limit')) {
					userMessage = '⏱️ Rate Limit Error: Too Many Requests';
					console.log('❌ Rate limit error detected');
				} else if (error.message.includes('server error') || error.message.includes('service unavailable')) {
					userMessage = '🔧 Service Error: API Temporarily Unavailable';
					console.log('❌ Service error detected - API unavailable');
				} else {
					userMessage = '❌ Generation Error: Request Failed';
					console.log('❌ General generation error detected');
				}
			} else {
				errorDetails = 'Unknown error occurred';
				console.log('❌ Unknown error type detected');
			}

			// Display error message to user
			vscode.window.showErrorMessage(`${userMessage}: ${errorDetails}`);

			// Comprehensive error logging for debugging
			console.error(`❌ Docstring Generation Test failed after ${duration}ms`);
			console.error('Error details:', error);
			console.error('Error type:', typeof error);
			console.error('Error constructor:', error?.constructor?.name);

			// Log environment state for debugging
			console.log('🔍 Debug info:');
			console.log(`  - API key configured: ${!!process.env.OPENROUTER_API_KEY}`);
			console.log(`  - API key length: ${process.env.OPENROUTER_API_KEY?.length || 0}`);
			console.log(`  - Test duration: ${duration}ms`);
			console.log(`  - Test function length: ${testFunction.length} characters`);
		}
	});

	context.subscriptions.push(testDocstringGenerationCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('Kiro Constellation extension deactivated');
}
