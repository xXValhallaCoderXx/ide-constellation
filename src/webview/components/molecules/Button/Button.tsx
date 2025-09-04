

import { h } from 'preact';
import { ComponentChildren } from 'preact';

/**
 * Reusable button component for webview UI.
 * Styling is provided purely via the shared `component-styles.css` stylesheet
 * (class: `.main-button`) to adhere to VS Code theming variables and avoid
 * inline style duplication. Keep this component minimal & theme-driven.
 */
export interface ButtonProps {
/** Click handler */
    onClick: () => void;
    /** Button content */
    children: ComponentChildren;
    /** Optional additional class names to allow variants (e.g., danger, subtle) */
    className?: string;
    /** Disabled state */
    disabled?: boolean;
    /** Accessible label when content is non-textual */
    ariaLabel?: string;
    /** Button type attribute (defaults to 'button' to prevent unintended form submit) */
    type?: 'button' | 'submit' | 'reset';
}

const BASE_CLASS = 'main-button';

const Button = ({
    onClick,
    children,
    className,
    disabled,
    ariaLabel,
    type = 'button'
}: ButtonProps) => {
    const cls = className ? `${BASE_CLASS} ${className}` : BASE_CLASS;
    return (
        <button
            type={type}
            className={cls}
            onClick={onClick}
            disabled={disabled}
            aria-label={ariaLabel}
        >
            {children}
        </button>
    );
};

export default Button;