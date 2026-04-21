import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { initBehaviorTracker } from '@/shared/security/behavior-tracker'
import '@/shared/styles/global.scss'

initBehaviorTracker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
