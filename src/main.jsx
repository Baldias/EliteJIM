import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/elite.css'
import App from './App.jsx'
import './styles/minimal.css'
import './styles/og.css'
import './styles/theme-bridge.css'
import { useStore } from './store/useStore'
import { bindTheme } from './utils/theme'
import { bindLanguage } from './i18n'

const stopThemeSync = bindTheme(useStore)
const stopLanguageSync = bindLanguage(useStore)
if (import.meta.hot) import.meta.hot.dispose(() => { stopThemeSync(); stopLanguageSync() })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
