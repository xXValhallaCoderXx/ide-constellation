/**
 * Development-time overlay diagnostics logger (Milestone 2 - Tasks 6.1–6.4).
 * Gated by NODE_ENV production check to avoid noisy logs in packaged builds.
 * Events:
 *  - apply: overlay added/updated
 *  - clear: overlay removed
 *  - compose: composition summary after overlays applied
 */
export type OverlayLogEvent = 'apply' | 'clear' | 'compose';

interface OverlayLogMeta {
  id?: string;
  kind?: string;
  correlationId?: string;
  remaining?: number; // remaining overlays after clear
  nodes?: number; // composed node count
  edges?: number; // composed edge count
  overlaysSize?: number; // overlay map size
  note?: string; // freeform
  deps?: number; // impact dependencies count
  dependents?: number; // impact dependents count
  visible?: number; // impact total visible count
  reason?: string; // reason for clear (user, graphRefresh)
}

export function logOverlay(event: OverlayLogEvent, meta: OverlayLogMeta = {}): void {
  // Guard: only log in non-production (bundler will tree-shake if env inlines)
  const isProd = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production';
  if (isProd) { return; }
  const ts = new Date().toISOString();
  const parts: string[] = [
    `[${ts}]`,
    '[overlay]',
    `event=${event}`
  ];
  if (meta.id) { parts.push(`id=${meta.id}`); }
  if (meta.kind) { parts.push(`kind=${meta.kind}`); }
  if (meta.correlationId) { parts.push(`corr=${meta.correlationId}`); }
  if (typeof meta.remaining === 'number') { parts.push(`remaining=${meta.remaining}`); }
  if (typeof meta.nodes === 'number') { parts.push(`nodes=${meta.nodes}`); }
  if (typeof meta.edges === 'number') { parts.push(`edges=${meta.edges}`); }
  if (typeof meta.overlaysSize === 'number') { parts.push(`overlays=${meta.overlaysSize}`); }
  if (typeof meta.deps === 'number') { parts.push(`deps=${meta.deps}`); }
  if (typeof meta.dependents === 'number') { parts.push(`dependents=${meta.dependents}`); }
  if (typeof meta.visible === 'number') { parts.push(`visible=${meta.visible}`); }
  if (meta.reason) { parts.push(`reason=${meta.reason}`); }
  if (meta.note) { parts.push(`note=${meta.note}`); }
  console.log(parts.join(' '));
}
