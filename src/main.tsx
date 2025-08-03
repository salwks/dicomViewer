import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { ThemeProvider } from './theme/ThemeContext';
import { initializeCornerstone } from './services/cornerstoneInit';
import { log } from './utils/logger';

// Initialize Cornerstone3D before rendering the app
const initializeApp = async () => {
  try {
    log.info('Starting application initialization', {
      component: 'Main',
    });

    // Initialize Cornerstone3D
    await initializeCornerstone();

    // Render the app
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error('Root element not found');
    }

    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </React.StrictMode>,
    );

    log.info('Application initialized successfully', {
      component: 'Main',
    });

  } catch (error) {
    log.error('Failed to initialize application', {
      component: 'Main',
    }, error as Error);

    // Show error in UI
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          background: #1a1a1a;
          color: white;
          font-family: system-ui, -apple-system, sans-serif;
          text-align: center;
        ">
          <div>
            <h1 style="color: #ef4444; margin-bottom: 16px;">Initialization Error</h1>
            <p style="margin-bottom: 16px;">Failed to initialize DICOM viewer</p>
            <details style="text-align: left; background: #2d2d2d; padding: 16px; border-radius: 8px;">
              <summary style="cursor: pointer; margin-bottom: 8px;">Error Details</summary>
              <pre style="white-space: pre-wrap; font-size: 12px;">${error}</pre>
            </details>
            <button onclick="window.location.reload()" style="
              margin-top: 16px;
              padding: 8px 16px;
              background: #3b82f6;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            ">
              Retry
            </button>
          </div>
        </div>
      `;
    }
  }
};

// Start initialization
initializeApp();
