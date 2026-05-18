import { useEffect, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const PIE_COLORS = ["#0ea5e9", "#10b981", "#f59e0b"];

export default function Analytics() {
  const [goals, setGoals] = useState([]);
  const [error, setError] = useState("");
  const userId = localStorage.getItem("userId") || "1";

  const fetchGoals = async () => {
    try {
      const res = await axios.get(`/api/goals/employee/${userId}`);
      setGoals(res.data || []);
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to load analytics");
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const statusData = [
    { name: "Completed", value: goals.filter((g) => g.progress_status === "Completed").length },
    { name: "On Track", value: goals.filter((g) => g.progress_status === "On Track").length },
    { name: "Not Started", value: goals.filter((g) => g.progress_status === "Not Started").length },
  ];

  const scoreData = goals.map((goal) => ({
    name: goal.title,
    score: goal.progress_score || 0,
  }));

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Visualize score trends and status distribution across goals.</p>
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-slate-900">Goal Progress Scores</h2>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreData} margin={{ top: 8, right: 12, left: 0, bottom: 56 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" angle={-25} textAnchor="end" height={72} interval={0} tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="score" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-slate-900">Goal Status Distribution</h2>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={110} label>
                    {statusData.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
