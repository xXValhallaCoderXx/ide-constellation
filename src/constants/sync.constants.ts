/**
 * Synchronization feature constants (Two-Way Editor Synchronization)
 * FR5: Debounce interval for active editor change events.
 * FR7: Status bar transient visibility timeout.
 * FR8: Auto-pan animation duration and visibility threshold.
 * FR19: Centralization of magic numbers related to sync feature.
 * 
 * Tooltip timing constants:
 * - TOOLTIP_HOVER_DELAY_MS works in conjunction with SYNC_DEBOUNCE_MS
 * - Tooltip delay (300ms) is longer than sync debounce (200ms) to ensure
 *   editor highlighting completes before tooltips appear, providing smooth UX
 */

/** Debounce interval (ms) for active editor change -> highlight dispatch (FR5) */
export const SYNC_DEBOUNCE_MS = 200;

/** Tooltip hover delay (ms) for graph node tooltips - prevents flicker during rapid mouse movements */
export const TOOLTIP_HOVER_DELAY_MS = 300;

/** Duration (ms) to show transient status bar messages (FR7) */
export const STATUS_BAR_TIMEOUT_MS = 3000;

/** Auto-pan animation duration in ms (FR8) */
export const AUTO_PAN_ANIMATION_MS = 400;

/** Layout change animation duration in ms for graph layout transitions */
export const LAYOUT_ANIMATION_MS = 500;

/** Portion of viewport margin used to decide if node is "off-screen" (FR8) */
export const AUTO_PAN_VISIBILITY_THRESHOLD = 0.25; // 25% inset on each axis

/** Allowed min/max zoom range for auto-pan (FR8) */
export const AUTO_PAN_MIN_ZOOM = 0.5;
export const AUTO_PAN_MAX_ZOOM = 1.2;

/** Basic heuristic zoom choices based on node count (FR8) */
export function computeTargetZoom(nodeCount: number): number {
    if (nodeCount > 500) { return 0.6; }
    if (nodeCount > 100) { return 0.8; }
    return 1.0;
}
