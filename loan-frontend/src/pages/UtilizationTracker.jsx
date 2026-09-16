import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/loanApi";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  RefreshCw,
  PlusCircle,
  Upload,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Banknote,
  Percent,
  CheckCircle2,
  X,
  TrendingUp,
  CreditCard,
  ShieldCheck,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";

const EVENT_TYPES = [
  "Fund Utilization",
  "Material Purchase",
  "Equipment Purchase",
  "Vendor Payment",
  "Operational Expense",
  "Disbursement",
  "EMI Payment",
  "Principal Repayment",
  "Interest Payment",
  "Penalty",
];

const CATEGORIES = [
  "Raw Materials",
  "Machinery & Equipment",
  "Vendor Invoice",
  "Inventory Stock",
  "Salaries & Labor",
  "Office & Factory Rent",
  "Utilities & Electricity",
  "Logistics & Shipping",
  "Software & IT Services",
  "Other Business Expense",
];

const fmt = (n) =>
  n !== undefined && n !== null
    ? `₹${Number(n || 0).toLocaleString("en-IN")}`
    : "₹0";

const dateStr = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export default function UtilizationTracker() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isOfficer } = useAuth();

  const initialLoanId = location.state?.loanId || "";
  const initialName = location.state?.name || "";

  const [loanId, setLoanId] = useState(initialLoanId);
  const [loanName, setLoanName] = useState(initialName);
  const [events, setEvents] = useState([]);
  const [loanData, setLoanData] = useState(null);
  const [disbursedLoans, setDisbursedLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // New utilization proof form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    event_type: "Fund Utilization",
    category: "Raw Materials",
    amount: "",
    vendor_name: "",
    invoice_no: "",
    payment_mode: "Bank Transfer",
    notes: "",
  });
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState("");

  // Modal for previewing proof image
  const [viewProofModal, setViewProofModal] = useState(null);

  // Load disbursed loans for selector
  const loadDisbursedLoans = async () => {
    try {
      const params = { status: "Disbursed", limit: 100 };
      if (!isOfficer && user?.email) {
        params.email = user.email;
      }
      const res = await api.getApplications(params);
      const appList = res.applications || [];
      setDisbursedLoans(appList);

      if (!loanId && appList.length > 0) {
        setLoanId(appList[0]._id);
        setLoanName(appList[0].applicant_name);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Load utilization events for active loanId
  const loadEvents = async () => {
    if (!loanId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.getUtilization(loanId);
      setEvents(res.events || []);
      const matchedLoan = disbursedLoans.find((l) => l._id === loanId);
      setLoanData(res.loan || matchedLoan || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDisbursedLoans();
  }, [user]);

  useEffect(() => {
    if (loanId) {
      loadEvents();
    }
  }, [loanId, disbursedLoans]);

  const handleProofChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setProofPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setFormMsg("✗ Please enter a valid expense amount.");
      return;
    }

    setSubmitting(true);
    setFormMsg("");
    try {
      const payload = {
        loan_id: loanId,
        event_type: form.event_type,
        category: form.category,
        amount: parseFloat(form.amount),
        vendor_name: form.vendor_name,
        invoice_no: form.invoice_no,
        payment_mode: form.payment_mode,
        notes: form.notes,
        proof_image: proofPreview || undefined,
        proof_data: proofPreview || undefined,
      };

      await api.recordUtilization(payload);
      setFormMsg("✓ Utilization event & invoice proof recorded successfully!");
      setTimeout(() => {
        setShowForm(false);
        setForm({
          event_type: "Fund Utilization",
          category: "Raw Materials",
          amount: "",
          vendor_name: "",
          invoice_no: "",
          payment_mode: "Bank Transfer",
          notes: "",
        });
        setProofFile(null);
        setProofPreview("");
        setFormMsg("");
        loadEvents();
      }, 1000);
    } catch (err) {
      setFormMsg(`✗ ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Calculations
  const approvedAmt = loanData ? Number(loanData.approved_amount || loanData.amount_requested || 0) : 0;
  const totalUtilized = events
    .filter((e) => !["Disbursement", "EMI Payment", "Principal Repayment", "Interest Payment"].includes(e.event_type))
    .reduce((acc, cur) => acc + Number(cur.amount || 0), 0);
  const remainingCredit = Math.max(0, approvedAmt - totalUtilized);
  const utilizationPct = approvedAmt > 0 ? Math.min(100, Math.round((totalUtilized / approvedAmt) * 100)) : 0;

  // Chart data
  let runningTotal = 0;
  const chartData = [...events]
    .sort((a, b) => new Date(a.event_date || a.created_at || a.date) - new Date(b.event_date || b.created_at || b.date))
    .map((e) => {
      if (!["Disbursement", "EMI Payment", "Principal Repayment", "Interest Payment"].includes(e.event_type)) {
        runningTotal += Number(e.amount || 0);
      }
      return {
        date: new Date(e.event_date || e.created_at || e.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
        utilized: runningTotal,
        amount: Number(e.amount || 0),
      };
    });

  return (
    <div className="fade-in">
      {/* Page Header */}
      <div
        className="page-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}
      >
        <div>
          <h1>Real-Time Fund Utilization & Invoice Audit</h1>
          <p>Verify disbursement drawdown milestones and track vendor invoice attachments.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {!isOfficer && loanId && (
            <button className="btn btn-accent" onClick={() => setShowForm(true)}>
              <PlusCircle size={15} /> Log Utilization Proof
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={loadEvents} disabled={!loanId}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Disbursed Loan Selector */}
      <div className="card" style={{ marginBottom: 20, padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0F172A" }}>
            Select Active Disbursed Loan:
          </label>
          <select
            className="form-control"
            style={{ maxWidth: 420 }}
            value={loanId}
            onChange={(e) => {
              const selected = disbursedLoans.find((l) => l._id === e.target.value);
              setLoanId(e.target.value);
              setLoanName(selected?.applicant_name || "");
            }}
          >
            {disbursedLoans.length === 0 ? (
              <option value="">No disbursed loans found</option>
            ) : (
              disbursedLoans.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.applicant_name} — {l.loan_type} ({fmt(l.approved_amount || l.amount_requested)})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {loading && <div className="spinner" />}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && loanData && (
        <>
          {/* Utilization Metrics & Progress Bar */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 18, marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>
                  Disbursed Credit Cap
                </span>
                <div style={{ fontFamily: "Outfit", fontSize: "1.6rem", fontWeight: 800, color: "#0F172A", marginTop: 4 }}>
                  {fmt(approvedAmt)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>
                  Total Verified Utilization
                </span>
                <div style={{ fontFamily: "Outfit", fontSize: "1.6rem", fontWeight: 800, color: "#0891B2", marginTop: 4 }}>
                  {fmt(totalUtilized)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>
                  Remaining Unused Balance
                </span>
                <div style={{ fontFamily: "Outfit", fontSize: "1.6rem", fontWeight: 800, color: "#10B981", marginTop: 4 }}>
                  {fmt(remainingCredit)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>
                  Drawdown Velocity
                </span>
                <div style={{ fontFamily: "Outfit", fontSize: "1.6rem", fontWeight: 800, color: "#6366F1", marginTop: 4 }}>
                  {utilizationPct}%
                </div>
              </div>
            </div>

            {/* Progress Meter */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 700, marginBottom: 6 }}>
                <span>Portfolio Utilization Progress</span>
                <span style={{ color: "#0891B2" }}>{utilizationPct}% Allocated</span>
              </div>
              <div
                style={{
                  height: 10,
                  background: "#E2E8F0",
                  borderRadius: 6,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${utilizationPct}%`,
                    background: "linear-gradient(90deg, #06B6D4 0%, #3B82F6 50%, #6366F1 100%)",
                    borderRadius: 6,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Utilization Spending Velocity Area Chart */}
          {chartData.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="section-title">
                <TrendingUp size={18} color="#06B6D4" />
                <span>Cumulative Utilization Trajectory</span>
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="utilGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 12 }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
                  <YAxis tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                      borderRadius: 8,
                      color: "#0F172A",
                      boxShadow: "0 4px 20px rgba(15,23,42,0.08)",
                    }}
                    formatter={(v) => [fmt(v), "Cumulative Utilization"]}
                  />
                  <Area type="monotone" dataKey="utilized" stroke="#0891B2" strokeWidth={2.5} fillOpacity={1} fill="url(#utilGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Utilization Proofs Table */}
          <div className="card">
            <div className="section-title">
              <FileText size={18} color="#06B6D4" />
              <span>Verified Expense Events & Invoices</span>
            </div>

            {events.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">🧾</div>
                <p>No utilization records logged yet for this loan account.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Event & Category</th>
                      <th>Expense Amount</th>
                      <th>Vendor / Recipient</th>
                      <th>Invoice No.</th>
                      <th>Payment Mode</th>
                      <th>Timestamp</th>
                      <th>Audit Proof</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e, idx) => (
                      <tr key={idx}>
                        <td>
                          <div style={{ fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                            {e.event_type}
                            {e.event_type === "EMI Payment" && (
                              <span style={{ fontSize: "0.68rem", background: "#ECFEFF", color: "#0891B2", border: "1px solid #A5F3FC", padding: "1px 6px", borderRadius: 10, fontWeight: 800 }}>
                                Amortized EMI
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "0.76rem", color: "#64748B" }}>{e.category || "General"}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: "#0F172A" }}>{fmt(e.amount)}</div>
                          {e.principal_component !== undefined && e.principal_component !== null && (e.event_type === "EMI Payment" || e.principal_component > 0) && (
                            <div style={{ fontSize: "0.72rem", marginTop: 2, display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ color: "#059669", fontWeight: 700 }}>
                                P: {fmt(e.principal_component)}
                              </span>
                              {e.interest_component !== undefined && e.interest_component > 0 && (
                                <span style={{ color: "#D97706", fontWeight: 700 }}>
                                  I: {fmt(e.interest_component)}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td>{e.vendor_name || "—"}</td>
                        <td>
                          <span style={{ fontFamily: "monospace", fontSize: "0.82rem", background: "#F1F5F9", padding: "2px 6px", borderRadius: 4 }}>
                            {e.invoice_no || "N/A"}
                          </span>
                        </td>
                        <td>{e.payment_mode || "Bank Transfer"}</td>
                        <td style={{ fontSize: "0.78rem", color: "#64748B" }}>{dateStr(e.event_date || e.created_at || e.date)}</td>
                        <td>
                          {e.proof_image || e.proof_data ? (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ padding: "4px 8px", fontSize: "0.74rem" }}
                              onClick={() => setViewProofModal(e.proof_image || e.proof_data)}
                            >
                              <ImageIcon size={12} /> View Invoice
                            </button>
                          ) : (
                            <span style={{ fontSize: "0.76rem", color: "#94A3B8" }}>No attachment</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Log Utilization Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Log Utilization & Upload Invoice Proof</h3>
            <p style={{ fontSize: "0.85rem", color: "#64748B", marginBottom: 18 }}>
              Record drawdown expenses with supporting invoices for underwriting compliance.
            </p>

            {formMsg && (
              <div
                className={formMsg.startsWith("✓") ? "alert alert-success" : "alert alert-error"}
                style={{ fontSize: "0.82rem", padding: "10px 14px" }}
              >
                {formMsg}
              </div>
            )}

            <form onSubmit={handleFormSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label>Event Type *</label>
                  <select
                    className="form-control"
                    value={form.event_type}
                    onChange={(e) => setForm((p) => ({ ...p, event_type: e.target.value }))}
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Expense Category *</label>
                  <select
                    className="form-control"
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label>Amount (₹) *</label>
                  <input
                    className="form-control"
                    type="number"
                    placeholder="Enter expense amount"
                    value={form.amount}
                    onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Vendor / Supplier Name</label>
                  <input
                    className="form-control"
                    placeholder="Enter vendor or supplier name"
                    value={form.vendor_name}
                    onChange={(e) => setForm((p) => ({ ...p, vendor_name: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label>Invoice / Reference Number</label>
                  <input
                    className="form-control"
                    placeholder="Enter invoice or bill reference number"
                    value={form.invoice_no}
                    onChange={(e) => setForm((p) => ({ ...p, invoice_no: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Payment Mode</label>
                  <select
                    className="form-control"
                    value={form.payment_mode}
                    onChange={(e) => setForm((p) => ({ ...p, payment_mode: e.target.value }))}
                  >
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="UPI">UPI Payment</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Credit Card">Corporate Card</option>
                  </select>
                </div>
              </div>

              {/* Proof image upload */}
              <div className="form-group">
                <label>Upload Invoice Photo / Proof</label>
                <input type="file" accept="image/*" className="form-control" onChange={handleProofChange} />
                {proofPreview && (
                  <div style={{ marginTop: 8 }}>
                    <img
                      src={proofPreview}
                      alt="Invoice preview"
                      style={{ maxHeight: 90, borderRadius: 6, border: "1px solid #E2E8F0" }}
                    />
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-accent" disabled={submitting}>
                  {submitting ? "Saving..." : "Log & Verify Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Proof Full Image Modal */}
      {viewProofModal && (
        <div className="modal-overlay" onClick={() => setViewProofModal(null)}>
          <div
            className="modal"
            style={{ maxWidth: 680, textAlign: "center" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3>Verified Invoice Attachment</h3>
              <button
                onClick={() => setViewProofModal(null)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748B" }}
              >
                <X size={20} />
              </button>
            </div>
            <img
              src={viewProofModal}
              alt="Full invoice"
              style={{ maxWidth: "100%", maxHeight: "65vh", borderRadius: 8, objectFit: "contain" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
