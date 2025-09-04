

interface IButtonProps {
    onClick: () => void;
    children: any;
}

const Button = ({ onClick, children }: IButtonProps) => (
    <button className="action-button" onClick={onClick} style={btnStyle}>
        {children}
    </button>
);


const btnStyle: any = {
    backgroundColor: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    border: 'none',
    padding: '8px 12px',
    margin: '0 6px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.9em',
};



export default Button