import { JSX } from 'preact';
import { openPanel } from '../../shared/postMessage';
import { PANEL_KEYS } from '@/types/routing.types';
import { ORIGIN } from '@/types/routing.types';
import { Button } from '@/webview/components/molecules/Button';
import HomePanel from '@/webview/components/organisms/HomePanel';

export function HomeView(): JSX.Element {
    const origin = ORIGIN.SIDEBAR.HOME;

    const quickAccessButtons = (
        <>
            <Button
                onClick={() => openPanel(PANEL_KEYS.DEPENDENCY_GRAPH, origin)}
            >
                Open Dependency Graph
            </Button>
            <Button
                onClick={() => openPanel(PANEL_KEYS.HEALTH_DASHBOARD, origin)}
            >
                Open Health Dashboard
            </Button>
            <Button
                onClick={() => {
                    // Extension Settings - could open VS Code settings or a custom settings panel
                    window.vscode?.postMessage({ command: 'openSettings' });
                }}
            >
                Extension Settings
            </Button>
        </>
    );

    return (
        <HomePanel quickAccessButtons={quickAccessButtons} />
    );
}

