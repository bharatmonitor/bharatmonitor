import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { migrateLocalStorage } from './lib/migrate'
import { initSentry } from './lib/monitoring'
import './index.css'

// Run migration once on startup
migrateLocalStorage()

// Initialize error monitoring — no-op if VITE_SENTRY_DSN is not set
initSentry()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
