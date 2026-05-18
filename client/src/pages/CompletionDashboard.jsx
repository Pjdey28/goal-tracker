import { useEffect, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";

export default function CompletionDashboard() {
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState("");

  const fetchDashboard = async () => {
    try {
      setError("");
      const res = await axios.get("/api/goals/completion/dashboard");
      setEmployees(res.data || []);
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to load completion dashboard");
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-5">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Completion Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Completion rate overview by employee.</p>
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="grid gap-4">
          {employees.map((emp) => {
            const percent = Math.min(100, Math.max(0, Number(emp.completion_rate) || 0));
            return (
              <div key={emp.employee_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Employee {emp.employee_id}</h2>
                    <p className="text-sm text-slate-600">Total Goals: {emp.total_goals} • Completed: {emp.completed_goals}</p>
                  </div>

                  <div className="w-full max-w-md">
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
                      <span>Completion</span>
                      <span>{Math.round(percent)}%</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                      <div className="h-3 rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {employees.length === 0 && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">No completion data available.</div>}
        </div>
      </div>
    </Layout>
  );
}
