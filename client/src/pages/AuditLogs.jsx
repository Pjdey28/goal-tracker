import { useEffect, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");

  const fetchLogs = async () => {
    try {
      setError("");
      const res = await axios.get("/api/goals/audit/logs");
      setLogs(res.data || []);
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to load audit logs");
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-5">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Audit Logs</h1>
          <p className="mt-1 text-sm text-slate-600">Track every meaningful change across goals and check-ins.</p>
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="grid gap-3">
          {logs.map((log) => (
            <article key={log.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <h2 className="text-lg font-black text-slate-900">{log.action}</h2>
                <p className="text-xs font-medium text-slate-500">{new Date(log.changed_at).toLocaleString()}</p>
              </div>

              <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                <p><span className="font-semibold text-slate-900">Goal ID:</span> {log.goal_id ?? "-"}</p>
                <p><span className="font-semibold text-slate-900">Changed By:</span> {log.changed_by || "-"}</p>
                <p><span className="font-semibold text-slate-900">Field:</span> {log.field_changed || "-"}</p>
              </div>

              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                <p className="mb-2 whitespace-pre-wrap break-words"><span className="font-semibold text-slate-900">Old Value:</span> {log.old_value || "-"}</p>
                <p className="whitespace-pre-wrap break-words"><span className="font-semibold text-slate-900">New Value:</span> {log.new_value || "-"}</p>
              </div>
            </article>
          ))}

          {logs.length === 0 && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">No audit entries found.</div>}
        </div>
      </div>
    </Layout>
  );
}
