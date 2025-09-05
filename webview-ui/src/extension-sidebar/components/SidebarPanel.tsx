import { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import "@/types/vscode-api.types";
import type { SidebarRouteKey } from "@/types/routing.types";
import { SIDEBAR_ROUTE_KEYS } from "@/types/routing.types";
import { SIDEBAR_ROUTES } from "@webview/ui/extension-sidebar/router/routes.config";
import { SidebarRouter } from "@webview/ui/extension-sidebar/router/SidebarRouter";
import SidebarScaffold from "@/webview/components/organisms/SidebarScaffold";
import { TabConfig } from "@/webview/components/molecules/Tabs";

export function SidebarPanel(): JSX.Element {
  const [active, setActive] = useState<SidebarRouteKey>(SIDEBAR_ROUTE_KEYS.HOME);

  // Restore last route
  useEffect(() => {
    const state = window.vscode?.getState?.();
    if (state?.activeRoute) {
      setActive(state.activeRoute as SidebarRouteKey);
    }
  }, []);

  // Persist route on change
  useEffect(() => {
    window.vscode?.setState?.({ activeRoute: active });
  }, [active]);

  // Convert SIDEBAR_ROUTES to TabConfig format
  const tabs: TabConfig[] = Object.entries(SIDEBAR_ROUTES).map(([key, meta]) => ({
    id: key,
    label: meta.label,
    content: <SidebarRouter active={key as SidebarRouteKey} />
  }));

  const handleTabChange = (tabId: string) => {
    setActive(tabId as SidebarRouteKey);
  };

  return (
    <SidebarScaffold
      brandTitle="Kiro Constellation"
      tabs={tabs}
      activeTab={active}
      onTabChange={handleTabChange}
    />
  );
}
