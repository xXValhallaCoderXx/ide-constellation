import { JSX } from 'preact';
import { openPanel, requestProjectScan } from '../../shared/postMessage';
import { PANEL_KEYS, ORIGIN } from '@/types/routing.types';

export function ActionsView(): JSX.Element {
    const origin = ORIGIN.SIDEBAR.ACTIONS;

    return (
        <div className="actions-view">
            <p style={{ marginTop: 0 }}>Actions</p>
            <div style={{ display: 'grid', gap: 8 }}>
                <button
                    type="button"
                    className="open-graph-button"
                    onClick={() => openPanel(PANEL_KEYS.DEPENDENCY_GRAPH, origin)}
                >
                    Open Dependency Graph
                </button>
                <button
                    type="button"
                    className="open-health-button"
                    onClick={() => openPanel(PANEL_KEYS.HEALTH_DASHBOARD, origin)}
                >
                    Open Health Dashboard
                </button>
                <button
                    type="button"
                    className="scan-project-button"
                    onClick={() => requestProjectScan(origin)}
                >
                    Scan Project
                </button>
            </div>
        </div>
    );
}