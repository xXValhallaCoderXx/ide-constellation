import { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { useHealthAnalysis } from './hooks/useHealthAnalysis';
import { deriveHealthStatus } from '@/services/health/health.services';

export function HealthDashboard(): JSX.Element {
  const { analysis, loading, error, exportResult, actions } = useHealthAnalysis();

  // On mount: request analysis; provider may push cached first; we force background refresh
  useEffect(() => {
    actions.ensureRequested(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const header = (() => {
    const score = analysis?.healthScore ?? 0;
    const { label, color } = deriveHealthStatus(score);
    return (
      <div className="header" style={{ textAlign: 'center', marginBottom: 16, padding: 16, borderRadius: 8, background: 'var(--vscode-editor-inactiveSelectionBackground)' }}>
        <h1 style={{ margin: 0 }}>Codebase Health Ansssalysis</h1>
        <div className="health-score" style={{ fontSize: '2.5em', fontWeight: 700, color, margin: '8px 0' }}>
          {score}/100
        </div>
        <div className="health-status" style={{ fontSize: '1.1em', color }}>{label}</div>
        {analysis && (
          <div style={{ color: 'var(--vscode-descriptionForeground)' }}>Analyzed {analysis.totalFiles} files</div>
        )}
      </div>
    );
  })();

  const actionsBar = (
    <div className="actions" style={{ textAlign: 'center', margin: '12px 0' }}>
      <button className="action-button" onClick={() => actions.refresh()} style={btnStyle}>🔄 Refresh Analysis</button>
      <button className="action-button" onClick={() => actions.export('json')} style={btnStyle}>📊 Export JSON</button>
      <button className="action-button" onClick={() => actions.export('csv')} style={btnStyle}>📊 Export CSV</button>
      <button className="action-button" onClick={() => actions.showHeatmap()} style={btnStyle}>🔥 Show Heatmap</button>
    </div>
  );

  const statsGrid = analysis && (
    <div className="stats-grid" style={gridStyle}>
      <StatCard label={`Critical (${percent(analysis.distribution.critical, analysis.totalFiles)}%)`} value={analysis.distribution.critical} tone="#ef4444" />
      <StatCard label={`High (${percent(analysis.distribution.high, analysis.totalFiles)}%)`} value={analysis.distribution.high} tone="#f97316" />
      <StatCard label={`Medium (${percent(analysis.distribution.medium, analysis.totalFiles)}%)`} value={analysis.distribution.medium} tone="#eab308" />
      <StatCard label={`Low (${percent(analysis.distribution.low, analysis.totalFiles)}%)`} value={analysis.distribution.low} tone="#22c55e" />
    </div>
  );

  const topRisks = analysis && analysis.topRisks.length > 0 && (
    <Section title="🚨 Top Risk Files">
      <div>
        {analysis.topRisks.map((risk) => (
          <div
            key={risk.nodeId}
            className="risk-file"
            style={riskRowStyle}
            onClick={() => actions.openFile(risk.metrics.path)}
            title="Open file in editor"
          >
            <span className="file-path" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace', fontSize: '0.9em' }}>
              {risk.metrics.path}
            </span>
            <span className="risk-badge" style={{ padding: '4px 8px', borderRadius: 4, fontSize: '0.8em', fontWeight: 700, textTransform: 'uppercase', color: categoryColor(risk.category) }}>
              {risk.category}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );

  const recommendations = analysis && (
    <Section title="💡 Recommendations">
      <div>
        {analysis.recommendations.map((rec, idx) => (
          <div key={idx} className="recommendation" style={recStyle}>
            {rec}
          </div>
        ))}
      </div>
    </Section>
  );

  return (
    <div className="health-dashboard" style={{ padding: 16 }}>
      {header}

      {actionsBar}

      {loading && <InfoBanner tone="info" text="Loading health analysis..." />}
      {error && <InfoBanner tone="error" text={error} />}
      {exportResult && exportResult.success && <InfoBanner tone="success" text={`Exported ${exportResult.format.toUpperCase()} to ${exportResult.uri || 'selected location'}`} />}
      {exportResult && !exportResult.success && <InfoBanner tone="warning" text={`Export failed: ${exportResult.error}`} />}

      {statsGrid}
      {topRisks}
      {recommendations}
    </div>
  );
}

function StatCard(props: { label: string; value: number; tone: string }) {
  return (
    <div className="stat-card" style={{ padding: 16, borderRadius: 8, background: 'var(--vscode-editor-inactiveSelectionBackground)', textAlign: 'center' }}>
      <div className="stat-number" style={{ fontSize: '1.8em', fontWeight: 700, color: props.tone }}>{props.value}</div>
      <div className="stat-label" style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '0.9em' }}>{props.label}</div>
    </div>
  );
}

function Section(props: { title: string; children: any }) {
  return (
    <div className="section" style={{ margin: '16px 0', padding: 16, borderRadius: 8, background: 'var(--vscode-editor-inactiveSelectionBackground)' }}>
      <h2 style={{ marginTop: 0, borderBottom: '1px solid var(--vscode-panel-border)', paddingBottom: 8 }}>{props.title}</h2>
      {props.children}
    </div>
  );
}

function InfoBanner(props: { tone: 'info' | 'warning' | 'error' | 'success'; text: string }) {
  const color = ({
    info: 'var(--vscode-textLink-foreground)',
    warning: '#f97316',
    error: '#ef4444',
    success: '#22c55e',
  } as const)[props.tone];

  return (
    <div style={{ margin: '8px 0', padding: '10px 12px', borderRadius: 4, borderLeft: `4px solid ${color}`, background: 'var(--vscode-list-hoverBackground)' }}>
      <span>{props.text}</span>
    </div>
  );
}

const btnStyle: any = {
  backgroundColor: 'var(--vscode-button-background)',
  color: 'var(--vscode-button-foreground)',
  border: 'none',
  padding: '8px 12px',
  margin: '0 6px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.9em',
};

const gridStyle: any = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 16,
  margin: '16px 0',
};

const riskRowStyle: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 12px',
  margin: '6px 0',
  borderRadius: 4,
  background: 'var(--vscode-list-hoverBackground)',
  cursor: 'pointer',
};

const recStyle: any = {
  padding: 12,
  margin: '8px 0',
  borderRadius: 4,
  background: 'var(--vscode-list-hoverBackground)',
  borderLeft: '4px solid var(--vscode-textLink-foreground)',
};

function percent(n: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.round((n / total) * 100);
}

function categoryColor(cat: 'low' | 'medium' | 'high' | 'critical'): string {
  switch (cat) {
    case 'critical': return '#ef4444';
    case 'high': return '#f97316';
    case 'medium': return '#eab308';
    case 'low': return '#22c55e';
  }
}