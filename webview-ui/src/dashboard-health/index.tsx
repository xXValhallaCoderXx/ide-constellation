import { render } from 'preact';
import '../main.css';
import { HealthDashboard } from './HealthDashboard';

// Render the main health dashboard component
render(<HealthDashboard />, document.getElementById('root')!);