import { h } from 'preact';
import { ComponentChildren } from 'preact';
import BrandRow from '../../molecules/BrandRow';
import Tabs, { TabConfig } from '../../molecules/Tabs';

/**
 * SidebarScaffold organism: main layout component combining header, tabs, and content
 */
export interface SidebarScaffoldProps {
  /** Brand title for the header */
  brandTitle: string;
  /** Tab configurations */
  tabs: TabConfig[];
  /** Currently active tab ID */
  activeTab: string;
  /** Callback when tab changes */
  onTabChange: (tabId: string) => void;
  /** Optional additional content */
  children?: ComponentChildren;
  /** Additional CSS classes */
  className?: string;
}

const BASE_CLASS = 'kc-sidebar-scaffold';

const SidebarScaffold = ({
  brandTitle,
  tabs,
  activeTab,
  onTabChange,
  children,
  className
}: SidebarScaffoldProps) => {
  const cls = className ? `${BASE_CLASS} ${className}` : BASE_CLASS;
  
  return (
    <div className={`kc-sidebar ${cls}`}>
      <BrandRow title={brandTitle} />
      
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        aria-label="Main navigation"
      />
      
      {children}
    </div>
  );
};

export default SidebarScaffold;