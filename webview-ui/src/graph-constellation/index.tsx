import { render } from 'preact';
import '../main.css';
import { ConstellationPanel } from './components/ConstellationPanel';

// Render the main constellation panel component
render(<ConstellationPanel />, document.getElementById('root')!);