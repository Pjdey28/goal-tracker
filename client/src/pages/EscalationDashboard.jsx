import { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export default function EscalationDashboard() {
  const [rules, setRules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const authHeaders = {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [rulesRes, logsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/admin/escalations/rules`, { headers: authHeaders }),
        axios.get(`${API_BASE}/api/admin/escalations/logs?limit=100`, { headers: authHeaders }),
      ]);
      setRules(rulesRes.data || []);
      setLogs(logsRes.data || []);
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.message || 'Failed to load escalation data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveRule = async (rule, patch) => {
    try {
      setMessage('');
      await axios.put(`${API_BASE}/api/admin/escalations/rules/${rule.id}`, patch, { headers: authHeaders });
      await loadData();
      setMessage('Rule saved');
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.message || 'Save failed');
    }
  };

  const runNow = async () => {
    try {
      setMessage('');
      await axios.post(`${API_BASE}/api/admin/escalations/run`, {}, { headers: authHeaders });
      await loadData();
      setMessage('Escalation sweep completed');
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.message || 'Manual run failed');
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-black text-slate-900">Escalation Module</h1>
              <p className="mt-1 text-sm text-slate-600">Rule-based reminders and escalation logs for overdue actions.</p>
            </div>
            <button onClick={runNow} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Run Sweep Now
            </button>
          </div>
        </div>

        {message && <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">{message}</div>}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-slate-900">Escalation Rules</h2>
            {loading && <span className="text-sm text-slate-500">Loading...</span>}
          </div>

          <div className="mt-4 grid gap-4">
            {rules.map((rule) => (
              <div key={rule.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-lg font-bold text-slate-900">{rule.title}</p>
                    <p className="text-sm text-slate-600">{rule.description}</p>
                    <p className="mt-1 text-xs text-slate-500">Condition: {rule.condition_key}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={!!rule.enabled}
                      onChange={(e) => saveRule(rule, { enabled: e.target.checked })}
                    />
                    Enabled
                  </label>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <label className="text-sm">
                    <span className="mb-1 block font-semibold text-slate-700">Employee days</span>
                    <input
                      type="number"
                      value={rule.threshold_days}
                      onChange={(e) => saveRule(rule, { threshold_days: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-semibold text-slate-700">Manager days</span>
                    <input
                      type="number"
                      value={rule.manager_days}
                      onChange={(e) => saveRule(rule, { manager_days: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-semibold text-slate-700">HR / skip-level days</span>
                    <input
                      type="number"
                      value={rule.hr_days}
                      onChange={(e) => saveRule(rule, { hr_days: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-slate-900">Escalation Log</h2>
          <div className="mt-4 space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{log.rule_title} • {log.stage}</p>
                    <p className="text-sm text-slate-600">Employee: {log.employee_email || log.employee_email_lookup || '-'} | Manager: {log.manager_email || log.manager_email_lookup || '-'}</p>
                    <p className="text-xs text-slate-500">Triggered: {new Date(log.triggered_at).toLocaleString()}</p>
                    {log.message && <p className="mt-2 text-sm text-slate-700">{log.message}</p>}
                  </div>
                  <button
                    onClick={async () => {
                      await axios.patch(`${API_BASE}/api/admin/escalations/logs/${log.id}/resolve`, {}, { headers: authHeaders });
                      await loadData();
                    }}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))}
            {logs.length === 0 && <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No escalation events yet.</div>}
          </div>
        </section>
      </div>
    </Layout>
  );
}