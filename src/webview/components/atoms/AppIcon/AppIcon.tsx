/**
 * AppIcon component: displays the Kiro Constellation app icon with size variants
 * Uses VS Code theme tokens for consistent icon coloring
 */
export interface AppIconProps {
  /** Size variant for the icon */
  size?: 'small' | 'medium' | 'large';
  /** Additional CSS classes */
  className?: string;
  /** Accessibility label */
  'aria-label'?: string;
  /** Whether the icon is decorative only */
  'aria-hidden'?: boolean;
}

const SIZE_MAP = {
  small: '20px',
  medium: '24px',
  large: '28px'
} as const;

const BASE_CLASS = 'kc-app-icon';

const AppIcon = ({
  size = 'medium',
  className,
  'aria-label': ariaLabel = 'Kiro Constellation',
  'aria-hidden': ariaHidden
}: AppIconProps) => {
  const sizeClass = `${BASE_CLASS}--${size}`;
  const cls = className ? `${BASE_CLASS} ${sizeClass} ${className}` : `${BASE_CLASS} ${sizeClass}`;
  
  return (
    <div 
      className={cls}
      aria-label={ariaHidden ? undefined : ariaLabel}
      aria-hidden={ariaHidden}
      role={ariaHidden ? undefined : 'img'}
      style={{ 
        width: SIZE_MAP[size], 
        height: SIZE_MAP[size] 
      }}
    >
      {/* Using a simple constellation icon - can be replaced with actual icon */}
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 24 24" 
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="6" cy="6" r="2" fill="currentColor" />
        <circle cx="18" cy="6" r="2" fill="currentColor" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <circle cx="6" cy="18" r="2" fill="currentColor" />
        <circle cx="18" cy="18" r="2" fill="currentColor" />
        <path d="M8 6L10 12L16 6" stroke="currentColor" strokeWidth="1.5" />
        <path d="M14 12L16 18L8 18L10 12" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
};

export default AppIcon;