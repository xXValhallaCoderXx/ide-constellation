import { ComponentChildren } from 'preact';

/**
 * Text component: provides semantic, theme-aware typography tokens.
 * Uses variant classes defined in `component-styles.css`.
 * A supplied `fontWeight` prop will override the default weight of the variant.
 */
export interface TextProps {
    /** Visual style variant */
    variant?: 'body' | 'caption' | 'label';
    /** Children content */
    children: ComponentChildren;
    /** Optional additional classes */
    className?: string;
    /** Override font weight (e.g. 'bold', 500) */
    fontWeight?: number | string;
    /** HTML element override (defaults chosen per variant) */
    as?: keyof HTMLElementTagNameMap;
    /** ARIA label for non-text children */
    ariaLabel?: string;
}

const VARIANT_BASE_ELEMENT: Record<NonNullable<TextProps['variant']>, keyof HTMLElementTagNameMap> = {
    body: 'p',
    caption: 'span',
    label: 'p'
};

const BASE_CLASS = 'kc-text';

const Text = ({
    variant = 'body',
    children,
    className,
    fontWeight,
    as,
    ariaLabel
}: TextProps) => {
    const Tag: any = as || VARIANT_BASE_ELEMENT[variant] || 'span';
    const variantClass = `${BASE_CLASS} ${BASE_CLASS}--${variant}`;
    const cls = className ? `${variantClass} ${className}` : variantClass;
    const style = fontWeight ? { fontWeight } : undefined;
    return (
        <Tag className={cls} style={style} aria-label={ariaLabel}>
            {children}
        </Tag>
    );
};

export default Text;
