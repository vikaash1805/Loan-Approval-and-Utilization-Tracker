import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/loanApi";
import StatCard from "../components/StatCard";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  FileText, CheckCircle, XCircle, Banknote, TrendingUp,
  Clock, RefreshCw, ArrowRight, PlusCircle
} from "lucide-react";

const PIE_COLORS = {
  Pending: "#f59e0b",
  Approved: "#10b981",
  Rejected: "#ef4444",
  Disbursed: "#06b6d4",
  Closed: "#64748b",
};

const fmt = (n) => {
  if (!n && n !== 0) return "₹0";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
};

const statusBadge = (s) => <span className={`badge badge-${s?.toLowerCase()}`}>{s}</span>;

export default function Dashboard() {
  const { user, isOfficer } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true); setError("");
    try {
      const params = {};
      if (!isOfficer && user?.email) {
        params.email = user.email;
      }
      setData(await api.getDashboard(params));
    }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [user]);

  if (loading) return <div className="spinner" />;
  if (error) return (
    <div>
      <div className="alert alert-error">{error}</div>
      <button className="btn btn-ghost" onClick={load}><RefreshCw size={15} /> Retry</button>
    </div>
  );

  const { stats = {}, status_breakdown = [], type_breakdown = [], monthly_trend = [], recent_applications = [] } = data || {};

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>Loan Dashboard</h1>
          <p>Real-time enterprise loan portfolio & performance analytics</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* KPI Cards */}
      <div className="stat-grid">
        <StatCard icon={<FileText size={20} />} label="Total Applications"
          value={stats.total_applications || 0} sub="All time applications" color="#0F172A" />
        <StatCard icon={<Clock size={20} />} label="Pending Approvals"
          value={stats.pending_approvals || 0} sub="Awaiting review" color="#f59e0b" />
        <StatCard icon={<CheckCircle size={20} />} label="Approved Loans"
          value={fmt(stats.total_approved)} sub={`${stats.approved_count || 0} applications`} color="#10b981" />
        <StatCard icon={<Banknote size={20} />} label="Total Disbursed"
          value={fmt(stats.total_disbursed)} sub={`${stats.disbursed_count || 0} active loans`} color="#06b6d4" />
        <StatCard icon={<TrendingUp size={20} />} label="Outstanding Balance"
          value={fmt(stats.total_outstanding)} sub="Across all loans" color="#1E293B" />
        <StatCard icon={<XCircle size={20} />} label="Utilization Rate"
          value={`${stats.utilization_rate_pct || 0}%`} sub="Disbursed / Approved" color="#0891b2" />
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* Monthly Trend */}
        <div className="card">
          <div className="section-title">📈 Monthly Applications</div>
          {monthly_trend.length === 0 ? (
            <div className="empty" style={{ padding: "40px 10px" }}><div className="empty-icon" style={{ fontSize: "2rem" }}>📈</div><p style={{ fontSize: "0.88rem" }}>No application activity recorded yet</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={monthly_trend}>
                <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, color: "#0F172A", boxShadow: "0 4px 20px rgba(15,23,42,0.08)" }}
                  formatter={(v, n) => [n === "amount" ? fmt(v) : v, n === "amount" ? "Amount" : "Count"]}
                />
                <Bar dataKey="count" fill="#0F172A" radius={[4, 4, 0, 0]} name="count" />
                <Bar dataKey="amount" fill="#06b6d4" radius={[4, 4, 0, 0]} name="amount" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status Breakdown Pie */}
        <div className="card">
          <div className="section-title">🥧 Status Breakdown</div>
          {status_breakdown.length === 0 ? (
            <div className="empty" style={{ padding: "40px 10px" }}><div className="empty-icon" style={{ fontSize: "2rem" }}>🥧</div><p style={{ fontSize: "0.88rem" }}>No loan status data available yet</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={status_breakdown} dataKey="count" nameKey="status"
                  cx="50%" cy="50%" outerRadius={80} label={({ status, count }) => `${status}: ${count}`}
                  labelLine={{ stroke: "#94a3b8" }}>
                  {status_breakdown.map((entry) => (
                    <Cell key={entry.status} fill={PIE_COLORS[entry.status] || "#0F172A"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, color: "#0F172A", boxShadow: "0 4px 20px rgba(15,23,42,0.08)" }} />
                <Legend wrapperStyle={{ fontSize: "0.8rem", color: "#64748b" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Loan Type Breakdown */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title">🏦 Loan Type Distribution</div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {type_breakdown.length === 0 ? (
            <div className="empty"><div className="empty-icon">📊</div><p>No data yet</p></div>
          ) : (
            type_breakdown.map((t) => (
              <div key={t.loan_type} style={{
                flex: "1 1 160px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: "16px 18px",
                boxShadow: "var(--shadow-sm)",
              }}>
                <div style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: 4, fontWeight: 600 }}>{t.loan_type}</div>
                <div style={{ fontFamily: "Outfit", fontSize: "1.3rem", fontWeight: 700, color: "#0F172A" }}>{t.count} loans</div>
                <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 2 }}>{fmt(t.total_amount)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Applications */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>🕒 Recent Applications</div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/approvals")}>
            View All <ArrowRight size={13} />
          </button>
        </div>
        {recent_applications.length === 0 ? (
          <div className="empty"><div className="empty-icon">📄</div><p>No applications yet</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Applicant</th><th>Type</th><th>Amount</th><th>Tenure</th><th>EMI</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent_applications.map((a) => (
                  <tr key={a._id} style={{ cursor: "pointer" }} onClick={() => navigate("/approvals")}>
                    <td>
                      <div style={{ fontWeight: 600, color: "#0F172A" }}>{a.applicant_name}</div>
                      <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{a.email}</div>
                    </td>
                    <td><span className="badge badge-disbursed" style={{ fontSize: "0.72rem" }}>{a.loan_type}</span></td>
                    <td style={{ fontWeight: 600, color: "#0F172A" }}>{fmt(a.amount_requested)}</td>
                    <td>{a.tenure_months}m</td>
                    <td style={{ color: "#10b981", fontWeight: 600 }}>{fmt(a.emi)}/mo</td>
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
