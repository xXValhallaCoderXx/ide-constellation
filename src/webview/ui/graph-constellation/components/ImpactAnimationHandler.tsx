/**
 * Impact Animation Handler Component
 * 
 * Handles impact analysis visual animations in the graph canvas.
 * Provides ripple effects, node highlighting, and color-coded impact visualization.
 */

import { useEffect, useRef, useState, useCallback } from 'preact/hooks';
import { 
  ImpactAnimationInstruction, 
  AnimatedNode, 
  AnimationState, 
  AnimationPhase,
  AnimationEvent,
  AnimationEventType,
  ANIMATION_TIMING,
  ANIMATION_CLASSES
} from '../../../../types/impact-animation.types';
import { ImpactLevel } from '../../../../services/impact-analyzer/impact-types';

export interface ImpactAnimationHandlerProps {
  /** Cytoscape instance for graph manipulation */
  cy: any;
  /** Callback when animation events occur */
  onAnimationEvent?: (event: AnimationEvent) => void;
  /** Whether animations are enabled */
  enabled?: boolean;
}

/**
 * Hook for managing impact animations on the graph canvas
 */
export function useImpactAnimation({ cy, onAnimationEvent, enabled = true }: ImpactAnimationHandlerProps) {
  const [animationState, setAnimationState] = useState<AnimationState>({
    isRunning: false,
    phase: AnimationPhase.IDLE,
    activeNodes: new Set(),
    startTime: 0,
    cleanupFunctions: []
  });

  const animationIdRef = useRef<string>('');
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);
  
  // Performance optimization refs
  const performanceMetrics = useRef({
    animationsStarted: 0,
    animationsCompleted: 0,
    averageAnimationTime: 0,
    lastCleanupTime: 0,
    maxConcurrentAnimations: 0
  });
  
  // Debouncing for rapid successive calls
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnimationRequestRef = useRef<number>(0);
  const DEBOUNCE_DELAY = 100; // 100ms debounce
  const MAX_ANIMATED_NODES = 100; // Performance limit
  const ANIMATION_THROTTLE_MS = 50; // Minimum time between animations

  /**
   * Emit animation event
   */
  const emitEvent = useCallback((type: AnimationEventType, nodeId?: string, phase?: AnimationPhase) => {
    const event: AnimationEvent = {
      type,
      nodeId,
      phase,
      timestamp: Date.now()
    };
    onAnimationEvent?.(event);
  }, [onAnimationEvent]);

  /**
   * Clean up all active animations and timers
   */
  const cleanup = useCallback(() => {
    const cleanupStartTime = Date.now();
    
    // Clear debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    
    // Clear all timeouts
    timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
    timeoutRefs.current = [];

    // Execute cleanup functions with error handling
    let cleanupErrors = 0;
    animationState.cleanupFunctions.forEach(fn => {
      try {
        fn();
      } catch (error) {
        cleanupErrors++;
        console.warn('[ImpactAnimation] Cleanup function failed:', error);
      }
    });

    // Reset animation state
    setAnimationState({
      isRunning: false,
      phase: AnimationPhase.IDLE,
      activeNodes: new Set(),
      startTime: 0,
      cleanupFunctions: []
    });

    // Performance monitoring
    const cleanupDuration = Date.now() - cleanupStartTime;
    performanceMetrics.current.lastCleanupTime = cleanupDuration;
    
    if (cleanupErrors > 0) {
      console.warn(`[ImpactAnimation] Cleanup completed with ${cleanupErrors} errors in ${cleanupDuration}ms`);
    } else {
      console.log(`[ImpactAnimation] Cleanup completed successfully in ${cleanupDuration}ms`);
    }

    // Remove animation classes from all nodes
    if (cy) {
      cy.nodes().removeClass([
        ANIMATION_CLASSES.TARGET_NODE,
        ANIMATION_CLASSES.CRITICAL_IMPACT,
        ANIMATION_CLASSES.HIGH_IMPACT,
        ANIMATION_CLASSES.MEDIUM_IMPACT,
        ANIMATION_CLASSES.LOW_IMPACT,
        ANIMATION_CLASSES.PULSE_ANIMATION,
        ANIMATION_CLASSES.FADE_IN
      ].join(' '));

      // Remove ripple elements
      cy.elements(`.${ANIMATION_CLASSES.RIPPLE_CIRCLE}`).remove();
    }
  }, [cy, animationState.cleanupFunctions]);

  /**
   * Apply impact animation based on instruction
   */
  const applyImpactAnimation = useCallback(async (instruction: ImpactAnimationInstruction): Promise<void> => {
    if (!enabled || !cy) {
      console.warn('[ImpactAnimation] Animation disabled or Cytoscape not available');
      return;
    }

    // Performance throttling - prevent too frequent animations
    const now = Date.now();
    if (now - lastAnimationRequestRef.current < ANIMATION_THROTTLE_MS) {
      console.log('[ImpactAnimation] Animation throttled - too frequent requests');
      return;
    }
    lastAnimationRequestRef.current = now;

    // Debounce rapid successive calls
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      await performAnimation(instruction);
    }, DEBOUNCE_DELAY);
  }, [enabled, cy]);

  /**
   * Perform the actual animation with performance monitoring
   */
  const performAnimation = useCallback(async (instruction: ImpactAnimationInstruction): Promise<void> => {
    const animationStartTime = Date.now();
    performanceMetrics.current.animationsStarted++;

    // Clean up any existing animation
    cleanup();

    const { payload } = instruction;
    const { targetNode, impactedNodes, animationConfig, riskScore } = payload;
    
    // Performance optimization: limit number of animated nodes
    const limitedImpactedNodes = impactedNodes.slice(0, MAX_ANIMATED_NODES);
    if (impactedNodes.length > MAX_ANIMATED_NODES) {
      console.warn(`[ImpactAnimation] Limited animation to ${MAX_ANIMATED_NODES} nodes (was ${impactedNodes.length})`);
    }
    
    animationIdRef.current = instruction.correlationId || `impact-${Date.now()}`;
    
    console.log(`[ImpactAnimation] Starting animation for ${targetNode} with ${limitedImpactedNodes.length} impacted nodes`);

    // Update animation state
    setAnimationState(prev => ({
      ...prev,
      isRunning: true,
      phase: AnimationPhase.STARTING,
      startTime: animationStartTime,
      activeNodes: new Set([targetNode, ...limitedImpactedNodes.map(n => n.nodeId)])
    }));

    // Track concurrent animations for performance monitoring
    performanceMetrics.current.maxConcurrentAnimations = Math.max(
      performanceMetrics.current.maxConcurrentAnimations,
      limitedImpactedNodes.length
    );

    emitEvent(AnimationEventType.ANIMATION_START);

    try {
      // Phase 1: Highlight target node
      await highlightTargetNode(targetNode);
      
      // Phase 2: Create ripple effect if enabled (with performance check)
      if (animationConfig.showRipples && limitedImpactedNodes.length <= 50) {
        await createRippleEffect(targetNode, limitedImpactedNodes, animationConfig);
      } else if (animationConfig.showRipples) {
        console.log('[ImpactAnimation] Skipping ripples for performance (too many nodes)');
      }
      
      // Phase 3: Animate impacted nodes with batching
      await animateImpactedNodesBatched(limitedImpactedNodes, animationConfig);
      
      // Phase 4: Complete animation with performance tracking
      const animationDuration = Date.now() - animationStartTime;
      performanceMetrics.current.animationsCompleted++;
      
      // Update average animation time
      const totalAnimations = performanceMetrics.current.animationsCompleted;
      performanceMetrics.current.averageAnimationTime = 
        (performanceMetrics.current.averageAnimationTime * (totalAnimations - 1) + animationDuration) / totalAnimations;
      
      setAnimationState(prev => ({ 
        ...prev, 
        phase: AnimationPhase.COMPLETE,
        isRunning: false 
      }));
      emitEvent(AnimationEventType.ANIMATION_COMPLETE);
      
      console.log(`[ImpactAnimation] Animation completed for ${animationIdRef.current} in ${animationDuration}ms`);
      console.log(`[ImpactAnimation] Performance: avg=${performanceMetrics.current.averageAnimationTime.toFixed(1)}ms, completed=${totalAnimations}`);
      
      // Schedule cleanup after a delay to allow visual feedback
      setTimeout(() => {
        performanceMetrics.current.lastCleanupTime = Date.now();
      }, 2000);

    } catch (error) {
      console.error('[ImpactAnimation] Animation failed:', error);
      emitEvent(AnimationEventType.ANIMATION_ERROR);
      cleanup();
    }
  }, [enabled, cy, cleanup, emitEvent]);

  /**
   * Highlight the target node where the change originates
   */
  const highlightTargetNode = useCallback(async (targetNodeId: string): Promise<void> => {
    if (!cy) return;

    setAnimationState(prev => ({ ...prev, phase: AnimationPhase.NODE_HIGHLIGHTING }));
    emitEvent(AnimationEventType.PHASE_CHANGE, undefined, AnimationPhase.NODE_HIGHLIGHTING);

    const targetNode = cy.getElementById(targetNodeId);
    if (targetNode.length === 0) {
      console.warn(`[ImpactAnimation] Target node not found: ${targetNodeId}`);
      return;
    }

    // Add target node styling
    targetNode.addClass(ANIMATION_CLASSES.TARGET_NODE);
    
    // Center the view on target node
    cy.center(targetNode);
    
    // Add pulse animation
    targetNode.addClass(ANIMATION_CLASSES.PULSE_ANIMATION);
    
    // Wait for initial highlight
    await new Promise(resolve => {
      const timeout = setTimeout(resolve, 300);
      timeoutRefs.current.push(timeout);
    });
  }, [cy, emitEvent]);

  /**
   * Create expanding ripple effect from target node
   */
  const createRippleEffect = useCallback(async (
    targetNodeId: string, 
    impactedNodes: AnimatedNode[], 
    animationConfig: any
  ): Promise<void> => {
    if (!cy) return;

    setAnimationState(prev => ({ ...prev, phase: AnimationPhase.RIPPLE_EFFECT }));
    emitEvent(AnimationEventType.PHASE_CHANGE, undefined, AnimationPhase.RIPPLE_EFFECT);

    const targetNode = cy.getElementById(targetNodeId);
    if (targetNode.length === 0) return;

    const targetPosition = targetNode.position();
    const maxDistance = Math.max(...impactedNodes.map(n => n.distance));

    // Create ripple circles for each distance level
    for (let distance = 1; distance <= maxDistance; distance++) {
      const delay = distance * animationConfig.staggerDelay;
      
      const timeout = setTimeout(() => {
        if (!cy) return;

        // Create ripple circle element
        const rippleRadius = distance * 100; // Scale radius by distance
        
        // Add ripple circle as a temporary element
        const ripple = cy.add({
          group: 'nodes',
          data: { 
            id: `ripple-${distance}-${Date.now()}`,
            isRipple: true
          },
          position: targetPosition,
          classes: ANIMATION_CLASSES.RIPPLE_CIRCLE
        });

        // Animate ripple expansion
        ripple.animate({
          style: {
            'width': rippleRadius * 2,
            'height': rippleRadius * 2,
            'opacity': 0
          }
        }, {
          duration: ANIMATION_TIMING.RIPPLE_DURATION,
          easing: animationConfig.easing,
          complete: () => {
            ripple.remove();
          }
        });

      }, delay);

      timeoutRefs.current.push(timeout);
    }

    // Wait for ripple effect to complete
    const totalRippleTime = maxDistance * animationConfig.staggerDelay + ANIMATION_TIMING.RIPPLE_DURATION;
    await new Promise(resolve => {
      const timeout = setTimeout(resolve, totalRippleTime);
      timeoutRefs.current.push(timeout);
    });
  }, [cy, emitEvent]);

  /**
   * Animate impacted nodes in batches for better performance
   */
  const animateImpactedNodesBatched = useCallback(async (
    impactedNodes: AnimatedNode[], 
    animationConfig: any
  ): Promise<void> => {
    if (!cy || impactedNodes.length === 0) return;

    const BATCH_SIZE = 20; // Process nodes in batches of 20
    const BATCH_DELAY = 100; // 100ms delay between batches

    console.log(`[ImpactAnimation] Animating ${impactedNodes.length} nodes in batches of ${BATCH_SIZE}`);

    // Sort nodes by priority (critical first, then by distance)
    const sortedNodes = [...impactedNodes].sort((a, b) => {
      const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      const aPriority = priorityOrder[a.impactLevel as keyof typeof priorityOrder] || 0;
      const bPriority = priorityOrder[b.impactLevel as keyof typeof priorityOrder] || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      return a.distance - b.distance;
    });

    // Process nodes in batches
    for (let i = 0; i < sortedNodes.length; i += BATCH_SIZE) {
      const batch = sortedNodes.slice(i, i + BATCH_SIZE);
      
      // Animate batch concurrently
      const batchPromises = batch.map(node => animateSingleNode(node, animationConfig));
      await Promise.all(batchPromises);
      
      // Small delay between batches to prevent overwhelming the browser
      if (i + BATCH_SIZE < sortedNodes.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }
  }, [cy]);

  /**
   * Animate a single node with performance optimizations
   */
  const animateSingleNode = useCallback(async (node: AnimatedNode, animationConfig: any): Promise<void> => {
    if (!cy) return;

    try {
      const cyNode = cy.getElementById(node.nodeId);
      if (!cyNode || cyNode.length === 0) {
        console.warn(`[ImpactAnimation] Node not found: ${node.nodeId}`);
        return;
      }

      // Apply impact level styling
      const impactClass = `impact-${node.impactLevel.toLowerCase()}`;
      cyNode.addClass(impactClass);

      // Apply color with fallback
      const nodeColor = node.color || getImpactLevelColor(node.impactLevel);
      cyNode.style('background-color', nodeColor);
      cyNode.style('border-color', nodeColor);

      // Add pulse animation for high-priority nodes
      if (node.shouldPulse && (node.impactLevel === 'critical' || node.impactLevel === 'high')) {
        cyNode.addClass('impact-pulse');
      }

      // Emit event for tracking
      emitEvent(AnimationEventType.NODE_ANIMATED, node.nodeId);

      // Store cleanup function
      const cleanup = () => {
        try {
          cyNode.removeClass(impactClass);
          cyNode.removeClass('impact-pulse');
          cyNode.removeStyle('background-color border-color');
        } catch (error) {
          console.warn('[ImpactAnimation] Cleanup failed for node:', node.nodeId, error);
        }
      };

      // Add to cleanup functions
      setAnimationState(prev => ({
        ...prev,
        cleanupFunctions: [...prev.cleanupFunctions, cleanup]
      }));

    } catch (error) {
      console.warn('[ImpactAnimation] Failed to animate node:', node.nodeId, error);
    }
  }, [cy, emitEvent]);

  /**
   * Get color for impact level
   */
  const getImpactLevelColor = useCallback((impactLevel: string): string => {
    const colors = {
      'CRITICAL': '#ef4444',
      'HIGH': '#f97316', 
      'MEDIUM': '#eab308',
      'LOW': '#22c55e'
    };
    return colors[impactLevel as keyof typeof colors] || '#64748b';
  }, []);

  /**
   * Animate impacted nodes with staggered timing and color coding
   */
  const animateImpactedNodes = useCallback(async (
    impactedNodes: AnimatedNode[], 
    animationConfig: any
  ): Promise<void> => {
    if (!cy) return;

    // Group nodes by distance for staggered animation
    const nodesByDistance = new Map<number, AnimatedNode[]>();
    impactedNodes.forEach(node => {
      const distance = node.distance;
      if (!nodesByDistance.has(distance)) {
        nodesByDistance.set(distance, []);
      }
      nodesByDistance.get(distance)!.push(node);
    });

    // Animate nodes by distance groups
    const animationPromises: Promise<void>[] = [];

    for (const [distance, nodes] of nodesByDistance) {
      const groupDelay = distance * animationConfig.staggerDelay;

      const groupPromise = new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (!cy) {
            resolve();
            return;
          }

          // Animate all nodes at this distance level
          const nodePromises = nodes.map(animatedNode => 
            animateIndividualNode(animatedNode, animationConfig)
          );

          Promise.all(nodePromises).then(() => resolve());
        }, groupDelay);

        timeoutRefs.current.push(timeout);
      });

      animationPromises.push(groupPromise);
    }

    // Wait for all animations to complete
    await Promise.all(animationPromises);
  }, [cy]);

  /**
   * Animate an individual node with impact-level styling
   */
  const animateIndividualNode = useCallback(async (
    animatedNode: AnimatedNode, 
    animationConfig: any
  ): Promise<void> => {
    if (!cy) return;

    const node = cy.getElementById(animatedNode.nodeId);
    if (node.length === 0) {
      console.warn(`[ImpactAnimation] Node not found: ${animatedNode.nodeId}`);
      return;
    }

    // Apply impact level class
    const impactClass = getImpactLevelClass(animatedNode.impactLevel);
    node.addClass(impactClass);

    // Add fade-in animation
    node.addClass(ANIMATION_CLASSES.FADE_IN);

    // Apply pulse animation for high-impact nodes
    if (animatedNode.shouldPulse) {
      node.addClass(ANIMATION_CLASSES.PULSE_ANIMATION);
    }

    // Apply color styling
    node.style({
      'background-color': animatedNode.color,
      'border-color': animatedNode.color,
      'border-width': '3px'
    });

    emitEvent(AnimationEventType.NODE_ANIMATED, animatedNode.nodeId);

    // Return promise that resolves after node animation duration
    return new Promise(resolve => {
      const timeout = setTimeout(resolve, animatedNode.nodeDuration);
      timeoutRefs.current.push(timeout);
    });
  }, [cy, emitEvent]);

  /**
   * Get CSS class for impact level
   */
  const getImpactLevelClass = useCallback((impactLevel: ImpactLevel): string => {
    switch (impactLevel) {
      case ImpactLevel.CRITICAL:
        return ANIMATION_CLASSES.CRITICAL_IMPACT;
      case ImpactLevel.HIGH:
        return ANIMATION_CLASSES.HIGH_IMPACT;
      case ImpactLevel.MEDIUM:
        return ANIMATION_CLASSES.MEDIUM_IMPACT;
      case ImpactLevel.LOW:
        return ANIMATION_CLASSES.LOW_IMPACT;
      default:
        return ANIMATION_CLASSES.LOW_IMPACT;
    }
  }, []);

  /**
   * Clear all impact animations
   */
  const clearAnimation = useCallback(() => {
    console.log('[ImpactAnimation] Clearing animation');
    cleanup();
    emitEvent(AnimationEventType.ANIMATION_COMPLETE);
  }, [cleanup, emitEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  /**
   * Get performance metrics for monitoring
   */
  const getPerformanceMetrics = useCallback(() => {
    return {
      ...performanceMetrics.current,
      isRunning: animationState.isRunning,
      activeNodesCount: animationState.activeNodes.size,
      memoryUsage: {
        cleanupFunctions: animationState.cleanupFunctions.length,
        timeouts: timeoutRefs.current.length
      }
    };
  }, [animationState]);

  /**
   * Reset performance metrics
   */
  const resetPerformanceMetrics = useCallback(() => {
    performanceMetrics.current = {
      animationsStarted: 0,
      animationsCompleted: 0,
      averageAnimationTime: 0,
      lastCleanupTime: 0,
      maxConcurrentAnimations: 0
    };
    console.log('[ImpactAnimation] Performance metrics reset');
  }, []);

  return {
    animationState,
    applyImpactAnimation,
    clearAnimation,
    isAnimating: animationState.isRunning,
    getPerformanceMetrics,
    resetPerformanceMetrics
  };
}

/**
 * Impact Animation Handler Component
 */
export function ImpactAnimationHandler({ cy, onAnimationEvent, enabled = true }: ImpactAnimationHandlerProps) {
  const { applyImpactAnimation, clearAnimation, animationState } = useImpactAnimation({
    cy,
    onAnimationEvent,
    enabled
  });

  // Expose methods to parent components via ref or global handlers
  useEffect(() => {
    if (!cy) return;

    // Add global event handlers for impact animations
    const handleImpactAnimation = (event: any) => {
      const instruction = event.detail as ImpactAnimationInstruction;
      applyImpactAnimation(instruction);
    };

    const handleClearAnimation = () => {
      clearAnimation();
    };

    // Listen for custom events
    window.addEventListener('impact:animate', handleImpactAnimation);
    window.addEventListener('impact:clear', handleClearAnimation);

    return () => {
      window.removeEventListener('impact:animate', handleImpactAnimation);
      window.removeEventListener('impact:clear', handleClearAnimation);
    };
  }, [cy, applyImpactAnimation, clearAnimation]);

  // This component doesn't render anything visible
  return null;
}