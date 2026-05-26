import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { AppErrorBoundary } from '@/components/shared/AppErrorBoundary'
import { installStaleAppRecovery } from '@/lib/staleAppRecovery'

installStaleAppRecovery()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </AppErrorBoundary>
  </StrictMode>,
)
