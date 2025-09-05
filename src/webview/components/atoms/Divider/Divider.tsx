/**
 * Divider component: themed section separator using VS Code border tokens
 */
export interface DividerProps {
  /** Additional CSS classes */
  className?: string;
  /** Custom margin override */
  margin?: string;
  /** ARIA role override (defaults to separator) */
  role?: 'separator' | 'presentation' | 'none';
  /** Whether the divider is decorative only */
  'aria-hidden'?: boolean;
  /** Orientation of the divider */
  'aria-orientation'?: 'horizontal' | 'vertical';
}

const BASE_CLASS = 'kc-divider';

const Divider = ({
  className,
  margin,
  role = 'separator',
  'aria-hidden': ariaHidden,
  'aria-orientation': ariaOrientation = 'horizontal'
}: DividerProps) => {
  const cls = className ? `${BASE_CLASS} ${className}` : BASE_CLASS;
  const style = margin ? { margin } : undefined;
  
  return (
    <hr 
      className={cls}
      style={style}
      role={role}
      aria-hidden={ariaHidden}
      aria-orientation={ariaOrientation}
    />
  );
};

export default Divider;