import { JSX } from 'preact';

export interface ScoreHeaderProps {
    score: number;
    totalFiles: number;
    statusLabel: string;
    statusColor: string;
    timestamp?: string;
    actions?: JSX.Element;
}

export function ScoreHeader(props: ScoreHeaderProps): JSX.Element {
    const { score, totalFiles, statusLabel, statusColor, timestamp, actions } = props;
    return (
        <div className="dashboard-header section" style={{ background: 'var(--vscode-editor-inactiveSelectionBackground)' }}>
            <h1>Codebase Health Report</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <div style={{ fontSize: '2.2em', fontWeight: 700, color: statusColor, lineHeight: 1 }}>
                        {score}
                    </div>
                    <div style={{ color: 'var(--vscode-descriptionForeground)' }}>
                        <div style={{ color: statusColor, fontWeight: 600 }}>{statusLabel}</div>
                        <div>{totalFiles} files analyzed{timestamp ? ` • ${new Date(timestamp).toLocaleString()}` : ''}</div>
                    </div>
                </div>
                {actions ? <div>{actions}</div> : null}
            </div>
        </div>
    );
}