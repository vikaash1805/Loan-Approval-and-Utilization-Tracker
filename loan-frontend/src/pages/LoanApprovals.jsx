import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
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
  AlertCircle,
  PlusCircle,
  Send,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  X,
} from "lucide-react";
import { LOAN_DOCUMENTS_CONFIG } from "../config/loanDocuments";

const LOAN_TYPES = ["", "Personal", "Business", "Home", "Education", "Vehicle"];
const STATUSES = ["", "Pending", "Approved", "Rejected", "Disbursed", "Closed"];

const fmt = (n) => (n ? `₹${Number(n).toLocaleString("en-IN")}` : "₹0");

const statusBadge = (s) => {
  const sLower = s?.toLowerCase() || "pending";
  return (
    <span className={`badge badge-${sLower}`}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background:
            sLower === "approved"
              ? "#10B981"
              : sLower === "disbursed"
              ? "#06B6D4"
              : sLower === "rejected"
              ? "#EF4444"
              : sLower === "pending"
              ? "#F59E0B"
              : "#64748B",
          display: "inline-block",
        }}
      />
      {s}
    </span>
  );
};

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
  const { refreshNotifications } = useNotifications();
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

  // Officer Document Review & Request State
  const [rejectDocModal, setRejectDocModal] = useState(null); // { docId, docLabel, notes: "" }
  const [requestDocModal, setRequestDocModal] = useState(false);
  const [requestDocForm, setRequestDocForm] = useState({ document_name: "", notes: "" });
  const [requestDocLoading, setRequestDocLoading] = useState(false);
  const [requestDocMsg, setRequestDocMsg] = useState("");
  const [updatingDocId, setUpdatingDocId] = useState(null);
  const [docFeedbackMsg, setDocFeedbackMsg] = useState("");

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
      approved_amount: app.approved_amount || app.amount_requested || 10000,
      notes: "",
    });
    setActionMsg("");
  };

  const doAction = async () => {
    if (!modal) return;
    setActionMsg("");

    // Validate based on underwriting decision
    if (modal.action === "Approved") {
      const amt = parseFloat(actionForm.approved_amount);
      if (isNaN(amt) || amt < 10000) {
        setActionMsg("✗ Approved amount must be at least ₹10,000.");
        return;
      }
      const reqAmt = parseFloat(modal.app.amount_requested) || 0;
      if (reqAmt > 0 && amt > reqAmt * 1.5) {
        setActionMsg(`✗ Approved amount cannot exceed 150% of requested amount (${fmt(reqAmt)}).`);
        return;
      }
    } else if (modal.action === "Rejected") {
      if (!actionForm.notes || !actionForm.notes.trim()) {
        setActionMsg("✗ Please provide rejection notes / reason for the applicant and audit record.");
        return;
      }
    } else if (modal.action === "Disbursed") {
      const currentStatus = (modal.app.status || "").toLowerCase();
      if (currentStatus !== "approved") {
        setActionMsg("✗ Loan must be in 'Approved' status before funds can be disbursed.");
        return;
      }
    }

    setActioning(true);
    try {
      await api.updateStatus(modal.app._id, {
        status: actionForm.status,
        approved_amount: modal.action === "Approved" ? parseFloat(actionForm.approved_amount) : undefined,
        notes: actionForm.notes.trim(),
      });
      setActionMsg("✓ Status updated successfully!");
      refreshNotifications();
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

  const handleVerifyDocument = async (docId, docLabel) => {
    if (!viewDocModal || !docId) return;
    setUpdatingDocId(docId);
    setDocFeedbackMsg("");
    try {
      await api.updateDocumentStatus(viewDocModal._id, docId, {
        status: "Verified",
        notes: "",
        label: docLabel,
      });
      setViewDocModal((prev) => {
        if (!prev) return prev;
        const exists = (prev.loan_documents || []).some(
          (d) => d.doc_id === docId || (d.label && d.label.toLowerCase() === String(docLabel).toLowerCase())
        );
        let updatedDocs;
        if (exists) {
          updatedDocs = (prev.loan_documents || []).map((d) =>
            d.doc_id === docId || (d.label && d.label.toLowerCase() === String(docLabel).toLowerCase())
              ? { ...d, verification_status: "Verified", officer_notes: "" }
              : d
          );
        } else {
          updatedDocs = [
            ...(prev.loan_documents || []),
            { doc_id: docId, label: docLabel, verification_status: "Verified", officer_notes: "" },
          ];
        }
        return { ...prev, loan_documents: updatedDocs };
      });
      setApps((prev) =>
        prev.map((a) => {
          if (a._id !== viewDocModal._id) return a;
          const updatedDocs = (a.loan_documents || []).map((d) =>
            d.doc_id === docId || (d.label && d.label.toLowerCase() === String(docLabel).toLowerCase())
              ? { ...d, verification_status: "Verified", officer_notes: "" }
              : d
          );
          return { ...a, loan_documents: updatedDocs };
        })
      );
      setDocFeedbackMsg(`✓ '${docLabel}' marked as Verified.`);
      refreshNotifications();
    } catch (e) {
      setDocFeedbackMsg(`✗ Failed to verify: ${e.message}`);
    } finally {
      setUpdatingDocId(null);
    }
  };

  const handleConfirmRejectDoc = async () => {
    if (!rejectDocModal || !viewDocModal) return;
    const { docId, docLabel, notes } = rejectDocModal;
    if (!notes.trim()) {
      setDocFeedbackMsg("✗ Please provide rejection notes/reason for the applicant.");
      return;
    }
    setUpdatingDocId(docId);
    setDocFeedbackMsg("");
    try {
      await api.updateDocumentStatus(viewDocModal._id, docId, {
        status: "Rejected",
        notes: notes.trim(),
        label: docLabel,
      });
      setViewDocModal((prev) => {
        if (!prev) return prev;
        const updatedDocs = (prev.loan_documents || []).map((d) =>
          d.doc_id === docId || (d.label && d.label.toLowerCase() === String(docLabel).toLowerCase())
            ? { ...d, verification_status: "Rejected", officer_notes: notes.trim() }
            : d
        );
        return { ...prev, loan_documents: updatedDocs };
      });
      setApps((prev) =>
        prev.map((a) => {
          if (a._id !== viewDocModal._id) return a;
          const updatedDocs = (a.loan_documents || []).map((d) =>
            d.doc_id === docId || (d.label && d.label.toLowerCase() === String(docLabel).toLowerCase())
              ? { ...d, verification_status: "Rejected", officer_notes: notes.trim() }
              : d
          );
          return { ...a, loan_documents: updatedDocs };
        })
      );
      setDocFeedbackMsg(`✓ '${docLabel}' marked as Rejected.`);
      setRejectDocModal(null);
      refreshNotifications();
    } catch (e) {
      setDocFeedbackMsg(`✗ Failed to reject: ${e.message}`);
    } finally {
      setUpdatingDocId(null);
    }
  };

  const handleRequestAdditionalDocSubmit = async (e) => {
    e?.preventDefault();
    if (!viewDocModal) return;
    if (!requestDocForm.document_name.trim()) {
      setRequestDocMsg("✗ Please enter document name.");
      return;
    }
    setRequestDocLoading(true);
    setRequestDocMsg("");
    try {
      await api.requestAdditionalDocument(viewDocModal._id, {
        document_name: requestDocForm.document_name.trim(),
        notes: requestDocForm.notes.trim(),
      });
      const newReq = {
        req_id: `REQ-${Date.now().toString(36).toUpperCase()}`,
        document_name: requestDocForm.document_name.trim(),
        notes: requestDocForm.notes.trim(),
        status: "Requested",
        requested_at: new Date().toISOString(),
      };
      setViewDocModal((prev) => {
        if (!prev) return prev;
        const existing = prev.additional_documents_requested || [];
        return { ...prev, additional_documents_requested: [...existing, newReq] };
      });
      setApps((prev) =>
        prev.map((a) => {
          if (a._id !== viewDocModal._id) return a;
          const existing = a.additional_documents_requested || [];
          return { ...a, additional_documents_requested: [...existing, newReq] };
        })
      );
      setRequestDocMsg("✓ Document request dispatched to borrower!");
      refreshNotifications();
      setTimeout(() => {
        setRequestDocModal(false);
        setRequestDocForm({ document_name: "", notes: "" });
        setRequestDocMsg("");
      }, 1100);
    } catch (err) {
      setRequestDocMsg(`✗ ${err.message}`);
    } finally {
      setRequestDocLoading(false);
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
                                {(a.status || "").toLowerCase() === "pending" && (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-success btn-sm"
                                      title="Approve Loan Application"
                                      onClick={() => openModal(a, "Approved")}
                                    >
                                      <CheckCircle size={13} /> Approve
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-danger btn-sm"
                                      title="Reject Loan Application"
                                      onClick={() => openModal(a, "Rejected")}
                                    >
                                      <XCircle size={13} /> Reject
                                    </button>
                                  </>
                                )}

                                {(a.status || "").toLowerCase() === "approved" && (
                                  <button
                                    type="button"
                                    className="btn btn-accent btn-sm"
                                    title="Disburse Approved Funds"
                                    onClick={() => openModal(a, "Disbursed")}
                                  >
                                    <Banknote size={13} /> Disburse
                                  </button>
                                )}

                                {(a.status || "").toLowerCase() === "disbursed" && (
                                  <button
                                    type="button"
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
                    min="10000"
                    step="1000"
                    placeholder="e.g. 250000"
                    value={actionForm.approved_amount}
                    onChange={(e) =>
                      setActionForm((p) => ({ ...p, approved_amount: e.target.value }))
                    }
                  />
                  <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                    Requested: {fmt(modal.app.amount_requested)} (Minimum: ₹10,000)
                  </span>
                </div>
              )}

              <div className="form-group">
                <label>
                  Underwriting Notes / Decision Remarks {modal.action === "Rejected" ? "*" : ""}
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder={
                    modal.action === "Rejected"
                      ? "Mandatory: Enter the reason for rejection (e.g. documentation mismatch, debt ratio)..."
                      : "Enter remarks for audit and notification..."
                  }
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
          <div className="modal" style={{ width: "min(880px, 96vw)" }}>
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

            {/* Loan Document Requirements & Officer Review Checklist */}
            {(() => {
              const currentDocConfig =
                LOAN_DOCUMENTS_CONFIG[viewDocModal.loan_type] || LOAN_DOCUMENTS_CONFIG.Personal;
              const configDocs = currentDocConfig.docs || [];
              const uploadedDocs = viewDocModal.loan_documents || [];

              const findUploadedDoc = (docDef) => {
                return uploadedDocs.find((d) => {
                  if (d.doc_id && d.doc_id === docDef.id) return true;
                  if (docDef.section && d.section) {
                    return (
                      d.section === docDef.section &&
                      d.label?.toLowerCase() === docDef.label.toLowerCase()
                    );
                  }
                  return d.label?.toLowerCase() === docDef.label.toLowerCase();
                });
              };

              const extraDocs = uploadedDocs.filter((d) => {
                return !configDocs.some((item) => {
                  if (d.doc_id && d.doc_id === item.id) return true;
                  if (item.section && d.section) {
                    return (
                      d.section === item.section &&
                      d.label?.toLowerCase() === item.label.toLowerCase()
                    );
                  }
                  return d.label?.toLowerCase() === item.label.toLowerCase();
                });
              });

              const isEducation = viewDocModal.loan_type === "Education";
              const studentDocs = isEducation
                ? configDocs.filter((d) => d.section === "Student")
                : [];
              const parentDocs = isEducation
                ? configDocs.filter((d) => d.section === "Parent / Co-borrower")
                : [];
              const additionalEduDocs = isEducation
                ? configDocs.filter((d) => d.section === "Additional")
                : [];

              const requiredDocs = configDocs.filter((d) => d.required);
              const requiredUploadedCount = requiredDocs.filter((d) => findUploadedDoc(d)).length;

              const renderDocRow = (docDef) => {
                const uploaded = findUploadedDoc(docDef);
                const isUploaded = !!uploaded;
                const vStatus =
                  uploaded?.verification_status || (isUploaded ? "Pending" : "Not Uploaded");
                const isUpdating = updatingDocId === (uploaded?.doc_id || docDef.id);

                return (
                  <div
                    key={docDef.id}
                    style={{
                      border: isUploaded ? "1px solid #E2E8F0" : "1px dashed #CBD5E1",
                      borderRadius: "var(--radius-md)",
                      padding: "12px 16px",
                      background: isUploaded ? "#FFFFFF" : "#F8FAFC",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        minWidth: "260px",
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: isUploaded
                            ? vStatus === "Verified"
                              ? "#ECFDF5"
                              : vStatus === "Rejected"
                              ? "#FEF2F2"
                              : "#ECFEFF"
                            : "#F1F5F9",
                          color: isUploaded
                            ? vStatus === "Verified"
                              ? "#059669"
                              : vStatus === "Rejected"
                              ? "#DC2626"
                              : "#0891B2"
                            : "#94A3B8",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        {vStatus === "Verified" ? (
                          <CheckCircle2 size={18} />
                        ) : vStatus === "Rejected" ? (
                          <XCircle size={18} />
                        ) : (
                          <FileText size={18} />
                        )}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: "0.88rem",
                              color: "#0F172A",
                            }}
                          >
                            {docDef.label}
                          </span>

                          {docDef.required ? (
                            <span
                              style={{
                                fontSize: "0.68rem",
                                fontWeight: 800,
                                color: "#E11D48",
                                background: "#FFE4E6",
                                padding: "1px 6px",
                                borderRadius: 4,
                                textTransform: "uppercase",
                                letterSpacing: "0.4px",
                              }}
                            >
                              Required
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: "0.68rem",
                                fontWeight: 600,
                                color: "#64748B",
                                background: "#F1F5F9",
                                padding: "1px 6px",
                                borderRadius: 4,
                              }}
                            >
                              Optional
                            </span>
                          )}

                          {/* Upload Status */}
                          {isUploaded ? (
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                color: "#059669",
                                background: "#ECFDF5",
                                border: "1px solid #A7F3D0",
                                padding: "1px 8px",
                                borderRadius: 999,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              ✓ Uploaded
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                color: docDef.required ? "#D97706" : "#64748B",
                                background: docDef.required ? "#FFFBEB" : "#F8FAFC",
                                border: `1px solid ${
                                  docDef.required ? "#FDE68A" : "#E2E8F0"
                                }`,
                                padding: "1px 8px",
                                borderRadius: 999,
                              }}
                            >
                              {docDef.required ? "⚠ Not Uploaded" : "Not Provided"}
                            </span>
                          )}

                          {/* Verification Status */}
                          {isUploaded && (
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                padding: "1px 8px",
                                borderRadius: 999,
                                background:
                                  vStatus === "Verified"
                                    ? "#D1FAE5"
                                    : vStatus === "Rejected"
                                    ? "#FEE2E2"
                                    : "#FEF3C7",
                                color:
                                  vStatus === "Verified"
                                    ? "#065F46"
                                    : vStatus === "Rejected"
                                    ? "#991B1B"
                                    : "#92400E",
                                border: `1px solid ${
                                  vStatus === "Verified"
                                    ? "#6EE7B7"
                                    : vStatus === "Rejected"
                                    ? "#FCA5A5"
                                    : "#FCD34D"
                                }`,
                              }}
                            >
                              {vStatus === "Verified"
                                ? "✓ Verified"
                                : vStatus === "Rejected"
                                ? "✕ Rejected"
                                : "⏳ Pending Review"}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: 3 }}>
                          {docDef.description}
                        </div>

                        {isUploaded && (
                          <div
                            style={{
                              fontSize: "0.73rem",
                              color: "#475569",
                              marginTop: 4,
                              display: "flex",
                              gap: 10,
                              flexWrap: "wrap",
                              alignItems: "center",
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>
                              📄 {uploaded.filename || `${docDef.label}.pdf`}
                            </span>
                            {uploaded.file_size_formatted && (
                              <span>({uploaded.file_size_formatted})</span>
                            )}
                            {uploaded.sha256_hash && (
                              <span
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: "0.68rem",
                                  color: "#0891B2",
                                  background: "#F0FDFA",
                                  padding: "1px 4px",
                                  borderRadius: 3,
                                }}
                                title={`SHA-256: ${uploaded.sha256_hash}`}
                              >
                                SHA-256: {uploaded.sha256_hash.slice(0, 10)}...
                              </span>
                            )}
                          </div>
                        )}

                        {isUploaded && vStatus === "Rejected" && uploaded.officer_notes && (
                          <div
                            style={{
                              marginTop: 6,
                              padding: "6px 10px",
                              background: "#FEF2F2",
                              border: "1px solid #FECACA",
                              borderRadius: 6,
                              color: "#991B1B",
                              fontSize: "0.75rem",
                            }}
                          >
                            <strong>Rejection Reason:</strong> {uploaded.officer_notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                      {isUploaded ? (
                        <>
                          {uploaded.file_data ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setActivePreviewDoc(uploaded)}
                              title="View and inspect uploaded document"
                            >
                              <Eye size={13} /> View
                            </button>
                          ) : (
                            <span style={{ fontSize: "0.73rem", color: "#94A3B8" }}>
                              File on Record
                            </span>
                          )}

                          {isOfficer && (
                            <>
                              <button
                                type="button"
                                className="btn btn-success btn-sm"
                                disabled={vStatus === "Verified" || isUpdating}
                                onClick={() =>
                                  handleVerifyDocument(
                                    uploaded.doc_id || docDef.id,
                                    uploaded.label || docDef.label
                                  )
                                }
                                title="Mark document as Verified"
                                style={{ opacity: vStatus === "Verified" ? 0.6 : 1 }}
                              >
                                <CheckCircle size={13} /> {isUpdating ? "..." : "Verify"}
                              </button>

                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                disabled={isUpdating}
                                onClick={() =>
                                  setRejectDocModal({
                                    docId: uploaded.doc_id || docDef.id,
                                    docLabel: uploaded.label || docDef.label,
                                    notes: uploaded.officer_notes || "",
                                  })
                                }
                                title="Reject document with audit notes"
                              >
                                <XCircle size={13} /> Reject
                              </button>
                            </>
                          )}
                        </>
                      ) : (
                        isOfficer && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{
                              color: "#0891B2",
                              borderColor: "#A5F3FC",
                              background: "#ECFEFF",
                            }}
                            onClick={() => {
                              setRequestDocForm({
                                document_name: docDef.label,
                                notes: `Please submit your ${docDef.label} for ${viewDocModal.loan_type} loan underwriting.`,
                              });
                              setRequestDocMsg("");
                              setRequestDocModal(true);
                            }}
                            title="Request applicant to upload document"
                          >
                            <Send size={12} /> Request Document
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              };

              return (
                <div style={{ marginBottom: 24 }}>
                  {/* Header with Title, Stats & Request Button */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 14,
                      flexWrap: "wrap",
                      gap: 10,
                    }}
                  >
                    <div>
                      <h4
                        style={{
                          fontSize: "1.05rem",
                          fontWeight: 800,
                          color: "#0F172A",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          margin: 0,
                        }}
                      >
                        <FileText size={18} color="#0891B2" />
                        {viewDocModal.loan_type} Loan Required Document Checklist
                      </h4>
                      <div style={{ fontSize: "0.78rem", color: "#64748B", marginTop: 4 }}>
                        Mandatory compliance: <strong>{requiredUploadedCount}</strong> of{" "}
                        <strong>{requiredDocs.length}</strong> required documents uploaded
                        {uploadedDocs.length > 0 && ` (${uploadedDocs.length} total attached)`}.
                      </div>
                    </div>

                    {isOfficer && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setRequestDocForm({ document_name: "", notes: "" });
                          setRequestDocMsg("");
                          setRequestDocModal(true);
                        }}
                      >
                        <PlusCircle size={13} /> Request Additional Document
                      </button>
                    )}
                  </div>

                  {/* Feedback Notification Banner */}
                  {docFeedbackMsg && (
                    <div
                      className={
                        docFeedbackMsg.startsWith("✓") ? "alert alert-success" : "alert alert-error"
                      }
                      style={{ fontSize: "0.82rem", padding: "10px 14px", marginBottom: 14 }}
                    >
                      <span>{docFeedbackMsg}</span>
                      <button
                        type="button"
                        onClick={() => setDocFeedbackMsg("")}
                        style={{
                          marginLeft: "auto",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "inherit",
                          fontWeight: 700,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Education Loan Grouped by Student and Parent/Co-borrower */}
                  {isEducation ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {/* 1. Student Documents */}
                      <div
                        style={{
                          border: "1px solid #E2E8F0",
                          borderRadius: "var(--radius-md)",
                          padding: "14px 16px",
                          background: "#FFFFFF",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 12,
                            paddingBottom: 8,
                            borderBottom: "1px solid #F1F5F9",
                          }}
                        >
                          <span style={{ fontSize: "1.1rem" }}>🎓</span>
                          <h5
                            style={{
                              fontSize: "0.92rem",
                              fontWeight: 800,
                              color: "#0F172A",
                              margin: 0,
                            }}
                          >
                            Student Documents
                          </h5>
                          <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                            (Admission, marksheets, fee structure, student KYC)
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {studentDocs.map(renderDocRow)}
                        </div>
                      </div>

                      {/* 2. Parent / Co-borrower Documents */}
                      <div
                        style={{
                          border: "1px solid #E2E8F0",
                          borderRadius: "var(--radius-md)",
                          padding: "14px 16px",
                          background: "#FFFFFF",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 12,
                            paddingBottom: 8,
                            borderBottom: "1px solid #F1F5F9",
                          }}
                        >
                          <span style={{ fontSize: "1.1rem" }}>👨‍👩‍👧</span>
                          <h5
                            style={{
                              fontSize: "0.92rem",
                              fontWeight: 800,
                              color: "#0F172A",
                              margin: 0,
                            }}
                          >
                            Parent / Co-borrower Documents
                          </h5>
                          <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                            (Parent Aadhaar, PAN, income proof & banking records)
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {parentDocs.map(renderDocRow)}
                        </div>
                      </div>

                      {/* 3. Additional Documents */}
                      {additionalEduDocs.length > 0 && (
                        <div
                          style={{
                            border: "1px solid #E2E8F0",
                            borderRadius: "var(--radius-md)",
                            padding: "14px 16px",
                            background: "#FFFFFF",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 12,
                              paddingBottom: 8,
                              borderBottom: "1px solid #F1F5F9",
                            }}
                          >
                            <span style={{ fontSize: "1.1rem" }}>📋</span>
                            <h5
                              style={{
                                fontSize: "0.92rem",
                                fontWeight: 800,
                                color: "#0F172A",
                                margin: 0,
                              }}
                            >
                              Additional Documentation
                            </h5>
                            <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                              (Collateral documents where applicable)
                            </span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {additionalEduDocs.map(renderDocRow)}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Standard Checklist for Home, Personal, Business, Vehicle Loans */
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {configDocs.map(renderDocRow)}
                    </div>
                  )}

                  {/* Supplementary / Extra Uploaded Documents */}
                  {extraDocs.length > 0 && (
                    <div style={{ marginTop: 18 }}>
                      <h5
                        style={{
                          fontSize: "0.9rem",
                          fontWeight: 800,
                          color: "#475569",
                          marginBottom: 10,
                        }}
                      >
                        Supplementary / Other Attached Documents ({extraDocs.length})
                      </h5>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {extraDocs.map((extra) =>
                          renderDocRow({
                            id: extra.doc_id || extra.label,
                            label: extra.label,
                            description: extra.filename || "Supplementary borrower attachment",
                            required: false,
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* Officer Requested Additional Documents History */}
                  {viewDocModal.additional_documents_requested &&
                    viewDocModal.additional_documents_requested.length > 0 && (
                      <div
                        style={{
                          marginTop: 18,
                          padding: "14px 16px",
                          background: "#F0FDFA",
                          border: "1px solid #CCFBF1",
                          borderRadius: "var(--radius-md)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            marginBottom: 10,
                          }}
                        >
                          <Clock size={16} color="#0D9488" />
                          <h5
                            style={{
                              fontSize: "0.9rem",
                              fontWeight: 800,
                              color: "#0F766E",
                              margin: 0,
                            }}
                          >
                            Officer Requested Additional Documents (
                            {viewDocModal.additional_documents_requested.length})
                          </h5>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {viewDocModal.additional_documents_requested.map((req, rIdx) => (
                            <div
                              key={rIdx}
                              style={{
                                background: "#FFFFFF",
                                padding: "8px 12px",
                                borderRadius: 6,
                                border: "1px solid #E2E8F0",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                fontSize: "0.8rem",
                                flexWrap: "wrap",
                                gap: 6,
                              }}
                            >
                              <div>
                                <strong style={{ color: "#0F172A" }}>{req.document_name}</strong>
                                {req.notes && (
                                  <span style={{ color: "#64748B", marginLeft: 8 }}>
                                    — {req.notes}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <span style={{ fontSize: "0.72rem", color: "#64748B" }}>
                                  {dateStr(req.requested_at)}
                                </span>
                                <span
                                  style={{
                                    fontSize: "0.7rem",
                                    fontWeight: 700,
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                    background:
                                      req.status === "Fulfilled" ? "#ECFDF5" : "#FEF3C7",
                                    color:
                                      req.status === "Fulfilled" ? "#065F46" : "#92400E",
                                  }}
                                >
                                  {req.status || "Requested"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              );
            })()}

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

            <div
              className="modal-footer"
              style={{
                marginTop: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setViewDocModal(null);
                    setActivePreviewDoc(null);
                  }}
                >
                  Close Dossier
                </button>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {isOfficer && (viewDocModal.status || "").toLowerCase() === "pending" && (
                  <>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => {
                        const target = viewDocModal;
                        setViewDocModal(null);
                        openModal(target, "Rejected");
                      }}
                    >
                      <XCircle size={14} /> Reject Application
                    </button>
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={() => {
                        const target = viewDocModal;
                        setViewDocModal(null);
                        openModal(target, "Approved");
                      }}
                    >
                      <CheckCircle size={14} /> Approve Loan
                    </button>
                  </>
                )}

                {isOfficer && (viewDocModal.status || "").toLowerCase() === "approved" && (
                  <button
                    type="button"
                    className="btn btn-accent"
                    onClick={() => {
                      const target = viewDocModal;
                      setViewDocModal(null);
                      openModal(target, "Disbursed");
                    }}
                  >
                    <Banknote size={14} /> Disburse Loan Funds
                  </button>
                )}

                {(!isOfficer ||
                  (viewDocModal.status || "").toLowerCase() === "disbursed" ||
                  (viewDocModal.status || "").toLowerCase() === "closed") && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setViewDocModal(null);
                      setActivePreviewDoc(null);
                    }}
                  >
                    Done Reviewing
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Officer Document Rejection Modal */}
      {rejectDocModal && (
        <div className="modal-overlay" style={{ zIndex: 1250 }}>
          <div className="modal" style={{ width: "min(500px, 94vw)" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 12,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "#991B1B",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <XCircle size={20} color="#DC2626" />
                Reject Document
              </h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setRejectDocModal(null)}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.85rem", color: "#64748B", marginBottom: 16 }}>
              Document: <strong>{rejectDocModal.docLabel}</strong>
              <br />
              Applicant: <strong>{viewDocModal?.applicant_name}</strong>
            </p>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Rejection Reason / Notes for Applicant *</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="e.g. Image is blurry, name does not match KYC profile, page 2 missing, document expired..."
                value={rejectDocModal.notes}
                onChange={(e) =>
                  setRejectDocModal((prev) => ({ ...prev, notes: e.target.value }))
                }
                autoFocus
              />
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setRejectDocModal(null)}
                disabled={updatingDocId === rejectDocModal.docId}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmRejectDoc}
                disabled={updatingDocId === rejectDocModal.docId}
              >
                {updatingDocId === rejectDocModal.docId ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Officer Request Additional Document Modal */}
      {requestDocModal && (
        <div className="modal-overlay" style={{ zIndex: 1250 }}>
          <div className="modal" style={{ width: "min(520px, 94vw)" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 12,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "#0F172A",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <PlusCircle size={20} color="#0891B2" />
                Request Additional Document
              </h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setRequestDocModal(false);
                  setRequestDocMsg("");
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.85rem", color: "#64748B", marginBottom: 16 }}>
              Send an official document request to <strong>{viewDocModal?.applicant_name}</strong> for this loan application.
            </p>

            {requestDocMsg && (
              <div
                className={
                  requestDocMsg.startsWith("✓") ? "alert alert-success" : "alert alert-error"
                }
                style={{ fontSize: "0.82rem", padding: "10px 14px", marginBottom: 14 }}
              >
                {requestDocMsg}
              </div>
            )}

            <form onSubmit={handleRequestAdditionalDocSubmit}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Document Name *</label>
                <input
                  className="form-control"
                  placeholder="e.g. Updated Bank Statement, Electricity Bill, Salary Certificate..."
                  value={requestDocForm.document_name}
                  onChange={(e) =>
                    setRequestDocForm((p) => ({ ...p, document_name: e.target.value }))
                  }
                  required
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Instructions / Reason for Request</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="e.g. Please provide statements showing the most recent 3 months salary credits..."
                  value={requestDocForm.notes}
                  onChange={(e) =>
                    setRequestDocForm((p) => ({ ...p, notes: e.target.value }))
                  }
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setRequestDocModal(false);
                    setRequestDocMsg("");
                  }}
                  disabled={requestDocLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={requestDocLoading}
                >
                  <Send size={13} /> {requestDocLoading ? "Dispatching..." : "Send Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}