/**
 * Hypothesis Editor - Renderer Entry Point
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { initIconRegistry } from './services/IconRegistry';
import './assets/styles/fonts.css';
import './assets/styles/global.css';

// Preload icon themes on startup, then render
initIconRegistry().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
});
