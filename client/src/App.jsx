import { Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import CreateGoal from "./pages/CreateGoal";
import AuditLogs from "./pages/AuditLogs";
import Analytics from "./pages/Analytics";
import SharedGoals from "./pages/SharedGoals";
import ProtectedRoute from "./components/ProtectedRoute";
import CompletionDashboard from "./pages/CompletionDashboard";
import ManagerCheckins from "./pages/ManagerCheckins";
export default function App() {

  return (

    <>
      <Routes>

        <Route
          path="/"
          element={<Login />}
        />

        <Route
          path="/employee"
          element={
            <ProtectedRoute allowedRole="employee">
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/create-goal"
          element={
            <ProtectedRoute allowedRole="employee">
              <CreateGoal />
            </ProtectedRoute>
          }
        />

        <Route
          path="/shared-goals"
          element={
            <ProtectedRoute allowedRole="employee">
              <SharedGoals />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager"
          element={
            <ProtectedRoute allowedRole="manager">
              <ManagerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/analytics"
          element={
            <ProtectedRoute allowedRole="admin">
              <Analytics />
            </ProtectedRoute>
          }
        />

        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute allowedRole="admin">
              <AuditLogs />
            </ProtectedRoute>
          }
        />

        <Route
          path="/completion-dashboard"
          element={
            <ProtectedRoute allowedRole="admin">
              <CompletionDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager-checkins"
          element={
            <ProtectedRoute allowedRole="manager">
              <ManagerCheckins />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>

  );
}