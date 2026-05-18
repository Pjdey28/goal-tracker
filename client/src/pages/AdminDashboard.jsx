import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import SharedGoalManager from "../components/SharedGoalManager";

export default function AdminDashboard() {
  const [goals, setGoals] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [cycleName, setCycleName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncStats, setSyncStats] = useState(null);
  const [syncError, setSyncError] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState("");
  const navigate = useNavigate();
  const userId = localStorage.getItem("userId") || "1";

  const token = localStorage.getItem("token");
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchGoals = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/goals/employee/${userId}`);
      setGoals(res.data || []);
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to load goals");
    }
  };

  const fetchCycles = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/cycles", { headers: authHeaders });
      setCycles(res.data || []);
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to load cycles");
    }
  };

  useEffect(() => {
    fetchGoals();
    fetchCycles();
  }, []);

  const createCycle = async () => {
    try {
      setError("");
      await axios.post(
        "http://localhost:5000/api/cycles",
        { cycle_name: cycleName, start_date: startDate, end_date: endDate },
        { headers: authHeaders }
      );
      setCycleName("");
      setStartDate("");
      setEndDate("");
      fetchCycles();
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to create cycle");
    }
  };

  const deleteCycle = async (id) => {
    if (!window.confirm("Delete this cycle?")) return;
    try {
      setError("");
      await axios.delete(`http://localhost:5000/api/cycles/${id}`, { headers: authHeaders });
      fetchCycles();
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to delete cycle");
    }
  };

  const unlockGoal = async (id) => {
    try {
      setError("");
      await axios.put(`http://localhost:5000/api/goals/unlock/${id}`);
      fetchGoals();
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to unlock goal");
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black text-slate-900">Admin Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600">Manage cycles, monitor locks, and review governance workflows.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => navigate("/audit-logs")} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Audit Logs</button>
              <button onClick={() => navigate("/analytics")} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">Analytics</button>
              <button onClick={() => navigate("/admin/notifications")} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Notifications</button>
              <button
                onClick={async () => {
                  setSyncError("");
                  setSyncStats(null);
                  if (!window.confirm('Run full Azure AD tenant sync now? This may take several minutes.')) return;
                  try {
                    setSyncLoading(true);
                    const res = await axios.post("http://localhost:5000/api/admin/azure/sync", null, { headers: authHeaders });
                    setSyncStats(res.data.stats || res.data);
                    setLastSyncAt(new Date().toLocaleString());
                  } catch (err) {
                    console.error(err);
                    setSyncError(err.response?.data?.message || err.message || 'Sync failed');
                  } finally {
                    setSyncLoading(false);
                  }
                }}
                disabled={syncLoading}
                className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-700 disabled:opacity-60"
              >
                {syncLoading ? 'Running Sync…' : 'Run Azure Sync'}
              </button>
              <button onClick={() => window.open("http://localhost:5000/api/goals/export/excel")} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                Export Excel
              </button>
            </div>
          </div>
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">Azure Sync Status</h2>
              <p className="text-sm text-slate-600">Track the latest tenant-wide sync from Microsoft Entra.</p>
            </div>
            {lastSyncAt && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Last run: {lastSyncAt}</span>}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
              <p className={`mt-1 text-lg font-bold ${syncError ? 'text-rose-600' : syncStats ? 'text-emerald-600' : 'text-slate-900'}`}>
                {syncLoading ? 'Running' : syncError ? 'Failed' : syncStats ? 'Success' : 'Idle'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{syncStats?.total ?? '-'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created / Updated</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {syncStats ? `${syncStats.created ?? 0} / ${syncStats.updated ?? 0}` : '-'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Errors</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{syncStats?.errors ?? '-'}</p>
            </div>
          </div>

          {syncError && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{syncError}</div>}
          {syncStats && !syncError && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Azure sync finished successfully.
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-black text-slate-900">Cycle Management</h2>

          <div className="grid gap-3 md:grid-cols-3">
            <input value={cycleName} onChange={(e) => setCycleName(e.target.value)} placeholder="Cycle name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500" />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500" />
          </div>

          <button onClick={createCycle} className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Create Cycle
          </button>

          <div className="mt-4 grid gap-2">
            {cycles.map((cycle) => (
              <div key={cycle.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div>
                  <p className="font-semibold text-slate-900">{cycle.cycle_name}</p>
                  <p className="text-xs text-slate-600">
                    {new Date(cycle.start_date).toLocaleDateString()} to {new Date(cycle.end_date).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => deleteCycle(cycle.id)} className="rounded-md bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-200">
                  Delete
                </button>
              </div>
            ))}
            {cycles.length === 0 && <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No cycles created yet.</div>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-black text-slate-900">Locked Goal Controls</h2>
          <div className="grid gap-3">
            {goals.map((goal) => (
              <div key={goal.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-lg font-bold text-slate-900">{goal.title}</p>
                  <p className="text-sm text-slate-600">Status: {goal.status || "-"} • Locked: {goal.locked ? "Yes" : "No"}</p>
                </div>
                {goal.locked && (
                  <button onClick={() => unlockGoal(goal.id)} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
                    Unlock
                  </button>
                )}
              </div>
            ))}
            {goals.length === 0 && <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No goals available.</div>}
          </div>
        </section>

        <SharedGoalManager />
      </div>
    </Layout>
  );
}
