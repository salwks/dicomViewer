import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './theme';
import './styles/global.css';

// Secure DOM element access with validation
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Security error: Root element not found. The DOM may have been tampered with.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
