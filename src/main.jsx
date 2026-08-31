import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { getStoredTheme, applyTheme } from './lib/theme.js'

// Applied before the first render, not inside a React effect - avoids a
// flash of the default dark theme for anyone who's chosen light.
applyTheme(getStoredTheme());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
