import { JSX } from 'preact';

export interface RecommendationsProps {
    items: string[];
}

export function Recommendations(props: RecommendationsProps): JSX.Element {
    const { items } = props;
    if (!items || items.length === 0) {
        return (
            <div className="section">
                <h2 style={{ marginTop: 0 }}>💡 Recommendations</h2>
                <div className="info-banner">No recommendations available.</div>
            </div>
        );
    }
    return (
        <div className="section">
            <h2 style={{ marginTop: 0 }}>💡 Recommendations</h2>
            <div>
                {items.map((rec, idx) => (
                    <div key={idx} className="recommendation" style={{ padding: 12, margin: '8px 0', borderRadius: 4, background: 'var(--vscode-list-hoverBackground)', borderLeft: '4px solid var(--vscode-textLink-foreground)' }}>
                        {rec}
                    </div>
                ))}
            </div>
        </div>
    );
}