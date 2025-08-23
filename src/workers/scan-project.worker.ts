import { parentPort, workerData } from 'worker_threads';
import { cruise } from 'dependency-cruiser';
import { ScanWorkerData, ScanWorkerMessage } from '../types/scanner.types';

const sendMessage = (message: ScanWorkerMessage) => {
  if (parentPort) {
    parentPort.postMessage(message);
  }
};

const executeScan = async (data: ScanWorkerData) => {
  try {
    // Send starting status
    sendMessage({
      type: 'status',
      data: {
        status: 'starting',
        timestamp: new Date().toISOString()
      }
    });

    // Configure dependency-cruiser with baseline settings
    const config = {
      // Exclude common directories that shouldn't be analyzed
      exclude: {
        path: [
          'node_modules',
          'dist',
          'out',
          '.git',
          '.vscode',
          'coverage',
          'build'
        ]
      },
      options: {
        // Don't follow into these directories
        doNotFollow: {
          path: [
            'node_modules',
            'dist',
            'out',
            '.git',
            'coverage',
            'build'
          ]
        },
        // Include common source file extensions
        includeOnly: '\\.(js|jsx|ts|tsx|mjs|cjs)$'
      }
    };

    // CRITICAL FIX: cruise() is async - properly await the result
    const cruiseResult = await cruise([data.targetPath], config);

    // CRITICAL FIX: Validate result structure before accessing properties
    if (!cruiseResult || typeof cruiseResult !== 'object') {
      throw new Error('Invalid result from dependency-cruiser: result is null or not an object');
    }

    // CRITICAL FIX: Check if output property exists and has expected structure
    let output;
    if ('output' in cruiseResult && cruiseResult.output !== undefined) {
      output = cruiseResult.output;
    } else {
      // Some versions of dependency-cruiser might return the data directly
      // Validate that we have a reasonable structure
      if ('modules' in cruiseResult || 'summary' in cruiseResult) {
        output = cruiseResult;
      } else {
        throw new Error('No valid output data from dependency-cruiser: missing output property and no recognizable data structure');
      }
    }

    // Additional validation to ensure we have meaningful data
    if (!output) {
      throw new Error('dependency-cruiser returned empty output');
    }

    // Send results with validated output
    sendMessage({
      type: 'result',
      data: {
        result: output,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    // CRITICAL FIX: Enhanced error handling for invalid API responses
    let errorMessage: string;

    if (error instanceof Error) {
      errorMessage = error.message;

      // Provide more specific error context for common dependency-cruiser issues
      if (error.message.includes('ENOENT')) {
        errorMessage = `File or directory not found: ${error.message}`;
      } else if (error.message.includes('EACCES')) {
        errorMessage = `Permission denied accessing files: ${error.message}`;
      } else if (error.message.includes('Invalid result from dependency-cruiser')) {
        errorMessage = `dependency-cruiser API returned unexpected data structure: ${error.message}`;
      } else if (error.message.includes('No valid output data')) {
        errorMessage = `dependency-cruiser did not return expected output format: ${error.message}`;
      }
    } else {
      errorMessage = `Unknown error type: ${String(error)}`;
    }

    // Send error with enhanced context
    sendMessage({
      type: 'error',
      data: {
        error: errorMessage,
        timestamp: new Date().toISOString()
      }
    });
  }
};

// Execute scan if worker data is provided
if (workerData) {
  executeScan(workerData as ScanWorkerData).catch((error) => {
    sendMessage({
      type: 'error',
      data: {
        error: `Worker execution failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString()
      }
    });
  });
}