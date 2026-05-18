import { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';

export default function NotificationSettings() {
  const [cfg, setCfg] = useState({ smtp: { host: '', port: 587, user: '', pass: '', from: '' } });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetchCfg();
  }, []);

  const fetchCfg = async () => {
    try {
      const res = await axios.get('/api/goals/config/notifications');
      setCfg(res.data || cfg);
    } catch (err) {
      console.error(err);
    }
  };

  const save = async () => {
    try {
      await axios.put('/api/goals/config/notifications', cfg);
      setMsg('Saved');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      console.error(err);
      setMsg('Save failed');
    }
  };

  const sendTest = async () => {
    try {
      await axios.post('/api/goals/config/notifications/test', { testEmail: cfg.smtp.from });
      setMsg('Test email sent (if configured)');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      console.error(err);
      setMsg('Test failed');
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold">Notification Settings</h1>
        <p className="text-sm text-slate-600">Configure SMTP settings used by the system.</p>

        <div className="mt-4 space-y-4 rounded-lg bg-white p-4 shadow">
          <h3 className="mt-2 text-lg font-semibold">SMTP</h3>
          <input placeholder="Host" value={cfg.smtp?.host || ''} onChange={(e) => setCfg({ ...cfg, smtp: { ...cfg.smtp, host: e.target.value } })} className="w-full rounded border px-3 py-2" />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Port" value={cfg.smtp?.port || 587} onChange={(e) => setCfg({ ...cfg, smtp: { ...cfg.smtp, port: Number(e.target.value) } })} className="rounded border px-3 py-2" />
            <input placeholder="From email" value={cfg.smtp?.from || ''} onChange={(e) => setCfg({ ...cfg, smtp: { ...cfg.smtp, from: e.target.value } })} className="rounded border px-3 py-2" />
          </div>
          <input placeholder="User" value={cfg.smtp?.user || ''} onChange={(e) => setCfg({ ...cfg, smtp: { ...cfg.smtp, user: e.target.value } })} className="w-full rounded border px-3 py-2" />
          <input placeholder="Pass" type="password" value={cfg.smtp?.pass || ''} onChange={(e) => setCfg({ ...cfg, smtp: { ...cfg.smtp, pass: e.target.value } })} className="w-full rounded border px-3 py-2" />

          <div className="flex gap-2">
            <button onClick={save} className="rounded bg-cyan-600 px-4 py-2 text-white">Save</button>
            <button onClick={sendTest} className="rounded bg-emerald-600 px-4 py-2 text-white">Send Test</button>
            <div className="text-sm text-slate-600">{msg}</div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
