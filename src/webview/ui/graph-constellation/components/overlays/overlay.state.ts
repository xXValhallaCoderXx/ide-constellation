import { BaseOverlay, OverlayData } from './overlay.types';

export type OverlayState = Map<string, OverlayData>;

/**
 * Apply (insert or update) an overlay. Preserves original createdAt on update.
 * Returns a new Map instance to preserve React state immutability patterns.
 */
export function applyOverlay(state: OverlayState, overlay: OverlayData): OverlayState {
  const next = new Map(state);
  const existing = next.get(overlay.id) as OverlayData | undefined;
  if (existing) {
    // Preserve createdAt, update updatedAt
    const merged: OverlayData = { ...overlay, createdAt: existing.createdAt, updatedAt: new Date().toISOString() } as OverlayData;
    next.set(overlay.id, merged);
  } else {
    // Ensure updatedAt not stale (caller typically sets both the same initially)
    const now = new Date().toISOString();
    const applied: OverlayData = { ...overlay, createdAt: overlay.createdAt || now, updatedAt: now } as OverlayData;
    next.set(overlay.id, applied);
  }
  return next;
}

/** Remove overlay by id, returning new Map (or original if not present). */
export function clearOverlay(state: OverlayState, id: string): OverlayState {
  if (!state.has(id)) {
    return state; // no change path
  }
  const next = new Map(state);
  next.delete(id);
  return next;
}

/** Retrieve overlay without modifying state */
export function getOverlay<T extends OverlayData = OverlayData>(state: OverlayState, id: string): T | undefined {
  return state.get(id) as T | undefined;
}

/** Initialize empty overlay state */
export function createOverlayState(): OverlayState {
  return new Map();
}
