import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/loanApi";
import { RefreshCw, Search, Eye } from "lucide-react";

const LOAN_TYPES = ["", "Personal", "Business", "Home", "Education", "Vehicle"];
const STATUSES = ["", "Pending", "Approved", "Rejected", "Disbursed", "Closed"];

const fmt = (n) => n ? `₹${Number(n).toLocaleString("en-IN")}` : "₹0";
const statusBadge = (s) => <span className={`badge badge-${s?.toLowerCase()}`}>{s}</span>;
const dateStr = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function LoanApprovals() {
  const navigate = useNavigate();
  const { user, isOfficer } = useAuth();
  const [apps, setApps] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ status: "", loan_type: "", search: "" });
  const [page, setPage] = useState(1);

  // Action modal
  const [modal, setModal] = useState(null); // { app, action }
  const [actionForm, setActionForm] = useState({ status: "", approved_amount: "", notes: "" });
  const [actioning, setActioning] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const queryFilters = { ...filters, page };
      if (!isOfficer && user?.email) {
        queryFilters.email = user.email;
      }
      const res = await api.getApplications(queryFilters);
      setApps(res.applications || []);
      setTotal(res.total || 0);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filters, page, user]);

  const openModal = (app, action) => {
    setModal({ app, action });
    setActionForm({
      status: action,
      approved_amount: app.amount_requested,
      notes: "",
    });
    setActionMsg("");
  };

  const doAction = async () => {
    if (!modal) return;
    setActioning(true); setActionMsg("");
    try {
      await api.updateStatus(modal.app._id, {
        status: actionForm.status,
        approved_amount: parseFloat(actionForm.approved_amount) || undefined,
        notes: actionForm.notes,
      });
      setActionMsg("✓ Status updated successfully!");
      setTimeout(() => { setModal(null); load(); }, 1000);
    } catch (e) {
      setActionMsg(`✗ ${e.message}`);
    } finally {
      setActioning(false);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>{isOfficer ? "Loan Approvals & Underwriting" : "My Loan Applications"}</h1>
          <p>{isOfficer ? "Review, approve, reject or disburse loan applications" : "Track your submitted loan applications and approval status"}</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20, padding: "18px 22px" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
            <input className="form-control" style={{ paddingLeft: 34 }} placeholder="Search applicant name..."
              value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
          </div>
          <select className="form-control" style={{ flex: "0 0 160px" }}
            value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
            {STATUSES.map((s) => <option key={s} value={s}>{s || "All Statuses"}</option>)}
          </select>
          <select className="form-control" style={{ flex: "0 0 160px" }}
            value={filters.loan_type} onChange={(e) => setFilters((p) => ({ ...p, loan_type: e.target.value }))}>
            {LOAN_TYPES.map((t) => <option key={t} value={t}>{t || "All Types"}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilters({ status: "", loan_type: "", search: "" }); setPage(1); }}>
            Clear
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Table */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>
            Applications <span style={{ fontSize: "0.82rem", color: "#64748b", fontWeight: 500 }}>({total} total)</span>
          </div>
        </div>

        {loading ? <div className="spinner" /> : apps.length === 0 ? (
          <div className="empty"><div className="empty-icon">📄</div><p>No applications found</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Applicant</th><th>Type</th><th>Amount</th><th>Approved</th>
                  <th>EMI</th><th>Tenure</th><th>Status</th><th>Applied</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a._id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "#0F172A" }}>{a.applicant_name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{a.phone}</div>
                    </td>
                    <td><span className="badge badge-disbursed" style={{ fontSize: "0.72rem" }}>{a.loan_type}</span></td>
                    <td style={{ color: "#0F172A", fontWeight: 600 }}>{fmt(a.amount_requested)}</td>
                    <td style={{ color: "#10b981", fontWeight: 600 }}>{a.approved_amount ? fmt(a.approved_amount) : "—"}</td>
                    <td>{fmt(a.emi)}<span style={{ color: "#64748b", fontSize: "0.75rem" }}>/mo</span></td>
                    <td>{a.tenure_months}m</td>
                    <td>{statusBadge(a.status)}</td>
                    <td style={{ fontSize: "0.8rem", color: "#64748b" }}>{dateStr(a.applied_at)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {a.status === "Pending" && (
                          <>
                            <button className="btn btn-success btn-sm" onClick={() => openModal(a, "Approved")}>✓ Approve</button>
                            <button className="btn btn-danger btn-sm" onClick={() => openModal(a, "Rejected")}>✗ Reject</button>
                          </>
                        )}
                        {a.status === "Approved" && (
                          <button className="btn btn-primary btn-sm"
                            onClick={() => openModal(a, "Disbursed")}>💸 Disburse</button>
                        )}
                        {(a.status === "Disbursed") && (
                          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/utilization", { state: { loanId: a._id, name: a.applicant_name } })}>
                            <Eye size={13} /> Track
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
            <span style={{ lineHeight: "34px", fontSize: "0.85rem", color: "#64748B", fontWeight: 500 }}>Page {page} / {totalPages}</span>
            <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next ›</button>
          </div>
        )}
      </div>

      {/* Action Modal */}
      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <h3>{modal.action === "Approved" ? "✅ Approve Loan" : modal.action === "Rejected" ? "❌ Reject Loan" : "💸 Disburse Loan"}</h3>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px", marginBottom: 18 }}>
              <div style={{ fontWeight: 600, fontSize: "1rem", color: "#0F172A", marginBottom: 4 }}>{modal.app.applicant_name}</div>
              <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
                {modal.app.loan_type} Loan · {fmt(modal.app.amount_requested)} · {modal.app.tenure_months} months
              </div>
            </div>

            {modal.action === "Approved" && (
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Approved Amount (₹)</label>
                <input className="form-control" type="number"
                  value={actionForm.approved_amount}
                  onChange={(e) => setActionForm((p) => ({ ...p, approved_amount: e.target.value }))} />
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Notes / Remarks (optional)</label>
              <input className="form-control" placeholder="e.g. Income verified, documents complete"
                value={actionForm.notes}
                onChange={(e) => setActionForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>

            {actionMsg && (
              <div className={`alert ${actionMsg.startsWith("✓") ? "alert-success" : "alert-error"}`}>{actionMsg}</div>
            )}

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button
                className={`btn ${modal.action === "Rejected" ? "btn-danger" : "btn-primary"}`}
                onClick={doAction} disabled={actioning}
              >
                {actioning ? "Processing..." : `Confirm ${modal.action}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
