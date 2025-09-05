import { ComponentChildren } from 'preact';
import AppIcon from '../../atoms/AppIcon';
import Title from '../../atoms/Title/Title';

/**
 * BrandRow molecule: combines AppIcon and Title for the header section
 */
export interface BrandRowProps {
  /** Brand title text */
  title: string;
  /** Optional custom icon (defaults to AppIcon) */
  icon?: ComponentChildren;
  /** Additional CSS classes */
  className?: string;
}

const BASE_CLASS = 'kc-brand-row';

const BrandRow = ({
  title,
  icon,
  className
}: BrandRowProps) => {
  const cls = className ? `${BASE_CLASS} ${className}` : BASE_CLASS;
  
  return (
    <header 
      className={cls} 
      role="banner"
      aria-label={`${title} application header`}
    >
      <div className={`${BASE_CLASS}__content`}>
        {icon || <AppIcon size="medium" aria-hidden={true} />}
        <Title 
          variant="md" 
          styleVariant="brand"
          as="h1"
        >
          {title}
        </Title>
      </div>
    </header>
  );
};

export default BrandRow;