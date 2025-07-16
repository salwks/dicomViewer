import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './App.css';

// 프로덕션 환경 콘솔 보안 가드 초기화
import ProductionConsoleGuard from './utils/production-console-guard';
ProductionConsoleGuard.initialize();

// Create root and render app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);