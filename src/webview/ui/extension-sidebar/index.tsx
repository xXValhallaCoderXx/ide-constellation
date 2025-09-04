import { render } from 'preact';
import "../../styles/component-styles.css";
import { SidebarPanel } from './components/SidebarPanel';

// Render the sidebar component
render(<SidebarPanel />, document.getElementById('root')!);