import { useEffect, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import SharedGoalManager from "../components/SharedGoalManager";

export default function ManagerDashboard() {
  const [goals, setGoals] = useState([]);
  const [tab, setTab] = useState("Pending");
  const [search, setSearch] = useState("");
  const [teamOverview, setTeamOverview] = useState([]);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const API = "/api/goals";

  const formatDate = (value) => {
    if (!value) return "Not set";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not set";
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  };

  const toInputDate = (value) => {
    if (!value) return "";
    return String(value).split("T")[0];
  };

  const statusBadge = (status) => {
    if (status === "Approved") return "bg-emerald-100 text-emerald-700";
    if (status === "Returned") return "bg-rose-100 text-rose-700";
    if (status === "Pending Approval") return "bg-amber-100 text-amber-800";
    return "bg-slate-100 text-slate-700";
  };

  const fetchGoals = async () => {
    try {
      setError("");
      const params = {};
      if (tab && tab !== "All") {
        params.status = tab === "Returned" ? "Returned" : tab;
      }

      const res = await axios.get(`${API}/manager`, { params });
      const rows = res.data || [];
      setGoals(rows);

      const initialDrafts = {};
      rows.forEach((goal) => {
        initialDrafts[goal.id] = {
          target_value: goal.target_value ?? "",
          weightage: goal.weightage ?? "",
          deadline: toInputDate(goal.deadline),
        };
      });
      setDrafts(initialDrafts);
    } catch (err) {
      console.log(err);
      const msg = err.response?.data?.message || err.message || "Failed to load goals";
      setError(msg);
    }
  };

  const fetchTeamOverview = async () => {
    try {
      setError("");
      const res = await axios.get(`${API}/manager/team-overview`);
      setTeamOverview(res.data || []);
    } catch (err) {
      console.log(err);
      const msg = err.response?.data?.message || err.message || "Failed to load team overview";
      setError(msg);
    }
  };

  useEffect(() => {
    if (tab === "Team") {
      fetchTeamOverview();
      return;
    }
    fetchGoals();
  }, [tab]);

  const approveGoal = async (id) => {
    try {
      setError("");
      await axios.put(`${API}/approve/${id}`);
      fetchGoals();
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to approve goal");
    }
  };

  const rejectGoal = async (id) => {
    try {
      setError("");
      await axios.put(`${API}/reject/${id}`);
      fetchGoals();
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to return goal");
    }
  };

  const updateGoal = async (id) => {
    try {
      setSavingId(id);
      setError("");
      const draft = drafts[id] || {};
      await axios.put(`${API}/manager/update/${id}`, {
        target_value: draft.target_value,
        weightage: Number(draft.weightage),
        deadline: draft.deadline || undefined,
      });
      fetchGoals();
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to update goal");
    } finally {
      setSavingId(null);
    }
  };

  const updateDraft = (id, key, value) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [key]: value,
      },
    }));
  };

  const filteredGoals = goals.filter((goal) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (goal.title || "").toLowerCase().includes(s) || (goal.description || "").toLowerCase().includes(s);
  });

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">Manager Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600">Review goals, approve submissions, and monitor team delivery.</p>
            </div>

            <div className="w-full lg:w-[28rem]">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search Goals</label>
              <input
                placeholder="Search by goal title or description"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {["Pending", "All", "Approved", "Returned", "Team"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  tab === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

        {tab === "Team" ? (
          <div className="grid gap-4 md:grid-cols-2">
            {teamOverview.map((member) => (
              <div key={member.employee_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{member.email}</h2>
                    <p className="text-xs text-slate-500">Employee ID: {member.employee_id}</p>
                  </div>
                  <div className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Avg {member.avg_progress_score}%</div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-slate-500">Total Goals</p>
                    <p className="text-xl font-black text-slate-900">{member.total_goals}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="text-emerald-700">Completed</p>
                    <p className="text-xl font-black text-emerald-800">{member.completed_goals}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Upcoming Deadlines</p>
                  {(member.upcoming_deadlines || []).length === 0 ? (
                    <p className="text-sm text-slate-500">No deadlines set.</p>
                  ) : (
                    <div className="space-y-2">
                      {member.upcoming_deadlines.map((deadline) => (
                        <div key={deadline.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                          <p className="font-semibold text-slate-900">{deadline.title}</p>
                          <p className="text-xs text-slate-600">Due {formatDate(deadline.deadline)} • {deadline.status || "Unspecified"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {teamOverview.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 md:col-span-2">No team overview data available.</div>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredGoals.map((goal) => {
              const draft = drafts[goal.id] || { target_value: "", weightage: "", deadline: "" };
              const canEdit = goal.status !== "Approved";
              const canApprove = goal.status === "Pending Approval" || tab === "Pending";
              const canReturn = goal.status === "Pending Approval" || tab === "Pending";

              return (
                <div key={goal.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-black text-slate-900">{goal.title}</h2>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(goal.status)}`}>{goal.status || "Draft"}</span>
                      </div>
                      <p className="mb-4 text-sm text-slate-600">{goal.description || "No description"}</p>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Target</label>
                          <input
                            type="text"
                            value={draft.target_value}
                            disabled={!canEdit}
                            onChange={(e) => updateDraft(goal.id, "target_value", e.target.value)}
                            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                              canEdit ? "border-slate-300 bg-white" : "border-slate-200 bg-slate-100 text-slate-500"
                            }`}
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Weightage %</label>
                          <input
                            type="number"
                            value={draft.weightage}
                            disabled={!canEdit}
                            onChange={(e) => updateDraft(goal.id, "weightage", e.target.value)}
                            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                              canEdit ? "border-slate-300 bg-white" : "border-slate-200 bg-slate-100 text-slate-500"
                            }`}
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Deadline</label>
                          {canEdit ? (
                            <input
                              type="date"
                              value={draft.deadline}
                              onChange={(e) => updateDraft(goal.id, "deadline", e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
                            />
                          ) : (
                            <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600">{formatDate(goal.deadline)}</div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 text-sm text-slate-700">
                        <span className="font-semibold">UOM:</span> {goal.uom_type || "-"}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-row gap-2 lg:flex-col">
                      {canEdit && (
                        <button
                          onClick={() => updateGoal(goal.id)}
                          disabled={savingId === goal.id}
                          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingId === goal.id ? "Saving..." : "Update"}
                        </button>
                      )}
                      {canApprove && (
                        <button
                          onClick={() => approveGoal(goal.id)}
                          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                      )}
                      {canReturn && (
                        <button
                          onClick={() => rejectGoal(goal.id)}
                          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
                        >
                          Return
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredGoals.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">No goals to display.</div>
            )}
          </div>
        )}

        <SharedGoalManager />
      </div>
    </Layout>
  );
}
