import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import LoanApplication from "./pages/LoanApplication";
import LoanApprovals from "./pages/LoanApprovals";
import UtilizationTracker from "./pages/UtilizationTracker";

import LoanRepayment from "./pages/LoanRepayment";

function ProtectedLayout() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="layout">
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/apply" element={<LoanApplication />} />
          <Route path="/approvals" element={<LoanApprovals />} />
          <Route path="/utilization" element={<UtilizationTracker />} />
          <Route path="/repay" element={<LoanRepayment />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/loan/app">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

