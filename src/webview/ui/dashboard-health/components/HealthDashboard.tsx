import { useState, useEffect } from 'preact/hooks';
import { JSX } from 'preact';
import { HealthAnalysis, RiskScore } from '../../../../types/health-analysis.types';
import { ToastContainer, useToasts } from '../../graph-constellation/components/ToastNotification';
import { AnalysisLoadingIndicator } from '../../graph-constellation/components/LoadingIndicator';
import { DashboardHelp } from '../../graph-constellation/components/ContextualHelp';
import '../../../../types/vscode-api.types';
import '../../graph-constellation/styles/toast-notification.css';
import '../../graph-constellation/styles/loading-indicator.css';
import '../../graph-constellation/styles/contextual-help.css';

interface HealthDashboardProps {
  analysis?: HealthAnalysis;
  onNavigateToGraph?: (nodeId?: string) => void;
  onOpenFile?: (nodeId: string, openMode?: 'default' | 'split') => void;
}

interface DashboardState {
  analysis: HealthAnalysis | null;
  isLoading: boolean;
  error: string | null;
  selectedRisk: RiskScore | null;
}

export function HealthDashboard({ 
  analysis: initialAnalysis, 
  onNavigateToGraph, 
  onOpenFile 
}: HealthDashboardProps): JSX.Element {
  const [state, setState] = useState<DashboardState>({
    analysis: initialAnalysis || null,
    isLoading: !initialAnalysis,
    error: null,
    selectedRisk: null
  });

  // Toast notifications
  const {
    toasts,
    dismissToast,
    showSuccess,
    showError,
    showWarning,
    showInfo
  } = useToasts();

  useEffect(() => {
    // Listen for messages from the extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.command) {
        case 'health:response':
          setState(prev => ({
            ...prev,
            analysis: message.data.analysis,
            isLoading: false,
            error: null
          }));
          break;
        case 'health:error':
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: message.data.error
          }));
          break;
        case 'dashboard:notification':
          // Handle notifications from the extension
          const { type, message: notificationMessage } = message.data;
          if (type === 'warning' || type === 'error') {
            setState(prev => ({
              ...prev,
              error: notificationMessage
            }));
          }
          break;
        case 'health:loading':
          setState(prev => ({
            ...prev,
            isLoading: true,
            error: null
          }));
          break;
        case 'dashboard:highlightRisk':
          // Highlight a specific risk in the dashboard
          const riskToHighlight = state.analysis?.riskScores.find(r => r.nodeId === message.data.nodeId);
          if (riskToHighlight) {
            setState(prev => ({
              ...prev,
              selectedRisk: riskToHighlight
            }));
          }
          break;
        default:
          // Ignore unknown messages
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Request health analysis if not provided
    if (!initialAnalysis) {
      setTimeout(() => {
        if (window.vscode) {
          setState(prev => ({ ...prev, isLoading: true, error: null }));
          window.vscode.postMessage({ command: 'health:request' });
        }
      }, 50);
    }

    return () => window.removeEventListener('message', handleMessage);
  }, [initialAnalysis]);

  const handleViewHeatmap = () => {
    try {
      // Check if we have analysis data
      if (!state.analysis) {
        showWarning('No Analysis Data', 'Please run a health analysis first before viewing the heatmap.');
        console.warn('No analysis data available for heatmap');
        if (window.vscode) {
          window.vscode.postMessage({ 
            command: 'health:request',
            data: { forceRefresh: true }
          });
        }
        return;
      }

      showInfo('Opening Heatmap', 'Switching to graph view with risk visualization...');

      if (onNavigateToGraph) {
        onNavigateToGraph(state.selectedRisk?.nodeId);
      } else if (window.vscode) {
        window.vscode.postMessage({ 
          command: 'health:showHeatmap',
          data: { 
            centerNode: state.selectedRisk?.nodeId,
            analysis: state.analysis
          }
        });
      } else {
        showError('Navigation Error', 'Unable to open heatmap view. Please try refreshing the page.');
        console.warn('No navigation method available for heatmap');
      }
    } catch (error) {
      console.error('Error handling heatmap view:', error);
      showError('Heatmap Error', 'Failed to show heatmap. Please try refreshing the analysis.');
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to show heatmap. Please try refreshing the analysis.' 
      }));
    }
  };

  const handleRiskClick = (risk: RiskScore, event: MouseEvent) => {
    try {
      if (!risk || !risk.nodeId) {
        showWarning('Invalid Selection', 'Unable to open this file. Please try selecting another.');
        console.warn('Invalid risk data for click handler');
        return;
      }

      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      const openMode = isCtrlOrCmd ? 'split' : 'default';
      
      setState(prev => ({ ...prev, selectedRisk: risk }));
      
      // Show feedback for file opening
      const fileName = risk.metrics.path.split('/').pop() || risk.metrics.path;
      console.log('[HealthDashboard] Showing toast notification for file opening:', fileName);
      showInfo(
        'Opening File',
        `Opening ${fileName}${openMode === 'split' ? ' in split view' : ''}...`
      );
      
      if (onOpenFile) {
        onOpenFile(risk.nodeId, openMode);
      } else if (window.vscode) {
        window.vscode.postMessage({ 
          command: 'editor:open', 
          data: { 
            fileId: risk.nodeId, 
            openMode 
          }
        });
      } else {
        showError('File Opening Error', 'Unable to open file. Please try refreshing the page.');
        console.warn('No file opening method available');
      }
    } catch (error) {
      console.error('Error handling risk click:', error);
      showError('File Error', 'Failed to open file. Please try again.');
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to open file. Please try again.' 
      }));
    }
  };

  const handleNavigateToGraph = (nodeId: string) => {
    try {
      if (!nodeId) {
        showWarning('Navigation Error', 'Unable to focus on this file in the graph.');
        console.warn('No node ID provided for graph navigation');
        return;
      }

      setState(prev => ({ 
        ...prev, 
        selectedRisk: prev.analysis?.riskScores.find(r => r.nodeId === nodeId) || null 
      }));
      
      const fileName = state.analysis?.riskScores.find(r => r.nodeId === nodeId)?.metrics.path.split('/').pop();
      showInfo('Focusing Graph', `Centering graph on ${fileName || 'selected file'}...`);
      
      if (onNavigateToGraph) {
        onNavigateToGraph(nodeId);
      } else if (window.vscode) {
        window.vscode.postMessage({ 
          command: 'health:focusNode',
          data: { nodeId }
        });
      } else {
        showError('Navigation Error', 'Unable to navigate to graph. Please try refreshing the page.');
        console.warn('No graph navigation method available');
      }
    } catch (error) {
      console.error('Error navigating to graph:', error);
      showError('Navigation Error', 'Failed to navigate to graph. Please try again.');
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to navigate to graph. Please try again.' 
      }));
    }
  };


  const getRiskCategoryIcon = (category: string): string => {
    switch (category) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  if (state.isLoading) {
    return (
      <div className="health-dashboard loading">
        <AnalysisLoadingIndicator stage="Analyzing codebase health..." />
      </div>
    );
  }

  if (state.error) {
    const isGraphError = state.error.includes('Graph') || state.error.includes('heatmap');
    const isDataError = state.error.includes('data') || state.error.includes('analysis');
    
    return (
      <div className="health-dashboard error">
        <div className="error-container">
          <h2>Health Analysis Error</h2>
          <p className="error-message">{state.error}</p>
          
          <div className="error-actions">
            <button 
              className="retry-button primary"
              onClick={() => {
                if (window.vscode) {
                  setState(prev => ({ ...prev, isLoading: true, error: null }));
                  window.vscode.postMessage({ 
                    command: 'health:request',
                    data: { forceRefresh: true }
                  });
                }
              }}
            >
              <span className="button-icon">🔄</span>
              Retry Analysis
            </button>
            
            {isGraphError && (
              <button 
                className="retry-button secondary"
                onClick={() => {
                  setState(prev => ({ ...prev, error: null }));
                }}
              >
                <span className="button-icon">📊</span>
                Continue with Dashboard Only
              </button>
            )}
            
            {isDataError && (
              <button 
                className="retry-button secondary"
                onClick={() => {
                  if (window.vscode) {
                    window.vscode.postMessage({ command: 'graph:request' });
                  }
                }}
              >
                <span className="button-icon">🗺️</span>
                View Graph Instead
              </button>
            )}
          </div>
          
          <div className="error-help">
            <details>
              <summary>Troubleshooting Tips</summary>
              <ul>
                <li>Ensure your project has been scanned recently</li>
                <li>Check that you have a valid workspace open</li>
                <li>Try refreshing the analysis with force refresh</li>
                <li>If graph issues persist, use dashboard-only mode</li>
              </ul>
            </details>
          </div>
        </div>
      </div>
    );
  }

  if (!state.analysis) {
    return (
      <div className="health-dashboard empty">
        <div className="empty-container">
          <h2>No Health Data Available</h2>
          <p>Please run a health analysis to view the dashboard.</p>
          <div className="empty-actions">
            <button 
              className="action-button primary"
              onClick={() => {
                if (window.vscode) {
                  setState(prev => ({ ...prev, isLoading: true, error: null }));
                  window.vscode.postMessage({ 
                    command: 'health:request',
                    data: { forceRefresh: true }
                  });
                }
              }}
            >
              <span className="button-icon">🔍</span>
              Run Health Analysis
            </button>
            <button 
              className="action-button secondary"
              onClick={() => {
                if (window.vscode) {
                  window.vscode.postMessage({ command: 'graph:request' });
                }
              }}
            >
              <span className="button-icon">📊</span>
              View Graph Only
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { analysis } = state;
  const healthScoreColor = analysis.healthScore >= 80 ? '#22c55e' : 
                          analysis.healthScore >= 60 ? '#eab308' : 
                          analysis.healthScore >= 40 ? '#f97316' : '#ef4444';

  return (
    <div className="health-dashboard">
      <div className="dashboard-header">
        <h1>Codebase Health Report</h1>
        <div className="header-actions">
          <div className="timestamp">
            Generated: {new Date(analysis.timestamp).toLocaleString()}
          </div>
          <DashboardHelp />
        </div>
      </div>

      {/* Health Score Section */}
      <div className="health-score-section">
        <div className="health-score-card">
          <div className="score-circle" style={{ borderColor: healthScoreColor }}>
            <span className="score-value" style={{ color: healthScoreColor }}>
              {analysis.healthScore}
            </span>
            <span className="score-label">Health Score</span>
          </div>
          <div className="score-details">
            <p className="score-description">
              {analysis.healthScore >= 80 ? 'Excellent' :
               analysis.healthScore >= 60 ? 'Good' :
               analysis.healthScore >= 40 ? 'Fair' : 'Needs Attention'}
            </p>
            <p className="files-analyzed">{analysis.totalFiles} files analyzed</p>
          </div>
        </div>
      </div>

      {/* Risk Distribution */}
      <div className="risk-distribution-section">
        <h2>Risk Distribution</h2>
        <div className="distribution-grid">
          <div className="distribution-item low">
            <span className="distribution-icon">🟢</span>
            <div className="distribution-details">
              <span className="distribution-count">{analysis.distribution.low}</span>
              <span className="distribution-label">Low Risk</span>
              <span className="distribution-percentage">
                {Math.round((analysis.distribution.low / analysis.totalFiles) * 100)}%
              </span>
            </div>
          </div>
          <div className="distribution-item medium">
            <span className="distribution-icon">🟡</span>
            <div className="distribution-details">
              <span className="distribution-count">{analysis.distribution.medium}</span>
              <span className="distribution-label">Medium Risk</span>
              <span className="distribution-percentage">
                {Math.round((analysis.distribution.medium / analysis.totalFiles) * 100)}%
              </span>
            </div>
          </div>
          <div className="distribution-item high">
            <span className="distribution-icon">🟠</span>
            <div className="distribution-details">
              <span className="distribution-count">{analysis.distribution.high}</span>
              <span className="distribution-label">High Risk</span>
              <span className="distribution-percentage">
                {Math.round((analysis.distribution.high / analysis.totalFiles) * 100)}%
              </span>
            </div>
          </div>
          <div className="distribution-item critical">
            <span className="distribution-icon">🔴</span>
            <div className="distribution-details">
              <span className="distribution-count">{analysis.distribution.critical}</span>
              <span className="distribution-label">Critical Risk</span>
              <span className="distribution-percentage">
                {Math.round((analysis.distribution.critical / analysis.totalFiles) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Actions */}
      <div className="dashboard-actions">
        <button 
          className="action-button primary"
          onClick={handleViewHeatmap}
          title="View risk heatmap overlay on the dependency graph"
        >
          <span className="button-icon">🗺️</span>
          View Heatmap on Graph
        </button>
        <button 
          className="action-button secondary"
          onClick={() => {
            if (window.vscode) {
              window.vscode.postMessage({ command: 'health:refresh' });
            }
          }}
          title="Refresh health analysis with latest data"
        >
          <span className="button-icon">🔄</span>
          Refresh Analysis
        </button>
        <button 
          className="action-button secondary"
          onClick={() => {
            console.log('[HealthDashboard] Test button clicked');
            showSuccess('Test Success!', 'Toast notifications are working correctly!');
          }}
          title="Test toast notifications"
          style={{ backgroundColor: 'var(--vscode-testing-iconPassed)' }}
        >
          <span className="button-icon">🧪</span>
          Test Notifications
        </button>
      </div>

      {/* Top Risk Files */}
      <div className="top-risks-section">
        <h2>Top Risk Files</h2>
        <div className="risk-list">
          {analysis.topRisks.map((risk, index) => (
            <div 
              key={risk.nodeId}
              className={`risk-item ${risk.category} ${state.selectedRisk?.nodeId === risk.nodeId ? 'selected' : ''}`}
              onClick={(e) => handleRiskClick(risk, e as any)}
              title={`Click to open file, Ctrl+Click to open in split pane`}
            >
              <div className="risk-rank">#{index + 1}</div>
              <div className="risk-icon">
                {getRiskCategoryIcon(risk.category)}
              </div>
              <div className="risk-details">
                <div className="risk-file-name">
                  {risk.metrics.path.split('/').pop() || risk.metrics.path}
                </div>
                <div className="risk-file-path">
                  {risk.metrics.path}
                </div>
                <div className="risk-metrics">
                  <span className="metric">
                    Complexity: {risk.metrics.complexity.cyclomaticComplexity || 0}
                  </span>
                  <span className="metric">
                    Churn: {risk.metrics.churn.commitCount}
                  </span>
                  <span className="metric">
                    Dependencies: {risk.metrics.dependencies}
                  </span>
                </div>
              </div>
              <div className="risk-score">
                <div 
                  className="risk-score-bar"
                  style={{ 
                    backgroundColor: risk.color,
                    width: `${risk.score * 100}%`
                  }}
                ></div>
                <span className="risk-score-text">
                  {Math.round(risk.score * 100)}%
                </span>
              </div>
              <button 
                className="navigate-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigateToGraph(risk.nodeId);
                }}
                title="Focus this file in the dependency graph"
              >
                <span className="button-icon">🎯</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="recommendations-section">
        <h2>Recommendations</h2>
        <div className="recommendations-list">
          {analysis.recommendations.map((recommendation, index) => (
            <div key={index} className="recommendation-item">
              <span className="recommendation-icon">💡</span>
              <span className="recommendation-text">{recommendation}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Toast Notifications */}
      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </div>
  );
}