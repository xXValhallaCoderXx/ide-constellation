import { useEffect, useRef, useState } from 'preact/hooks';
import { JSX } from 'preact';
import { truncateFilePath } from '../../../../utils/path.utils';

export interface TooltipData {
  title: string;
  path?: string;
  packageInfo?: {
    name: string;
    version?: string;
    isMonorepoFile?: boolean;
    workspacePackage?: string;
  };
  riskData?: {
    score: number;
    category: string;
    complexity: number;
    churn: number;
    dependencies: number;
    dependents: number;
    recommendation?: string;
  };
  basicInfo?: {
    type: string;
    size?: string;
    lastModified?: string;
  };
}

interface RichTooltipProps {
  data: TooltipData | null;
  position: { x: number; y: number };
  visible: boolean;
  theme?: 'light' | 'dark' | 'auto';
}

export function RichTooltip({ data, position, visible, theme = 'auto' }: RichTooltipProps): JSX.Element {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Enhanced tooltip position adjustment with smart positioning
  useEffect(() => {
    if (!visible || !tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12; // Increased margin for better positioning

    let newX = position.x;
    let newY = position.y;

    // Smart horizontal positioning
    const spaceOnRight = viewportWidth - position.x;
    const spaceOnLeft = position.x;
    
    if (spaceOnRight < rect.width + margin && spaceOnLeft > rect.width + margin) {
      // Position to the left of cursor when near right edge
      newX = position.x - rect.width - margin;
    } else if (newX + rect.width > viewportWidth - margin) {
      // Fallback: align to right edge with margin
      newX = viewportWidth - rect.width - margin;
    }
    
    // Ensure minimum distance from left edge
    if (newX < margin) {
      newX = margin;
    }

    // Smart vertical positioning  
    const spaceBelow = viewportHeight - position.y;
    const spaceAbove = position.y;
    
    if (spaceBelow < rect.height + margin && spaceAbove > rect.height + margin) {
      // Position above cursor when near bottom edge
      newY = position.y - rect.height - margin;
    } else if (newY + rect.height > viewportHeight - margin) {
      // Fallback: align to bottom edge with margin
      newY = viewportHeight - rect.height - margin;
    }
    
    // Ensure minimum distance from top edge
    if (newY < margin) {
      newY = margin;
    }

    setAdjustedPosition({ x: newX, y: newY });
  }, [position, visible, data]);

  if (!visible || !data) {
    return <div style={{ display: "none" }} />;
  }

  const getRiskColor = (category: string): string => {
    switch (category) {
      case 'critical': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#eab308';
      case 'low': return '#22c55e';
      default: return 'var(--vscode-foreground)';
    }
  };

  const getRiskIcon = (category: string): string => {
    switch (category) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const getComplexityLevel = (complexity: number): string => {
    if (complexity >= 20) return 'Very High';
    if (complexity >= 10) return 'High';
    if (complexity >= 5) return 'Medium';
    return 'Low';
  };

  const getChurnLevel = (churn: number): string => {
    if (churn >= 50) return 'Very Active';
    if (churn >= 20) return 'Active';
    if (churn >= 5) return 'Moderate';
    return 'Stable';
  };

  return (
    <div
      ref={tooltipRef}
      className="rich-tooltip"
      role="tooltip"
      aria-live="polite"
      aria-label={`File information for ${data.title}`}
      style={{
        position: 'fixed',
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
        zIndex: 1000,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease-in-out',
        pointerEvents: 'none'
      }}
    >
      <div className="tooltip-content">
        {/* Header */}
        <div className="tooltip-header">
          <div className="tooltip-title">{data.title}</div>
          {data.packageInfo && (
            <div className="package-badges">
              {data.packageInfo.isMonorepoFile && (
                <span className="package-badge monorepo-badge">
                  📦 {data.packageInfo.workspacePackage || 'Monorepo'}
                </span>
              )}
              {data.packageInfo.name && (
                <span className="package-badge package-name-badge">
                  {data.packageInfo.name}
                  {data.packageInfo.version && (
                    <span className="package-version">@{data.packageInfo.version}</span>
                  )}
                </span>
              )}
            </div>
          )}
          {data.path && (
            <div className="tooltip-path" title={data.path}>
              {truncateFilePath(data.path, 60)}
            </div>
          )}
        </div>

        {/* Risk Analysis Section */}
        {data.riskData && (
          <div className="tooltip-section risk-section">
            <div className="section-header">
              <span className="section-icon">⚠️</span>
              <span className="section-title">Risk Analysis</span>
            </div>
            <div className="risk-overview">
              <div className="risk-score-container">
                <span className="risk-icon">{getRiskIcon(data.riskData.category)}</span>
                <div className="risk-score-details">
                  <div className="risk-score" style={{ color: getRiskColor(data.riskData.category) }}>
                    {Math.round(data.riskData.score * 100)}%
                  </div>
                  <div className="risk-category">{data.riskData.category.toUpperCase()}</div>
                </div>
              </div>
            </div>
            
            <div className="risk-metrics">
              <div className="metric-row">
                <span className="metric-label">Complexity:</span>
                <span className="metric-value">
                  {data.riskData.complexity} ({getComplexityLevel(data.riskData.complexity)})
                </span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Churn:</span>
                <span className="metric-value">
                  {data.riskData.churn} commits ({getChurnLevel(data.riskData.churn)})
                </span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Dependencies:</span>
                <span className="metric-value">{data.riskData.dependencies}</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Dependents:</span>
                <span className="metric-value">{data.riskData.dependents}</span>
              </div>
            </div>

            {data.riskData.recommendation && (
              <div className="tooltip-recommendation">
                <div className="recommendation-header">
                  <span className="recommendation-icon">💡</span>
                  <span className="recommendation-title">Recommendation</span>
                </div>
                <div className="recommendation-text">{data.riskData.recommendation}</div>
              </div>
            )}
          </div>
        )}

        {/* Basic Info Section */}
        {data.basicInfo && (
          <div className="tooltip-section basic-info-section">
            <div className="section-header">
              <span className="section-icon">ℹ️</span>
              <span className="section-title">File Info</span>
            </div>
            <div className="basic-info-metrics">
              <div className="metric-row">
                <span className="metric-label">Type:</span>
                <span className="metric-value">{data.basicInfo.type}</span>
              </div>
              {data.basicInfo.size && (
                <div className="metric-row">
                  <span className="metric-label">Size:</span>
                  <span className="metric-value">{data.basicInfo.size}</span>
                </div>
              )}
              {data.basicInfo.lastModified && (
                <div className="metric-row">
                  <span className="metric-label">Modified:</span>
                  <span className="metric-value">{data.basicInfo.lastModified}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Interaction Hints */}
        <div className="tooltip-section interaction-hints">
          <div className="hint-row">
            <span className="hint-text">Click to open • Ctrl+Click for split view</span>
          </div>
        </div>
      </div>
    </div>
  );
}