import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/main.css'
import './pop.css'
import PopApp from './PopApp'

const baseTitle = document.title || 'Umoya POP'
if (import.meta.env.DEV) {
  const host = window.location.host
  document.title = `${baseTitle} [DEV:${host}]`
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PopApp />
  </StrictMode>,
)
