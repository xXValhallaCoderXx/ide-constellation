import { h } from "preact";
import { useState, useEffect } from "preact/hooks";
import "../styles/StatsOverlay.css";

export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  visibleNodes: number;
  visibleEdges: number;
  filteredNodes: number;
  filteredEdges: number;
  selectedNodes: number;
  focusedNodes: number;
  averageConnections: number;
  maxConnections: number;
  isolatedNodes: number;
  clusters: number;
  nodeSizeDistribution: {
    small: number;
    medium: number;
    large: number;
  };
  complexityDistribution: {
    low: number;
    medium: number;
    high: number;
  };
  performanceMetrics: {
    renderTime: number;
    layoutTime: number;
    lastUpdate: number;
  };
}

interface StatsOverlayProps {
  stats: GraphStats;
  isVisible: boolean;
  onToggle: () => void;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  compact?: boolean;
}

export const StatsOverlay = ({
  stats,
  isVisible,
  onToggle,
  position = "top-right",
  compact = false,
}: StatsOverlayProps) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["overview"])
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  };

  const formatTime = (ms: number): string => {
    if (ms < 1000) {
      return `${ms.toFixed(1)}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getPerformanceStatus = (
    renderTime: number
  ): "good" | "warning" | "poor" => {
    if (renderTime < 100) return "good";
    if (renderTime < 500) return "warning";
    return "poor";
  };

  const renderSection = (
    title: string,
    content: () => h.JSX.Element,
    sectionKey: string
  ) => {
    const isExpanded = expandedSections.has(sectionKey);

    return (
      <div className={`stats-section ${isExpanded ? "expanded" : "collapsed"}`}>
        <div
          className="stats-section-header"
          onClick={() => toggleSection(sectionKey)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleSection(sectionKey);
            }
          }}
        >
          <span className="stats-section-title">{title}</span>
          <span
            className={`stats-section-chevron ${isExpanded ? "expanded" : ""}`}
          >
            ▼
          </span>
        </div>
        {isExpanded && <div className="stats-section-content">{content()}</div>}
      </div>
    );
  };

  const renderOverviewStats = () => (
    <div className="stats-grid">
      <div className="stat-item">
        <span className="stat-label">Total Nodes</span>
        <span className="stat-value">{formatNumber(stats.totalNodes)}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Total Edges</span>
        <span className="stat-value">{formatNumber(stats.totalEdges)}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Visible</span>
        <span className="stat-value">
          {formatNumber(stats.visibleNodes)}/{formatNumber(stats.visibleEdges)}
        </span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Selected</span>
        <span className="stat-value">{formatNumber(stats.selectedNodes)}</span>
      </div>
      {stats.focusedNodes > 0 && (
        <div className="stat-item">
          <span className="stat-label">Focused</span>
          <span className="stat-value focused">
            {formatNumber(stats.focusedNodes)}
          </span>
        </div>
      )}
    </div>
  );

  const renderNetworkStats = () => (
    <div className="stats-grid">
      <div className="stat-item">
        <span className="stat-label">Avg Connections</span>
        <span className="stat-value">
          {stats.averageConnections.toFixed(1)}
        </span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Max Connections</span>
        <span className="stat-value">{stats.maxConnections}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Isolated Nodes</span>
        <span className="stat-value">{formatNumber(stats.isolatedNodes)}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Clusters</span>
        <span className="stat-value">{stats.clusters}</span>
      </div>
    </div>
  );

  const renderDistributionStats = () => (
    <div className="distribution-stats">
      <div className="distribution-group">
        <h4 className="distribution-title">Node Sizes</h4>
        <div className="distribution-bar">
          <div
            className="distribution-segment small"
            style={{
              width: `${
                (stats.nodeSizeDistribution.small / stats.totalNodes) * 100
              }%`,
            }}
            title={`Small: ${stats.nodeSizeDistribution.small} nodes`}
          />
          <div
            className="distribution-segment medium"
            style={{
              width: `${
                (stats.nodeSizeDistribution.medium / stats.totalNodes) * 100
              }%`,
            }}
            title={`Medium: ${stats.nodeSizeDistribution.medium} nodes`}
          />
          <div
            className="distribution-segment large"
            style={{
              width: `${
                (stats.nodeSizeDistribution.large / stats.totalNodes) * 100
              }%`,
            }}
            title={`Large: ${stats.nodeSizeDistribution.large} nodes`}
          />
        </div>
        <div className="distribution-legend">
          <span className="legend-item">
            <span className="legend-color small"></span>
            Small ({stats.nodeSizeDistribution.small})
          </span>
          <span className="legend-item">
            <span className="legend-color medium"></span>
            Medium ({stats.nodeSizeDistribution.medium})
          </span>
          <span className="legend-item">
            <span className="legend-color large"></span>
            Large ({stats.nodeSizeDistribution.large})
          </span>
        </div>
      </div>

      <div className="distribution-group">
        <h4 className="distribution-title">Complexity</h4>
        <div className="distribution-bar">
          <div
            className="distribution-segment complexity-low"
            style={{
              width: `${
                (stats.complexityDistribution.low / stats.totalNodes) * 100
              }%`,
            }}
            title={`Low: ${stats.complexityDistribution.low} nodes`}
          />
          <div
            className="distribution-segment complexity-medium"
            style={{
              width: `${
                (stats.complexityDistribution.medium / stats.totalNodes) * 100
              }%`,
            }}
            title={`Medium: ${stats.complexityDistribution.medium} nodes`}
          />
          <div
            className="distribution-segment complexity-high"
            style={{
              width: `${
                (stats.complexityDistribution.high / stats.totalNodes) * 100
              }%`,
            }}
            title={`High: ${stats.complexityDistribution.high} nodes`}
          />
        </div>
        <div className="distribution-legend">
          <span className="legend-item">
            <span className="legend-color complexity-low"></span>
            Low ({stats.complexityDistribution.low})
          </span>
          <span className="legend-item">
            <span className="legend-color complexity-medium"></span>
            Medium ({stats.complexityDistribution.medium})
          </span>
          <span className="legend-item">
            <span className="legend-color complexity-high"></span>
            High ({stats.complexityDistribution.high})
          </span>
        </div>
      </div>
    </div>
  );

  const renderPerformanceStats = () => {
    const performanceStatus = getPerformanceStatus(
      stats.performanceMetrics.renderTime
    );
    const lastUpdateTime = new Date(stats.performanceMetrics.lastUpdate);

    return (
      <div className="performance-stats">
        <div className="stat-item">
          <span className="stat-label">Render Time</span>
          <span className={`stat-value performance-${performanceStatus}`}>
            {formatTime(stats.performanceMetrics.renderTime)}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Layout Time</span>
          <span className="stat-value">
            {formatTime(stats.performanceMetrics.layoutTime)}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Last Update</span>
          <span className="stat-value timestamp">
            {lastUpdateTime.toLocaleTimeString()}
          </span>
        </div>
        <div className={`performance-indicator ${performanceStatus}`}>
          <span className="performance-status">
            Performance:{" "}
            {performanceStatus.charAt(0).toUpperCase() +
              performanceStatus.slice(1)}
          </span>
        </div>
      </div>
    );
  };

  if (!isVisible && compact) return null;

  return (
    <div
      className={`stats-overlay ${position} ${compact ? "compact" : ""} ${
        isVisible ? "visible" : "collapsed"
      }`}
    >
      <div className="stats-header">
        <h3 className="stats-title">Graph Statistics</h3>
        <div className="stats-controls">
          <button
            className="stats-toggle-button"
            onClick={onToggle}
            title={isVisible ? "Collapse statistics" : "Expand statistics"}
            aria-label={isVisible ? "Collapse statistics" : "Expand statistics"}
          >
            {isVisible ? "−" : "+"}
          </button>
        </div>
      </div>

      {isVisible && (
        <div className="stats-content">
          {!compact && (
            <>
              {renderSection("Overview", renderOverviewStats, "overview")}
              {renderSection("Network Analysis", renderNetworkStats, "network")}
              {renderSection(
                "Distribution",
                renderDistributionStats,
                "distribution"
              )}
              {renderSection(
                "Performance",
                renderPerformanceStats,
                "performance"
              )}
            </>
          )}

          {compact && (
            <div className="compact-stats">
              <div className="compact-row">
                <span>
                  Nodes: {formatNumber(stats.visibleNodes)}/
                  {formatNumber(stats.totalNodes)}
                </span>
                <span>Edges: {formatNumber(stats.visibleEdges)}</span>
              </div>
              {stats.selectedNodes > 0 && (
                <div className="compact-row">
                  <span>Selected: {stats.selectedNodes}</span>
                  {stats.focusedNodes > 0 && (
                    <span>Focused: {stats.focusedNodes}</span>
                  )}
                </div>
              )}
              <div className="compact-row">
                <span
                  className={`performance-indicator ${getPerformanceStatus(
                    stats.performanceMetrics.renderTime
                  )}`}
                >
                  {formatTime(stats.performanceMetrics.renderTime)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StatsOverlay;
