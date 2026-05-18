import { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  ResponsiveContainer,
} from 'recharts';

export default function AnalyticsDashboard(){
  const [qoq, setQoq] = useState([]);
  const [dist, setDist] = useState([]);
  const [managers, setManagers] = useState([]);

  useEffect(()=>{ fetchAll(); },[]);

  async function fetchAll(){
    try{
      const [q, d, m] = await Promise.all([
        axios.get('/api/admin/analytics/qoq'),
        axios.get('/api/admin/analytics/distribution?by=thrust_area'),
        axios.get('/api/admin/analytics/managers')
      ]);
      setQoq(q.data || []);
      setDist(d.data || []);
      setManagers(m.data || []);
    }catch(err){
      console.error(err);
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold mb-4">Analytics Dashboard</h1>
        <section className="mb-6 bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-2">Quarter-on-Quarter Goals (Org)</h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={qoq} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="cycle_name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="completed_goals" stroke="#8884d8" name="Completed" />
                <Line type="monotone" dataKey="total_goals" stroke="#82ca9d" name="Total" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="mb-6 bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-2">Goal Distribution (Thrust Area)</h2>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={dist} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="key" type="category" />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="mb-6 bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-2">Manager Effectiveness (Top)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Manager</th>
                  <th>Direct Reports</th>
                  <th>Avg Checkin Rate</th>
                  <th>Avg Approval Days</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {managers.map((m)=>(
                  <tr key={m.manager_id}>
                    <td>{m.manager_email}</td>
                    <td>{m.direct_reports}</td>
                    <td>{m.avg_checkin_rate}</td>
                    <td>{m.avg_approval_days}</td>
                    <td><Link to={`/admin/analytics/manager/${m.manager_id}`} className="text-cyan-600">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </Layout>
  );
}
