import { useEffect, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";

export default function ManagerCheckins() {
  const [checkins, setCheckins] = useState([]);
  const [error, setError] = useState("");
  const [comments, setComments] = useState({});

  const fetchCheckins = async () => {
    try {
      setError("");
      const res = await axios.get("/api/goals/manager/checkins");
      const rows = res.data || [];
      setCheckins(rows);
      const initial = {};
      rows.forEach((row) => {
        initial[row.id] = row.manager_comment || "";
      });
      setComments(initial);
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to load check-ins");
    }
  };

  useEffect(() => {
    fetchCheckins();
  }, []);

  const addComment = async (id) => {
    try {
      setError("");
      await axios.put(`/api/goals/manager/comment/${id}`, {
        manager_comment: comments[id] || "",
      });
      fetchCheckins();
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to save comment");
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-5">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Manager Check-ins</h1>
          <p className="mt-1 text-sm text-slate-600">Review quarterly submissions and provide manager comments.</p>
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="grid gap-4">
          {checkins.map((checkin) => (
            <div key={checkin.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-slate-900">{checkin.title}</h2>
              <div className="mt-2 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                <p><span className="font-semibold">Quarter:</span> {checkin.quarter || "-"}</p>
                <p><span className="font-semibold">Status:</span> {checkin.progress_status || "-"}</p>
                <p><span className="font-semibold">Planned:</span> {checkin.target_value || "-"}</p>
                <p><span className="font-semibold">Actual:</span> {checkin.achievement_value || "-"}</p>
              </div>

              <textarea
                value={comments[checkin.id] || ""}
                onChange={(e) => setComments((prev) => ({ ...prev, [checkin.id]: e.target.value }))}
                className="mt-4 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500"
                placeholder="Manager comment"
              />

              <button onClick={() => addComment(checkin.id)} className="mt-3 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">
                Save Comment
              </button>
            </div>
          ))}

          {checkins.length === 0 && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">No check-ins available.</div>}
        </div>
      </div>
    </Layout>
  );
}
