interface ServerStatusButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function ServerStatusButton({ onClick, disabled = false }: ServerStatusButtonProps) {
  return (
    <button 
      className="check-button"
      onClick={onClick}
      disabled={disabled}
    >
      {disabled ? 'Checking...' : 'Check Server Status'}
    </button>
  );
}