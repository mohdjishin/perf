import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './i18n'
import './index.css'

import { loadConfig } from './config'
import { setApiBaseUrl } from './api/client'

async function init() {
  const cfg = await loadConfig()
  if (cfg.apiBaseUrl) setApiBaseUrl(cfg.apiBaseUrl)

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  )
}

init()
