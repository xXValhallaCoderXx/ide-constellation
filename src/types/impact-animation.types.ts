/**
 * Type definitions for impact analysis visual animations
 * Extends the existing visual instruction system for impact-specific animations
 */

import { VisualInstruction } from './visual-instruction.types';
import { ImpactLevel, ChangeType } from '../services/impact-analyzer/impact-types';

/**
 * Visual instruction for impact analysis animation
 */
export interface ImpactAnimationInstruction extends VisualInstruction {
    action: 'applyImpactAnimation';
    payload: ImpactAnimationPayload;
}

/**
 * Payload for impact animation visual instruction
 */
export interface ImpactAnimationPayload {
    /** The target node where the change originates */
    targetNode: string;
    /** All nodes that will be animated with impact effects */
    impactedNodes: AnimatedNode[];
    /** Animation timing and style configuration */
    animationConfig: AnimationConfig;
    /** Risk score to display (0-10) */
    riskScore: number;
    /** Type of change being analyzed */
    changeType: ChangeType;
    /** Summary statistics for display */
    summary: {
        totalFiles: number;
        criticalFiles: number;
        highRiskFiles: number;
        mediumRiskFiles: number;
        lowRiskFiles: number;
    };
}

/**
 * Configuration for animation timing and effects
 */
export interface AnimationConfig {
    /** Total duration of the ripple effect in milliseconds */
    duration: number;
    /** Delay between each "wave" of the ripple effect */
    staggerDelay: number;
    /** CSS easing function for animations */
    easing: string;
    /** Whether to show ripple circles expanding from target */
    showRipples: boolean;
    /** Whether to pulse nodes during animation */
    pulseNodes: boolean;
}

/**
 * Individual node animation data
 */
export interface AnimatedNode {
    /** Node ID (workspace-relative path) */
    nodeId: string;
    /** Impact level determines color and animation intensity */
    impactLevel: ImpactLevel;
    /** Distance from target node (number of hops) */
    distance: number;
    /** Animation delay in milliseconds (calculated from distance) */
    delay: number;
    /** Color for the node during animation */
    color: string;
    /** Animation duration for this specific node */
    nodeDuration: number;
    /** Whether this node should pulse during animation */
    shouldPulse: boolean;
}

/**
 * Animation state for tracking progress
 */
export interface AnimationState {
    /** Whether animation is currently running */
    isRunning: boolean;
    /** Current animation phase */
    phase: AnimationPhase;
    /** Nodes currently being animated */
    activeNodes: Set<string>;
    /** Animation start timestamp */
    startTime: number;
    /** Cleanup functions for active animations */
    cleanupFunctions: (() => void)[];
}

/**
 * Phases of the impact animation
 */
export enum AnimationPhase {
    IDLE = 'idle',
    STARTING = 'starting',
    RIPPLE_EFFECT = 'ripple_effect',
    NODE_HIGHLIGHTING = 'node_highlighting',
    CLEANUP = 'cleanup',
    COMPLETE = 'complete'
}

/**
 * Animation timing constants
 */
export const ANIMATION_TIMING = {
    /** Base delay between distance levels (100ms, 200ms, 300ms) */
    BASE_STAGGER_DELAY: 100,
    /** Default animation duration */
    DEFAULT_DURATION: 1000,
    /** Default easing function */
    DEFAULT_EASING: 'ease-out',
    /** Maximum number of nodes to animate (performance limit) */
    MAX_ANIMATED_NODES: 100,
    /** Pulse duration for individual nodes */
    PULSE_DURATION: 300,
    /** Ripple circle expansion duration */
    RIPPLE_DURATION: 800
} as const;

/**
 * Default animation configuration
 */
export const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
    duration: ANIMATION_TIMING.DEFAULT_DURATION,
    staggerDelay: ANIMATION_TIMING.BASE_STAGGER_DELAY,
    easing: ANIMATION_TIMING.DEFAULT_EASING,
    showRipples: true,
    pulseNodes: true
};

/**
 * CSS class names for animation states
 */
export const ANIMATION_CLASSES = {
    TARGET_NODE: 'impact-target-node',
    CRITICAL_IMPACT: 'impact-critical',
    HIGH_IMPACT: 'impact-high',
    MEDIUM_IMPACT: 'impact-medium',
    LOW_IMPACT: 'impact-low',
    RIPPLE_CIRCLE: 'impact-ripple-circle',
    PULSE_ANIMATION: 'impact-pulse',
    FADE_IN: 'impact-fade-in'
} as const;

/**
 * Animation event types for communication
 */
export interface AnimationEvent {
    type: AnimationEventType;
    nodeId?: string;
    phase?: AnimationPhase;
    timestamp: number;
}

/**
 * Types of animation events
 */
export enum AnimationEventType {
    ANIMATION_START = 'animation_start',
    ANIMATION_COMPLETE = 'animation_complete',
    NODE_ANIMATED = 'node_animated',
    PHASE_CHANGE = 'phase_change',
    ANIMATION_ERROR = 'animation_error'
}