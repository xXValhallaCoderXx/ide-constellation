import { JSX } from 'preact';
import type { RiskScore } from '@/types/health-analysis.types';

export interface RiskListProps {
    risks: RiskScore[];
    selectedId?: string | null;
    onSelect: (id: string) => void;
    onOpenFile: (id: string, mode: 'default' | 'split') => void;
    onFocusGraph: (id: string) => void;
}

/**
 * RiskList
 * - Renders selectable list of top risk files
 * - Click opens file (Ctrl/Cmd+Click opens in split view)
 * - Keyboard:
 *   - Enter opens default
 *   - Shift+Enter opens split
 *   - Focus outlines via CSS
 */
export function RiskList(props: RiskListProps): JSX.Element {
    const { risks, selectedId, onSelect, onOpenFile, onFocusGraph } = props;

    const handleClick = (risk: RiskScore, ev: MouseEvent) => {
        const isSplit = (ev.ctrlKey || (ev as any).metaKey) ? 'split' : 'default';
        onSelect(risk.nodeId);
        onOpenFile(risk.nodeId, isSplit);
    };

    const handleKeyDown = (risk: RiskScore, ev: KeyboardEvent) => {
        if (ev.key === 'Enter') {
            const mode: 'default' | 'split' = ev.shiftKey ? 'split' : 'default';
            onSelect(risk.nodeId);
            onOpenFile(risk.nodeId, mode);
            ev.preventDefault();
        }
    };

    const colorForCategory = (cat: RiskScore['category']): string => {
        switch (cat) {
            case 'critical': return '#ef4444';
            case 'high': return '#f97316';
            case 'medium': return '#eab308';
            case 'low': return '#22c55e';
        }
    };

    return (
        <div className="section">
            <h2 style={{ marginTop: 0 }}>🚨 Top Risk Files</h2>
            <div>
                {risks.map((risk, idx) => {
                    const isSelected = selectedId === risk.nodeId;
                    return (
                        <div
                            key={risk.nodeId}
                            className={`risk-file${isSelected ? ' selected' : ''}`}
                            tabIndex={0}
                            onClick={(e) => handleClick(risk, e as any)}
                            onKeyDown={(e) => handleKeyDown(risk, e as any)}
                            aria-label={`Risk ${idx + 1}: ${risk.metrics.path}. Category ${risk.category}. Percentile ${risk.percentile}. Commits ${risk.metrics.churn.commitCount}. Unique authors ${risk.metrics.churn.uniqueAuthors}. Days since last change ${risk.metrics.churn.daysSinceLastChange}.`}
                            title={`Click to open${' • Ctrl/Cmd+Click for split'}`}
                        >
                            <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace', fontSize: '0.9em' }}>
                                {risk.metrics.path}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="metrics-chip">Cx: {risk.metrics.complexity.cyclomaticComplexity || 0}</span>
                                <span className="metrics-chip">Churn: {risk.metrics.churn.commitCount}</span>
                                <span className="metrics-chip">Authors: {risk.metrics.churn.uniqueAuthors}</span>
                                <span className="metrics-chip">Last change: {risk.metrics.churn.daysSinceLastChange}d</span>
                                <span className="metrics-chip">Deps: {risk.metrics.dependencies}</span>
                                <span className="risk-badge" style={{ color: colorForCategory(risk.category) }}>
                                    {risk.category}
                                </span>
                                <button
                                    className="action-button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onFocusGraph(risk.nodeId);
                                    }}
                                    title="Focus in graph"
                                    style={{ backgroundColor: 'transparent', border: '1px solid var(--vscode-panel-border)' }}
                                >
                                    🎯
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}