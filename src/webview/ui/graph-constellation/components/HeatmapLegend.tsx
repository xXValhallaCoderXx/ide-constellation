import { JSX } from 'preact';
import { useState } from 'preact/hooks';

interface HeatmapLegendProps {
  /** Whether the legend is visible */
  isVisible: boolean;
  /** Whether heatmap overlay is currently active */
  isHeatmapActive: boolean;
  /** Risk distribution statistics */
  distribution?: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  /** Total number of files analyzed */
  totalFiles?: number;
  /** Callback when toggle heatmap is clicked */
  onToggleHeatmap?: () => void;
  /** Callback when close is clicked */
  onClose?: () => void;
}

export function HeatmapLegend({
  isVisible,
  isHeatmapActive,
  distribution,
  totalFiles = 0,
  onToggleHeatmap,
  onClose
}: HeatmapLegendProps): JSX.Element | null {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!isVisible) {
    return null;
  }

  const riskLevels = [
    { 
      label: 'Low Risk', 
      color: '#22c55e', 
      icon: '🟢',
      count: distribution?.low || 0,
      description: 'Well-maintained files with low complexity and churn'
    },
    { 
      label: 'Medium Risk', 
      color: '#eab308', 
      icon: '🟡',
      count: distribution?.medium || 0,
      description: 'Files that may need attention in the future'
    },
    { 
      label: 'High Risk', 
      color: '#f97316', 
      icon: '🟠',
      count: distribution?.high || 0,
      description: 'Files with elevated complexity or churn patterns'
    },
    { 
      label: 'Critical Risk', 
      color: '#ef4444', 
      icon: '🔴',
      count: distribution?.critical || 0,
      description: 'Files requiring immediate attention'
    }
  ];

  const getPercentage = (count: number): number => {
    return totalFiles > 0 ? Math.round((count / totalFiles) * 100) : 0;
  };

  return (
    <div className={`heatmap-legend ${isMinimized ? 'minimized' : ''}`}>
      {/* Header */}
      <div className="legend-header">
        <div className="legend-title">
          <span className="legend-icon">🗺️</span>
          <span className="legend-text">Risk Heatmap</span>
        </div>
        <div className="legend-controls">
          <button
            className="legend-control-button minimize-button"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand legend' : 'Minimize legend'}
            aria-label={isMinimized ? 'Expand legend' : 'Minimize legend'}
          >
            {isMinimized ? '📈' : '📉'}
          </button>
          <button
            className="legend-control-button close-button"
            onClick={onClose}
            title="Close heatmap legend"
            aria-label="Close heatmap legend"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content (hidden when minimized) */}
      {!isMinimized && (
        <div className="legend-content">
          {/* Toggle Button */}
          <div className="legend-toggle-section">
            <button
              className={`toggle-heatmap-button ${isHeatmapActive ? 'active' : 'inactive'}`}
              onClick={onToggleHeatmap}
              title={isHeatmapActive ? 'Hide risk heatmap overlay' : 'Show risk heatmap overlay'}
            >
              <span className="toggle-icon">
                {isHeatmapActive ? '👁️' : '👁️‍🗨️'}
              </span>
              <span className="toggle-text">
                {isHeatmapActive ? 'Hide Heatmap' : 'Show Heatmap'}
              </span>
            </button>
          </div>

          {/* Risk Scale */}
          <div className="legend-scale-section">
            <h4 className="section-title">Risk Scale</h4>
            <div className="risk-gradient">
              <div className="gradient-bar">
                <div 
                  className="gradient-segment low" 
                  style={{ backgroundColor: '#22c55e' }}
                ></div>
                <div 
                  className="gradient-segment medium" 
                  style={{ backgroundColor: '#eab308' }}
                ></div>
                <div 
                  className="gradient-segment high" 
                  style={{ backgroundColor: '#f97316' }}
                ></div>
                <div 
                  className="gradient-segment critical" 
                  style={{ backgroundColor: '#ef4444' }}
                ></div>
              </div>
              <div className="gradient-labels">
                <span className="gradient-label">Low</span>
                <span className="gradient-label">High</span>
              </div>
            </div>
          </div>

          {/* Risk Distribution */}
          {distribution && totalFiles > 0 && (
            <div className="legend-distribution-section">
              <h4 className="section-title">Distribution ({totalFiles} files)</h4>
              <div className="risk-levels">
                {riskLevels.map((level) => (
                  <div key={level.label} className="risk-level-item">
                    <div className="risk-level-header">
                      <span className="risk-icon">{level.icon}</span>
                      <span className="risk-label">{level.label}</span>
                      <span className="risk-count">
                        {level.count} ({getPercentage(level.count)}%)
                      </span>
                    </div>
                    <div className="risk-level-bar">
                      <div 
                        className="risk-level-fill"
                        style={{ 
                          backgroundColor: level.color,
                          width: `${getPercentage(level.count)}%`
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="legend-instructions-section">
            <h4 className="section-title">Interaction Guide</h4>
            <div className="instructions-list">
              <div className="instruction-item">
                <span className="instruction-icon">🖱️</span>
                <span className="instruction-text">Hover nodes for detailed risk metrics</span>
              </div>
              <div className="instruction-item">
                <span className="instruction-icon">👆</span>
                <span className="instruction-text">Click nodes to open files</span>
              </div>
              <div className="instruction-item">
                <span className="instruction-icon">⌨️</span>
                <span className="instruction-text">Ctrl+Click to open in split pane</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}