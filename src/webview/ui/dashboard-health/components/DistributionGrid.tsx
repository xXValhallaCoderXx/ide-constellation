import { JSX } from 'preact';

export interface Distribution {
    low: number;
    medium: number;
    high: number;
    critical: number;
}

export interface DistributionGridProps {
    distribution: Distribution;
    totalFiles: number;
}

function pct(n: number, total: number): number {
    if (!total || total <= 0) return 0;
    return Math.round((n / total) * 100);
}

export function DistributionGrid(props: DistributionGridProps): JSX.Element {
    const { distribution, totalFiles } = props;
    return (
        <div className="stats-grid">
            <div className="stat-card">
                <div className="stat-number" style={{ color: '#ef4444' }}>{distribution.critical}</div>
                <div className="stat-label">Critical ({pct(distribution.critical, totalFiles)}%)</div>
            </div>
            <div className="stat-card">
                <div className="stat-number" style={{ color: '#f97316' }}>{distribution.high}</div>
                <div className="stat-label">High ({pct(distribution.high, totalFiles)}%)</div>
            </div>
            <div className="stat-card">
                <div className="stat-number" style={{ color: '#eab308' }}>{distribution.medium}</div>
                <div className="stat-label">Medium ({pct(distribution.medium, totalFiles)}%)</div>
            </div>
            <div className="stat-card">
                <div className="stat-number" style={{ color: '#22c55e' }}>{distribution.low}</div>
                <div className="stat-label">Low ({pct(distribution.low, totalFiles)}%)</div>
            </div>
        </div>
    );
}