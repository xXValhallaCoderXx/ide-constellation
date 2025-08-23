import { useState, useEffect, useRef } from 'preact/hooks';

interface SearchBoxProps {
  onSearchChange: (query: string) => void;
  placeholder?: string;
  disabled?: boolean;
  resultCount?: number;
}

export function SearchBox({ 
  onSearchChange, 
  placeholder = "Search files...", 
  disabled = false,
  resultCount = 0
}: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [isActive, setIsActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  // Debounced search with 300ms delay
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      onSearchChange(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, onSearchChange]);

  const handleInputChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    setQuery(target.value);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setQuery('');
      inputRef.current?.blur();
    } else if (event.key === 'Enter') {
      // Trigger immediate search on Enter
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      onSearchChange(query);
    }
  };

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    setIsActive(true);
  };

  const handleBlur = () => {
    setIsActive(false);
  };

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: '400px',
      marginBottom: '10px'
    }}>
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        backgroundColor: 'var(--vscode-input-background)',
        border: `1px solid ${isActive ? 'var(--vscode-focusBorder)' : 'var(--vscode-input-border)'}`,
        borderRadius: '4px',
        padding: '6px 8px',
        transition: 'border-color 0.2s ease'
      }}>
        {/* Search icon */}
        <div style={{
          marginRight: '8px',
          color: 'var(--vscode-input-placeholderForeground)',
          fontSize: '14px'
        }}>
          🔍
        </div>

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          onInput={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            color: 'var(--vscode-input-foreground)',
            fontSize: '13px',
            fontFamily: 'var(--vscode-font-family)'
          }}
        />

        {/* Clear button */}
        {query && (
          <button
            onClick={handleClear}
            disabled={disabled}
            style={{
              marginLeft: '8px',
              border: 'none',
              background: 'none',
              color: 'var(--vscode-input-placeholderForeground)',
              cursor: disabled ? 'default' : 'pointer',
              fontSize: '12px',
              padding: '2px',
              borderRadius: '2px',
              opacity: disabled ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                (e.target as HTMLElement).style.backgroundColor = 'var(--vscode-toolbar-hoverBackground)';
              }
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Search results indicator */}
      {query && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          right: '0',
          backgroundColor: 'var(--vscode-editor-background)',
          border: '1px solid var(--vscode-panel-border)',
          borderTop: 'none',
          borderRadius: '0 0 4px 4px',
          padding: '4px 8px',
          fontSize: '11px',
          color: 'var(--vscode-descriptionForeground)',
          zIndex: 10
        }}>
          {resultCount === 0 ? 'No matches found' : `${resultCount} match${resultCount === 1 ? '' : 'es'} found`}
        </div>
      )}
    </div>
  );
}