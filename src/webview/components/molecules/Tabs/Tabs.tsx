import { useState, useEffect, useRef } from 'preact/hooks';
import { ComponentChildren } from 'preact';
import TabButton from '../../atoms/TabButton';

/**
 * Tabs molecule: manages tab state and keyboard navigation with accessibility support
 */
export interface TabConfig {
  id: string;
  label: string;
  content: ComponentChildren;
  disabled?: boolean;
}

export interface TabsProps {
  /** Array of tab configurations */
  tabs: TabConfig[];
  /** Currently active tab ID */
  activeTab: string;
  /** Callback when tab changes */
  onTabChange: (tabId: string) => void;
  /** ARIA label for the tablist */
  'aria-label'?: string;
  /** Additional CSS classes */
  className?: string;
}

const BASE_CLASS = 'kc-tabs';

const Tabs = ({
  tabs,
  activeTab,
  onTabChange,
  'aria-label': ariaLabel = 'Main navigation',
  className
}: TabsProps) => {
  const [focusedTabIndex, setFocusedTabIndex] = useState(0);
  const [announceText, setAnnounceText] = useState('');
  const liveRegionRef = useRef<HTMLDivElement>(null);

  // Update focused tab index when active tab changes
  useEffect(() => {
    const activeIndex = tabs.findIndex(tab => tab.id === activeTab);
    if (activeIndex !== -1) {
      setFocusedTabIndex(activeIndex);
    }
  }, [activeTab, tabs]);

  // Announce tab changes to screen readers
  const announceTabChange = (tabLabel: string) => {
    setAnnounceText(`${tabLabel} tab selected`);
    // Clear announcement after a short delay
    setTimeout(() => setAnnounceText(''), 1000);
  };

  const handleKeyDown = (event: KeyboardEvent, tabIndex: number) => {
    const enabledTabs = tabs.filter(tab => !tab.disabled);
    const currentEnabledIndex = enabledTabs.findIndex(tab => tab.id === tabs[tabIndex].id);
    
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        const prevIndex = currentEnabledIndex > 0 ? currentEnabledIndex - 1 : enabledTabs.length - 1;
        const prevTab = enabledTabs[prevIndex];
        const prevTabIndex = tabs.findIndex(tab => tab.id === prevTab.id);
        // Use requestAnimationFrame for smooth transitions
        requestAnimationFrame(() => {
          setFocusedTabIndex(prevTabIndex);
          onTabChange(prevTab.id);
          announceTabChange(prevTab.label);
          // Focus the new tab button
          requestAnimationFrame(() => {
            const tabButton = document.querySelector(`[role="tab"][aria-selected="true"]`) as HTMLElement;
            tabButton?.focus();
          });
        });
        break;
        
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        const nextIndex = currentEnabledIndex < enabledTabs.length - 1 ? currentEnabledIndex + 1 : 0;
        const nextTab = enabledTabs[nextIndex];
        const nextTabIndex = tabs.findIndex(tab => tab.id === nextTab.id);
        // Use requestAnimationFrame for smooth transitions
        requestAnimationFrame(() => {
          setFocusedTabIndex(nextTabIndex);
          onTabChange(nextTab.id);
          announceTabChange(nextTab.label);
          // Focus the new tab button
          requestAnimationFrame(() => {
            const tabButton = document.querySelector(`[role="tab"][aria-selected="true"]`) as HTMLElement;
            tabButton?.focus();
          });
        });
        break;
        
      case 'Home':
        event.preventDefault();
        const firstTab = enabledTabs[0];
        const firstTabIndex = tabs.findIndex(tab => tab.id === firstTab.id);
        // Use requestAnimationFrame for smooth transitions
        requestAnimationFrame(() => {
          setFocusedTabIndex(firstTabIndex);
          onTabChange(firstTab.id);
          announceTabChange(firstTab.label);
          // Focus the first tab button
          requestAnimationFrame(() => {
            const tabButton = document.querySelector(`[role="tab"][aria-selected="true"]`) as HTMLElement;
            tabButton?.focus();
          });
        });
        break;
        
      case 'End':
        event.preventDefault();
        const lastTab = enabledTabs[enabledTabs.length - 1];
        const lastTabIndex = tabs.findIndex(tab => tab.id === lastTab.id);
        // Use requestAnimationFrame for smooth transitions
        requestAnimationFrame(() => {
          setFocusedTabIndex(lastTabIndex);
          onTabChange(lastTab.id);
          announceTabChange(lastTab.label);
          // Focus the last tab button
          requestAnimationFrame(() => {
            const tabButton = document.querySelector(`[role="tab"][aria-selected="true"]`) as HTMLElement;
            tabButton?.focus();
          });
        });
        break;
        
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!tabs[tabIndex].disabled) {
          // Use requestAnimationFrame for smooth transitions
          requestAnimationFrame(() => {
            onTabChange(tabs[tabIndex].id);
            announceTabChange(tabs[tabIndex].label);
          });
        }
        break;
    }
  };

  const handleTabClick = (tabId: string, tabIndex: number) => {
    if (!tabs[tabIndex].disabled) {
      // Use requestAnimationFrame for smooth tab switching
      requestAnimationFrame(() => {
        setFocusedTabIndex(tabIndex);
        onTabChange(tabId);
        announceTabChange(tabs[tabIndex].label);
      });
    }
  };

  const tabListClass = className ? `${BASE_CLASS} ${className}` : BASE_CLASS;

  return (
    <div>
      {/* Live region for screen reader announcements */}
      <div 
        ref={liveRegionRef}
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        {announceText}
      </div>
      
      <div 
        className={tabListClass}
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
      >
        {tabs.map((tab, index) => (
          <TabButton
            key={tab.id}
            id={`tab-${tab.id}`}
            isActive={tab.id === activeTab}
            onClick={() => handleTabClick(tab.id, index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            tabIndex={index === focusedTabIndex ? 0 : -1}
            aria-selected={tab.id === activeTab}
            aria-controls={`tabpanel-${tab.id}`}
            aria-disabled={tab.disabled}
            role="tab"
            className={tab.disabled ? 'kc-tab-button--disabled' : undefined}
          >
            {tab.label}
          </TabButton>
        ))}
      </div>
      
      <div 
        id={`tabpanel-${activeTab}`}
        role="tabpanel" 
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
        aria-label={`${tabs.find(tab => tab.id === activeTab)?.label} panel content`}
        className="kc-tabpanel"
      >
        {tabs.find(tab => tab.id === activeTab)?.content}
      </div>
    </div>
  );
};

export default Tabs;