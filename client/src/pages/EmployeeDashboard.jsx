import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Layout from "../components/Layout";

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [goals, setGoals] = useState([]);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState({});
  const employeeId = localStorage.getItem("userId") || "1";

  const fetchGoals = async () => {
    try {
      setError("");
      const res = await axios.get(`http://localhost:5000/api/goals/employee/${employeeId}`);
      const rows = res.data || [];
      setGoals(rows);
      const initial = {};
      rows.forEach((goal) => {
        initial[goal.id] = {
          achievement: goal.achievement_value || "",
          status: goal.progress_status || "Not Started",
        };
      });
      setDrafts(initial);
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to fetch goals");
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const updateAchievement = async (id) => {
    try {
      setError("");
      const draft = drafts[id] || {};
      await axios.post(`http://localhost:5000/api/goals/checkin/${id}`, {
        achievement_value: draft.achievement,
        progress_status: draft.status,
      });
      fetchGoals();
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Check-in failed");
    }
  };

  const submitGoals = async () => {
    try {
      setError("");
      await axios.put(`http://localhost:5000/api/goals/submit/${employeeId}`);
      fetchGoals();
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Goal submission failed");
    }
  };

  const totalWeightage = goals.reduce((sum, goal) => sum + (Number(goal.weightage) || 0), 0);

  const statusClass = (status) => {
    if (status === "Pending Approval") return "bg-amber-100 text-amber-800";
    if (status === "Approved") return "bg-emerald-100 text-emerald-700";
    if (status === "Completed") return "bg-emerald-100 text-emerald-700";
    if (status === "On Track") return "bg-cyan-100 text-cyan-700";
    return "bg-slate-100 text-slate-700";
  };

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black text-slate-900">Employee Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600">Track personal goals and submit quarterly progress updates.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => navigate("/create-goal")} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                Create Goal
              </button>
              <button onClick={submitGoals} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                Submit Goals
              </button>
              <button onClick={() => navigate("/shared-goals")} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">
                Shared Goals
              </button>
            </div>
          </div>
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total Goals</p>
            <p className="text-2xl font-black text-slate-900">{goals.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total Weightage</p>
            <p className="text-2xl font-black text-slate-900">{totalWeightage}%</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Approved Goals</p>
            <p className="text-2xl font-black text-slate-900">{goals.filter((goal) => goal.status === "Approved").length}</p>
          </div>
        </div>

        <div className="grid gap-4">
          {goals.map((goal) => {
            const draft = drafts[goal.id] || { achievement: "", status: "Not Started" };
            return (
              <div key={goal.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-black text-slate-900">{goal.title}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(goal.status || goal.progress_status)}`}>
                        {goal.status || goal.progress_status || "Not Started"}
                      </span>
                    </div>
                    <p className="mb-4 text-sm text-slate-600">{goal.description || "No description"}</p>

                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="rounded-lg bg-slate-50 p-3 text-sm">
                        <p className="text-slate-500">Thrust Area</p>
                        <p className="font-semibold text-slate-900">{goal.thrust_area || "-"}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 text-sm">
                        <p className="text-slate-500">UOM</p>
                        <p className="font-semibold text-slate-900">{goal.uom_type || "-"}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 text-sm">
                        <p className="text-slate-500">Target</p>
                        <p className="font-semibold text-slate-900">{goal.target_value || "-"}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 text-sm">
                        <p className="text-slate-500">Weightage</p>
                        <p className="font-semibold text-slate-900">{goal.weightage || 0}%</p>
                      </div>
                    </div>

                    <p className="mt-3 text-sm font-semibold text-emerald-700">Score: {goal.progress_score || 0}%</p>

                    {goal.status === "Approved" && (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <input
                          type="text"
                          value={draft.achievement}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [goal.id]: { ...draft, achievement: e.target.value } }))}
                          placeholder="Achievement"
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500"
                        />
                        <select
                          value={draft.status}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [goal.id]: { ...draft, status: e.target.value } }))}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500"
                        >
                          <option value="Not Started">Not Started</option>
                          <option value="On Track">On Track</option>
                          <option value="Completed">Completed</option>
                        </select>
                        <button
                          onClick={() => updateAchievement(goal.id)}
                          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 md:col-span-2 md:w-fit"
                        >
                          Update Achievement
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {goals.length === 0 && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">No goals found.</div>}
        </div>
      </div>
    </Layout>
  );
}
