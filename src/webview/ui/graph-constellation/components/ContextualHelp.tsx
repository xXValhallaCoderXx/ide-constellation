import { useState } from 'preact/hooks';
import { JSX } from 'preact';

export interface HelpContent {
  title: string;
  description: string;
  shortcuts?: Array<{
    key: string;
    description: string;
  }>;
  tips?: string[];
  examples?: Array<{
    title: string;
    description: string;
  }>;
}

interface ContextualHelpProps {
  content: HelpContent;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  trigger?: 'hover' | 'click' | 'always';
  size?: 'small' | 'medium' | 'large';
}

export function ContextualHelp({ 
  content, 
  position = 'top-right',
  trigger = 'hover',
  size = 'medium'
}: ContextualHelpProps): JSX.Element {
  const [isVisible, setIsVisible] = useState(trigger === 'always');

  const handleTrigger = () => {
    if (trigger === 'click') {
      setIsVisible(!isVisible);
    }
  };

  const handleMouseEnter = () => {
    if (trigger === 'hover') {
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover') {
      setIsVisible(false);
    }
  };

  return (
    <div className={`contextual-help ${position} ${size}`}>
      <button
        className="help-trigger"
        onClick={handleTrigger}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label="Show help information"
        title="Click for help"
      >
        <span className="help-icon">❓</span>
      </button>
      
      {isVisible && (
        <div 
          className="help-content"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="help-header">
            <h3 className="help-title">{content.title}</h3>
            {trigger === 'click' && (
              <button 
                className="help-close"
                onClick={() => setIsVisible(false)}
                aria-label="Close help"
              >
                ✕
              </button>
            )}
          </div>
          
          <div className="help-body">
            <p className="help-description">{content.description}</p>
            
            {content.shortcuts && content.shortcuts.length > 0 && (
              <div className="help-section">
                <h4 className="help-section-title">Keyboard Shortcuts</h4>
                <div className="shortcuts-list">
                  {content.shortcuts.map((shortcut, index) => (
                    <div key={index} className="shortcut-item">
                      <kbd className="shortcut-key">{shortcut.key}</kbd>
                      <span className="shortcut-description">{shortcut.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {content.tips && content.tips.length > 0 && (
              <div className="help-section">
                <h4 className="help-section-title">Tips</h4>
                <ul className="tips-list">
                  {content.tips.map((tip, index) => (
                    <li key={index} className="tip-item">
                      <span className="tip-icon">💡</span>
                      <span className="tip-text">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {content.examples && content.examples.length > 0 && (
              <div className="help-section">
                <h4 className="help-section-title">Examples</h4>
                <div className="examples-list">
                  {content.examples.map((example, index) => (
                    <div key={index} className="example-item">
                      <div className="example-title">{example.title}</div>
                      <div className="example-description">{example.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Predefined help content for common scenarios
export const GRAPH_HELP_CONTENT: HelpContent = {
  title: "Graph Navigation",
  description: "Interactive dependency graph showing your codebase structure and relationships.",
  shortcuts: [
    { key: "Click", description: "Open file in editor" },
    { key: "Ctrl/Cmd + Click", description: "Open file in split view" },
    { key: "Mouse Wheel", description: "Zoom in/out" },
    { key: "Drag", description: "Pan around the graph" }
  ],
  tips: [
    "Hover over nodes to see detailed information",
    "Use the search box to find specific files",
    "Highlighted nodes show active editor files",
    "Risk colors indicate code health when heatmap is active"
  ]
};

export const HEATMAP_HELP_CONTENT: HelpContent = {
  title: "Risk Heatmap",
  description: "Visual overlay showing code health and risk levels across your project.",
  shortcuts: [
    { key: "Toggle Button", description: "Show/hide heatmap overlay" },
    { key: "Hover", description: "View detailed risk metrics" },
    { key: "Click", description: "Navigate to file and dashboard" }
  ],
  tips: [
    "Red nodes indicate high-risk files that need attention",
    "Green nodes are healthy with low risk",
    "Risk is calculated from complexity, churn, and dependencies",
    "Use the dashboard for detailed analysis"
  ],
  examples: [
    {
      title: "Critical Risk (Red)",
      description: "High complexity + frequent changes + many dependencies"
    },
    {
      title: "Low Risk (Green)", 
      description: "Simple code + stable + few dependencies"
    }
  ]
};

export const DASHBOARD_HELP_CONTENT: HelpContent = {
  title: "Health Dashboard",
  description: "Comprehensive analysis of your codebase health with actionable insights.",
  shortcuts: [
    { key: "Click File", description: "Open in editor" },
    { key: "Ctrl/Cmd + Click", description: "Open in split view" },
    { key: "Navigate Button", description: "Focus file in graph" }
  ],
  tips: [
    "Health score is calculated from multiple risk factors",
    "Top risk files need immediate attention",
    "Recommendations provide actionable next steps",
    "Use 'View Heatmap' to see visual patterns"
  ]
};

// Specialized help components
export function GraphHelp(): JSX.Element {
  return (
    <ContextualHelp
      content={GRAPH_HELP_CONTENT}
      position="top-right"
      trigger="hover"
      size="large"
    />
  );
}

export function HeatmapHelp(): JSX.Element {
  return (
    <ContextualHelp
      content={HEATMAP_HELP_CONTENT}
      position="top-left"
      trigger="click"
      size="medium"
    />
  );
}

export function DashboardHelp(): JSX.Element {
  return (
    <ContextualHelp
      content={DASHBOARD_HELP_CONTENT}
      position="top-right"
      trigger="hover"
      size="medium"
    />
  );
}