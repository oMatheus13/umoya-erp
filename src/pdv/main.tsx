import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/main.css'
import './pdv.css'
import PdvApp from './PdvApp'

const baseTitle = document.title || 'Umoya PDV'
if (import.meta.env.DEV) {
  const host = window.location.host
  document.title = `${baseTitle} [DEV:${host}]`
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PdvApp />
  </StrictMode>,
)
