import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@ui/styles/main.css'
import './rastreio.css'
import RastreioApp from './RastreioApp'

const baseTitle = document.title || 'Rastreio Umoya'
if (import.meta.env.DEV) {
  const host = window.location.host
  document.title = `${baseTitle} [DEV:${host}]`
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RastreioApp />
  </StrictMode>,
)
