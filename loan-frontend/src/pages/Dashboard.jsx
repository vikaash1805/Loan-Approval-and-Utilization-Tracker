import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/loanApi";
import StatCard from "../components/StatCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";
import {
  FileText,
  CheckCircle,
  XCircle,
  Banknote,
  TrendingUp,
  Clock,
  RefreshCw,
  ArrowRight,
  PlusCircle,
  CreditCard,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Radio,
  Copy,
} from "lucide-react";

const PIE_COLORS = {
  Pending: "#F59E0B",
  Approved: "#10B981",
  Rejected: "#EF4444",
  Disbursed: "#06B6D4",
  Closed: "#64748B",
};

const fmt = (n) => {
  if (!n && n !== 0) return "₹0";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
};

const statusBadge = (s) => (
  <span className={`badge badge-${s?.toLowerCase() || "pending"}`}>
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background:
          s === "Approved"
            ? "#10B981"
            : s === "Disbursed"
            ? "#06B6D4"
            : s === "Rejected"
            ? "#EF4444"
            : s === "Pending"
            ? "#F59E0B"
            : "#64748B",
        display: "inline-block",
      }}
    />
    {s}
  </span>
);

export default function Dashboard() {
  const { user, isOfficer } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (!isOfficer && user?.email) {
        params.email = user.email;
      }
      const res = await api.getDashboard(params);
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  const copyAccountNum = () => {
    navigator.clipboard?.writeText("FM-9842-8921-9024");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) return <div className="spinner" />;

  if (error) {
    return (
      <div className="fade-in">
        <div className="alert alert-error" style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={load}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const {
    stats = {},
    status_breakdown = [],
    type_breakdown = [],
    monthly_trend = [],
    recent_applications = [],
  } = data || {};

  return (
    <div className="fade-in">
      {/* Top Hero Section: Split between 3D Holographic Card & Portfolio Command Hub */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: 22,
          marginBottom: 26,
          alignItems: "stretch",
        }}
      >
        {/* Left: Interactive 3D Holographic Card */}
        <div className="fintech-virtual-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
            <div>
              <div style={{ fontSize: "0.72rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#A5F3FC", fontWeight: 800 }}>
                FUNDMATRIX PRIME
              </div>
              <div style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "1.1rem", fontWeight: 700, letterSpacing: "2px", marginTop: 4 }}>
                FM • 8921 • 9024
              </div>
            </div>

            {/* Chip & Signal Icon */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 24,
                  borderRadius: 4,
                  background: "linear-gradient(135deg, #FDE68A 0%, #D97706 100%)",
                  border: "1px solid rgba(255, 255, 255, 0.4)",
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
                }}
              />
              <Radio size={18} color="#A5F3FC" style={{ transform: "rotate(90deg)" }} />
            </div>
          </div>

          <div style={{ margin: "14px 0", position: "relative", zIndex: 1 }}>
            <span style={{ fontSize: "0.74rem", color: "#E2E8F0", textTransform: "uppercase", fontWeight: 600 }}>
              {isOfficer ? "Portfolio Lending Facility" : "Approved Available Credit"}
            </span>
            <div
              style={{
                fontFamily: "Outfit, sans-serif",
                fontSize: "2.1rem",
                fontWeight: 800,
                color: "#FFFFFF",
                letterSpacing: "-0.5px",
                lineHeight: 1.1,
                marginTop: 2,
              }}
            >
              {fmt(stats.total_approved || stats.total_disbursed || 500000)}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", position: "relative", zIndex: 1 }}>
            <div>
              <div style={{ fontSize: "0.68rem", textTransform: "uppercase", color: "#94A3B8", fontWeight: 700 }}>
                Cardholder / Facility
              </div>
              <div style={{ fontSize: "0.92rem", fontWeight: 800, letterSpacing: "0.5px" }}>
                {user?.name || "Enterprise Borrower"}
              </div>
            </div>

            <button
              onClick={copyAccountNum}
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                borderRadius: 8,
                padding: "5px 10px",
                color: "#FFFFFF",
                fontSize: "0.74rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.2s ease",
              }}
            >
              <Copy size={12} /> {copied ? "Copied ID" : "Copy Account Ref"}
            </button>
          </div>
        </div>

        {/* Right: Quick Action Dock & Live Pulse */}
        <div
          className="card"
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "22px 24px",
            background: "linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)",
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", color: "#64748B", letterSpacing: "0.5px" }}>
                Command Center
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  color: "#059669",
                  background: "#ECFDF5",
                  padding: "3px 8px",
                  borderRadius: 12,
                  border: "1px solid #A7F3D0",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
                AI Engine Online
              </span>
            </div>

            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>
              {isOfficer ? "Underwriting Risk Engine" : "Seamless Lending Workflows"}
            </div>
            <p style={{ fontSize: "0.82rem", color: "#64748B", lineHeight: 1.4 }}>
              {isOfficer
                ? "Automatic fraud detection, duplicate image shield, and instant credit decisions."
                : "Apply in minutes with automated OCR verification and milestone drawdown tracking."}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            {!isOfficer ? (
              <>
                <button
                  className="btn btn-accent"
                  style={{ flex: 1, minWidth: 140 }}
                  onClick={() => navigate("/apply")}
                >
                  <PlusCircle size={15} /> Apply Loan
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ flex: 1, minWidth: 140 }}
                  onClick={() => navigate("/repay")}
                >
                  <CreditCard size={15} /> Repay EMI
                </button>
              </>
            ) : (
              <button
                className="btn btn-accent"
                style={{ width: "100%" }}
                onClick={() => navigate("/approvals")}
              >
                <CheckCircle size={15} /> Review Loan Pipeline ({stats.pending_approvals || 0} Pending)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="stat-grid">
        <StatCard
          icon={<FileText size={20} />}
          label="Total Applications"
          value={stats.total_applications || 0}
          sub="Recorded loan requests"
          color="#0F172A"
          trend="+14%"
          trendPositive={true}
        />
        <StatCard
          icon={<Clock size={20} />}
          label="Pending Review"
          value={stats.pending_approvals || 0}
          sub="Underwriting queue"
          color="#F59E0B"
          trend="In queue"
        />
        <StatCard
          icon={<CheckCircle size={20} />}
          label="Approved Facility"
          value={fmt(stats.total_approved)}
          sub={`${stats.approved_count || 0} sanctioned`}
          color="#10B981"
          trend="Active"
          trendPositive={true}
        />
        <StatCard
          icon={<Banknote size={20} />}
          label="Disbursed Capital"
          value={fmt(stats.total_disbursed)}
          sub={`${stats.disbursed_count || 0} active loans`}
          color="#06B6D4"
          trend="Released"
          trendPositive={true}
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Outstanding Principal"
          value={fmt(stats.total_outstanding)}
          sub="Current debt balance"
          color="#6366F1"
        />
        <StatCard
          icon={<XCircle size={20} />}
          label="Utilization Ratio"
          value={`${stats.utilization_rate_pct || 0}%`}
          sub="Disbursed / Approved"
          color="#0891B2"
          trend={`${stats.utilization_rate_pct || 0}%`}
          trendPositive={true}
        />
      </div>

      {/* Charts Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 20,
          marginBottom: 24,
        }}
      >
        {/* Monthly Trend */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0F172A" }}>
              📈 Monthly Lending Volume
            </div>
            <span style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 600 }}>Amount vs Count</span>
          </div>

          {monthly_trend.length === 0 ? (
            <div className="empty" style={{ padding: "36px 10px" }}>
              <div className="empty-icon" style={{ fontSize: "2.2rem" }}>
                📊
              </div>
              <p style={{ fontSize: "0.85rem" }}>No loan activity recorded for this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthly_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradientPrimary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0F172A" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#334155" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="barGradientCyan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06B6D4" stopOpacity={1} />
                    <stop offset="100%" stopColor="#0891B2" stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 12, fontWeight: 600 }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
                <YAxis tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    color: "#0F172A",
                    boxShadow: "0 10px 25px rgba(15,23,42,0.1)",
                    fontSize: "0.82rem",
                  }}
                  formatter={(v, n) => [
                    n === "amount" ? fmt(v) : `${v} loans`,
                    n === "amount" ? "Total Capital" : "Applications",
                  ]}
                />
                <Bar dataKey="count" fill="url(#barGradientPrimary)" radius={[6, 6, 0, 0]} name="count" />
                <Bar dataKey="amount" fill="url(#barGradientCyan)" radius={[6, 6, 0, 0]} name="amount" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status Breakdown Donut Chart */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0F172A" }}>
              🥧 Portfolio Allocation Breakdown
            </div>
            <span style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 600 }}>By Status</span>
          </div>

          {status_breakdown.length === 0 ? (
            <div className="empty" style={{ padding: "36px 10px" }}>
              <div className="empty-icon" style={{ fontSize: "2.2rem" }}>
                🥧
              </div>
              <p style={{ fontSize: "0.85rem" }}>No loan status data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={status_breakdown}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  label={({ status, count }) => `${status}: ${count}`}
                  labelLine={{ stroke: "#CBD5E1", strokeWidth: 1 }}
                >
                  {status_breakdown.map((entry) => (
                    <Cell key={entry.status} fill={PIE_COLORS[entry.status] || "#0F172A"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    color: "#0F172A",
                    boxShadow: "0 10px 25px rgba(15,23,42,0.1)",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "0.82rem", color: "#64748B" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Applications Pipeline */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0F172A" }}>
              🕒 Active Application Stream
            </div>
            <p style={{ fontSize: "0.8rem", color: "#64748B", marginTop: 2 }}>
              Recent underwriting applications with instant OCR verifications
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/approvals")}>
            View Pipeline <ArrowRight size={13} />
          </button>
        </div>

        {recent_applications.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📄</div>
            <p>No recent applications recorded</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Applicant Name</th>
                  <th>Category</th>
                  <th>Requested Amount</th>
                  <th>Tenure</th>
                  <th>Estimated EMI</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent_applications.map((a) => (
                  <tr
                    key={a._id}
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate("/approvals")}
                  >
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #ECFEFF 0%, #E0F2FE 100%)",
                            color: "#0891B2",
                            fontWeight: 800,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.82rem",
                            border: "1px solid #A5F3FC",
                          }}
                        >
                          {a.applicant_name ? a.applicant_name[0].toUpperCase() : "U"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: "#0F172A" }}>{a.applicant_name}</div>
                          <div style={{ fontSize: "0.74rem", color: "#64748B" }}>{a.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-indigo" style={{ fontSize: "0.72rem" }}>
                        {a.loan_type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 800, color: "#0F172A" }}>{fmt(a.amount_requested)}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: "#475569" }}>{a.tenure_months} months</span>
                    </td>
                    <td style={{ color: "#059669", fontWeight: 800 }}>{fmt(a.emi)}/mo</td>
                    <td>{statusBadge(a.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
