import { JSX } from 'preact';
import type { SidebarRouteKey } from '@/types/routing.types';
import { SIDEBAR_ROUTES } from '@webview/ui/extension-sidebar/router/routes.config';

interface Props {
    active: SidebarRouteKey;
}

export function SidebarRouter({ active }: Props): JSX.Element | null {
    const route = SIDEBAR_ROUTES[active];
    if (!route) {
        return null;
    }
    const Component = route.component as any;
    return <Component />;
}