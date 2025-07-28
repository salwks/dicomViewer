import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './theme';
import './styles/global.css';
import { log } from './utils/logger';

// Initialize without any Worker blocking

// Initialize medical-grade logging system
log.info('Medical imaging application starting', {
  component: 'Application',
  operation: 'initialize',
  environment: process.env.NODE_ENV || 'development',
});

log.debug('Logger test - you should see this in console', {
  component: 'Application',
  operation: 'loggerTest',
});

// Secure DOM element access with validation
const rootElement = document.getElementById('root');
if (!rootElement) {
  log.fatal('Root element not found - security breach detected', {
    component: 'Application',
    operation: 'domValidation',
  });
  throw new Error('Security error: Root element not found. The DOM may have been tampered with.');
}

log.info('DOM validation successful', {
  component: 'Application',
  operation: 'domValidation',
});

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
