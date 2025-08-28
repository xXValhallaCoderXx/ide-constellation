import { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import "@/types/vscode-api.types";
import type { SidebarRouteKey } from "@/types/routing.types";
import { SIDEBAR_ROUTE_KEYS } from "@/types/routing.types";
import { SIDEBAR_ROUTES } from "@webview/ui/extension-sidebar/router/routes.config";
import { SidebarRouter } from "@webview/ui/extension-sidebar/router/SidebarRouter";

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

  return (
    <div className="sidebar-container">
      <h2 className="sidebar-header">Kiro Constellation</h2>

      <div className="sidebar-tabs" role="tablist" aria-label="Constellation tabs">
        {Object.entries(SIDEBAR_ROUTES).map(([key, meta]) => {
          const routeKey = key as SidebarRouteKey;
          const isActive = active === routeKey;
          return (
            <button
              key={key}
              className={`sidebar-tab ${isActive ? 'active' : ''}`}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(routeKey)}
              type="button"
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="sidebar-content" role="tabpanel">
        <SidebarRouter active={active} />
      </div>
    </div>
  );
}
