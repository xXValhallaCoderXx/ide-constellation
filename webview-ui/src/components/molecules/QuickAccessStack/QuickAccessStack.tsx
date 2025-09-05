import { ComponentChildren } from 'preact';
import Title from '../../atoms/Title/Title';

/**
 * QuickAccessStack molecule: vertical stack container for Quick Access buttons
 */
export interface QuickAccessStackProps {
  /** Section title */
  title: string;
  /** Button components */
  children: ComponentChildren;
  /** Additional CSS classes */
  className?: string;
}

const BASE_CLASS = 'kc-quick-access-stack';

const QuickAccessStack = ({
  title,
  children,
  className
}: QuickAccessStackProps) => {
  const cls = className ? `${BASE_CLASS} ${className}` : BASE_CLASS;
  const titleId = `${BASE_CLASS}-title-${title.toLowerCase().replace(/\s+/g, '-')}`;
  
  return (
    <section 
      className={cls}
      aria-labelledby={titleId}
    >
      <Title 
        variant="sm" 
        styleVariant="section"
        as="h2"
        id={titleId}
        className={`${BASE_CLASS}__title`}
      >
        {title}
      </Title>
      <div 
        className={`${BASE_CLASS}__content`}
        role="group"
        aria-labelledby={titleId}
      >
        {children}
      </div>
    </section>
  );
};

export default QuickAccessStack;