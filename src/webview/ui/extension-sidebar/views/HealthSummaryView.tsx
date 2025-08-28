import { JSX } from 'preact';
import { openPanel } from '../../shared/postMessage';
import { PANEL_KEYS, ORIGIN } from '@/types/routing.types';

export function HealthSummaryView(): JSX.Element {
    const origin = ORIGIN.SIDEBAR.HEALTH;

    return (
        <div className="health-summary-view">
            <p style={{ marginTop: 0 }}>Health overview</p>
            <div style={{ display: 'grid', gap: 8 }}>
                <button
                    type="button"
                    className="open-health-button"
                    onClick={() => openPanel(PANEL_KEYS.HEALTH_DASHBOARD, origin)}
                >
                    Open Dashboard
                </button>
            </div>
        </div>
    );
}