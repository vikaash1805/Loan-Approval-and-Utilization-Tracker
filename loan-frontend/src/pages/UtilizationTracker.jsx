import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/loanApi";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import {
  RefreshCw, PlusCircle, Upload, FileText, Image as ImageIcon,
  ExternalLink, Banknote, Percent, CheckCircle2, X
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
  "Penalty"
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
  "Other Business Expense"
];

const fmt = (n) => n !== undefined && n !== null ? `₹${Number(n || 0).toLocaleString("en-IN")}` : "₹0";
const dateStr = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const EVENT_COLORS = {
  "Disbursement": "#06b6d4",
  "Fund Utilization": "#0F172A",
  "Material Purchase": "#1E293B",
  "Equipment Purchase": "#334155",
  "Vendor Payment": "#0284c7",
  "Operational Expense": "#475569",
  "EMI Payment": "#10b981",
  "Principal Repayment": "#059669",
  "Interest Payment": "#f59e0b",
  "Prepayment": "#0891b2",
  "Penalty": "#ef4444",
};

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
    notes: ""
  });
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState("");

  // Modal for previewing proof image
  const [viewProofModal, setViewProofModal] = useState(null); // image base64 url

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
      if (initialLoanId && !loanId) {
        setLoanId(initialLoanId);
      } else if (!loanId && appList.length > 0) {
        setLoanId(appList[0]._id);
        loadEvents(appList[0]._id);
      }
    } catch (_) {}
  };

  const loadEvents = async (id = loanId) => {
    if (!id) return;
    setLoading(true); setError("");
    try {
      const [evRes, loanRes] = await Promise.all([
        api.getUtilization(id),
        api.getApplication(id),
      ]);
      const evts = [...(evRes.events || [])].reverse(); // oldest first for chart
      setEvents(evts);
      setLoanData(loanRes.application);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadDisbursedLoans();
    if (initialLoanId) loadEvents(initialLoanId);
  }, [user]);

  const handleLoanSelect = (id) => {
    setLoanId(id);
    const found = disbursedLoans.find((l) => l._id === id);
    setLoanName(found ? found.applicant_name : "");
    setEvents([]); setLoanData(null);
    if (id) loadEvents(id);
  };

  const handleProofChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = () => setProofPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const recordEvent = async (e) => {
    e.preventDefault();
    if (!loanId) { setFormMsg("✗ Select a loan first."); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setFormMsg("✗ Enter a valid expense amount."); return; }
    
    setSubmitting(true); setFormMsg("");
    try {
      await api.recordUtilization({
        loan_id: loanId,
        event_type: form.event_type,
        category: form.category,
        amount: parseFloat(form.amount),
        vendor_name: form.vendor_name,
        invoice_no: form.invoice_no,
        payment_mode: form.payment_mode,
        proof_data: proofPreview || null,
        notes: form.notes,
      });
      setFormMsg("✓ Utilization record and proof submitted successfully!");
      setForm({
        event_type: "Fund Utilization",
        category: "Raw Materials",
        amount: "",
        vendor_name: "",
        invoice_no: "",
        payment_mode: "Bank Transfer",
        notes: ""
      });
      setProofFile(null);
      setProofPreview("");
      setTimeout(() => { setFormMsg(""); setShowForm(false); loadEvents(); }, 1200);
    } catch (e) {
      setFormMsg(`✗ ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Chart data: balance over time
  const chartData = events.map((e) => ({
    date: new Date(e.event_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    balance: e.balance_remaining,
    amount: e.amount,
    type: e.event_type,
  }));

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1>{isOfficer ? "Utilization Tracker & Proof Verification" : "Utilization Tracker & Proof Submissions"}</h1>
          <p>{isOfficer ? "Review fund utilization invoices, inspect borrower proof documents, and monitor live portfolio balances" : "Submit fund utilization invoices, record project expenses, and monitor repayment ledgers"}</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {loanId && (
            <button className="btn btn-ghost btn-sm" onClick={() => loadEvents()}>
              <RefreshCw size={14} /> Refresh
            </button>
          )}
          {!isOfficer && loanId && (
            <button
              className="btn btn-sm"
              onClick={() => navigate("/repay", { state: { loanId } })}
              style={{ background: "#ecfeff", color: "#0891b2", border: "1px solid #a5f3fc", fontWeight: 600 }}
            >
              <Banknote size={14} /> Repay / Pay Interest
            </button>
          )}
          {!isOfficer && loanId && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm((p) => !p)}>
              <Upload size={14} /> Submit Utilization Record
            </button>
          )}
        </div>
      </div>

      {/* ── LOAN SELECTOR ────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title">🔍 Select a Disbursed Loan</div>
        <select className="form-control" value={loanId} onChange={(e) => handleLoanSelect(e.target.value)}>
          <option value="">— Select a loan account to track —</option>
          {disbursedLoans.map((l) => (
            <option key={l._id} value={l._id}>
              {l.applicant_name} · {l.loan_type} · Approved: {fmt(l.approved_amount || l.amount_requested)} · Outstanding: {fmt(l.outstanding_balance)}
            </option>
          ))}
        </select>
        {disbursedLoans.length === 0 && (
          <div style={{ marginTop: 10, fontSize: "0.85rem", color: "#64748b" }}>
            No active disbursed loans found. Disburse a loan from the Approvals page first.
          </div>
        )}
      </div>

      {/* ── LOAN SUMMARY METRICS ─────────────────────────────────── */}
      {loanData && (() => {
        let latestEvent = null;
        let computedRepaid = 0;
        let computedInterest = 0;

        if (events && events.length > 0) {
          events.forEach((ev) => {
            if (!latestEvent || new Date(ev.event_date) > new Date(latestEvent.event_date)) {
              latestEvent = ev;
            }
            const amt = Number(ev.amount || 0);
            if (ev.event_type?.includes("Repayment") || ev.event_type?.includes("EMI") || ev.event_type?.includes("Prepayment")) {
              computedRepaid += amt;
            }
            if (ev.event_type?.includes("Interest")) {
              computedInterest += amt;
            }
          });
        }

        const currentOutstanding = latestEvent != null
          ? Number(latestEvent.balance_remaining || 0)
          : (Number(loanData.outstanding_balance) ?? 0);

        const totalDisbursedAmt = Number(loanData.total_disbursed || (loanData.approved_amount || 0));
        const totalRepaidAmt = computedRepaid > 0 ? computedRepaid : Number(loanData.total_repaid || 0);
        const totalInterestAmt = computedInterest > 0 ? computedInterest : Number(loanData.total_interest_paid || 0);

        const metrics = isOfficer ? [
          ["Borrower", loanData.applicant_name, "#0F172A"],
          ["Loan Facility", loanData.loan_type, "#0F172A"],
          ["Approved Principal", fmt(loanData.approved_amount), "#10b981"],
          ["Capital Disbursed", fmt(totalDisbursedAmt), "#06b6d4"],
          ["Principal Recovered", fmt(totalRepaidAmt), "#059669"],
          ["Interest Collected", fmt(totalInterestAmt), "#d97706"],
          ["Remaining Recovery", fmt(currentOutstanding), currentOutstanding > 0 ? "#0F172A" : "#10b981"],
          ["Monthly EMI", fmt(loanData.emi), "#0F172A"],
        ] : [
          ["Applicant", loanData.applicant_name, "#0F172A"],
          ["Loan Type", loanData.loan_type, "#0F172A"],
          ["Approved Amount", fmt(loanData.approved_amount), "#10b981"],
          ["Total Disbursed", fmt(totalDisbursedAmt), "#06b6d4"],
          ["Principal Repaid", fmt(totalRepaidAmt), "#059669"],
          ["Interest Paid", fmt(totalInterestAmt), "#d97706"],
          ["Outstanding Balance", fmt(currentOutstanding), currentOutstanding > 0 ? "#ea580c" : "#10b981"],
          ["Monthly EMI", fmt(loanData.emi), "#0F172A"],
        ];

        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 20 }}>
            {metrics.map(([k, v, c]) => (
              <div key={k} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ fontSize: "0.74rem", color: "#64748b", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>{k}</div>
                <div style={{ fontFamily: "Outfit", fontWeight: 700, fontSize: "1.05rem", color: c }}>{v}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── SUBMIT UTILIZATION RECORD & PROOF FORM ───────────────── */}
      {showForm && loanId && (
        <div className="card" style={{ marginBottom: 24, border: "1px solid #cbd5e1", background: "#f8fafc", padding: "24px" }}>
          <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Upload size={18} color="#06b6d4" /> Submit Record of Fund Utilization (Proof Upload)
          </div>
          <p style={{ color: "#64748b", fontSize: "0.88rem", marginBottom: 18 }}>
            Upload your invoices, vendor bills, or receipts verifying how the disbursed funds were used for your approved business/personal purpose.
          </p>

          <form onSubmit={recordEvent}>
            <div className="form-grid">
              <div className="form-group">
                <label>Utilization Event Type *</label>
                <select
                  className="form-control"
                  value={form.event_type}
                  onChange={(e) => setForm((p) => ({ ...p, event_type: e.target.value }))}
                  required
                >
                  {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Expense Category *</label>
                <select
                  className="form-control"
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  required
                >
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Amount Utilized (₹) *</label>
                <input
                  className="form-control"
                  type="number"
                  placeholder="e.g. 45000"
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Vendor / Merchant / Beneficiary Name</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="e.g. Acme Industrial Supplies Ltd"
                  value={form.vendor_name}
                  onChange={(e) => setForm((p) => ({ ...p, vendor_name: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Invoice / Bill / Receipt Number</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="e.g. INV-2026-0881"
                  value={form.invoice_no}
                  onChange={(e) => setForm((p) => ({ ...p, invoice_no: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Payment Channel</label>
                <select
                  className="form-control"
                  value={form.payment_mode}
                  onChange={(e) => setForm((p) => ({ ...p, payment_mode: e.target.value }))}
                >
                  <option value="Bank Transfer">NEFT / RTGS Bank Transfer</option>
                  <option value="UPI">UPI (Google Pay, PhonePe, BHIM)</option>
                  <option value="Debit Card">Debit / Corporate Card</option>
                  <option value="Cheque / DD">Cheque / Demand Draft</option>
                  <option value="Cash Receipt">Cash Voucher / Receipt</option>
                </select>
              </div>

              {/* Bill / Invoice Proof Upload */}
              <div className="form-group" style={{ gridColumn: "1/-1" }}>
                <label>Attach Bill / Receipt / Invoice Proof (Image or Document) *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProofChange}
                  className="form-control"
                  style={{ padding: "10px" }}
                />
                {proofPreview && (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
                    <img
                      src={proofPreview}
                      alt="Receipt preview"
                      style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "#0a0f25" }}>
                        {proofFile?.name || "Uploaded invoice proof"}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "#10b981", fontWeight: 600 }}>
                        ✓ Ready to submit with record
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ gridColumn: "1/-1" }}>
                <label>Utilization Description / Notes</label>
                <input
                  className="form-control"
                  placeholder="e.g. Procured specialized steel components for industrial batch production"
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>

            {formMsg && (
              <div className={`alert ${formMsg.startsWith("✓") ? "alert-success" : "alert-error"}`} style={{ marginTop: 16 }}>
                {formMsg}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => { setShowForm(false); setFormMsg(""); }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? "Uploading Proof..." : "✓ Submit Utilization Record"}
              </button>
            </div>
          </form>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {/* ── OUTSTANDING BALANCE CHART ───────────────────────────── */}
      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-title">📊 Outstanding Balance Timeline</div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#edf2f7" />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => v >= 1e5 ? `₹${(v / 1e5).toFixed(1)}L` : `₹${v}`} />
              <Tooltip
                contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, color: "#0F172A", boxShadow: "0 4px 20px rgba(15,23,42,0.08)" }}
                formatter={(v, n) => [fmt(v), n === "balance" ? "Balance" : "Amount"]}
              />
              <Area type="monotone" dataKey="balance" stroke="#0F172A" strokeWidth={2.5}
                fill="url(#balGrad)" dot={{ fill: "#06b6d4", r: 4 }} name="balance" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── EVENTS & PROOF LEDGER ───────────────────────────────── */}
      {loanId && !loading && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>
              📋 Utilization & Repayment Ledger ({events.length} records)
            </div>
            {!isOfficer && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate("/repay", { state: { loanId } })}
              >
                <Banknote size={14} /> Open Repayment Module
              </button>
            )}
          </div>

          {events.length === 0 ? (
            <div className="empty"><div className="empty-icon">📭</div><p>No utilization records or transactions submitted yet.</p></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[...events].reverse().map((e, i) => (
                <div key={e._id || i} style={{
                  display: "flex", gap: 16, padding: "18px 0",
                  borderBottom: i < events.length - 1 ? "1px solid #edf2f7" : "none",
                  position: "relative",
                  alignItems: "flex-start",
                }}>
                  {/* Color dot */}
                  <div style={{
                    width: 12, height: 12, borderRadius: "50%", flexShrink: 0, marginTop: 6,
                    background: EVENT_COLORS[e.event_type] || "#06b6d4",
                    boxShadow: `0 0 0 3px ${EVENT_COLORS[e.event_type] || "#06b6d4"}22`,
                  }} />

                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, color: "#0F172A", fontSize: "0.95rem" }}>
                            {e.event_type}
                          </span>
                          {e.category && (
                            <span style={{ fontSize: "0.72rem", background: "#f1f5f9", color: "#475569", padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>
                              {e.category}
                            </span>
                          )}
                          {e.payment_mode && (
                            <span style={{ fontSize: "0.72rem", background: "#ecfeff", color: "#0891b2", padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>
                              via {e.payment_mode}
                            </span>
                          )}
                        </div>

                        {/* Extra metadata */}
                        <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                          {e.vendor_name && <span>Vendor: <strong>{e.vendor_name}</strong></span>}
                          {e.invoice_no && <span>Invoice: <code>{e.invoice_no}</code></span>}
                          {e.transaction_ref && <span>Txn: <code>{e.transaction_ref}</code></span>}
                        </div>

                        {e.notes && (
                          <div style={{ fontSize: "0.84rem", color: "#334155", marginTop: 4 }}>
                            {e.notes}
                          </div>
                        )}

                        {/* Bill Proof Attachment Thumbnail */}
                        {e.proof_data && (
                          <div style={{ marginTop: 8 }}>
                            <button
                              type="button"
                              onClick={() => setViewProofModal(e.proof_data)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                background: "#ecfeff",
                                border: "1px solid #a5f3fc",
                                padding: "4px 10px",
                                borderRadius: 6,
                                cursor: "pointer",
                                fontSize: "0.76rem",
                                color: "#0891b2",
                                fontWeight: 600
                              }}
                            >
                              <ImageIcon size={13} /> View Attached Bill Proof
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right amount column */}
                      {(() => {
                        const isRepayment = e.event_type?.includes("Repayment") || e.event_type?.includes("EMI") || e.event_type?.includes("Prepayment");
                        const isInterest = e.event_type?.includes("Interest");
                        const isDisbursement = e.event_type === "Disbursement";

                        // Perspective: Officer (Bank) vs Customer (Borrower)
                        let displaySign = "";
                        let color = "#06b6d4";
                        let statusTag = "";

                        if (isOfficer) {
                          if (isRepayment) {
                            displaySign = "+"; // Inflow to bank
                            color = "#059669";
                            statusTag = "Collection Received";
                          } else if (isInterest) {
                            displaySign = "+";
                            color = "#d97706";
                            statusTag = "Interest Received";
                          } else if (isDisbursement) {
                            displaySign = "−"; // Outflow from bank
                            color = "#06b6d4";
                            statusTag = "Capital Disbursed";
                          } else {
                            displaySign = "";
                            color = "#0F172A";
                            statusTag = "Borrower Expense";
                          }
                        } else {
                          if (isRepayment) {
                            displaySign = "−"; // Outflow from customer
                            color = "#059669";
                            statusTag = "Repayment Paid";
                          } else if (isInterest) {
                            displaySign = "−";
                            color = "#d97706";
                            statusTag = "Interest Paid";
                          } else if (isDisbursement) {
                            displaySign = "+"; // Inflow to customer
                            color = "#06b6d4";
                            statusTag = "Loan Disbursed";
                          } else {
                            displaySign = "";
                            color = "#0F172A";
                            statusTag = "Utilized";
                          }
                        }

                        return (
                          <div style={{ textAlign: "right" }}>
                            <div style={{
                              fontFamily: "Outfit",
                              fontWeight: 700,
                              fontSize: "1.1rem",
                              color: color
                            }}>
                              {displaySign}{fmt(e.amount)}
                            </div>
                            <div style={{ fontSize: "0.74rem", color: "#64748b", marginTop: 2, fontWeight: 600 }}>
                              {isDisbursement
                                ? (isOfficer ? "Disbursed in Full · Undisbursed: ₹0" : "Initial Loan Principal: " + fmt(e.amount))
                                : (isOfficer ? `Remaining Recovery: ${fmt(e.balance_remaining)}` : `Outstanding Debt: ${fmt(e.balance_remaining)}`)}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 2 }}>
                              {dateStr(e.event_date)}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BILL PROOF MODAL ─────────────────────────────────────── */}
      {viewProofModal && (
        <div className="modal-overlay" onClick={() => setViewProofModal(null)}>
          <div className="modal" style={{ maxWidth: 600, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>Attached Utilization Proof Document</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setViewProofModal(null)}><X size={16} /></button>
            </div>
            <img
              src={viewProofModal}
              alt="Utilization Proof"
              style={{ maxWidth: "100%", maxHeight: "65vh", objectFit: "contain", borderRadius: 8, border: "1px solid #e2e8f0" }}
            />
            <div style={{ marginTop: 18 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setViewProofModal(null)}>Close Preview</button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="spinner" />}
    </div>
  );
}
