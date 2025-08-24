import { JSX } from 'preact';
import { ShowMapButton } from './ShowMapButton';
import '../../../types/vscode-api.types';

interface SidebarCommandButtonProps {
  label: string;
  command: string;
  variant?: 'primary' | 'secondary';
}

function SidebarCommandButton({ label, command, variant = 'primary' }: SidebarCommandButtonProps) {
  const handleClick = () => {
    if (window.vscode) {
      window.vscode.postMessage({ command });
    }
  };
  return (
    <button
      type="button"
      className={`sidebar-btn sidebar-btn--${variant}`}
      onClick={handleClick}
    >
      {label}
    </button>
  );
}

export function SidebarPanel(): JSX.Element {
  return (
    <div className="sidebar-container">
      <h2 className="sidebar-header">Constellation</h2>
      <div className="sidebar-actions">
        <SidebarCommandButton label="Show Codebase Map" command="showGraph" variant="primary" />
        <SidebarCommandButton label="Open Health Dashboard" command="openHealth" variant="secondary" />
        <SidebarCommandButton label="Scan Project" command="scanProject" variant="secondary" />
      </div>
    </div>
  );
}