import { HomeView, GraphView, HealthSummaryView, ActionsView } from '@webview/ui/extension-sidebar/views';
import type { SidebarRouteKey } from '@/types/routing.types';

type RouteMeta = { label: string; component: () => any };

export const SIDEBAR_ROUTES = {
    home: { label: 'Home', component: HomeView },
    graph: { label: 'Graph', component: GraphView },
    health: { label: 'Health', component: HealthSummaryView },
    actions: { label: 'Actions', component: ActionsView },
} as const satisfies Record<SidebarRouteKey, RouteMeta>;
