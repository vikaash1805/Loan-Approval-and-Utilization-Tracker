import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, FileText, CheckSquare, TrendingUp, Landmark, LogOut, UserCheck, CreditCard
} from "lucide-react";
import fundmatrixLogo from "../assets/fundmatrix_logo.png";

export default function Navbar() {
  const { user, logout, isOfficer } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Nav links tailored by role
  const navItems = isOfficer
    ? [
        { to: "/approvals", icon: CheckSquare, label: "Loan Approvals" },
        { to: "/utilization", icon: TrendingUp, label: "Tracker & Proofs" },
        { to: "/", icon: LayoutDashboard, label: "Dashboard" },
      ]
    : [
        { to: "/apply", icon: FileText, label: "Apply for Loan" },
        { to: "/approvals", icon: CheckSquare, label: "My Applications" },
        { to: "/utilization", icon: TrendingUp, label: "Utilization Tracker" },
        { to: "/repay", icon: CreditCard, label: "Repay & Interest" },
        { to: "/", icon: LayoutDashboard, label: "Dashboard" },
      ];

  return (
    <aside className="app-sidebar">
      {/* Logo */}
      <div className="sidebar-logo-container">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <img
            src={fundmatrixLogo}
            alt="FUNDMATRIX"
            style={{
              height: 34,
              width: "auto",
              maxWidth: "100%",
              objectFit: "contain",
              objectPosition: "left",
              display: "block",
            }}
          />
          <div style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600, paddingLeft: 2, letterSpacing: "0.3px" }}>
            SaaS Loan Platform
          </div>
        </div>
      </div>

      {/* User Profile Badge */}
      {user && (
        <div className="sidebar-user-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <UserCheck size={16} color={isOfficer ? "#10b981" : "#06b6d4"} />
            <div className="sidebar-user-name">
              {user.name}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              style={{
                fontSize: "0.68rem",
                padding: "3px 8px",
                borderRadius: 12,
                fontWeight: 600,
                background: isOfficer ? "#dcfce7" : "#ecfeff",
                color: isOfficer ? "#15803d" : "#0891b2",
                border: `1px solid ${isOfficer ? "#bbf7d0" : "#a5f3fc"}`,
              }}
            >
              {isOfficer ? "Loan Officer" : "Customer"}
            </span>
            <button
              onClick={handleLogout}
              title="Logout"
              style={{
                background: "transparent",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: "0.74rem",
                fontWeight: 500,
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
            >
              <LogOut size={13} /> Logout
            </button>
          </div>
        </div>
      )}

      {/* Nav links */}
      <nav className="sidebar-nav">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `sidebar-nav-link ${isActive ? "active" : ""}`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: "0 20px", fontSize: "0.72rem", color: "#94a3b8", textAlign: "center", fontWeight: 500 }}>
        Smart Verification & Banking Suite
      </div>
    </aside>
  );
}
