import { JSX } from 'preact';
import { ShowMapButton } from './ShowMapButton';
import '../../types/vscode-api.types';

export function SidebarPanel(): JSX.Element {
  const handleShowMap = () => {
    if (window.vscode) {
      window.vscode.postMessage({ command: 'showGraph' });
    }
  };

  return (
    <div className="sidebar-container">
      <h2 className="sidebar-header">Kiro Constellation</h2>
      <div className="sidebar-actions">
        <ShowMapButton onClick={handleShowMap} />
      </div>
    </div>
  );
}