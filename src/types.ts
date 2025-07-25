/**
 * Core data types for the structural indexing system
 */

export interface CodeSymbol {
  id: string;           // Unique identifier: "filePath#symbolName"
  name: string;         // Symbol name
  kind: 'function' | 'class' | 'method' | 'variable';
  filePath: string;     // Relative path from workspace root
  position: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  docstring: string | null; // JSDoc/docstring content
}

export interface Manifest {
  [filePath: string]: CodeSymbol[];
}