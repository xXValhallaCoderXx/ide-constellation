import { h } from 'preact';
import { ComponentChildren } from 'preact';

/**
 * Title (heading) component providing a semantic & theme-aware typography scale.
 * Sizes map to a constrained set of variants, decoupled from raw h1-h6 usage.
 */
export interface TitleProps {
  /** Visual size variant */
  variant?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Content */
  children: ComponentChildren;
  /** Additional CSS classes */
  className?: string;
  /** Override default heading element */
  as?: keyof HTMLElementTagNameMap;
  /** Override font weight (default depends on variant) */
  fontWeight?: number | string;
  /** Accessibility label if children non-text */
  ariaLabel?: string;
}

// Preferred default semantic element per size (can be adjusted later)
const VARIANT_ELEMENT: Record<NonNullable<TitleProps['variant']>, keyof HTMLElementTagNameMap> = {
  sm: 'h6',
  md: 'h5',
  lg: 'h4',
  xl: 'h3',
  '2xl': 'h2'
};

const BASE_CLASS = 'kc-title';

const Title = ({
  variant = 'md',
  children,
  className,
  as,
  fontWeight,
  ariaLabel
}: TitleProps) => {
  const Tag: any = as || VARIANT_ELEMENT[variant] || 'h3';
  const variantClass = `${BASE_CLASS} ${BASE_CLASS}--${variant}`;
  const cls = className ? `${variantClass} ${className}` : variantClass;
  const style = fontWeight ? { fontWeight } : undefined;
  return (
    <Tag className={cls} style={style} aria-label={ariaLabel}>
      {children}
    </Tag>
  );
};

export default Title;
