/**
 * @fileoverview Filter Dropdown Component
 *
 * Provides a comprehensive filtering interface for graph nodes with multi-select
 * file types, complexity levels, risk levels, dependency types, and node count control.
 *
 * @author IDE Constellation
 * @since Graph Interaction Upgrade
 */

import { useState, useRef, useEffect } from "preact/hooks";
import "./FilterDropdown.css";

export interface FilterState {
  fileTypes: string[];
  complexity: "all" | "low" | "medium" | "high";
  riskLevel: "all" | "low" | "medium" | "high";
  dependencies: "all" | "internal" | "external";
  nodeCount: number;
}

export interface FilterDropdownProps {
  currentFilters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  disabled?: boolean;
  totalNodeCount?: number;
}

const DEFAULT_FILTERS: FilterState = {
  fileTypes: [],
  complexity: "all",
  riskLevel: "all",
  dependencies: "all",
  nodeCount: 500,
};

const FILE_TYPE_OPTIONS = [
  { value: "ts", label: "TypeScript (.ts)" },
  { value: "tsx", label: "TSX (.tsx)" },
  { value: "js", label: "JavaScript (.js)" },
  { value: "jsx", label: "JSX (.jsx)" },
  { value: "css", label: "CSS (.css)" },
  { value: "md", label: "Markdown (.md)" },
];

const COMPLEXITY_OPTIONS = [
  { value: "all" as const, label: "All Complexity" },
  { value: "low" as const, label: "Low Complexity" },
  { value: "medium" as const, label: "Medium Complexity" },
  { value: "high" as const, label: "High Complexity" },
];

const RISK_LEVEL_OPTIONS = [
  { value: "all" as const, label: "All Risk Levels" },
  { value: "low" as const, label: "Low Risk" },
  { value: "medium" as const, label: "Medium Risk" },
  { value: "high" as const, label: "High Risk" },
];

const DEPENDENCY_OPTIONS = [
  { value: "all" as const, label: "All Dependencies" },
  { value: "internal" as const, label: "Internal Only" },
  { value: "external" as const, label: "External Only" },
];

export function FilterDropdown({
  currentFilters,
  onFilterChange,
  disabled = false,
  totalNodeCount = 500,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  const handleToggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleFileTypeChange = (fileType: string, checked: boolean) => {
    const newFileTypes = checked
      ? [...currentFilters.fileTypes, fileType]
      : currentFilters.fileTypes.filter((type) => type !== fileType);

    onFilterChange({
      ...currentFilters,
      fileTypes: newFileTypes,
    });
  };

  const handleComplexityChange = (complexity: FilterState["complexity"]) => {
    onFilterChange({
      ...currentFilters,
      complexity,
    });
  };

  const handleRiskLevelChange = (riskLevel: FilterState["riskLevel"]) => {
    onFilterChange({
      ...currentFilters,
      riskLevel,
    });
  };

  const handleDependencyChange = (
    dependencies: FilterState["dependencies"]
  ) => {
    onFilterChange({
      ...currentFilters,
      dependencies,
    });
  };

  const handleNodeCountChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const nodeCount = parseInt(target.value, 10);
    onFilterChange({
      ...currentFilters,
      nodeCount,
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (currentFilters.fileTypes.length > 0) count++;
    if (currentFilters.complexity !== "all") count++;
    if (currentFilters.riskLevel !== "all") count++;
    if (currentFilters.dependencies !== "all") count++;
    if (currentFilters.nodeCount !== totalNodeCount) count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className="filter-dropdown" ref={dropdownRef}>
      <button
        ref={buttonRef}
        className={`dropdown-button ${disabled ? "disabled" : ""}`}
        onClick={handleToggleDropdown}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Filter options ${
          activeFilterCount > 0 ? `(${activeFilterCount} active)` : ""
        }`}
      >
        <span className="dropdown-label">Filters</span>
        {activeFilterCount > 0 && (
          <span className="filter-badge">{activeFilterCount}</span>
        )}
        <span className={`dropdown-arrow ${isOpen ? "open" : ""}`}>▼</span>
      </button>

      {isOpen && (
        <>
          <div className="dropdown-overlay" onClick={() => setIsOpen(false)} />
          <div className="filter-dropdown-menu">
            {/* File Types Section */}
            <div className="filter-section">
              <h4 className="filter-section-title">File Types</h4>
              <div className="filter-checkbox-group">
                {FILE_TYPE_OPTIONS.map((option) => (
                  <label key={option.value} className="filter-checkbox-item">
                    <input
                      type="checkbox"
                      checked={currentFilters.fileTypes.includes(option.value)}
                      onChange={(e) =>
                        handleFileTypeChange(
                          option.value,
                          (e.target as HTMLInputElement).checked
                        )
                      }
                    />
                    <span className="checkbox-label">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Complexity Section */}
            <div className="filter-section">
              <h4 className="filter-section-title">Complexity Level</h4>
              <div className="filter-radio-group">
                {COMPLEXITY_OPTIONS.map((option) => (
                  <label key={option.value} className="filter-radio-item">
                    <input
                      type="radio"
                      name="complexity"
                      value={option.value}
                      checked={currentFilters.complexity === option.value}
                      onChange={() => handleComplexityChange(option.value)}
                    />
                    <span className="radio-label">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Risk Level Section */}
            <div className="filter-section">
              <h4 className="filter-section-title">Risk Level</h4>
              <div className="filter-radio-group">
                {RISK_LEVEL_OPTIONS.map((option) => (
                  <label key={option.value} className="filter-radio-item">
                    <input
                      type="radio"
                      name="riskLevel"
                      value={option.value}
                      checked={currentFilters.riskLevel === option.value}
                      onChange={() => handleRiskLevelChange(option.value)}
                    />
                    <span className="radio-label">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Dependencies Section */}
            <div className="filter-section">
              <h4 className="filter-section-title">Dependencies</h4>
              <div className="filter-radio-group">
                {DEPENDENCY_OPTIONS.map((option) => (
                  <label key={option.value} className="filter-radio-item">
                    <input
                      type="radio"
                      name="dependencies"
                      value={option.value}
                      checked={currentFilters.dependencies === option.value}
                      onChange={() => handleDependencyChange(option.value)}
                    />
                    <span className="radio-label">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Node Count Section */}
            <div className="filter-section">
              <h4 className="filter-section-title">Max Nodes</h4>
              <div className="filter-slider-group">
                <input
                  type="range"
                  min="50"
                  max={totalNodeCount}
                  step="25"
                  value={currentFilters.nodeCount}
                  onChange={handleNodeCountChange}
                  className="node-count-slider"
                />
                <div className="slider-labels">
                  <span className="slider-value">
                    {currentFilters.nodeCount} nodes
                  </span>
                  <span className="slider-max">of {totalNodeCount}</span>
                </div>
              </div>
            </div>

            {/* Clear All Section */}
            <div className="filter-actions">
              <button
                className="clear-filters-button"
                onClick={() => onFilterChange(DEFAULT_FILTERS)}
                disabled={activeFilterCount === 0}
              >
                Clear All Filters
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
