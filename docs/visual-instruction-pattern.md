# visualInstruction Pattern

## Overview
The visualInstruction pattern introduces a dual payload contract for MCP tool responses:
- `dataForAI`: Structured data for AI reasoning.
- `visualInstruction` (optional): A UI action + payload dispatched to the Constellation webview panel for immediate visual feedback.

This supports a tight conversational feedback loop where an AI-triggered tool run can update the graph without additional user interaction.

## Interfaces
```
interface VisualInstruction { action: string; payload: Record<string, any>; correlationId?: string; ts?: number; }
interface DualToolResponse<T=any> { dataForAI: T; visualInstruction?: VisualInstruction; }
interface ParsedToolEnvelope<T=any> { kind: 'dual' | 'plain'; rawText: string; dual?: DualToolResponse<T>; parseError?: string; }
```

## Lifecycle
1. MCP tool executes server-side.
2. Server constructs `DualToolResponse` JSON (adds placeholder visualInstruction if needed).
3. Extension provider receives `content[0].text` and calls `handleToolResult`.
4. `parseDualResponse` classifies payload.
5. If instruction present → debounced dispatch ensures only the latest within 50ms window posts.
6. Webview panel is ensured (created + revealed) before posting `{ command: 'visualInstruction', data: { ... } }`.

## Adding a New Tool
1. Generate or collect your analytic data object.
2. Decide if a UI update is needed:
   - Yes: Add a `visualInstruction` with meaningful `action` & payload.
   - No: Omit the field entirely (NOT an empty object).
3. Return JSON string of the dual object in `content[0].text`.

## Error Handling & Resilience
- Malformed JSON falls back to plain mode (no throw).
- Missing `dataForAI` => plain classification.
- Invalid or oversized (`>1MB`) instructions are skipped with WARN log.
- Dispatch exceptions are caught; core tool flow unaffected.

## Debounce & Latest-Only Policy
- 50ms debounce merges bursts; last instruction wins.
- Prevents UI thrash from rapid sequential tool actions.

## Logging Conventions
- All pattern logs prefixed with `[VI]`.
- Routes: `[VI][INFO] Routed action=...` (correlationId included inside message if present).
- Truncation: `dataForAI` preview truncated after 5000 chars with `...<truncated>` suffix.

## Size Guard
- Instructions exceeding 1,048,576 bytes (UTF-8) are skipped.

## Manual Verification Checklist
- Trigger summary tool → panel reveals + placeholder instruction logged.
- Rapid calls (flood test) → single routed instruction.
- Oversized payload test (temporarily enlarge payload) → skipped with WARN.
- Malformed JSON (temp code change) → plain fallback with WARN.
- Large `dataForAI` output → truncated preview log.

## Future Extensions (Deferred)
- Action whitelist inside webview message handler.
- Schema versioning field (`schemaVersion`).
- Accessibility notifications (screen reader cues).
- Telemetry & metrics for routed actions.

## Reference
Implemented in:
- Types: `src/types/visual-instruction.types.ts`
- Provider logic: `src/mcp/mcp.provider.ts`
- Server dual payload example: `src/mcp/mcp-stdio.server.ts`

