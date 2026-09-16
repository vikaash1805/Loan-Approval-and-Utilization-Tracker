import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/loanApi";
import {
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  Banknote,
  Clock,
  Filter,
  ShieldCheck,
  TrendingUp,
  FileText,
  AlertCircle,
  Check,
  Eye,
  Home,
  Car,
  GraduationCap,
  Briefcase,
  UserCheck,
  Download,
  ExternalLink,
  Layers,
} from "lucide-react";

const LOAN_TYPES = ["", "Personal", "Business", "Home", "Education", "Vehicle"];
const STATUSES = ["", "Pending", "Approved", "Rejected", "Disbursed", "Closed"];

const fmt = (n) => (n ? `₹${Number(n).toLocaleString("en-IN")}` : "₹0");

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

const dateStr = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const getLoanIcon = (type) => {
  switch (type) {
    case "Home": return Home;
    case "Vehicle": return Car;
    case "Education": return GraduationCap;
    case "Business": return Briefcase;
    case "Personal": return UserCheck;
    default: return Banknote;
  }
};

export default function LoanApprovals() {
  const navigate = useNavigate();
  const { user, isOfficer } = useAuth();
  const [apps, setApps] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ status: "", loan_type: "", search: "" });
  const [page, setPage] = useState(1);

  // Action modal (Approve / Reject / Disburse)
  const [modal, setModal] = useState(null); // { app, action }
  const [actionForm, setActionForm] = useState({ status: "", approved_amount: "", notes: "" });
  const [actioning, setActioning] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  // Document Inspection Detail Modal
  const [viewDocModal, setViewDocModal] = useState(null); // application doc
  const [activePreviewDoc, setActivePreviewDoc] = useState(null); // single doc item
  const [modalUtilEvents, setModalUtilEvents] = useState([]);
  const [loadingUtilEvents, setLoadingUtilEvents] = useState(false);

  useEffect(() => {
    if (viewDocModal && (viewDocModal.status === "Disbursed" || viewDocModal.status === "Closed" || viewDocModal.status === "Approved")) {
      setLoadingUtilEvents(true);
      api.getUtilization(viewDocModal._id)
        .then((res) => setModalUtilEvents(res.events || []))
        .catch(() => setModalUtilEvents([]))
        .finally(() => setLoadingUtilEvents(false));
    } else {
      setModalUtilEvents([]);
    }
  }, [viewDocModal]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const queryFilters = { ...filters, page };
      if (!isOfficer && user?.email) {
        queryFilters.email = user.email;
      }
      const res = await api.getApplications(queryFilters);
      setApps(res.applications || []);
      setTotal(res.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filters, page, user]);

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
    setActioning(true);
    setActionMsg("");
    try {
      await api.updateStatus(modal.app._id, {
        status: actionForm.status,
        approved_amount: parseFloat(actionForm.approved_amount) || undefined,
        notes: actionForm.notes,
      });
      setActionMsg("✓ Status updated successfully!");
      setTimeout(() => {
        setModal(null);
        load();
      }, 900);
    } catch (e) {
      setActionMsg(`✗ ${e.message}`);
    } finally {
      setActioning(false);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="fade-in">
      {/* Page Header */}
      <div
        className="page-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}
      >
        <div>
          <h1>{isOfficer ? "Loan Underwriting & Approvals" : "My Loan Applications"}</h1>
          <p>
            {isOfficer
              ? "Review risk profiles, verify AI matching scores, review loan category documents, approve and disburse loans."
              : "Track the status of your submitted loan applications in real-time."}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}>
          <RefreshCw size={14} /> Refresh Pipeline
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ marginBottom: 20, padding: "16px 20px" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 240px" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#64748B",
              }}
            />
            <input
              className="form-control"
              style={{ paddingLeft: 36 }}
              placeholder="Search applicant name or email..."
              value={filters.search}
              onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
            />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select
              className="form-control"
              style={{ width: "auto", minWidth: 150 }}
              value={filters.status}
              onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s ? `${s} Status` : "All Statuses"}
                </option>
              ))}
            </select>

            <select
              className="form-control"
              style={{ width: "auto", minWidth: 150 }}
              value={filters.loan_type}
              onChange={(e) => setFilters((p) => ({ ...p, loan_type: e.target.value }))}
            >
              {LOAN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t ? `${t} Loans` : "All Loan Types"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading & Error */}
      {loading && <div className="spinner" />}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Applications Table */}
      {!loading && !error && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {apps.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📁</div>
              <p>No loan applications found matching your criteria.</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ border: "none" }}>
              <table>
                <thead>
                  <tr>
                    <th>Applicant Details</th>
                    <th>Loan Type</th>
                    <th>Requested / Approved</th>
                    <th>Tenure</th>
                    <th>Monthly EMI</th>
                    <th>Attached Docs</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((a) => {
                    const LoanIcon = getLoanIcon(a.loan_type);
                    const docCount = a.loan_documents?.length || 0;

                    return (
                      <tr key={a._id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                background: "#ECFEFF",
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
                              <div style={{ fontSize: "0.76rem", color: "#64748B" }}>
                                {a.email} • {a.phone || "No phone"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span
                            className="badge badge-indigo"
                            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                          >
                            <LoanIcon size={12} /> {a.loan_type}
                          </span>
                        </td>

                        <td>
                          <div style={{ fontWeight: 700, color: "#0F172A" }}>
                            {fmt(a.approved_amount || a.amount_requested)}
                          </div>
                          {a.approved_amount && a.approved_amount !== a.amount_requested && (
                            <div style={{ fontSize: "0.74rem", color: "#64748B" }}>
                              Req: {fmt(a.amount_requested)}
                            </div>
                          )}
                        </td>

                        <td>
                          <span style={{ fontWeight: 600, color: "#475569" }}>{a.tenure_months}m</span>
                        </td>

                        <td>
                          <span style={{ color: "#059669", fontWeight: 700 }}>{fmt(a.emi)}/mo</span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: "0.76rem", padding: "4px 8px" }}
                            onClick={() => setViewDocModal(a)}
                          >
                            <FileText size={12} color="#0891B2" />
                            {docCount} Doc{docCount !== 1 ? "s" : ""}
                          </button>
                        </td>

                        <td>{statusBadge(a.status)}</td>

                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 6 }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              title="View Document Dossier"
                              onClick={() => setViewDocModal(a)}
                            >
                              <Eye size={13} /> View
                            </button>

                            {isOfficer && (
                              <>
                                {a.status === "Pending" && (
                                  <>
                                    <button
                                      className="btn btn-success btn-sm"
                                      onClick={() => openModal(a, "Approved")}
                                    >
                                      <CheckCircle size={13} /> Approve
                                    </button>
                                    <button
                                      className="btn btn-danger btn-sm"
                                      onClick={() => openModal(a, "Rejected")}
                                    >
                                      <XCircle size={13} /> Reject
                                    </button>
                                  </>
                                )}

                                {a.status === "Approved" && (
                                  <button
                                    className="btn btn-accent btn-sm"
                                    onClick={() => openModal(a, "Disbursed")}
                                  >
                                    <Banknote size={13} /> Disburse
                                  </button>
                                )}

                                {a.status === "Disbursed" && (
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() =>
                                      navigate("/utilization", {
                                        state: { loanId: a._id, name: a.applicant_name },
                                      })
                                    }
                                  >
                                    <TrendingUp size={13} /> Track
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Underwriting Action Modal */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Underwriting Decision: {modal.action} Loan</h3>

            <p style={{ fontSize: "0.88rem", color: "#64748B", marginBottom: 18 }}>
              Applicant: <strong>{modal.app.applicant_name}</strong> ({modal.app.email}) • {modal.app.loan_type} Loan
            </p>

            {actionMsg && (
              <div
                className={actionMsg.startsWith("✓") ? "alert alert-success" : "alert alert-error"}
                style={{ fontSize: "0.82rem", padding: "10px 14px" }}
              >
                {actionMsg}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {modal.action === "Approved" && (
                <div className="form-group">
                  <label>Approved Principal Amount (₹) *</label>
                  <input
                    className="form-control"
                    type="number"
                    value={actionForm.approved_amount}
                    onChange={(e) =>
                      setActionForm((p) => ({ ...p, approved_amount: e.target.value }))
                    }
                  />
                </div>
              )}

              <div className="form-group">
                <label>Underwriting Notes / Decision Remarks</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Enter remarks for audit and notification..."
                  value={actionForm.notes}
                  onChange={(e) => setActionForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-ghost"
                onClick={() => setModal(null)}
                disabled={actioning}
              >
                Cancel
              </button>
              <button
                className={
                  modal.action === "Approved"
                    ? "btn btn-success"
                    : modal.action === "Disbursed"
                    ? "btn btn-accent"
                    : "btn btn-danger"
                }
                onClick={doAction}
                disabled={actioning}
              >
                {actioning ? "Processing..." : `Confirm ${modal.action}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Dossier & Verification Detail Modal */}
      {viewDocModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ width: "min(780px, 96vw)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>
                  {viewDocModal.loan_type} Loan Application Dossier
                </h3>
                <p style={{ color: "#64748B", fontSize: "0.86rem" }}>
                  Applicant: <strong>{viewDocModal.applicant_name}</strong> • {viewDocModal.email}
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setViewDocModal(null);
                  setActivePreviewDoc(null);
                }}
              >
                ✕ Close
              </button>
            </div>

            {/* Quick Profile Summary */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12,
                background: "#F8FAFC",
                padding: "14px 18px",
                borderRadius: "var(--radius-md)",
                border: "1px solid #E2E8F0",
                marginBottom: 20,
              }}
            >
              <div>
                <div style={{ fontSize: "0.72rem", color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>
                  Loan Requested
                </div>
                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0891B2" }}>
                  {fmt(viewDocModal.amount_requested)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.72rem", color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>
                  Tenure & Rate
                </div>
                <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#0F172A" }}>
                  {viewDocModal.tenure_months}m @ {viewDocModal.interest_rate}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.72rem", color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>
                  Monthly EMI
                </div>
                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#10B981" }}>
                  {fmt(viewDocModal.emi)}/mo
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.72rem", color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>
                  KYC AI Verification
                </div>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: viewDocModal.id_verified ? "#10B981" : "#EF4444" }}>
                  {viewDocModal.id_verified ? "✓ 100% Passed" : "Pending / Check"}
                </div>
              </div>
            </div>

            {/* Loan Purpose */}
            {viewDocModal.purpose && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Purpose / Utilization Statement:
                </div>
                <div style={{ fontSize: "0.86rem", color: "#64748B", background: "#FFFFFF", padding: "10px 14px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                  {viewDocModal.purpose}
                </div>
              </div>
            )}

            {/* Attached Category Documents */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h4 style={{ fontSize: "1rem", fontWeight: 800, color: "#0F172A" }}>
                  Attached {viewDocModal.loan_type} Specific Documents ({viewDocModal.loan_documents?.length || 0})
                </h4>
              </div>

              {(!viewDocModal.loan_documents || viewDocModal.loan_documents.length === 0) ? (
                <div className="empty" style={{ padding: "20px" }}>
                  <p style={{ fontSize: "0.85rem" }}>No category documents were attached during submission.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {viewDocModal.loan_documents.map((doc, idx) => (
                    <div
                      key={idx}
                      style={{
                        border: "1px solid #E2E8F0",
                        borderRadius: "var(--radius-md)",
                        padding: "12px 16px",
                        background: "#FFFFFF",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 8,
                            background: "#ECFEFF",
                            color: "#0891B2",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <FileText size={18} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "#0F172A" }}>
                            {doc.label}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                            {doc.filename} • {doc.file_size_formatted || "Attached"}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {doc.file_data ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => setActivePreviewDoc(doc)}
                          >
                            <Eye size={12} /> Inspect Document
                          </button>
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>Proof on File</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Post-Disbursement Fund Utilization Invoices & Audit Proofs */}
            {(viewDocModal.status === "Disbursed" || viewDocModal.status === "Closed" || modalUtilEvents.length > 0) && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h4 style={{ fontSize: "1rem", fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}>
                    <TrendingUp size={16} color="#0891B2" />
                    Drawdown Utilization & Invoice Proofs ({modalUtilEvents.length})
                  </h4>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: "0.76rem" }}
                    onClick={() => {
                      const targetId = viewDocModal._id;
                      const targetName = viewDocModal.applicant_name;
                      setViewDocModal(null);
                      navigate("/utilization", { state: { loanId: targetId, name: targetName } });
                    }}
                  >
                    <ExternalLink size={12} /> Open Full Tracker
                  </button>
                </div>

                {loadingUtilEvents ? (
                  <div className="spinner" style={{ margin: "16px auto" }} />
                ) : modalUtilEvents.length === 0 ? (
                  <div className="empty" style={{ padding: "16px" }}>
                    <p style={{ fontSize: "0.82rem", color: "#64748B" }}>No expense proofs or invoices uploaded yet for this loan.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {modalUtilEvents.map((evt, idx) => (
                      <div
                        key={idx}
                        style={{
                          border: "1px solid #E2E8F0",
                          borderRadius: "var(--radius-md)",
                          padding: "12px 16px",
                          background: "#F8FAFC",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 8,
                              background: "#ECFDF5",
                              color: "#059669",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              fontWeight: 800,
                              fontSize: "0.82rem",
                            }}
                          >
                            ₹
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "#0F172A" }}>
                              {evt.event_type} — {fmt(evt.amount)}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                              {evt.category || "Expense"} • {evt.vendor_name ? `Vendor: ${evt.vendor_name}` : "Direct"} • Inv: {evt.invoice_no || "N/A"} • {dateStr(evt.event_date || evt.created_at || evt.date)}
                            </div>
                          </div>
                        </div>

                        <div>
                          {evt.proof_image || evt.proof_data ? (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() =>
                                setActivePreviewDoc({
                                  label: `${evt.event_type} (${evt.category || "Invoice"})`,
                                  filename: evt.invoice_no ? `Invoice_${evt.invoice_no}` : "Uploaded_Proof",
                                  file_data: evt.proof_image || evt.proof_data,
                                })
                              }
                            >
                              <Eye size={12} /> Inspect Invoice
                            </button>
                          ) : (
                            <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>No attachment</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* In-Modal Document Viewer */}
            {activePreviewDoc && (
              <div
                style={{
                  marginTop: 18,
                  padding: 16,
                  borderRadius: "var(--radius-md)",
                  background: "#0F172A",
                  color: "#FFFFFF",
                  textAlign: "center",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#38BDF8" }}>
                    Inspecting: {activePreviewDoc.label} ({activePreviewDoc.filename})
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: "#FFFFFF", borderColor: "rgba(255,255,255,0.2)" }}
                    onClick={() => setActivePreviewDoc(null)}
                  >
                    Close Preview
                  </button>
                </div>

                {activePreviewDoc.file_data?.startsWith("data:image/") ? (
                  <img
                    src={activePreviewDoc.file_data}
                    alt="Document preview"
                    style={{
                      maxHeight: 380,
                      maxWidth: "100%",
                      borderRadius: 8,
                      objectFit: "contain",
                      background: "#FFFFFF",
                      padding: 4,
                    }}
                  />
                ) : (
                  <div style={{ padding: "30px 20px" }}>
                    <FileText size={40} color="#38BDF8" style={{ margin: "0 auto 10px" }} />
                    <p style={{ fontSize: "0.85rem", color: "#94A3B8" }}>
                      PDF / Document attachment available for download.
                    </p>
                    <a
                      href={activePreviewDoc.file_data}
                      download={activePreviewDoc.filename}
                      className="btn btn-accent btn-sm"
                      style={{ marginTop: 10 }}
                    >
                      <Download size={13} /> Download {activePreviewDoc.filename}
                    </a>
                  </div>
                )}
              </div>
            )}

            <div className="modal-footer" style={{ marginTop: 20 }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setViewDocModal(null);
                  setActivePreviewDoc(null);
                }}
              >
                Done Reviewing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
