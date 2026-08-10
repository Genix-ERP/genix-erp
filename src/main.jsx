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
import { consumeImpersonationHandoff } from '@/api/impersonationHandoff'

// A support session arriving from the control plane is installed BEFORE the
// app mounts, so the very first request already carries it — otherwise the app
// boots against the previous session, fires a round of requests as the wrong
// user, and only then swaps.
consumeImpersonationHandoff()

// Apply the cached brand favicon/title synchronously before first paint, so the
// login page and reloads reflect them before settings load from the backend.
applyFavicon(readStoredFavicon())
applyBrowserTitle(readStoredTitle())

ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
)