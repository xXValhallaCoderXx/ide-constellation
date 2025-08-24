// visual-instruction.types.ts
// Task 1.x: Dual payload interfaces for visualInstruction pattern (FR1)

export interface VisualInstruction {
  action: string;                // e.g. 'applyOverlay', 'highlightPath'
  payload: Record<string, any>;  // V1 unstructured payload
  correlationId?: string;        // Optional correlation metadata
  ts?: number;                   // Epoch ms timestamp
}

export interface DualToolResponse<TData = any> {
  dataForAI: TData;              // Structured data meant for AI reasoning layer
  visualInstruction?: VisualInstruction; // Optional visual instruction
}

export interface ParsedToolEnvelope<TData = any> {
  kind: 'dual' | 'plain';
  rawText: string;               // Raw original text content
  dual?: DualToolResponse<TData>; // Present when kind === 'dual'
  parseError?: string;           // Populated if JSON parse failed
}
