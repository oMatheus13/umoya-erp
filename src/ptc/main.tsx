import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/main.css'
import './ptc.css'
import PtcApp from './PtcApp'

const baseTitle = document.title || 'Umoya PTC'
if (import.meta.env.DEV) {
  const host = window.location.host
  document.title = `${baseTitle} [DEV:${host}]`
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PtcApp />
  </StrictMode>,
)
