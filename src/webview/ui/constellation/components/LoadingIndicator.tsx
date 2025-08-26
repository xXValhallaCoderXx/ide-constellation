import { JSX } from 'preact';

export interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number; // 0-100
  subMessage?: string;
  type?: 'spinner' | 'progress' | 'dots' | 'pulse';
}

interface LoadingIndicatorProps {
  state: LoadingState;
  size?: 'small' | 'medium' | 'large';
  overlay?: boolean;
  position?: 'center' | 'top-right' | 'bottom-right';
}

export function LoadingIndicator({ 
  state, 
  size = 'medium', 
  overlay = false,
  position = 'center'
}: LoadingIndicatorProps): JSX.Element | null {
  if (!state.isLoading) {
    return null;
  }

  const renderSpinner = () => (
    <div className={`loading-spinner ${size}`}>
      <div className="spinner-ring">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
    </div>
  );

  const renderProgress = () => (
    <div className={`loading-progress ${size}`}>
      <div className="progress-circle">
        <svg viewBox="0 0 36 36" className="progress-svg">
          <path
            className="progress-bg"
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            className="progress-bar"
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
            style={{
              strokeDasharray: `${state.progress || 0}, 100`
            }}
          />
        </svg>
        <div className="progress-text">
          {Math.round(state.progress || 0)}%
        </div>
      </div>
    </div>
  );

  const renderDots = () => (
    <div className={`loading-dots ${size}`}>
      <div className="dot"></div>
      <div className="dot"></div>
      <div className="dot"></div>
    </div>
  );

  const renderPulse = () => (
    <div className={`loading-pulse ${size}`}>
      <div className="pulse-ring"></div>
      <div className="pulse-ring"></div>
      <div className="pulse-ring"></div>
    </div>
  );

  const renderLoadingAnimation = () => {
    switch (state.type) {
      case 'progress':
        return renderProgress();
      case 'dots':
        return renderDots();
      case 'pulse':
        return renderPulse();
      case 'spinner':
      default:
        return renderSpinner();
    }
  };

  const content = (
    <div className={`loading-content ${size}`}>
      {renderLoadingAnimation()}
      {state.message && (
        <div className="loading-message">{state.message}</div>
      )}
      {state.subMessage && (
        <div className="loading-sub-message">{state.subMessage}</div>
      )}
    </div>
  );

  if (overlay) {
    return (
      <div className={`loading-overlay ${position}`}>
        <div className="loading-backdrop" />
        {content}
      </div>
    );
  }

  return (
    <div className={`loading-indicator ${position}`}>
      {content}
    </div>
  );
}

// Specialized loading components
export function GraphLoadingIndicator({ message = "Loading graph..." }: { message?: string }): JSX.Element {
  return (
    <LoadingIndicator
      state={{
        isLoading: true,
        message,
        type: 'spinner'
      }}
      size="large"
      overlay={true}
      position="center"
    />
  );
}

export function HeatmapLoadingIndicator({ 
  progress, 
  message = "Processing heatmap..." 
}: { 
  progress?: number; 
  message?: string; 
}): JSX.Element {
  return (
    <LoadingIndicator
      state={{
        isLoading: true,
        message,
        progress,
        type: progress !== undefined ? 'progress' : 'spinner',
        subMessage: progress !== undefined ? `${Math.round(progress)}% complete` : undefined
      }}
      size="medium"
      overlay={false}
      position="top-right"
    />
  );
}

export function AnalysisLoadingIndicator({ 
  stage = "Analyzing codebase..." 
}: { 
  stage?: string; 
}): JSX.Element {
  return (
    <LoadingIndicator
      state={{
        isLoading: true,
        message: "Health Analysis",
        subMessage: stage,
        type: 'dots'
      }}
      size="large"
      overlay={true}
      position="center"
    />
  );
}