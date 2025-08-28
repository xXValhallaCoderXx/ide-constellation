import { useState } from 'preact/hooks';

export interface LayoutOption {
  id: string;
  name: string;
  description: string;
  cytoscapeLayout: string;
}

export interface LayoutSwitcherProps {
  currentLayout: string;
  onLayoutChange: (layoutId: string) => void;
  disabled?: boolean;
  nodeCount?: number;
}

const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    id: 'force-directed',
    name: 'Force-Directed',
    description: 'Automatic positioning with force simulation',
    cytoscapeLayout: 'cose'
  },
  {
    id: 'circle',
    name: 'Circle',
    description: 'Nodes arranged in a circular pattern',
    cytoscapeLayout: 'circle'
  },
  {
    id: 'grid',
    name: 'Grid',
    description: 'Nodes arranged in a regular grid',
    cytoscapeLayout: 'grid'
  },
  {
    id: 'hierarchical',
    name: 'Hierarchical (Tree)',
    description: 'Tree-like hierarchical arrangement',
    cytoscapeLayout: 'breadthfirst'
  },
  {
    id: 'concentric',
    name: 'Concentric',
    description: 'Nodes in concentric circles by importance',
    cytoscapeLayout: 'concentric'
  }
];

/**
 * Layout Switcher Component for Graph Visualization
 * Task 3.1: Dropdown interface for layout selection with loading states
 */
export function LayoutSwitcher({ 
  currentLayout, 
  onLayoutChange, 
  disabled = false,
  nodeCount = 0 
}: LayoutSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const showLargeGraphWarning = nodeCount > 1000;

  const getCurrentLayoutName = () => {
    const option = LAYOUT_OPTIONS.find(opt => opt.id === currentLayout);
    return option?.name || 'Force-Directed';
  };

  const handleLayoutSelect = (layoutId: string) => {
    setIsOpen(false);
    onLayoutChange(layoutId);
  };

  return (
    <div className="layout-switcher">
      {/* Warning for large graphs */}
      {showLargeGraphWarning && (
        <div className="layout-warning">
          <span className="warning-icon">⚠️</span>
          Layout changes may be slow for large graphs
        </div>
      )}
      
      {/* Dropdown Button */}
      <div className="dropdown-container">
        <button
          className={`dropdown-button ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          title={disabled ? 'Layout change in progress...' : 'Change graph layout'}
        >
          <span className="dropdown-label">Layout:</span>
          <span className="dropdown-value">{getCurrentLayoutName()}</span>
          <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
        </button>

        {/* Dropdown Menu */}
        {isOpen && !disabled && (
          <div className="dropdown-menu">
            {LAYOUT_OPTIONS.map(option => (
              <button
                key={option.id}
                className={`dropdown-item ${option.id === currentLayout ? 'selected' : ''}`}
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
        <div 
          className="dropdown-overlay" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

export { LAYOUT_OPTIONS };
