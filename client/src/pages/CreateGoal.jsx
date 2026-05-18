import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";

export default function CreateGoal() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thrustArea, setThrustArea] = useState("");
  const [uomType, setUomType] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [weightage, setWeightage] = useState("");
  const [error, setError] = useState("");
  const employeeId = localStorage.getItem("userId") || "1";

  const handleSubmit = async () => {
    try {
      setError("");
      await axios.post("http://localhost:5000/api/goals/create", {
        employee_id: Number(employeeId),
        title,
        description,
        thrust_area: thrustArea,
        uom_type: uomType,
        target_value: targetValue,
        weightage: Number(weightage),
      });

      navigate("/employee");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create goal");
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Create Goal</h1>
          <p className="mt-1 text-sm text-slate-600">Define a new goal with clear target and measurement unit.</p>
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Goal Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500" />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Thrust Area</label>
              <input value={thrustArea} onChange={(e) => setThrustArea(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">UOM Type</label>
              <select value={uomType} onChange={(e) => setUomType(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500">
                <option value="">Select UOM</option>
                <option value="MIN">MIN</option>
                <option value="MAX">MAX</option>
                <option value="TIMELINE">TIMELINE</option>
                <option value="ZERO">ZERO</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Target Value</label>
              <input value={targetValue} onChange={(e) => setTargetValue(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Weightage</label>
              <input type="number" value={weightage} onChange={(e) => setWeightage(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500" />
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button onClick={handleSubmit} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
              Save Goal
            </button>
            <button onClick={() => navigate("/employee")} className="rounded-lg bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
