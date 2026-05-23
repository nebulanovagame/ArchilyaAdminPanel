import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App.jsx';
import { Sentry, initErrorTracking } from './services/errorTracking.js';

initErrorTracking();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Bir hata oluştu.</div>}>
      <App />
    </Sentry.ErrorBoundary>
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#1a1c23',
          color: '#e2e2e2',
          border: '1px solid rgba(255,255,255,0.08)',
          fontFamily: 'Montserrat, sans-serif',
          fontSize: '14px',
          borderRadius: '2px',
        },
        success: {
          iconTheme: {
            primary: '#c6a87c',
            secondary: '#1a1c23',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: '#1a1c23',
          },
        },
      }}
    />
  </StrictMode>,
);
