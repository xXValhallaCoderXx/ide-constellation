import { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useHealthAnalysis } from './hooks/useHealthAnalysis';
import { deriveHealthStatus } from '@/services/health/health.services';
import { ScoreHeader } from './components/ScoreHeader';
import { DistributionGrid } from './components/DistributionGrid';
import { RiskList } from './components/RiskList';
import { Recommendations } from './components/Recommendations';
import { Button } from '@/webview/components/molecules/Button';

export function HealthDashboard(): JSX.Element {
  const { analysis, loading, error, exportResult, actions } = useHealthAnalysis();
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);

  // On mount: request analysis; provider may push cached first; we force background refresh
  useEffect(() => {
    actions.ensureRequested(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const header = (() => {
    const score = analysis?.healthScore ?? 0;
    const { label, color } = deriveHealthStatus(score);
    return (
      <ScoreHeader
        score={score}
        totalFiles={analysis?.totalFiles ?? 0}
        statusLabel={label}
        statusColor={color}
        timestamp={analysis?.timestamp}
      />
    );
  })();

  const actionsBar = (
    <div className="actions" style={{ textAlign: 'center', margin: '12px 0' }}>
      <Button onClick={() => actions.refresh()} >🔄 Refresh Analysis</Button>
      <Button onClick={() => actions.export('json')} >📊 Export JSON</Button>
      <Button onClick={() => actions.export('csv')} >📊 Export CSV</Button>
      <Button onClick={() => actions.showHeatmap()} >🔥 Show Heatmap</Button>
    </div>
  );

  const statsGrid = analysis && (
    <DistributionGrid distribution={analysis.distribution} totalFiles={analysis.totalFiles} />
  );

  const topRisks = analysis && analysis.topRisks.length > 0 && (
    <RiskList
      risks={analysis.topRisks}
      selectedId={selectedRiskId ?? undefined}
      onSelect={(id) => setSelectedRiskId(id)}
      onOpenFile={(id, mode) => actions.openFile(id, mode)}
      onFocusGraph={(id) => actions.focusNode(id)}
    />
  );

  const recommendations = analysis && (
    <Recommendations items={analysis.recommendations} />
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