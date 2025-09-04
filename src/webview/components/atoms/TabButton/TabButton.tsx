import { ComponentChildren } from 'preact';

/**
 * TabButton component: individual tab with active/hover states and accessibility support
 * Uses VS Code theme tokens for consistent styling
 */
export interface TabButtonProps {
  /** Tab content */
  children: ComponentChildren;
  /** Element ID */
  id?: string;
  /** Whether this tab is currently active */
  isActive?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Keyboard event handler */
  onKeyDown?: (event: KeyboardEvent) => void;
  /** Tab index for keyboard navigation */
  tabIndex?: number;
  /** ARIA selected state */
  'aria-selected'?: boolean;
  /** ARIA controls - ID of the tabpanel this tab controls */
  'aria-controls'?: string;
  /** ARIA disabled state */
  'aria-disabled'?: boolean;
  /** ARIA role */
  role?: 'tab' | 'button';
  /** Additional CSS classes */
  className?: string;
}

const BASE_CLASS = 'kc-tab-button';

const TabButton = ({
  children,
  id,
  isActive = false,
  onClick,
  onKeyDown,
  tabIndex = -1,
  'aria-selected': ariaSelected,
  'aria-controls': ariaControls,
  'aria-disabled': ariaDisabled,
  role = 'tab',
  className
}: TabButtonProps) => {
  const activeClass = isActive ? `${BASE_CLASS}--active` : '';
  const cls = className 
    ? `${BASE_CLASS} ${activeClass} ${className}`.trim()
    : `${BASE_CLASS} ${activeClass}`.trim();

  return (
    <button
      id={id}
      className={cls}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
      aria-selected={ariaSelected ?? isActive}
      aria-controls={ariaControls}
      aria-disabled={ariaDisabled}
      role={role}
      type="button"
    >
      {children}
    </button>
  );
};

export default TabButton;