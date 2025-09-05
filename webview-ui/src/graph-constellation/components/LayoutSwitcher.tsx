/**
 * @fileoverview Layout Switcher Component
 *
 * Provides a dropdown interface for selecting graph layout algorithms.
 * Supports all major Cytoscape.js layout types with performance optimization
 * for large graphs and loading state management.
 *
 * @author IDE Constellation
 * @since Phase 3 - Graph Interaction Enhancements
 */

import { useState } from "preact/hooks";
import { LayoutType, LayoutOption } from "@/types/layout.types";

/**
 * Props interface for the LayoutSwitcher component
 *
 * @interface LayoutSwitcherProps
 * @property {LayoutType} currentLayout - Currently active layout type
 * @property {function} onLayoutChange - Callback fired when layout is changed
 * @property {boolean} [disabled] - Whether the switcher is disabled during layout changes
 * @property {number} [nodeCount] - Number of nodes in the graph for performance warnings
 */
export interface LayoutSwitcherProps {
  currentLayout: LayoutType; // Task 6.3: Use proper LayoutType
  onLayoutChange: (layoutId: LayoutType) => void; // Task 6.3: Type-safe callback
  disabled?: boolean;
  nodeCount?: number;
}

/**
 * Available layout options with metadata
 *
 * Each option includes:
 * - id: Internal identifier matching LayoutType
 * - name: Human-readable display name
 * - description: Brief description of layout behavior
 * - cytoscapeLayout: Corresponding Cytoscape.js layout name
 */
const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    id: "force-directed",
    name: "Force-Directed",
    description: "Automatic positioning with force simulation",
    cytoscapeLayout: "cose",
  },
  {
    id: "circle",
    name: "Circle",
    description: "Nodes arranged in a circular pattern",
    cytoscapeLayout: "circle",
  },
  {
    id: "grid",
    name: "Grid",
    description: "Nodes arranged in a regular grid",
    cytoscapeLayout: "grid",
  },
  {
    id: "hierarchical",
    name: "Hierarchical (Tree)",
    description: "Tree-like hierarchical arrangement",
    cytoscapeLayout: "breadthfirst",
  },
  {
    id: "concentric",
    name: "Concentric",
    description: "Nodes in concentric circles by importance",
    cytoscapeLayout: "concentric",
  },
];

/**
 * Layout Switcher Component for Graph Visualization
 * Task 3.1: Dropdown interface for layout selection with loading states
 *
 * @description Provides a dropdown interface for selecting graph layout algorithms.
 * Includes performance warnings for large graphs and loading state management.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <LayoutSwitcher
 *   currentLayout="force-directed"
 *   onLayoutChange={(layout) => setCurrentLayout(layout)}
 *   nodeCount={graph.nodes.length}
 * />
 *
 * // With loading state
 * <LayoutSwitcher
 *   currentLayout={currentLayout}
 *   onLayoutChange={handleLayoutChange}
 *   disabled={isLayoutChanging}
 *   nodeCount={graph.nodes.length}
 * />
 * ```
 *
 * @param {LayoutSwitcherProps} props - Component props
 * @returns {JSX.Element} Rendered layout switcher dropdown
 */
export function LayoutSwitcher({
  currentLayout,
  onLayoutChange,
  disabled = false,
  nodeCount = 0,
}: LayoutSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const showLargeGraphWarning = nodeCount > 1000;
  const showMediumGraphWarning = nodeCount > 500 && nodeCount <= 1000;

  // Task 8.5: Dynamic warning messages based on graph size
  const getWarningMessage = () => {
    if (nodeCount > 2000) {
      return "⚠️ Very large graph detected - Layout changes may take 5+ seconds";
    } else if (nodeCount > 1000) {
      return "⚠️ Large graph detected - Layout changes may take 2-5 seconds";
    } else if (nodeCount > 500) {
      return "ℹ️ Medium graph - Layout changes should complete within 1 second";
    }
    return "";
  };

  const getCurrentLayoutName = () => {
    const option = LAYOUT_OPTIONS.find((opt) => opt.id === currentLayout);
    return option?.name || "Force-Directed";
  };

  const handleLayoutSelect = (layoutId: string) => {
    setIsOpen(false);

    // Task 8.5: Performance warnings for large graphs
    if (nodeCount > 1000) {
      console.log(
        `[PERF] Large graph layout change initiated - ${nodeCount} nodes, switching to ${layoutId}`
      );
      console.log(
        `[PERF] Expected performance impact: HIGH - Layout may take 2-5 seconds`
      );
    } else if (nodeCount > 500) {
      console.log(
        `[PERF] Medium graph layout change - ${nodeCount} nodes, switching to ${layoutId}`
      );
      console.log(
        `[PERF] Expected performance impact: MEDIUM - Layout should complete within 1 second`
      );
    }

    onLayoutChange(layoutId as LayoutType); // Task 6.3: Type-safe layout selection
  };

  return (
    <div className="layout-switcher">
      {/* Task 8.5: Enhanced warnings for different graph sizes */}
      {(showLargeGraphWarning || showMediumGraphWarning) && (
        <div
          className={`layout-warning ${
            nodeCount > 2000 ? "severe" : nodeCount > 1000 ? "high" : "medium"
          }`}
        >
          {getWarningMessage()}
        </div>
      )}

      {/* Dropdown Button */}
      <div className="dropdown-container">
        <button
          className={`dropdown-button ${isOpen ? "open" : ""} ${
            disabled ? "disabled" : ""
          }`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          title={
            disabled ? "Layout change in progress..." : "Change graph layout"
          }
        >
          <span className="dropdown-label">Layout:</span>
          <span className="dropdown-value">{getCurrentLayoutName()}</span>
          <span className={`dropdown-arrow ${isOpen ? "open" : ""}`}>▼</span>
        </button>

        {/* Dropdown Menu */}
        {isOpen && !disabled && (
          <div className="dropdown-menu">
            {LAYOUT_OPTIONS.map((option) => (
              <button
                key={option.id}
                className={`dropdown-item ${
                  option.id === currentLayout ? "selected" : ""
                }`}
                onClick={() => handleLayoutSelect(option.id)}
                title={option.description}
              >
                <span className="option-name">{option.name}</span>
                <span className="option-description">{option.description}</span>
                {option.id === currentLayout && (
                  <span className="selected-indicator">✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Close overlay */}
      {isOpen && (
        <div className="dropdown-overlay" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}

export { LAYOUT_OPTIONS };
