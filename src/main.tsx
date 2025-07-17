import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './App.css';

// 프로덕션 환경 콘솔 보안 가드 초기화
import ProductionConsoleGuard from './utils/production-console-guard';
ProductionConsoleGuard.initialize();

// Google Analytics는 쿠키 동의 후에 초기화됨

// Create root and render app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);