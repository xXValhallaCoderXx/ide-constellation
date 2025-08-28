import { useState } from 'preact/hooks';
import { JSX } from 'preact';
import { RichTooltip, TooltipData } from './RichTooltip';
import { ToastContainer, useToasts } from './ToastNotification';
import { LoadingIndicator } from './LoadingIndicator';
import { ContextualHelp, HelpContent } from './ContextualHelp';

/**
 * Demo component to showcase the new tooltip and feedback features
 */
export function FeatureDemo(): JSX.Element {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [loadingState, setLoadingState] = useState({ isLoading: false, progress: 0 });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const {
    toasts,
    dismissToast,
    showSuccess,
    showError,
    showWarning,
    showInfo
  } = useToasts();

  const sampleTooltipData: TooltipData = {
    title: 'sample-file.ts',
    path: 'src/components/sample-file.ts',
    riskData: {
      score: 0.75,
      category: 'high',
      complexity: 12,
      churn: 25,
      dependencies: 8,
      dependents: 6,
      recommendation: 'Consider refactoring to reduce complexity and improve maintainability.'
    }
  };

  const demoHelpContent: HelpContent = {
    title: 'Feature Demo',
    description: 'This demo shows the new tooltip and feedback systems.',
    shortcuts: [
      { key: 'Hover', description: 'Show rich tooltip' },
      { key: 'Click', description: 'Trigger notifications' }
    ],
    tips: [
      'All components support light and dark themes',
      'Tooltips automatically position themselves within viewport',
      'Toast notifications stack and auto-dismiss'
    ]
  };

  const handleMouseMove = (e: MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  };

  const simulateLoading = () => {
    setLoadingState({ isLoading: true, progress: 0 });
    
    const interval = setInterval(() => {
      setLoadingState(prev => {
        const newProgress = prev.progress + 10;
        if (newProgress >= 100) {
          clearInterval(interval);
          showSuccess('Demo Complete', 'Loading simulation finished successfully!');
          return { isLoading: false, progress: 100 };
        }
        return { isLoading: true, progress: newProgress };
      });
    }, 200);
  };

  return (
    <div style={{
      padding: '20px',
      fontFamily: 'var(--vscode-font-family)',
      color: 'var(--vscode-foreground)',
      backgroundColor: 'var(--vscode-editor-background)',
      minHeight: '400px',
      position: 'relative'
    }}>
      <h2>Enhanced UI Features Demo</h2>
      
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <button
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          onClick={() => showSuccess('Success!', 'This is a success notification with auto-dismiss.')}
        >
          Show Success Toast
        </button>

        <button
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          onClick={() => showError('Error!', 'This is an error notification that stays longer.')}
        >
          Show Error Toast
        </button>

        <button
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          onClick={() => showWarning('Warning!', 'This is a warning with an action button.', {
            action: {
              label: 'Fix It',
              onClick: () => showInfo('Fixed!', 'Action button clicked!')
            }
          })}
        >
          Show Warning Toast
        </button>

        <button
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          onClick={simulateLoading}
          disabled={loadingState.isLoading}
        >
          {loadingState.isLoading ? 'Loading...' : 'Simulate Loading'}
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div
          style={{
            padding: '20px',
            border: '2px dashed var(--vscode-panel-border)',
            borderRadius: '8px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: 'var(--vscode-panel-background)'
          }}
          onMouseEnter={(e) => {
            setTooltipVisible(true);
            setMousePosition({ x: e.clientX, y: e.clientY });
          }}
          onMouseLeave={() => setTooltipVisible(false)}
          onMouseMove={handleMouseMove as any}
        >
          <strong>Hover over this area to see the rich tooltip!</strong>
          <br />
          <small>This demonstrates the new tooltip system with risk analysis data.</small>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <span>Contextual Help Example:</span>
        <ContextualHelp
          content={demoHelpContent}
          position="bottom-right"
          trigger="hover"
          size="medium"
        />
      </div>

      {/* Loading Indicator */}
      {loadingState.isLoading && (
        <LoadingIndicator
          state={{
            isLoading: true,
            message: 'Demo Loading...',
            progress: loadingState.progress,
            type: 'progress',
            subMessage: `${loadingState.progress}% complete`
          }}
          size="medium"
          overlay={false}
          position="center"
        />
      )}

      {/* Rich Tooltip */}
      <RichTooltip
        data={tooltipVisible ? sampleTooltipData : null}
        position={mousePosition}
        visible={tooltipVisible}
        theme="auto"
      />

      {/* Toast Notifications */}
      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </div>
  );
}