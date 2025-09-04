import { JSX } from 'preact';
import Text from '@/webview/components/atoms/Text/Text';
import { Button } from '@/webview/components/molecules/Button';
import { openPanel } from '../../shared/postMessage';
import { PANEL_KEYS } from '@/types/routing.types';
import { ORIGIN } from '@/types/routing.types';

export function GraphView(): JSX.Element {
    const origin = ORIGIN.SIDEBAR.GRAPH;

    return (
        <div className="graph-view">
            <Text variant="body">Graph visualization and analysis tools</Text>
            <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
                <Button
                    onClick={() => openPanel(PANEL_KEYS.DEPENDENCY_GRAPH, origin)}
                >
                    Open Full Graph View
                </Button>
                <Text variant="caption" className="graph-view-caption">
                    Interactive graph controls and mini-preview coming soon...
                </Text>
            </div>
        </div>
    );
}