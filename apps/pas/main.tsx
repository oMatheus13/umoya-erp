import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@ui/styles/main.css'
import './pas.css'
import PasApp from './PasApp'

const baseTitle = document.title || 'Umoya PAS'
if (import.meta.env.DEV) {
  const host = window.location.host
  document.title = `${baseTitle} [DEV:${host}]`
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PasApp />
  </StrictMode>,
)
