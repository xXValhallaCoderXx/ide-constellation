import { JSX } from 'preact';
import { openPanel } from '../../shared/postMessage';
import { PANEL_KEYS } from '@/types/routing.types';
import { ORIGIN } from '@/types/routing.types';

export function HomeView(): JSX.Element {
    const origin = ORIGIN.SIDEBAR.HOME;

    return (
        <div className="home-view">
            <p style={{ marginTop: 0 }}>Quick access</p>
            <div style={{ display: 'grid', gap: 8 }}>
                <button
                    type="button"
                    className="show-map-button"
                    onClick={() => openPanel(PANEL_KEYS.DEPENDENCY_GRAPH, origin)}
                >
                    Open Dependency Graph
                </button>
                <button
                    type="button"
                    className="show-health-button"
                    onClick={() => openPanel(PANEL_KEYS.HEALTH_DASHBOARD, origin)}
                >
                    Open Health Dashboard
                </button>
            </div>
        </div>
    );
}

