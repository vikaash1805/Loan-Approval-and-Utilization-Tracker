import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/loanApi";
import {
  CreditCard,
  Banknote,
  Percent, 
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Receipt,
  Download,
  FileText,
  Landmark,
  Zap,
  TrendingDown,
  Sparkles,
  QrCode,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
  Sliders,
} from "lucide-react";

const fmt = (n) =>
  n !== undefined && n !== null
    ? `₹${Number(n || 0).toLocaleString("en-IN")}`
    : "₹0";

export default function LoanRepayment() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isOfficer } = useAuth();

  const initialLoanId = location.state?.loanId || "";
  const initialType = location.state?.paymentType || "emi";

  const [loanId, setLoanId] = useState(initialLoanId);
  const [loans, setLoans] = useState([]);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successReceipt, setSuccessReceipt] = useState(null);

  // Repayment Mode: "emi" (Amortized EMI), "principal" (Prepayment / Foreclosure), "interest" (Interest Servicing)
  const [paymentType, setPaymentType] = useState(initialType);
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [txnRef, setTxnRef] = useState("");
  const [notes, setNotes] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState("");

  // Amortization Schedule Drawer / View
  const [showAmortization, setShowAmortization] = useState(false);
  const [amortizationData, setAmortizationData] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

  // Load active loans
  const loadLoans = async () => {
    setLoading(true);
    setError("");
    try {
      const params = { status: "Disbursed", limit: 100 };
      if (!isOfficer && user?.email) {
        params.email = user.email;
      }
      const res = await api.getApplications(params);
      const appList = res.applications || [];
      setLoans(appList);

      if (initialLoanId) {
        const match = appList.find((l) => l._id === initialLoanId);
        if (match) {
          setSelectedLoan(match);
          setLoanId(match._id);
          if (initialType === "emi" && match.emi) {
            setAmount(String(Math.round(match.emi)));
          }
        }
      } else if (appList.length > 0 && !selectedLoan) {
        setSelectedLoan(appList[0]);
        setLoanId(appList[0]._id);
        if (appList[0].emi) {
          setAmount(String(Math.round(appList[0].emi)));
        }
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

  const handleLoanChange = (id) => {
    setLoanId(id);
    const match = loans.find((l) => l._id === id);
    setSelectedLoan(match || null);
    setSuccessReceipt(null);
    setAmortizationData(null);
    if (match && paymentType === "emi" && match.emi) {
      setAmount(String(Math.round(match.emi)));
    } else {
      setAmount("");
    }
  };

  // Calculations
  const outstanding = selectedLoan
    ? Number(selectedLoan.outstanding_balance ?? selectedLoan.approved_amount ?? selectedLoan.amount_requested ?? 0)
    : 0;
  const annualRate = selectedLoan ? Number(selectedLoan.interest_rate || 10.5) : 10.5;
  const monthlyInterest = round2((outstanding * (annualRate / 100)) / 12);
  const totalInterestPaid = selectedLoan ? Number(selectedLoan.total_interest_paid || 0) : 0;
  const totalPrincipalRepaid = selectedLoan ? Number(selectedLoan.total_repaid || 0) : 0;
  const standardEmi = selectedLoan ? Number(selectedLoan.emi || 0) : 0;

  // Live Component Breakdown Calculations
  const enteredAmount = parseFloat(amount) || 0;
  let livePrincipal = 0;
  let liveInterest = 0;
  let simulatedBalance = outstanding;

  if (paymentType === "emi") {
    if (enteredAmount <= monthlyInterest) {
      liveInterest = enteredAmount;
      livePrincipal = 0;
    } else {
      liveInterest = monthlyInterest;
      livePrincipal = Math.min(round2(enteredAmount - monthlyInterest), outstanding);
    }
    simulatedBalance = Math.max(0, round2(outstanding - livePrincipal));
  } else if (paymentType === "principal") {
    livePrincipal = Math.min(enteredAmount, outstanding);
    liveInterest = 0;
    simulatedBalance = Math.max(0, round2(outstanding - livePrincipal));
  } else if (paymentType === "interest") {
    liveInterest = enteredAmount;
    livePrincipal = 0;
    simulatedBalance = outstanding;
  }

  const principalPct =
    enteredAmount > 0 ? Math.min(100, round2((livePrincipal / enteredAmount) * 100)) : 0;
  const interestPct =
    enteredAmount > 0 ? Math.min(100, round2((liveInterest / enteredAmount) * 100)) : 0;

  const setQuickAmount = (type) => {
    if (!selectedLoan) return;
    if (paymentType === "emi") {
      if (type === "1x") setAmount(String(Math.round(standardEmi)));
      if (type === "2x") setAmount(String(Math.round(standardEmi * 2)));
      if (type === "3x") setAmount(String(Math.round(standardEmi * 3)));
      if (type === "100%") setAmount(String(Math.round(outstanding + monthlyInterest)));
    } else if (paymentType === "principal") {
      if (type === "25%") setAmount(String(Math.round(outstanding * 0.25)));
      if (type === "50%") setAmount(String(Math.round(outstanding * 0.5)));
      if (type === "100%") setAmount(String(Math.round(outstanding)));
    } else {
      if (type === "1m") setAmount(String(Math.round(monthlyInterest)));
      if (type === "3m") setAmount(String(Math.round(monthlyInterest * 3)));
      if (type === "6m") setAmount(String(Math.round(monthlyInterest * 6)));
    }
  };

  const handleModeChange = (mode) => {
    setPaymentType(mode);
    setError("");
    if (mode === "emi" && selectedLoan?.emi) {
      setAmount(String(Math.round(selectedLoan.emi)));
    } else if (mode === "interest") {
      setAmount(String(Math.round(monthlyInterest)));
    } else if (mode === "principal") {
      setAmount(String(Math.round(outstanding * 0.25)));
    } else {
      setAmount("");
    }
  };

  const loadAmortizationSchedule = async () => {
    if (!selectedLoan) return;
    if (amortizationData) {
      setShowAmortization(!showAmortization);
      return;
    }
    setScheduleLoading(true);
    try {
      const res = await api.getAmortization(selectedLoan._id);
      setAmortizationData(res.schedule || []);
      setShowAmortization(true);
    } catch (e) {
      setError("Unable to load amortization schedule: " + e.message);
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleProofChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setProofPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleRepaymentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLoan) return;
    const numAmt = parseFloat(amount);
    if (!numAmt || numAmt <= 0) {
      setError("Please enter a valid payment amount.");
      return;
    }

    if (paymentType === "principal" && numAmt > outstanding) {
      setError(`Principal payment cannot exceed current outstanding balance (${fmt(outstanding)}).`);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        loan_id: selectedLoan._id,
        amount: numAmt,
        payment_type: paymentType,
        payment_mode: paymentMode,
        transaction_ref: txnRef || `TXN-${Date.now().toString().slice(-6)}`,
        notes: notes || `Direct ${paymentType.toUpperCase()} repayment via FundMatrix`,
        proof_image: proofPreview || undefined,
      };

      const res = await api.repayLoan(payload);

      setSuccessReceipt({
        ...payload,
        date: new Date().toISOString(),
        previous_balance: outstanding,
        new_balance: res.new_balance ?? res.loan?.outstanding_balance ?? simulatedBalance,
        principal_component: res.principal_component ?? livePrincipal,
        interest_component: res.interest_component ?? liveInterest,
        total_interest_paid: res.total_interest_paid ?? (totalInterestPaid + liveInterest),
        total_repaid: res.total_repaid ?? (totalPrincipalRepaid + livePrincipal),
        loan_type: selectedLoan.loan_type,
        applicant_name: selectedLoan.applicant_name,
      });

      // Refresh loans data
      loadLoans();
      setAmortizationData(null);
    } catch (err) {
      setError(err.message || "Repayment processing failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: 900, margin: "0 auto", paddingBottom: 40 }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1>Loan Repayment & EMI Processing</h1>
        <p>
          Standard reducing-balance amortization with automatic Principal vs. Interest component separation
        </p>
      </div>

      {loading && <div className="spinner" />}
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loans.length === 0 && !loading && (
        <div className="card empty">
          <div className="empty-icon">💳</div>
          <h3>No Active Disbursed Loans</h3>
          <p style={{ marginTop: 6, fontSize: "0.88rem" }}>
            You currently do not have any active loans eligible for repayment.
          </p>
          <button className="btn btn-accent" style={{ marginTop: 16 }} onClick={() => navigate("/apply")}>
            Apply for a Loan
          </button>
        </div>
      )}

      {selectedLoan && (
        <>
          {/* Active Facility Card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Landmark size={20} color="#06B6D4" />
                <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0F172A" }}>
                  Active Credit Facility
                </span>
                <span className="badge badge-disbursed">Disbursed & Active</span>
              </div>
              <select
                className="form-control"
                style={{ maxWidth: 360, fontWeight: 700 }}
                value={loanId}
                onChange={(e) => handleLoanChange(e.target.value)}
              >
                {loans.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.loan_type} Loan — {fmt(l.approved_amount || l.amount_requested)} ({l.tenure_months}m @ {l.interest_rate}%)
                  </option>
                ))}
              </select>
            </div>

            {/* Account Metrics Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 12,
              }}
            >
              <div
                style={{
                  background: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)",
                  border: "1px solid #E2E8F0",
                  padding: "14px 16px",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <span style={{ fontSize: "0.72rem", color: "#64748B", textTransform: "uppercase", fontWeight: 800 }}>
                  Outstanding Principal
                </span>
                <div style={{ fontFamily: "Outfit", fontSize: "1.45rem", fontWeight: 800, color: "#0F172A", marginTop: 2 }}>
                  {fmt(outstanding)}
                </div>
              </div>

              <div
                style={{
                  background: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)",
                  border: "1px solid #E2E8F0",
                  padding: "14px 16px",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <span style={{ fontSize: "0.72rem", color: "#64748B", textTransform: "uppercase", fontWeight: 800 }}>
                  Fixed Monthly EMI
                </span>
                <div style={{ fontFamily: "Outfit", fontSize: "1.45rem", fontWeight: 800, color: "#0891B2", marginTop: 2 }}>
                  {fmt(standardEmi)}
                </div>
              </div>

              <div
                style={{
                  background: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)",
                  border: "1px solid #E2E8F0",
                  padding: "14px 16px",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <span style={{ fontSize: "0.72rem", color: "#64748B", textTransform: "uppercase", fontWeight: 800 }}>
                  Current Monthly Interest ({annualRate}%)
                </span>
                <div style={{ fontFamily: "Outfit", fontSize: "1.45rem", fontWeight: 800, color: "#F59E0B", marginTop: 2 }}>
                  {fmt(monthlyInterest)}
                </div>
              </div>

              <div
                style={{
                  background: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)",
                  border: "1px solid #E2E8F0",
                  padding: "14px 16px",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <span style={{ fontSize: "0.72rem", color: "#64748B", textTransform: "uppercase", fontWeight: 800 }}>
                  Total Principal Repaid
                </span>
                <div style={{ fontFamily: "Outfit", fontSize: "1.45rem", fontWeight: 800, color: "#10B981", marginTop: 2 }}>
                  {fmt(totalPrincipalRepaid)}
                </div>
              </div>

              <div
                style={{
                  background: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)",
                  border: "1px solid #E2E8F0",
                  padding: "14px 16px",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <span style={{ fontSize: "0.72rem", color: "#64748B", textTransform: "uppercase", fontWeight: 800 }}>
                  Cumulative Interest Serviced
                </span>
                <div style={{ fontFamily: "Outfit", fontSize: "1.45rem", fontWeight: 800, color: "#8B5CF6", marginTop: 2 }}>
                  {fmt(totalInterestPaid)}
                </div>
              </div>
            </div>

            {/* Toggle Amortization Schedule Button */}
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={loadAmortizationSchedule}
                disabled={scheduleLoading}
                style={{ display: "flex", alignItems: "center", gap: 6, color: "#0891B2", fontWeight: 700 }}
              >
                {scheduleLoading ? (
                  <RefreshCw size={14} style={{ animation: "spin 0.8s linear infinite" }} />
                ) : (
                  <Layers size={14} />
                )}
                {showAmortization ? "Hide Amortization Schedule" : "View Month-by-Month Amortization Schedule"}
                {showAmortization ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {/* Amortization Schedule Expandable Drawer */}
            {showAmortization && (
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  background: "#F8FAFC",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid #E2E8F0",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "0.95rem", color: "#0F172A", fontWeight: 800 }}>
                      Loan Amortization Schedule ({selectedLoan.tenure_months} Months @ {annualRate}% p.a.)
                    </h4>
                    <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#64748B" }}>
                      Notice how in early months the Interest portion is larger, and over time more of each payment pays down the Principal.
                    </p>
                  </div>
                </div>

                <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid #E2E8F0", borderRadius: "var(--radius-sm)" }}>
                  <table className="table" style={{ fontSize: "0.8rem", margin: 0 }}>
                    <thead style={{ position: "sticky", top: 0, background: "#F1F5F9", zIndex: 1 }}>
                      <tr>
                        <th>Month #</th>
                        <th>Opening Principal</th>
                        <th>Monthly EMI</th>
                        <th style={{ color: "#059669" }}>Principal Portion</th>
                        <th style={{ color: "#D97706" }}>Interest Portion</th>
                        <th>Closing Balance</th>
                        <th>Cumul. Interest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(amortizationData || []).map((row) => (
                        <tr key={row.month}>
                          <td style={{ fontWeight: 700 }}>Month {row.month}</td>
                          <td>{fmt(row.opening_balance)}</td>
                          <td style={{ fontWeight: 700 }}>{fmt(row.emi)}</td>
                          <td style={{ color: "#059669", fontWeight: 700 }}>+{fmt(row.principal_portion)}</td>
                          <td style={{ color: "#D97706", fontWeight: 700 }}>{fmt(row.interest_portion)}</td>
                          <td style={{ fontWeight: 800 }}>{fmt(row.closing_balance)}</td>
                          <td style={{ color: "#64748B" }}>{fmt(row.cumulative_interest)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Repayment Terminal */}
          <div className="card">
            {/* 3-Mode Selector */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                background: "#F1F5F9",
                padding: 4,
                borderRadius: "var(--radius-md)",
                marginBottom: 20,
                gap: 4,
              }}
            >
              {/* Option 1: Pay EMI */}
              <button
                type="button"
                onClick={() => handleModeChange("emi")}
                style={{
                  padding: "10px 14px",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  background: paymentType === "emi" ? "#FFFFFF" : "transparent",
                  color: paymentType === "emi" ? "#0F172A" : "#64748B",
                  fontWeight: 800,
                  fontSize: "0.86rem",
                  cursor: "pointer",
                  boxShadow: paymentType === "emi" ? "0 2px 6px rgba(15, 23, 42, 0.08)" : "none",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <CreditCard size={16} color="#06B6D4" />
                <span>Pay Monthly EMI</span>
                {paymentType === "emi" && (
                  <span
                    style={{
                      background: "#ECFEFF",
                      color: "#0891B2",
                      fontSize: "0.68rem",
                      fontWeight: 800,
                      padding: "2px 6px",
                      borderRadius: 10,
                      border: "1px solid #A5F3FC",
                    }}
                  >
                    Recommended
                  </span>
                )}
              </button>

              {/* Option 2: Prepay Principal */}
              <button
                type="button"
                onClick={() => handleModeChange("principal")}
                style={{
                  padding: "10px 14px",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  background: paymentType === "principal" ? "#FFFFFF" : "transparent",
                  color: paymentType === "principal" ? "#0F172A" : "#64748B",
                  fontWeight: 800,
                  fontSize: "0.86rem",
                  cursor: "pointer",
                  boxShadow: paymentType === "principal" ? "0 2px 6px rgba(15, 23, 42, 0.08)" : "none",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Banknote size={16} color="#10B981" />
                <span>Principal Prepayment</span>
              </button>

              {/* Option 3: Pay Interest */}
              <button
                type="button"
                onClick={() => handleModeChange("interest")}
                style={{
                  padding: "10px 14px",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  background: paymentType === "interest" ? "#FFFFFF" : "transparent",
                  color: paymentType === "interest" ? "#0F172A" : "#64748B",
                  fontWeight: 800,
                  fontSize: "0.86rem",
                  cursor: "pointer",
                  boxShadow: paymentType === "interest" ? "0 2px 6px rgba(15, 23, 42, 0.08)" : "none",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Percent size={16} color="#F59E0B" />
                <span>Pay Accrued Interest</span>
              </button>
            </div>

            {/* Mode Explanation Notice */}
            <div
              style={{
                padding: "10px 14px",
                background:
                  paymentType === "emi"
                    ? "#EFF6FF"
                    : paymentType === "principal"
                    ? "#ECFDF5"
                    : "#FFFBEB",
                border: `1px solid ${
                  paymentType === "emi"
                    ? "#BFDBFE"
                    : paymentType === "principal"
                    ? "#A7F3D0"
                    : "#FDE68A"
                }`,
                borderRadius: "var(--radius-md)",
                marginBottom: 18,
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                fontSize: "0.82rem",
                color:
                  paymentType === "emi"
                    ? "#1E40AF"
                    : paymentType === "principal"
                    ? "#065F46"
                    : "#92400E",
              }}
            >
              <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                {paymentType === "emi" && (
                  <>
                    <strong>Equated Monthly Instalment (EMI) Breakdown: </strong>
                    Each EMI payment contains two parts: <em>Interest</em> (the borrowing cost charged on current principal) and <em>Principal</em> (the actual money borrowed). In the beginning, a larger part goes toward interest; as principal reduces, more of your EMI pays down the principal balance.
                  </>
                )}
                {paymentType === "principal" && (
                  <>
                    <strong>Direct Principal Prepayment / Foreclosure: </strong>
                    100% of this payment will be deducted directly from your principal debt balance, saving future interest charges and accelerating loan payoff.
                  </>
                )}
                {paymentType === "interest" && (
                  <>
                    <strong>Standalone Interest Servicing: </strong>
                    Service monthly or accrued interest fees without affecting the underlying principal balance.
                  </>
                )}
              </div>
            </div>

            <form onSubmit={handleRepaymentSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Preset Buttons */}
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: 6, display: "block" }}>
                  Quick Amount Presets:
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {paymentType === "emi" && (
                    <>
                      <button
                        type="button"
                        className="btn btn-outline-accent btn-sm"
                        onClick={() => setQuickAmount("1x")}
                      >
                        ⚡ 1 Month EMI ({fmt(Math.round(standardEmi))})
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setQuickAmount("2x")}
                      >
                        2 Months EMI ({fmt(Math.round(standardEmi * 2))})
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setQuickAmount("3x")}
                      >
                        3 Months EMI ({fmt(Math.round(standardEmi * 3))})
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setQuickAmount("100%")}
                      >
                        Full Payoff ({fmt(Math.round(outstanding + monthlyInterest))})
                      </button>
                    </>
                  )}

                  {paymentType === "principal" && (
                    <>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQuickAmount("25%")}>
                        25% ({fmt(Math.round(outstanding * 0.25))})
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQuickAmount("50%")}>
                        50% ({fmt(Math.round(outstanding * 0.5))})
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-accent btn-sm"
                        onClick={() => setQuickAmount("100%")}
                      >
                        ⚡ 100% Full Foreclosure ({fmt(outstanding)})
                      </button>
                    </>
                  )}

                  {paymentType === "interest" && (
                    <>
                      <button type="button" className="btn btn-outline-accent btn-sm" onClick={() => setQuickAmount("1m")}>
                        1 Month ({fmt(Math.round(monthlyInterest))})
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQuickAmount("3m")}>
                        3 Months ({fmt(Math.round(monthlyInterest * 3))})
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQuickAmount("6m")}>
                        6 Months ({fmt(Math.round(monthlyInterest * 6))})
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Amount Input */}
              <div className="form-group">
                <label>
                  Payment Amount (₹) *
                  {paymentType === "emi" && (
                    <span style={{ fontSize: "0.76rem", color: "#64748B", fontWeight: 500, marginLeft: 8 }}>
                      (Standard Monthly EMI: {fmt(standardEmi)})
                    </span>
                  )}
                </label>
                <input
                  className="form-control"
                  type="number"
                  placeholder="Enter payment amount in ₹"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{ fontSize: "1.15rem", fontWeight: 700 }}
                  min="1"
                  step="any"
                />
              </div>

              {/* Live Simulator & Breakdown Card */}
              {enteredAmount > 0 && (
                <div
                  style={{
                    background: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)",
                    border: "1px solid #CBD5E1",
                    borderRadius: "var(--radius-md)",
                    padding: "16px 18px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Payment Component Breakdown
                    </span>
                    <span style={{ fontSize: "0.84rem", color: "#64748B" }}>
                      Total Payment: <strong style={{ color: "#0F172A" }}>{fmt(enteredAmount)}</strong>
                    </span>
                  </div>

                  {/* Component Breakdown Ratio Bar (For EMI) */}
                  {paymentType === "emi" && (
                    <div style={{ marginBottom: 14 }}>
                      <div
                        style={{
                          height: 12,
                          width: "100%",
                          background: "#E2E8F0",
                          borderRadius: 8,
                          overflow: "hidden",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            width: `${principalPct}%`,
                            background: "#10B981",
                            transition: "width 0.3s ease",
                          }}
                          title={`Principal Reduction: ${principalPct}%`}
                        />
                        <div
                          style={{
                            width: `${interestPct}%`,
                            background: "#F59E0B",
                            transition: "width 0.3s ease",
                          }}
                          title={`Interest Fee: ${interestPct}%`}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          marginTop: 4,
                        }}
                      >
                        <span style={{ color: "#059669", display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981" }} />
                          Principal Component: {principalPct}% ({fmt(livePrincipal)})
                        </span>
                        <span style={{ color: "#D97706", display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B" }} />
                          Interest Component: {interestPct}% ({fmt(liveInterest)})
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Key Financial Impact Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <div
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: "var(--radius-sm)",
                        padding: "10px 12px",
                      }}
                    >
                      <span style={{ fontSize: "0.72rem", color: "#059669", fontWeight: 800, textTransform: "uppercase" }}>
                        Principal Reduction
                      </span>
                      <div style={{ fontFamily: "Outfit", fontSize: "1.2rem", fontWeight: 800, color: "#10B981", marginTop: 2 }}>
                        -{fmt(livePrincipal)}
                      </div>
                      <span style={{ fontSize: "0.7rem", color: "#64748B" }}>Reduces loan balance</span>
                    </div>

                    <div
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: "var(--radius-sm)",
                        padding: "10px 12px",
                      }}
                    >
                      <span style={{ fontSize: "0.72rem", color: "#D97706", fontWeight: 800, textTransform: "uppercase" }}>
                        Interest Fee Paid
                      </span>
                      <div style={{ fontFamily: "Outfit", fontSize: "1.2rem", fontWeight: 800, color: "#F59E0B", marginTop: 2 }}>
                        {fmt(liveInterest)}
                      </div>
                      <span style={{ fontSize: "0.7rem", color: "#64748B" }}>Accrued finance charge</span>
                    </div>

                    <div
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: "var(--radius-sm)",
                        padding: "10px 12px",
                      }}
                    >
                      <span style={{ fontSize: "0.72rem", color: "#0891B2", fontWeight: 800, textTransform: "uppercase" }}>
                        New Principal Balance
                      </span>
                      <div style={{ fontFamily: "Outfit", fontSize: "1.2rem", fontWeight: 800, color: "#0F172A", marginTop: 2 }}>
                        {fmt(simulatedBalance)}
                      </div>
                      <span style={{ fontSize: "0.7rem", color: "#64748B" }}>
                        {simulatedBalance === 0 ? "🎉 Loan Fully Paid!" : "Remaining debt"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Mode Selector */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label>Payment Method</label>
                  <select
                    className="form-control"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                  >
                    <option value="UPI">Instant UPI (GPay / PhonePe / Paytm / BHIM)</option>
                    <option value="Net Banking">Net Banking / IMPS / NEFT</option>
                    <option value="Debit Card">Corporate / Savings Debit Card</option>
                    <option value="Wire Transfer">RTGS / Wire Transfer</option>
                    <option value="Auto-Debit NACH">Auto-Debit e-NACH / Mandate</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Transaction Reference (Optional)</label>
                  <input
                    className="form-control"
                    placeholder="Enter transaction reference / UTR number"
                    value={txnRef}
                    onChange={(e) => setTxnRef(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Payment Remarks</label>
                <input
                  className="form-control"
                  placeholder={`Enter remarks for ${paymentType.toUpperCase()} payment`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-accent btn-lg"
                style={{ marginTop: 10 }}
                disabled={submitting || !enteredAmount}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} style={{ animation: "spin 0.8s linear infinite" }} /> Processing Payment...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} /> Confirm {fmt(enteredAmount)} {paymentType.toUpperCase()} Payment
                  </>
                )}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Digital Receipt Modal with QR Watermark */}
      {successReceipt && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 540 }}>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: "50%",
                  background: "#ECFDF5",
                  color: "#10B981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 10px",
                }}
              >
                <CheckCircle2 size={32} />
              </div>
              <h3 style={{ marginBottom: 4 }}>Repayment Successful!</h3>
              <p style={{ fontSize: "0.85rem", color: "#64748B" }}>
                Digital receipt generated and credited with amortized principal deduction.
              </p>
            </div>

            {/* Receipt Box */}
            <div
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "var(--radius-md)",
                padding: "18px 20px",
                marginBottom: 20,
                position: "relative",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.84rem" }}>
                <span style={{ color: "#64748B" }}>Transaction Ref</span>
                <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{successReceipt.transaction_ref}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.84rem" }}>
                <span style={{ color: "#64748B" }}>Payment Mode</span>
                <span style={{ fontWeight: 700 }}>{successReceipt.payment_mode}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.84rem" }}>
                <span style={{ color: "#64748B" }}>Payment Type</span>
                <span className="badge badge-indigo" style={{ fontSize: "0.72rem", textTransform: "uppercase" }}>
                  {successReceipt.payment_type}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.95rem" }}>
                <span style={{ color: "#0F172A", fontWeight: 700 }}>Total Amount Paid</span>
                <span style={{ fontWeight: 800, color: "#0F172A" }}>{fmt(successReceipt.amount)}</span>
              </div>

              {/* Itemized Split */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 12px",
                  margin: "10px 0",
                  fontSize: "0.82rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "#059669", fontWeight: 700 }}>✓ Principal Deducted</span>
                  <span style={{ fontWeight: 800, color: "#10B981" }}>{fmt(successReceipt.principal_component)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#D97706", fontWeight: 700 }}>✓ Interest Fee Serviced</span>
                  <span style={{ fontWeight: 800, color: "#F59E0B" }}>{fmt(successReceipt.interest_component)}</span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: 10,
                  borderTop: "1px solid #E2E8F0",
                  fontSize: "0.86rem",
                }}
              >
                <span style={{ color: "#64748B" }}>New Outstanding Principal</span>
                <span style={{ fontWeight: 800, color: "#0F172A" }}>{fmt(successReceipt.new_balance)}</span>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setSuccessReceipt(null)}>
                Close
              </button>
              <button
                className="btn btn-accent"
                onClick={() => {
                  window.print();
                }}
              >
                <Download size={14} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
