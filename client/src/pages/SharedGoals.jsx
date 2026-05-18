import { useEffect, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";

export default function SharedGoals() {
  const [goals, setGoals] = useState([]);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState({});
  const employeeId = localStorage.getItem("userId") || "1";

  const fetchGoals = async () => {
    try {
      setError("");
      const res = await axios.get(`/api/goals/shared/${employeeId}`);
      const rows = res.data || [];
      setGoals(rows);
      const initial = {};
      rows.forEach((goal) => {
        initial[goal.id] = {
          weightage: goal.weightage ?? "",
          progress_status: goal.progress_status || "Not Started",
          achievement_value: goal.achievement_value ?? "",
        };
      });
      setDrafts(initial);
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to load shared goals");
    }
  };

  const updateAssignment = async (assignmentId) => {
    const draft = drafts[assignmentId] || {};
    const payload = {};

    if (draft.weightage !== "") {
      const numericWeightage = Number(draft.weightage);
      if (Number.isNaN(numericWeightage)) {
        setError("Invalid weightage value");
        return;
      }
      payload.weightage = numericWeightage;
    }

    if (draft.progress_status) {
      payload.progress_status = draft.progress_status;
    }

    if (draft.achievement_value !== "") {
      const numericAchievement = Number(draft.achievement_value);
      if (Number.isNaN(numericAchievement)) {
        setError("Invalid achievement value");
        return;
      }
      payload.achievement_value = numericAchievement;
    }

    try {
      setError("");
      await axios.put(`/api/goals/shared/assign/${assignmentId}`, payload);
      fetchGoals();
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to update shared goal");
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-5">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Shared Goals</h1>
          <p className="mt-1 text-sm text-slate-600">Assigned KPIs only. Title and target are read-only; update status, achievement, and weightage here.</p>
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="grid gap-4">
          {goals.map((goal) => (
            <div key={goal.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-black text-slate-900">{goal.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">{goal.description || "No description"}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-3 text-sm">
                      <p className="text-slate-500">Thrust Area</p>
                      <p className="font-semibold text-slate-900">{goal.thrust_area || "-"}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-sm">
                      <p className="text-slate-500">Target</p>
                      <p className="font-semibold text-slate-900">{goal.target_value || "-"}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-sm">
                      <p className="text-slate-500">Current Status</p>
                      <p className="font-semibold text-slate-900">{goal.progress_status || "Not Started"}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-sm">
                      <p className="text-slate-500">Progress Score</p>
                      <p className="font-semibold text-slate-900">{goal.progress_score ?? 0}%</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4 lg:min-w-72">
                  <div className="grid gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Weightage</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={drafts[goal.id]?.weightage ?? ""}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [goal.id]: {
                                ...(prev[goal.id] || {}),
                                weightage: e.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500"
                        />
                        <span className="text-sm font-semibold text-slate-600">%</span>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Progress Status</label>
                      <select
                        value={drafts[goal.id]?.progress_status ?? "Not Started"}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [goal.id]: {
                              ...(prev[goal.id] || {}),
                              progress_status: e.target.value,
                            },
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500"
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="On Track">On Track</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Achievement</label>
                      <input
                        type="number"
                        value={drafts[goal.id]?.achievement_value ?? ""}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [goal.id]: {
                              ...(prev[goal.id] || {}),
                              achievement_value: e.target.value,
                            },
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500"
                      />
                    </div>

                    <p className="text-xs text-slate-500">Goal title and target remain read-only.</p>

                    <button onClick={() => updateAssignment(goal.id)} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
                      Save Shared Goal Update
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {goals.length === 0 && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">No shared goals assigned yet.</div>}
        </div>
      </div>
    </Layout>
  );
}
