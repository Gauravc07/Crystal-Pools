import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { PanelProvider } from './contexts/PanelContext';
import { loadSiteSettings } from './lib/siteSettings';
import { captureAttribution } from './lib/attribution';

// Start loading admin-managed settings (contact details, banner) while the page boots.
loadSiteSettings();
captureAttribution();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <PanelProvider>
        <App />
      </PanelProvider>
    </ThemeProvider>
  </StrictMode>,
);
