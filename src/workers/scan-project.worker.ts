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
        includeOnly: '\\.(js|jsx|ts|tsx|mjs|cjs)$',
        // Respect .gitignore
        exclude: {
          path: 'node_modules'
        }
      }
    };

    // Execute dependency-cruiser scan
    const result = await cruise([data.targetPath], config);

    // Send results
    sendMessage({
      type: 'result',
      data: { 
        result: result.output,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    // Send error
    sendMessage({
      type: 'error',
      data: { 
        error: error instanceof Error ? error.message : String(error),
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