import { Link, useNavigate } from "react-router-dom";

export default function Layout({ children }) {

  const navigate = useNavigate();

  const role = localStorage.getItem("role");

  const logout = () => {

    localStorage.clear();

    navigate("/");

  };

  return (

    <div className="min-h-screen bg-slate-100">

      <div className="mx-auto flex min-h-screen w-full max-w-[1700px]">

      <aside className="w-[260px] border-r border-slate-800 bg-slate-950 px-5 py-6 text-white">

        <h1 className="mb-10 text-3xl font-black tracking-tight text-cyan-200">
          Goal Portal
        </h1>

        <div className="flex flex-col gap-2">

          {role === "employee" && (

            <>

              <Link
                to="/employee"
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                Dashboard
              </Link>

              <Link
                to="/create-goal"
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                Create Goal
              </Link>

              <Link
                to="/shared-goals"
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                Shared Goals
              </Link>

            </>

          )}

          {role === "manager" && (

            <>

              <Link
                to="/manager"
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                Manager Dashboard
              </Link>
              <Link
                to="/manager-checkins"
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                >
                Quarterly Check-ins
              </Link>

            </>

          )}

          {role === "admin" && (

            <>

              <Link
                to="/admin"
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                Admin Dashboard
              </Link>

              <Link
                to="/analytics"
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                Analytics
              </Link>

              <Link
                to="/audit-logs"
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                Audit Logs
              </Link>
              <Link
                to="/admin/escalations"
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                Escalations
              </Link>
              <Link
                to="/completion-dashboard"
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                >
                Completion Dashboard
              </Link>

            </>

          )}

          <button
            onClick={logout}
            className="mt-8 rounded-lg bg-rose-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Logout
          </button>

        </div>

      </aside>

      <main className="app-content flex-1 p-6 text-slate-900 lg:p-8">{children}</main>

      </div>

    </div>

  );
}