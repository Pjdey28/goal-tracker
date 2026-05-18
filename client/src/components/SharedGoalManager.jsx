import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API = "http://localhost:5000/api/goals";

export default function SharedGoalManager() {
  const [sharedGoals, setSharedGoals] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState("assign");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    thrust_area: "",
    uom_type: "",
    target_value: "",
  });
  const [assignForm, setAssignForm] = useState({
    shared_goal_id: "",
    weightage: "",
    selectedEmployees: [],
  });

  const fetchData = async () => {
    try {
      setError("");
      const [goalsRes, employeesRes] = await Promise.all([
        axios.get(`${API}/shared/catalog`),
        axios.get(`${API}/employees`),
      ]);
      setSharedGoals(goalsRes.data || []);
      setEmployees(employeesRes.data || []);
      if (!assignForm.shared_goal_id && goalsRes.data?.[0]?.id) {
        setAssignForm((prev) => ({ ...prev, shared_goal_id: String(goalsRes.data[0].id) }));
      }
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to load shared goal data");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedEmployees = useMemo(() => {
    const selectedIds = new Set(assignForm.selectedEmployees.map(String));
    return employees.filter((employee) => selectedIds.has(String(employee.id)));
  }, [assignForm.selectedEmployees, employees]);

  const createSharedGoal = async () => {
    try {
      setLoading(true);
      setError("");
      await axios.post(`${API}/shared/create`, createForm);
      setCreateForm({ title: "", description: "", thrust_area: "", uom_type: "", target_value: "" });
      setActiveTab("assign");
      fetchData();
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to create shared goal");
    } finally {
      setLoading(false);
    }
  };

  const assignSharedGoal = async () => {
    try {
      setLoading(true);
      setError("");
      if (!assignForm.shared_goal_id) {
        setError("Choose a shared KPI first");
        return;
      }
      if (assignForm.selectedEmployees.length === 0) {
        setError("Select at least one employee");
        return;
      }
      if (!assignForm.weightage || Number(assignForm.weightage) <= 0) {
        setError("Enter a weightage greater than 0");
        return;
      }

      const results = [];
      for (const employeeId of assignForm.selectedEmployees) {
        try {
          await axios.post(`${API}/shared/assign`, {
            shared_goal_id: Number(assignForm.shared_goal_id),
            employee_id: Number(employeeId),
            weightage: Number(assignForm.weightage),
          });
          results.push({ employeeId, ok: true });
        } catch (err) {
          results.push({ employeeId, ok: false, message: err.response?.data?.message || "Failed" });
        }
      }

      const failed = results.filter((result) => !result.ok);
      if (failed.length > 0) {
        setError(`Assigned ${results.length - failed.length} employee(s). ${failed.length} failed: ${failed.map((result) => result.message).join(", ")}`);
      } else {
        setError("");
      }

      setAssignForm((prev) => ({ ...prev, selectedEmployees: [] }));
      fetchData();
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to assign shared KPI");
    } finally {
      setLoading(false);
    }
  };

  const toggleEmployee = (employeeId) => {
    setAssignForm((prev) => {
      const exists = prev.selectedEmployees.includes(employeeId);
      return {
        ...prev,
        selectedEmployees: exists
          ? prev.selectedEmployees.filter((id) => id !== employeeId)
          : [...prev.selectedEmployees, employeeId],
      };
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Shared KPI Assignment</h2>
          <p className="mt-1 text-sm text-slate-600">Create a departmental KPI and push it to one or more employees.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("assign")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === "assign" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            Assign KPI
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === "create" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            Create KPI
          </button>
        </div>
      </div>

      {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-4">
          {activeTab === "create" ? (
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Goal Title</label>
                <input value={createForm.title} onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Description</label>
                <textarea value={createForm.description} onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))} className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Thrust Area</label>
                <input value={createForm.thrust_area} onChange={(e) => setCreateForm((prev) => ({ ...prev, thrust_area: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">UOM</label>
                <select value={createForm.uom_type} onChange={(e) => setCreateForm((prev) => ({ ...prev, uom_type: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500">
                  <option value="">Select</option>
                  <option value="MIN">MIN</option>
                  <option value="MAX">MAX</option>
                  <option value="TIMELINE">TIMELINE</option>
                  <option value="ZERO">ZERO</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Target Value</label>
                <input value={createForm.target_value} onChange={(e) => setCreateForm((prev) => ({ ...prev, target_value: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500" />
              </div>
              <div className="flex items-end">
                <button onClick={createSharedGoal} disabled={loading} className="w-full rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60">
                  {loading ? "Saving..." : "Create KPI"}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Shared KPI</label>
                <select value={assignForm.shared_goal_id} onChange={(e) => setAssignForm((prev) => ({ ...prev, shared_goal_id: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500">
                  {sharedGoals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Weightage for each selected employee</label>
                <input type="number" value={assignForm.weightage} onChange={(e) => setAssignForm((prev) => ({ ...prev, weightage: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500" />
              </div>
              <div className="flex items-end">
                <button onClick={assignSharedGoal} disabled={loading} className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                  {loading ? "Assigning..." : "Push KPI"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Employees</h3>
          <div className="mt-3 max-h-[28rem] space-y-2 overflow-auto pr-1">
            {employees.map((employee) => (
              <label key={employee.id} className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <span className="font-medium text-slate-800">{employee.email}</span>
                <input type="checkbox" checked={assignForm.selectedEmployees.includes(employee.id)} onChange={() => toggleEmployee(employee.id)} />
              </label>
            ))}
            {employees.length === 0 && <div className="rounded-lg bg-white p-4 text-sm text-slate-500">No employees found.</div>}
          </div>
          <div className="mt-4 rounded-lg bg-white p-3 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">Selected:</span> {selectedEmployees.length}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Available Shared KPIs</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {sharedGoals.map((goal) => (
            <div key={goal.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="font-semibold text-slate-900">{goal.title}</p>
              <p className="text-xs text-slate-600">{goal.target_value} target • {goal.uom_type}</p>
            </div>
          ))}
          {sharedGoals.length === 0 && <div className="rounded-lg bg-white p-4 text-sm text-slate-500">No shared KPIs created yet.</div>}
        </div>
      </div>
    </section>
  );
}
