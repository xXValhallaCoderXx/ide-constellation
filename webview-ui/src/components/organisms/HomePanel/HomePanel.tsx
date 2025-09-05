import { ComponentChildren } from 'preact';
import QuickAccessStack from '../../molecules/QuickAccessStack';
import Title from '../../atoms/Title/Title';
import Divider from '../../atoms/Divider';

/**
 * HomePanel organism: Home tab content with Quick Access and Recent Sessions
 */
export interface HomePanelProps {
  /** Quick Access button components */
  quickAccessButtons: ComponentChildren;
  /** Additional CSS classes */
  className?: string;
}

const BASE_CLASS = 'kc-home-panel';

const HomePanel = ({
  quickAccessButtons,
  className
}: HomePanelProps) => {
  const cls = className ? `${BASE_CLASS} ${className}` : BASE_CLASS;
  
  return (
    <div 
      className={cls}
      role="main"
      aria-label="Home panel content"
    >
      <QuickAccessStack title="Quick Access">
        {quickAccessButtons}
      </QuickAccessStack>
      
      <Divider role="separator" aria-hidden={true} />
      
      <section 
        className={`${BASE_CLASS}__recent-sessions`}
        aria-labelledby="recent-sessions-heading"
      >
        <div className={`${BASE_CLASS}__section-header`}>
          <Title 
            variant="sm" 
            styleVariant="section"
            as="h2"
            id="recent-sessions-heading"
          >
            Recent graph sessions
          </Title>
          <a 
            href="#" 
            className={`${BASE_CLASS}__view-all-link ${BASE_CLASS}__view-all-link--disabled`}
            aria-disabled="true"
            aria-describedby="view-all-description"
            onClick={(e) => e.preventDefault()}
          >
            View All
          </a>
          <span 
            id="view-all-description" 
            className="sr-only"
          >
            View all recent sessions (currently unavailable)
          </span>
        </div>
        <div 
          className={`${BASE_CLASS}__sessions-placeholder`}
          role="status"
          aria-live="polite"
          aria-label="Recent sessions will appear here when available"
        >
          {/* Placeholder for future session cards */}
        </div>
      </section>
    </div>
  );
};

export default HomePanel;