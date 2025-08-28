import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type {
    ExtensionToWebviewMessage,
    HealthLoadingMessage,
    HealthResponseMessage,
    HealthErrorMessage,
    HealthExportResultMessage,
} from '@/types/messages.types';
import type { HealthAnalysis } from '@/types/health-analysis.types';
import {
    requestHealth,
    refreshHealth as refreshHealthCmd,
    exportHealth as exportHealthCmd,
    openFile as openFileCmd,
    showHeatmap as showHeatmapCmd,
    focusNode as focusNodeCmd,
} from '../health.postMessage';

type ExportResult =
    | { success: true; format: 'json' | 'csv'; uri?: string }
    | { success: false; format: 'json' | 'csv'; error: string };

export interface UseHealthAnalysis {
    analysis: HealthAnalysis | null;
    loading: boolean;
    error: string | null;
    exportResult: ExportResult | null;
    actions: {
        ensureRequested: (force?: boolean) => void;
        refresh: () => void;
        export: (format: 'json' | 'csv') => void;
        openFile: (fileId: string, mode?: 'default' | 'split') => void;
        showHeatmap: (centerNode?: string) => void;
        focusNode: (nodeId: string) => void;
    };
}

/**
 * Health Dashboard state + actions hook
 * - Subscribes to window message events and updates local state
 * - Sends typed commands back to the extension
 */
export function useHealthAnalysis(): UseHealthAnalysis {
    const [analysis, setAnalysis] = useState<HealthAnalysis | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [exportResult, setExportResult] = useState<ExportResult | null>(null);

    const requestedOnceRef = useRef(false);

    useEffect(() => {
        const handler = (evt: MessageEvent<ExtensionToWebviewMessage>) => {
            const msg = evt.data;
            if (!msg || typeof msg !== 'object') {
                return;
            }

            switch (msg.command) {
                case 'health:loading': {
                    setLoading(true);
                    setError(null);
                    break;
                }
                case 'health:response': {
                    const data = (msg as HealthResponseMessage).data;
                    setAnalysis(data.analysis);
                    setLoading(false);
                    setError(null);
                    break;
                }
                case 'health:error': {
                    const data = (msg as HealthErrorMessage).data;
                    setLoading(false);
                    setError(data.error ?? 'Unknown health error');
                    break;
                }
                case 'health:export:result': {
                    const data = (msg as HealthExportResultMessage).data;
                    if (data.success) {
                        setExportResult({ success: true, format: data.format, uri: data.uri });
                    } else {
                        setExportResult({ success: false, format: data.format, error: data.error || 'Export failed' });
                    }
                    break;
                }
                default:
                    break;
            }
        };

        window.addEventListener('message', handler as EventListener);
        return () => window.removeEventListener('message', handler as EventListener);
    }, []);

    // Ensure we request data at least once if provider didn't push an initial payload
    const ensureRequested = (force?: boolean) => {
        if (!requestedOnceRef.current || force) {
            requestedOnceRef.current = true;
            requestHealth(force);
        }
    };

    const refresh = () => {
        refreshHealthCmd();
    };

    const exportHealth = (format: 'json' | 'csv') => {
        exportHealthCmd(format);
    };

    const openFile = (fileId: string, mode: 'default' | 'split' = 'default') => {
        openFileCmd(fileId, mode);
    };

    const showHeatmap = (centerNode?: string) => {
        const a = analysis;
        if (!a) {
            return;
        }
        showHeatmapCmd(a, centerNode);
    };

    const focusNode = (nodeId: string) => {
        focusNodeCmd(nodeId);
    };

    return useMemo(
        () => ({
            analysis,
            loading,
            error,
            exportResult,
            actions: { ensureRequested, refresh, export: exportHealth, openFile, showHeatmap, focusNode },
        }),
        [analysis, loading, error, exportResult]
    );
}
// ... existing code ...