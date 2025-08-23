import { JSX } from 'preact';

interface ShowMapButtonProps {
  onClick: () => void;
}

export function ShowMapButton({ onClick }: ShowMapButtonProps): JSX.Element {
  return (
    <button 
      className="show-map-button"
      onClick={onClick}
      type="button"
    >
      Show Codebase Map
    </button>
  );
}