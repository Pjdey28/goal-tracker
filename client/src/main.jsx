import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import axios from 'axios';

// Handle token from auth redirect (e.g., /?token=...) and store user info
try {
  const params = new URLSearchParams(window.location.search);
  const t = params.get('token');
  if (t) {
    localStorage.setItem('token', t);
    // mark that this tab/window just received an SSO token so login can redirect once
    try { sessionStorage.setItem('sso_just_logged_in', '1'); } catch (e) {}
    try {
      const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload?.id) localStorage.setItem('userId', String(payload.id));
      if (payload?.role) localStorage.setItem('role', payload.role);
      if (payload?.email) localStorage.setItem('email', payload.email);
    } catch (e) {
      // ignore decode errors
    }
    // remove token from URL
    const url = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, url);
  }
  // If no token was in the URL but a token exists in localStorage (refresh/new tab),
  // ensure role and user fields are populated so ProtectedRoute won't redirect.
  try {
    const existing = localStorage.getItem('token');
    if (!params?.get || !params.get('token')) {
      if (existing) {
        try {
          const payload = JSON.parse(atob(existing.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          if (payload?.id && !localStorage.getItem('userId')) localStorage.setItem('userId', String(payload.id));
          if (payload?.role && !localStorage.getItem('role')) localStorage.setItem('role', payload.role);
          if (payload?.email && !localStorage.getItem('email')) localStorage.setItem('email', payload.email);
        } catch (e) {
          // ignore
        }
      }
    }
  } catch (e) {
    // ignore
  }
} catch (e) {
  // ignore
}

axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || "";
axios.defaults.headers.common["Authorization"] = localStorage.getItem("token");
const storedTheme = window.localStorage.getItem('theme')
const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches

if (storedTheme === 'dark' || (!storedTheme && prefersDark)) {
  document.documentElement.classList.add('dark')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
