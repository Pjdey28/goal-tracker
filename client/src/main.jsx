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
