import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  TrendingUp,
  CreditCard,
  LogOut,
  User,
  ShieldCheck,
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

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <aside className="app-sidebar">
      {/* Brand Header */}
      <div className="sidebar-logo-container" style={{ padding: "8px 20px 16px" }}>
        <img
          src={fundmatrixLogo}
          alt="FUNDMATRIX"
          style={{
            height: 32,
            width: "auto",
            maxWidth: "100%",
            objectFit: "contain",
            objectPosition: "left",
            display: "block",
          }}
        />
      </div>

      {/* User Profile Card */}
      {user && (
        <div className="sidebar-user-card">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: isOfficer
                  ? "linear-gradient(135deg, #10B981 0%, #059669 100%)"
                  : "linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "0.85rem",
                boxShadow: isOfficer
                  ? "0 2px 8px rgba(16, 185, 129, 0.3)"
                  : "0 2px 8px rgba(6, 182, 212, 0.3)",
                flexShrink: 0,
              }}
            >
              {getInitials(user.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sidebar-user-name" title={user.name}>
                {user.name}
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "#64748B",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={user.email}
              >
                {user.email}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 10,
              paddingTop: 8,
              borderTop: "1px solid #E2E8F0",
            }}
          >
            <span
              style={{
                fontSize: "0.68rem",
                padding: "2px 8px",
                borderRadius: 12,
                fontWeight: 700,
                background: isOfficer ? "#DCFCE7" : "#ECFEFF",
                color: isOfficer ? "#15803D" : "#0891B2",
                border: `1px solid ${isOfficer ? "#BBF7D0" : "#A5F3FC"}`,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {isOfficer ? <ShieldCheck size={11} /> : <User size={11} />}
              {isOfficer ? "Loan Officer" : "Customer"}
            </span>

            <button
              onClick={handleLogout}
              title="Logout session"
              style={{
                background: "transparent",
                border: "none",
                color: "#64748B",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: "0.74rem",
                fontWeight: 600,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#EF4444";
                e.currentTarget.style.background = "#FEF2F2";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#64748B";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <LogOut size={12} /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
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
            <span style={{ flex: 1 }}>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
