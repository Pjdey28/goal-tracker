import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function Login() {

  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // show auth error redirected from server (e.g., ?auth_error=...)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const authErr = params.get('auth_error');
      if (authErr) {
        setError(decodeURIComponent(authErr));
        const url = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, url);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // If token already present (SSO just set it), redirect based on role
  useEffect(() => {
    try {
      const t = localStorage.getItem('token');
      const r = localStorage.getItem('role');
      if (t && r) {
        if (r === 'employee') return navigate('/employee');
        if (r === 'manager') return navigate('/manager');
        if (r === 'admin') return navigate('/admin');
      }
    } catch (e) {
      // ignore
    }
  }, [navigate]);

  const handleLogin = async () => {

    try {
      setError("");

      const res = await axios.post(
        `${API_BASE}/api/auth/login`,
        {
          email,
          password,
        }
      );

      localStorage.setItem(
        "token",
        res.data.token
      );
      axios.defaults.headers.common[
        "Authorization"
        ] = res.data.token;
      localStorage.setItem(
        "role",
        res.data.user.role
      );
      localStorage.setItem(
        "userId",
        String(res.data.user.id)
      );

      if (res.data.user.role === "employee") {
        navigate("/employee");
      }

      if (res.data.user.role === "manager") {
        navigate("/manager");
      }

      if (res.data.user.role === "admin") {
        navigate("/admin");
      }

    } catch (error) {
      setError(error.response?.data?.message || "Login failed");

    }

  };

  const handleAzureLogin = () => {
    window.location.href = `${API_BASE}/auth/azure/login`;
  };

  return (

    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-cyan-50 to-indigo-100 px-4">

      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-300/30">

        <h1 className="mb-1 text-center text-3xl font-black tracking-tight text-slate-900">Goal Portal</h1>
        <p className="mb-7 text-center text-sm text-slate-600">Sign in to continue</p>

        {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}

        <input
          type="email"
          placeholder="Email"
          className="mb-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition focus:border-cyan-500"
          onChange={(e) =>
            setEmail(e.target.value)
          }
        />

        <input
          type="password"
          placeholder="Password"
          className="mb-6 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition focus:border-cyan-500"
          onChange={(e) =>
            setPassword(e.target.value)
          }
        />

        <button
          onClick={handleLogin}
          className="w-full rounded-xl bg-slate-900 p-3 font-semibold text-white transition hover:bg-slate-800"
        >
          Login
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-slate-500">
          <div className="h-px flex-1 bg-slate-200"></div>
          <span>or</span>
          <div className="h-px flex-1 bg-slate-200"></div>
        </div>

        <button
          onClick={handleAzureLogin}
          className="w-full rounded-xl border border-slate-300 bg-white p-3 font-semibold text-slate-900 transition hover:bg-slate-50"
        >
          Sign in with Microsoft
        </button>

      </div>

    </div>

  );
}