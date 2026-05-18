import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';

export default function ManagerDetail(){
  const { id } = useParams();
  const [cycles, setCycles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [goals, setGoals] = useState([]);

  useEffect(()=>{ fetchCycles(); },[]);

  async function fetchCycles(){
    try{
      const res = await axios.get('/api/cycles');
      setCycles(res.data || []);
      if(res.data && res.data[0]) setSelected(res.data[0].id);
    }catch(err){console.error(err)}
  }

  async function loadGoals(cycleId){
    try{
      const res = await axios.get(`/api/admin/analytics/manager/${id}/cycle/${cycleId}/goals`);
      setGoals(res.data || []);
    }catch(err){console.error(err)}
  }

  useEffect(()=>{ if(selected) loadGoals(selected); },[selected]);

  return (
    <Layout>
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold mb-4">Manager Detail</h1>
        <div className="mb-4">
          <label className="mr-2">Cycle</label>
          <select value={selected||''} onChange={(e)=>setSelected(e.target.value)}>
            {cycles.map(c=>(<option key={c.id} value={c.id}>{c.cycle_name}</option>))}
          </select>
          <a className="ml-4 rounded bg-slate-700 text-white px-3 py-1" href={`/api/admin/analytics/export/manager/${id}/cycle/${selected}`}>Export CSV</a>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <table className="w-full text-sm">
            <thead>
              <tr><th>Goal</th><th>Employee</th><th>Status</th><th>Progress</th></tr>
            </thead>
            <tbody>
              {goals.map(g=>(
                <tr key={g.id}><td>{g.title}</td><td>{g.employee_id}</td><td>{g.status}</td><td>{g.progress_score}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
