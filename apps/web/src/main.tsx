import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { SpikeReview } from './app/SpikeReview';
import { ErrorBoundary } from './app/ErrorBoundary';
import './styles/global.css';
import './styles/fonts.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {window.location.pathname === '/spike' ? <SpikeReview /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>,
);
