import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/loanApi";
import {
  CreditCard, Banknote, Percent, CheckCircle2, ArrowRight,
  ShieldCheck, RefreshCw, Receipt, Download, FileText, Landmark
} from "lucide-react";

const fmt = (n) => n !== undefined && n !== null ? `₹${Number(n || 0).toLocaleString("en-IN")}` : "₹0";

export default function LoanRepayment() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isOfficer } = useAuth();
  
  const initialLoanId = location.state?.loanId || "";
  const initialType = location.state?.paymentType || "principal";

  const [loanId, setLoanId] = useState(initialLoanId);
  const [loans, setLoans] = useState([]);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successReceipt, setSuccessReceipt] = useState(null);

  // Mode: "principal" (Repay Principal Amount) or "interest" (Pay Loan Interest)
  const [paymentType, setPaymentType] = useState(initialType);
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [txnRef, setTxnRef] = useState("");
  const [notes, setNotes] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState("");

  // Load active loans
  const loadLoans = async () => {
    setLoading(true); setError("");
    try {
      const params = { status: "Disbursed", limit: 100 };
      if (!isOfficer && user?.email) {
        params.email = user.email;
      }
      const res = await api.getApplications(params);
      const appList = res.applications || [];
      setLoans(appList);

      // Select initial or first loan
      if (initialLoanId) {
        const match = appList.find((l) => l._id === initialLoanId);
        if (match) {
          setSelectedLoan(match);
          setLoanId(match._id);
        }
      } else if (appList.length > 0 && !selectedLoan) {
        setSelectedLoan(appList[0]);
        setLoanId(appList[0]._id);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOfficer) {
      navigate("/approvals", { replace: true });
      return;
    }
    loadLoans();
  }, [user, isOfficer]);

  // Handle loan switch
  const handleLoanChange = (id) => {
    setLoanId(id);
    const match = loans.find((l) => l._id === id);
    setSelectedLoan(match || null);
    setSuccessReceipt(null);
    setAmount("");
  };

  // Calculations for interest and principal
  const outstanding = selectedLoan ? Number(selectedLoan.outstanding_balance || 0) : 0;
  const annualRate = selectedLoan ? Number(selectedLoan.interest_rate || 10.5) : 10.5;
  const monthlyInterest = round2((outstanding * (annualRate / 100)) / 12);
  const totalInterestPaid = selectedLoan ? Number(selectedLoan.total_interest_paid || 0) : 0;
  const totalPrincipalRepaid = selectedLoan ? Number(selectedLoan.total_repaid || 0) : 0;

  function round2(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  // Handle preset amount buttons
  const setQuickAmount = (type) => {
    if (!selectedLoan) return;
    if (paymentType === "principal") {
      if (type === "25%") setAmount(String(Math.round(outstanding * 0.25)));
      if (type === "50%") setAmount(String(Math.round(outstanding * 0.5)));
      if (type === "100%") setAmount(String(Math.round(outstanding)));
      if (type === "emi") setAmount(String(Math.round(selectedLoan.emi || 0)));
    } else {
      if (type === "1m") setAmount(String(monthlyInterest));
      if (type === "2m") setAmount(String(monthlyInterest * 2));
      if (type === "3m") setAmount(String(monthlyInterest * 3));
    }
  };

  // Handle Proof File Upload
  const handleProofChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = () => setProofPreview(reader.result);
    reader.readAsDataURL(file);
  };

  // Submit Repayment
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!loanId) {
      setError("Please select a loan to make a payment.");
      return;
    }
    const payAmt = parseFloat(amount);
    if (!payAmt || payAmt <= 0) {
      setError("Please enter a valid payment amount greater than ₹0.");
      return;
    }
    if (paymentType === "principal" && payAmt > outstanding) {
      setError(`Payment amount cannot exceed current outstanding balance (${fmt(outstanding)}).`);
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccessReceipt(null);

    try {
      const generatedTxn = txnRef.trim() || `TXN${Date.now().toString().slice(-8)}`;
      const payload = {
        loan_id: loanId,
        payment_type: paymentType, // "principal" or "interest"
        amount: payAmt,
        payment_mode: paymentMode,
        transaction_ref: generatedTxn,
        notes: notes.trim() || (paymentType === "principal" ? `Principal repayment via ${paymentMode}` : `Interest payment via ${paymentMode}`),
        proof_data: proofPreview || null,
      };

      const res = await api.repayLoan(payload);
      setSuccessReceipt(res);
      setAmount("");
      setNotes("");
      setTxnRef("");
      setProofFile(null);
      setProofPreview("");

      // Update local selected loan
      if (res.loan) {
        setSelectedLoan(res.loan);
        setLoans((prev) => prev.map((l) => (l._id === res.loan._id ? res.loan : l)));
      }
    } catch (err) {
      setError(err.message || "Repayment transaction failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>Loan Repayment & Interest Servicing</h1>
          <p>Make principal repayments or pay monthly interest charges with instant balance updates</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={loadLoans}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* ── LOAN SELECTOR & KPI SUMMARY ─────────────────────────── */}
      <div className="card" style={{ marginBottom: 24, padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>
            🏦 Select Loan Account
          </div>
          {loans.length > 0 && (
            <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
              Showing {loans.length} active loan account{loans.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <select
          className="form-control"
          value={loanId}
          onChange={(e) => handleLoanChange(e.target.value)}
          style={{ fontSize: "0.95rem", padding: "12px 14px", fontWeight: 500 }}
        >
          <option value="">— Select a loan account —</option>
          {loans.map((l) => (
            <option key={l._id} value={l._id}>
              {l.applicant_name} · {l.loan_type} Loan · Approved: {fmt(l.approved_amount || l.amount_requested)} · Balance: {fmt(l.outstanding_balance)}
            </option>
          ))}
        </select>

        {loans.length === 0 && !loading && (
          <div style={{ marginTop: 14, padding: "16px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", color: "#64748b", fontSize: "0.9rem" }}>
            No active disbursed loans available for repayment. Once a loan is approved and disbursed, it will appear here for repayment.
          </div>
        )}

        {/* Selected Loan Real-time Metrics */}
        {selectedLoan && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginTop: 20 }}>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: "0.74rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>
                Outstanding Principal
              </div>
              <div style={{ fontFamily: "Outfit", fontWeight: 700, fontSize: "1.25rem", color: outstanding > 0 ? "#0F172A" : "#10b981" }}>
                {fmt(outstanding)}
              </div>
            </div>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: "0.74rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>
                Monthly Interest Due
              </div>
              <div style={{ fontFamily: "Outfit", fontWeight: 700, fontSize: "1.25rem", color: "#f59e0b" }}>
                {fmt(monthlyInterest)} <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#64748b" }}>({annualRate}% p.a.)</span>
              </div>
            </div>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: "0.74rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>
                Principal Repaid
              </div>
              <div style={{ fontFamily: "Outfit", fontWeight: 700, fontSize: "1.25rem", color: "#10b981" }}>
                {fmt(totalPrincipalRepaid)}
              </div>
            </div>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: "0.74rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>
                Interest Paid to Date
              </div>
              <div style={{ fontFamily: "Outfit", fontWeight: 700, fontSize: "1.25rem", color: "#0891b2" }}>
                {fmt(totalInterestPaid)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── SUCCESS RECEIPT BANNER ──────────────────────────────── */}
      {successReceipt && (
        <div className="card" style={{ marginBottom: 24, background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <CheckCircle2 size={28} color="#059669" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <h3 style={{ fontFamily: "Outfit", fontSize: "1.2rem", fontWeight: 700, color: "#065f46", marginBottom: 4 }}>
                {successReceipt.message}
              </h3>
              <p style={{ fontSize: "0.88rem", color: "#047857", marginBottom: 16 }}>
                Transaction ID: <strong>{successReceipt.receipt?.transaction_ref}</strong> · Date: {new Date().toLocaleString("en-IN")}
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, background: "#ffffff", padding: "16px", borderRadius: 8, border: "1px solid #d1fae5" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Payment Category</div>
                  <div style={{ fontWeight: 600, color: "#0F172A", marginTop: 2, textTransform: "capitalize" }}>
                    {successReceipt.payment_type === "principal" ? "Loan Principal Repayment" : "Loan Interest Payment"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Amount Paid</div>
                  <div style={{ fontWeight: 700, color: "#059669", fontSize: "1.1rem", marginTop: 2 }}>
                    {fmt(successReceipt.amount_paid)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>New Outstanding Balance</div>
                  <div style={{ fontWeight: 700, color: "#0F172A", fontSize: "1.1rem", marginTop: 2 }}>
                    {fmt(successReceipt.new_balance)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Payment Mode</div>
                  <div style={{ fontWeight: 600, color: "#0F172A", marginTop: 2 }}>
                    {successReceipt.receipt?.payment_mode || "UPI"}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => navigate("/utilization", { state: { loanId } })}
                >
                  <FileText size={14} /> View in Utilization Ledger
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setSuccessReceipt(null)}
                >
                  Make Another Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TWO-OPTION PAYMENT MODULE ───────────────────────────── */}
      {selectedLoan && (
        <div className="card" style={{ padding: "28px" }}>
          {/* Module Mode Switcher Tabs */}
          <div style={{ display: "flex", gap: 10, padding: "6px", background: "#f1f5f9", borderRadius: 10, marginBottom: 24 }}>
            <button
              type="button"
              onClick={() => { setPaymentType("principal"); setError(""); }}
              style={{
                flex: 1,
                padding: "12px 18px",
                fontFamily: "Outfit",
                fontWeight: 700,
                fontSize: "0.95rem",
                borderRadius: 8,
                border: paymentType === "principal" ? "1px solid #a5f3fc" : "1px solid transparent",
                background: paymentType === "principal" ? "#ffffff" : "transparent",
                color: paymentType === "principal" ? "#0F172A" : "#64748B",
                boxShadow: paymentType === "principal" ? "0 2px 8px rgba(6,182,212,0.12)" : "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.2s ease"
              }}
            >
              <Banknote size={18} color={paymentType === "principal" ? "#06b6d4" : "#64748B"} />
              Option 1: Repay Principal Amount
            </button>

            <button
              type="button"
              onClick={() => { setPaymentType("interest"); setError(""); }}
              style={{
                flex: 1,
                padding: "12px 18px",
                fontFamily: "Outfit",
                fontWeight: 700,
                fontSize: "0.95rem",
                borderRadius: 8,
                border: paymentType === "interest" ? "1px solid #fed7aa" : "1px solid transparent",
                background: paymentType === "interest" ? "#ffffff" : "transparent",
                color: paymentType === "interest" ? "#ea580c" : "#64748B",
                boxShadow: paymentType === "interest" ? "0 2px 8px rgba(234,88,12,0.08)" : "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.2s ease"
              }}
            >
              <Percent size={18} />
              Option 2: Pay Loan Interest
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Context Info Banner */}
            <div style={{
              padding: "14px 18px",
              borderRadius: 8,
              marginBottom: 20,
              background: paymentType === "principal" ? "#ecfeff" : "#fff7ed",
              border: `1px solid ${paymentType === "principal" ? "#a5f3fc" : "#ffedd5"}`,
              fontSize: "0.88rem",
              color: paymentType === "principal" ? "#0e7490" : "#9a3412",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8
            }}>
              <div>
                <strong>{paymentType === "principal" ? "Principal Repayment Mode:" : "Interest Payment Mode:"}</strong>{" "}
                {paymentType === "principal"
                  ? "Payments made under this option directly reduce your loan principal and lower future interest charges."
                  : "Payments made under this option service your monthly accrued interest while keeping the principal tenure intact."}
              </div>
              <div style={{ fontWeight: 700 }}>
                {paymentType === "principal"
                  ? `Max Repayable: ${fmt(outstanding)}`
                  : `Monthly Interest: ${fmt(monthlyInterest)}`}
              </div>
            </div>

            <div className="form-grid">
              {/* Payment Amount */}
              <div className="form-group">
                <label style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Payment Amount (₹) *</span>
                  {amount && !isNaN(amount) && (
                    <span style={{ fontWeight: 500, color: "#0891b2" }}>
                      {paymentType === "principal" && (
                        <>New Balance: {fmt(Math.max(outstanding - parseFloat(amount), 0))}</>
                      )}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  placeholder={paymentType === "principal" ? `e.g. ${Math.min(25000, outstanding)}` : `e.g. ${monthlyInterest}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  style={{ fontSize: "1.1rem", fontWeight: 600 }}
                />

                {/* Quick Presets */}
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  {paymentType === "principal" ? (
                    <>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQuickAmount("25%")}>25%</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQuickAmount("50%")}>50%</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQuickAmount("100%")}>Full Payoff ({fmt(outstanding)})</button>
                      {selectedLoan.emi && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQuickAmount("emi")}>1 EMI ({fmt(selectedLoan.emi)})</button>
                      )}
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQuickAmount("1m")}>1 Month ({fmt(monthlyInterest)})</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQuickAmount("2m")}>2 Months ({fmt(monthlyInterest * 2)})</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQuickAmount("3m")}>3 Months ({fmt(monthlyInterest * 3)})</button>
                    </>
                  )}
                </div>
              </div>

              {/* Payment Mode */}
              <div className="form-group">
                <label>Payment Method *</label>
                <select
                  className="form-control"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  required
                >
                  <option value="UPI">UPI (Google Pay, PhonePe, Paytm, BHIM)</option>
                  <option value="Net Banking">Net Banking / Direct Debit</option>
                  <option value="Debit Card">Debit Card / ATM Card</option>
                  <option value="Bank Transfer">NEFT / RTGS / IMPS Bank Transfer</option>
                  <option value="Cheque / DD">Cheque / Demand Draft</option>
                </select>
              </div>

              {/* Transaction Reference No */}
              <div className="form-group">
                <label>Transaction / UTR Reference (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. UPI-984210984 or UTR10294819"
                  value={txnRef}
                  onChange={(e) => setTxnRef(e.target.value)}
                />
              </div>

              {/* Optional Proof / Receipt Upload */}
              <div className="form-group">
                <label>Payment Receipt / Screenshot (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProofChange}
                  className="form-control"
                  style={{ padding: "8px 12px" }}
                />
                {proofPreview && (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
                    <img
                      src={proofPreview}
                      alt="Proof Preview"
                      style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, border: "1px solid #e2e8f0" }}
                    />
                    <span style={{ fontSize: "0.8rem", color: "#10b981", fontWeight: 600 }}>✓ Receipt attached</span>
                  </div>
                )}
              </div>

              {/* Notes / Description */}
              <div className="form-group" style={{ gridColumn: "1/-1" }}>
                <label>Payment Notes / Remarks</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder={paymentType === "principal" ? "e.g. Part prepayment of loan principal for Q3" : "e.g. Regular monthly interest installment"}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Action Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, paddingTop: 18, borderTop: "1px solid #e2e8f0" }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => navigate("/utilization", { state: { loanId } })}
              >
                ← Back to Utilization Tracker
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || outstanding <= 0}
                style={{
                  padding: "12px 28px",
                  fontSize: "0.95rem",
                  background: paymentType === "principal"
                    ? "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)"
                    : "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)"
                }}
              >
                {submitting ? "Processing Payment..." : (
                  paymentType === "principal"
                    ? `Confirm Principal Repayment ${amount ? `(${fmt(amount)})` : ""}`
                    : `Confirm Interest Payment ${amount ? `(${fmt(amount)})` : ""}`
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
