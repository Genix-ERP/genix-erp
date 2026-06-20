import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import {
  applyFavicon,
  applyBrowserTitle,
  readStoredFavicon,
  readStoredTitle,
} from '@/utils/brandLogo'

// Apply the cached brand favicon/title synchronously before first paint, so the
// login page and reloads reflect them before settings load from the backend.
applyFavicon(readStoredFavicon())
applyBrowserTitle(readStoredTitle())

ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
)