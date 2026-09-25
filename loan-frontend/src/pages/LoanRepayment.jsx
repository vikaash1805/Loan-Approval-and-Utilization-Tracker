import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/loanApi";
import fundmatrixLogo from "../assets/fundmatrix_logo.png";
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
  User,
  Phone,
  Mail,
  Clock,
  CalendarCheck,
  CheckCircle,
} from "lucide-react";

const fmt = (n) =>
  n !== undefined && n !== null
    ? `₹${Number(n || 0).toLocaleString("en-IN")}`
    : "₹0";

const maskAadhaar = (num) => {
  if (!num) return "Verified (KYC UID)";
  const clean = String(num).replace(/\D/g, "");
  if (clean.length >= 4) {
    return `•••• •••• ${clean.slice(-4)}`;
  }
  return clean || "Verified (KYC UID)";
};

const maskPan = (pan) => {
  if (!pan) return "Verified (KYC PAN)";
  const clean = String(pan).toUpperCase().trim();
  if (clean.length === 10) {
    return `${clean.slice(0, 2)}•••••${clean.slice(-3)}`;
  }
  return clean || "Verified (KYC PAN)";
};

const formatDurationServiced = (startDateStr, endDateStr = new Date()) => {
  if (!startDateStr) return "1 Month Active";
  try {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const diffMs = Math.max(0, end.getTime() - start.getTime());
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffMonths = Math.max(
      1,
      (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
    );
    if (diffDays < 30) {
      return `${diffDays} Day${diffDays === 1 ? "" : "s"} (Month 1)`;
    }
    return `${diffMonths} Month${diffMonths === 1 ? "" : "s"} (${diffDays} Days)`;
  } catch (_) {
    return "1 Month Active";
  }
};

const getMaturityDate = (startDateStr, tenureMonths) => {
  try {
    const start = startDateStr ? new Date(startDateStr) : new Date();
    const maturity = new Date(start);
    maturity.setMonth(maturity.getMonth() + Number(tenureMonths || 12));
    return maturity.toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    });
  } catch (_) {
    return "N/A";
  }
};

const formatDate = (dateStr) => {
  if (!dateStr) return "N/A";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch (_) {
    return dateStr;
  }
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return "N/A";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return dateStr;
  }
};

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
  const [loanHistory, setLoanHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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
  const [scheduleViewMode, setScheduleViewMode] = useState("window"); // "window" = prev/current/next, "all" = all months

  const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

  const getCurrentMonthIndex = () => {
    if (!selectedLoan) return 1;
    const startStr = selectedLoan.disbursed_at || selectedLoan.applied_at || selectedLoan.created_at;
    if (startStr) {
      const start = new Date(startStr);
      const now = new Date();
      const diff = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1;
      const tenure = selectedLoan.tenure_months || 12;
      return Math.min(Math.max(diff, 1), tenure);
    }
    return 1;
  };

  const currentMonthIndex = getCurrentMonthIndex();

  const displayedSchedule = useMemo(() => {
    if (!amortizationData || amortizationData.length === 0) return [];
    if (scheduleViewMode === "all") return amortizationData;

    let targetMonths = [currentMonthIndex - 1, currentMonthIndex, currentMonthIndex + 1];
    if (currentMonthIndex <= 1) {
      targetMonths = [1, 2, 3];
    } else if (currentMonthIndex >= amortizationData.length) {
      targetMonths = [amortizationData.length - 2, amortizationData.length - 1, amortizationData.length];
    }

    return amortizationData.filter((row) => targetMonths.includes(row.month));
  }, [amortizationData, currentMonthIndex, scheduleViewMode]);

  // Load repayment history for selected loan
  const loadLoanHistory = async (id) => {
    if (!id) {
      setLoanHistory([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await api.getUtilization(id);
      const events = res.events || [];
      const paymentEvents = events.filter((e) =>
        ["EMI Payment", "Principal Repayment", "Interest Payment"].includes(e.event_type) ||
        ["emi", "principal", "interest"].includes(e.payment_type)
      );
      setLoanHistory(paymentEvents);
    } catch (_) {
      setLoanHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

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
          loadLoanHistory(match._id);
          if (initialType === "emi" && match.emi) {
            setAmount(String(Math.round(match.emi)));
          }
        }
      } else if (appList.length > 0 && !selectedLoan) {
        setSelectedLoan(appList[0]);
        setLoanId(appList[0]._id);
        loadLoanHistory(appList[0]._id);
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
    if (match) {
      loadLoanHistory(match._id);
    } else {
      setLoanHistory([]);
    }
    if (match && paymentType === "emi" && match.emi) {
      setAmount(String(Math.round(match.emi)));
    } else {
      setAmount("");
    }
  };

  // View past receipt from history
  const handleViewReceipt = (event) => {
    if (!selectedLoan) return;
    const sanctioned = Number(selectedLoan.approved_amount || selectedLoan.amount_requested || 0);
    const tenure = Number(selectedLoan.tenure_months || 12);
    const startStr = selectedLoan.disbursed_at || selectedLoan.applied_at || selectedLoan.created_at;
    const eventDate = event.event_date || event.created_at || new Date().toISOString();

    const sorted = [...loanHistory].sort(
      (a, b) => new Date(a.event_date || a.created_at) - new Date(b.event_date || b.created_at)
    );
    const idx = sorted.findIndex((e) => e._id === event._id);
    const installmentNumber = idx >= 0 ? idx + 1 : 1;
    const priorBalance = Number(event.balance_remaining || 0) + Number(event.principal_component || 0);

    setSuccessReceipt({
      receipt_no: event.receipt_no || `FMX-RCP-${String(event._id || Date.now()).slice(-8).toUpperCase()}`,
      transaction_ref: event.transaction_ref || `TXN-${String(event._id || Date.now()).slice(-6).toUpperCase()}`,
      date: eventDate,
      payment_mode: event.payment_mode || "UPI",
      payment_type:
        event.payment_type ||
        (event.event_type?.toLowerCase().includes("principal")
          ? "principal"
          : event.event_type?.toLowerCase().includes("interest")
          ? "interest"
          : "emi"),
      amount: event.amount,
      principal_component: event.principal_component ?? 0,
      interest_component: event.interest_component ?? 0,
      previous_balance: priorBalance,
      new_balance: event.balance_remaining ?? 0,
      notes: event.notes || `Direct repayment on ${selectedLoan.loan_type} loan`,
      // Customer Details
      customer_name: selectedLoan.applicant_name || user?.name || "Customer",
      customer_email: selectedLoan.email || user?.email || "customer@fundmatrix.in",
      customer_phone: selectedLoan.phone || user?.phone || "N/A",
      customer_aadhaar: selectedLoan.aadhaar_number || "",
      customer_pan: selectedLoan.pan_number || "",
      customer_dob: selectedLoan.dob || "",
      customer_gender: selectedLoan.gender || "",
      customer_id: `CUST-${(selectedLoan._id || "").slice(-6).toUpperCase()}`,
      // Loan Details
      loan_id: selectedLoan._id,
      loan_type: selectedLoan.loan_type,
      sanctioned_amount: sanctioned,
      interest_rate: selectedLoan.interest_rate || 10.5,
      tenure_months: tenure,
      emi_amount: selectedLoan.emi || 0,
      loan_purpose: selectedLoan.purpose || "Credit Facility",
      disbursed_at: startStr,
      // Repayment Progress & Tenure
      months_paid: installmentNumber,
      months_remaining: Math.max(0, tenure - installmentNumber),
      how_long_paid: formatDurationServiced(startStr, eventDate),
      maturity_date: getMaturityDate(startStr, tenure),
      total_principal_repaid: selectedLoan.total_repaid || 0,
      total_interest_paid: selectedLoan.total_interest_paid || 0,
      total_amount_paid: Number(selectedLoan.total_repaid || 0) + Number(selectedLoan.total_interest_paid || 0),
      repayment_progress_pct:
        sanctioned > 0 ? (((selectedLoan.total_repaid || 0) / sanctioned) * 100).toFixed(1) : 0,
      loan_status: selectedLoan.status || "Disbursed",
    });
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
      if (file.size > 5 * 1024 * 1024) {
        setError("Payment receipt image exceeds 5 MB limit. Please upload a smaller file.");
        return;
      }
      setProofFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setProofPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleRepaymentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLoan) {
      setError("Please select an active loan to service repayment.");
      return;
    }

    if (outstanding <= 0) {
      setError("This loan is already fully settled with ₹0 outstanding balance.");
      return;
    }

    const numAmt = parseFloat(amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      setError("Please enter a valid payment amount greater than ₹0.");
      return;
    }

    if (paymentType === "principal" && numAmt > outstanding) {
      setError(`Principal payment cannot exceed current outstanding balance (${fmt(outstanding)}).`);
      return;
    }

    if (paymentType === "emi" && numAmt > (outstanding + monthlyInterest) * 1.5) {
      setError(`EMI payment amount cannot excessively exceed total remaining liability (${fmt(outstanding + monthlyInterest)}).`);
      return;
    }

    if (paymentType === "interest" && numAmt > monthlyInterest * 12 && monthlyInterest > 0) {
      setError(`Interest payment cannot exceed 12 months accrued interest (${fmt(monthlyInterest * 12)}).`);
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

      const sanctioned = Number(selectedLoan.approved_amount || selectedLoan.amount_requested || 0);
      const tenure = Number(selectedLoan.tenure_months || 12);
      const startStr = selectedLoan.disbursed_at || selectedLoan.applied_at || selectedLoan.created_at;

      const pastEmiCount = loanHistory.filter(
        (e) => e.event_type === "EMI Payment" || e.payment_type === "emi"
      ).length;
      const isEmi = paymentType === "emi";
      const newTotalRepaid = res.total_repaid ?? (totalPrincipalRepaid + livePrincipal);
      const newTotalInterest = res.total_interest_paid ?? (totalInterestPaid + liveInterest);
      const newBalanceVal = res.new_balance ?? res.loan?.outstanding_balance ?? simulatedBalance;

      let computedMonthsPaid = pastEmiCount + (isEmi ? 1 : 0);
      if (sanctioned > 0) {
        const amortizedMonths = Math.min(
          tenure,
          Math.max(1, Math.round((newTotalRepaid / sanctioned) * tenure))
        );
        computedMonthsPaid = Math.max(computedMonthsPaid, amortizedMonths);
      }
      if (newBalanceVal <= 0) {
        computedMonthsPaid = tenure;
      }
      const computedMonthsRemaining = Math.max(0, tenure - computedMonthsPaid);
      const progressVal =
        sanctioned > 0 ? Math.min(100, (newTotalRepaid / sanctioned) * 100).toFixed(1) : 0;
      const howLongText = formatDurationServiced(startStr, new Date());
      const maturityText = getMaturityDate(startStr, tenure);

      const rSummary = res.repayment_summary || {};

      setSuccessReceipt({
        receipt_no: res.receipt?.receipt_no || `FMX-RCP-${Date.now().toString().slice(-8)}`,
        ...payload,
        date: new Date().toISOString(),
        previous_balance: outstanding,
        new_balance: newBalanceVal,
        principal_component: res.principal_component ?? livePrincipal,
        interest_component: res.interest_component ?? liveInterest,
        total_interest_paid: newTotalInterest,
        total_repaid: newTotalRepaid,
        total_amount_paid: Number(newTotalRepaid) + Number(newTotalInterest),
        // Customer Details
        customer_name: selectedLoan.applicant_name || user?.name || "Customer",
        customer_email: selectedLoan.email || user?.email || "customer@fundmatrix.in",
        customer_phone: selectedLoan.phone || user?.phone || "N/A",
        customer_aadhaar: selectedLoan.aadhaar_number || "",
        customer_pan: selectedLoan.pan_number || "",
        customer_dob: selectedLoan.dob || "",
        customer_gender: selectedLoan.gender || "",
        customer_id: `CUST-${(selectedLoan._id || "").slice(-6).toUpperCase()}`,
        // Loan Details
        loan_id: selectedLoan._id,
        loan_type: selectedLoan.loan_type,
        sanctioned_amount: sanctioned,
        interest_rate: annualRate,
        tenure_months: tenure,
        emi_amount: standardEmi,
        loan_purpose: selectedLoan.purpose || "Credit Facility",
        disbursed_at: startStr,
        // Repayment Progress & Tenure
        months_paid: rSummary.months_paid ?? computedMonthsPaid,
        months_remaining: rSummary.months_remaining ?? computedMonthsRemaining,
        how_long_paid: rSummary.duration_days
          ? `${rSummary.duration_months} Month(s) (${rSummary.duration_days} Days)`
          : howLongText,
        maturity_date: maturityText,
        repayment_progress_pct: rSummary.repayment_progress_pct ?? progressVal,
        loan_status: newBalanceVal <= 0 ? "Closed / Settled" : selectedLoan.status || "Disbursed",
      });

      // Refresh loans data & history
      loadLoans();
      loadLoanHistory(selectedLoan._id);
      setAmortizationData(null);
    } catch (err) {
      setError(err.message || "Repayment processing failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: 900, margin: "0 auto", paddingBottom: 40 }}>
      {/* Main Page Body (hidden during print when receipt modal is active) */}
      <div className={successReceipt ? "no-print" : ""}>
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "0.95rem", color: "#0F172A", fontWeight: 800 }}>
                      Loan Amortization Schedule {scheduleViewMode === "window" ? "(Previous, Current & Next Month)" : `(${selectedLoan.tenure_months} Months @ ${annualRate}% p.a.)`}
                    </h4>
                    <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#64748B" }}>
                      {scheduleViewMode === "window"
                        ? `Showing 3-month repayment window: Month ${Math.max(1, currentMonthIndex - 1)} (Previous), Month ${currentMonthIndex} (Current Active), and Month ${Math.min(selectedLoan.tenure_months || 12, currentMonthIndex + 1)} (Next).`
                        : "Notice how in early months the Interest portion is larger, and over time more of each payment pays down the Principal."}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => setScheduleViewMode("window")}
                      style={{
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        padding: "5px 12px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid",
                        borderColor: scheduleViewMode === "window" ? "#06B6D4" : "#CBD5E1",
                        background: scheduleViewMode === "window" ? "#ECFEFF" : "#FFFFFF",
                        color: scheduleViewMode === "window" ? "#0891B2" : "#64748B",
                        cursor: "pointer",
                        boxShadow: scheduleViewMode === "window" ? "0 1px 3px rgba(6, 182, 212, 0.15)" : "none",
                      }}
                    >
                      3-Month Window
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleViewMode("all")}
                      style={{
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        padding: "5px 12px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid",
                        borderColor: scheduleViewMode === "all" ? "#06B6D4" : "#CBD5E1",
                        background: scheduleViewMode === "all" ? "#ECFEFF" : "#FFFFFF",
                        color: scheduleViewMode === "all" ? "#0891B2" : "#64748B",
                        cursor: "pointer",
                        boxShadow: scheduleViewMode === "all" ? "0 1px 3px rgba(6, 182, 212, 0.15)" : "none",
                      }}
                    >
                      All {selectedLoan.tenure_months || 12} Months
                    </button>
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
                      {displayedSchedule.map((row) => {
                        const isCurrent = row.month === currentMonthIndex;
                        const isPrev = row.month === currentMonthIndex - 1;
                        const isNext = row.month === currentMonthIndex + 1;

                        return (
                          <tr
                            key={row.month}
                            style={{
                              background: isCurrent ? "#F0FDF4" : isPrev ? "#F8FAFC" : "#FFFFFF",
                              borderLeft: isCurrent ? "4px solid #059669" : "4px solid transparent",
                            }}
                          >
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 800 }}>Month {row.month}</span>
                                {isCurrent && (
                                  <span
                                    style={{
                                      fontSize: "0.65rem",
                                      fontWeight: 800,
                                      padding: "2px 6px",
                                      borderRadius: 4,
                                      background: "#059669",
                                      color: "#FFFFFF",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.5px",
                                    }}
                                  >
                                    Current
                                  </span>
                                )}
                                {isPrev && (
                                  <span
                                    style={{
                                      fontSize: "0.65rem",
                                      fontWeight: 700,
                                      padding: "2px 6px",
                                      borderRadius: 4,
                                      background: "#E2E8F0",
                                      color: "#475569",
                                      textTransform: "uppercase",
                                    }}
                                  >
                                    Previous
                                  </span>
                                )}
                                {isNext && (
                                  <span
                                    style={{
                                      fontSize: "0.65rem",
                                      fontWeight: 700,
                                      padding: "2px 6px",
                                      borderRadius: 4,
                                      background: "#EFF6FF",
                                      color: "#2563EB",
                                      textTransform: "uppercase",
                                    }}
                                  >
                                    Next
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ fontWeight: isCurrent ? 700 : 500 }}>{fmt(row.opening_balance)}</td>
                            <td style={{ fontWeight: 800, color: isCurrent ? "#059669" : "inherit" }}>{fmt(row.emi)}</td>
                            <td style={{ color: "#059669", fontWeight: 700 }}>+{fmt(row.principal_portion)}</td>
                            <td style={{ color: "#D97706", fontWeight: 700 }}>{fmt(row.interest_portion)}</td>
                            <td style={{ fontWeight: 800 }}>{fmt(row.closing_balance)}</td>
                            <td style={{ color: "#64748B" }}>{fmt(row.cumulative_interest)}</td>
                          </tr>
                        );
                      })}
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

          {/* Repayment History & Downloadable Receipts */}
          {selectedLoan && (
            <div className="card" style={{ marginTop: 24 }}>
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
                  <Receipt size={18} color="#0891B2" />
                  <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0F172A" }}>
                    Repayment History & Digital Receipts
                  </span>
                  <span className="badge badge-indigo" style={{ fontSize: "0.72rem" }}>
                    {loanHistory.length} Record{loanHistory.length === 1 ? "" : "s"}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => loadLoanHistory(selectedLoan._id)}
                  disabled={historyLoading}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.76rem" }}
                >
                  <RefreshCw
                    size={12}
                    style={{ animation: historyLoading ? "spin 0.8s linear infinite" : "none" }}
                  />
                  Refresh Records
                </button>
              </div>

              {historyLoading ? (
                <div style={{ textAlign: "center", padding: 24, color: "#64748B", fontSize: "0.85rem" }}>
                  <RefreshCw size={16} style={{ animation: "spin 0.8s linear infinite", display: "inline-block", marginRight: 8 }} />
                  Loading payment history...
                </div>
              ) : loanHistory.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 16px", color: "#64748B", fontSize: "0.85rem", background: "#F8FAFC", borderRadius: "var(--radius-sm)", border: "1px dashed #E2E8F0" }}>
                  <Receipt size={24} color="#94A3B8" style={{ margin: "0 auto 8px", display: "block" }} />
                  No repayment transactions recorded yet for this loan facility.
                  <div style={{ fontSize: "0.75rem", marginTop: 4, color: "#94A3B8" }}>
                    Once a payment is completed, its full customer receipt can be viewed and printed anytime here.
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="table" style={{ fontSize: "0.8rem", margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Transaction Ref</th>
                        <th>Type & Mode</th>
                        <th>Amount Paid</th>
                        <th>Principal vs. Interest</th>
                        <th>Balance After</th>
                        <th style={{ textAlign: "right" }}>Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loanHistory.map((ev, idx) => (
                        <tr key={ev._id || idx}>
                          <td>
                            <div style={{ fontWeight: 700, color: "#0F172A" }}>
                              {formatDate(ev.event_date || ev.created_at)}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "#64748B" }}>
                              {formatDateTime(ev.event_date || ev.created_at).split(",")[1] || ""}
                            </div>
                          </td>
                          <td>
                            <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#334155" }}>
                              {ev.transaction_ref || `TXN-${String(ev._id || idx).slice(-6).toUpperCase()}`}
                            </span>
                          </td>
                          <td>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                fontWeight: 800,
                                textTransform: "uppercase",
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: "#F1F5F9",
                                color: "#334155",
                                display: "inline-block",
                                marginBottom: 2,
                              }}
                            >
                              {ev.event_type || ev.payment_type || "Payment"}
                            </span>
                            <div style={{ fontSize: "0.7rem", color: "#64748B" }}>
                              via {ev.payment_mode || "UPI"}
                            </div>
                          </td>
                          <td>
                            <strong style={{ color: "#0F172A", fontSize: "0.88rem" }}>
                              {fmt(ev.amount)}
                            </strong>
                          </td>
                          <td>
                            <div style={{ fontSize: "0.72rem", color: "#059669", fontWeight: 700 }}>
                              Principal: +{fmt(ev.principal_component || 0)}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#D97706", fontWeight: 600 }}>
                              Interest: +{fmt(ev.interest_component || 0)}
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 800, color: "#0F172A" }}>
                              {fmt(ev.balance_remaining)}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleViewReceipt(ev)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "4px 8px",
                                fontSize: "0.74rem",
                                color: "#0891B2",
                                fontWeight: 700,
                              }}
                            >
                              <Receipt size={13} /> View Receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
      </div>

      {/* Digital Receipt Modal with Comprehensive Customer, Loan & Tenure Details */}
      {successReceipt && (
        <div className="modal-overlay print-receipt-overlay">
          <div
            className="modal print-receipt-modal"
            style={{
              maxWidth: 680,
              width: "100%",
              padding: "24px 28px",
              maxHeight: "92vh",
              overflowY: "auto",
            }}
          >
            {/* Header: Brand & Document Title */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingBottom: 16,
                borderBottom: "2px solid #E2E8F0",
                marginBottom: 16,
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img
                  src={fundmatrixLogo}
                  alt="FundMatrix"
                  style={{ height: 38, maxWidth: 160, objectFit: "contain" }}
                />
                <div>
                  <div
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: 800,
                      color: "#0F172A",
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                    }}
                  >
                    Repayment Receipt
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 600 }}>
                    Official Reducing-Balance Credit Ledger
                  </div>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#ECFDF5",
                    color: "#059669",
                    padding: "4px 10px",
                    borderRadius: 20,
                    fontSize: "0.74rem",
                    fontWeight: 800,
                    border: "1px solid #A7F3D0",
                    marginBottom: 4,
                  }}
                >
                  <CheckCircle2 size={13} /> Payment Credited
                </div>
                <div style={{ fontSize: "0.74rem", color: "#64748B", fontFamily: "monospace" }}>
                  Receipt #: <strong style={{ color: "#0F172A" }}>{successReceipt.receipt_no}</strong>
                </div>
                <div style={{ fontSize: "0.72rem", color: "#64748B" }}>
                  Issued: {formatDateTime(successReceipt.date)}
                </div>
              </div>
            </div>

            {/* SECTION 1: Customer / Borrower Information */}
            <div
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "var(--radius-md)",
                padding: "12px 16px",
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  color: "#0891B2",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: 10,
                  borderBottom: "1px solid #E2E8F0",
                  paddingBottom: 6,
                }}
              >
                <User size={14} /> Borrower / Customer Profile
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "10px 18px",
                  fontSize: "0.82rem",
                }}
              >
                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>
                    Customer Full Name
                  </span>
                  <strong style={{ color: "#0F172A", fontSize: "0.92rem" }}>
                    {successReceipt.customer_name}
                  </strong>
                </div>

                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>
                    Customer / Borrower ID
                  </span>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#475569" }}>
                    {successReceipt.customer_id}
                  </span>
                </div>

                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>
                    Registered Email
                  </span>
                  <span style={{ color: "#334155", fontWeight: 600 }}>
                    {successReceipt.customer_email}
                  </span>
                </div>

                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>
                    Registered Mobile
                  </span>
                  <span style={{ color: "#334155", fontWeight: 700 }}>
                    +91 {successReceipt.customer_phone}
                  </span>
                </div>

                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>
                    Aadhaar Card (UID)
                  </span>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#334155" }}>
                    {maskAadhaar(successReceipt.customer_aadhaar)}
                  </span>
                </div>

                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>
                    PAN Number
                  </span>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#334155" }}>
                    {maskPan(successReceipt.customer_pan)}
                  </span>
                </div>

                {successReceipt.customer_dob && (
                  <div>
                    <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>
                      DOB & Gender
                    </span>
                    <span style={{ color: "#334155", fontWeight: 600 }}>
                      {successReceipt.customer_dob} {successReceipt.customer_gender ? `(${successReceipt.customer_gender})` : ""}
                    </span>
                  </div>
                )}

                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>
                    KYC Verification
                  </span>
                  <span style={{ color: "#059669", fontWeight: 700, fontSize: "0.78rem" }}>
                    ✓ Identity Verified & Compliant
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 2: Loan Facility Details */}
            <div
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "var(--radius-md)",
                padding: "12px 16px",
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  color: "#0891B2",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: 10,
                  borderBottom: "1px solid #E2E8F0",
                  paddingBottom: 6,
                }}
              >
                <Landmark size={14} /> Loan Facility Overview
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "10px 18px",
                  fontSize: "0.82rem",
                }}
              >
                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>
                    Loan Account Number (LAN)
                  </span>
                  <span style={{ fontWeight: 800, color: "#0F172A", fontFamily: "monospace" }}>
                    LNX-{successReceipt.loan_id?.slice(-8).toUpperCase()}
                  </span>
                </div>

                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>
                    Facility Category
                  </span>
                  <strong style={{ color: "#0F172A" }}>
                    {successReceipt.loan_type} Loan
                  </strong>
                </div>

                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>
                    Original Sanctioned Principal
                  </span>
                  <strong style={{ color: "#0F172A", fontSize: "0.95rem" }}>
                    {fmt(successReceipt.sanctioned_amount)}
                  </strong>
                </div>

                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>
                    Annual Interest Rate
                  </span>
                  <strong style={{ color: "#D97706" }}>
                    {successReceipt.interest_rate}% p.a. (Reducing)
                  </strong>
                </div>

                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>
                    Total Sanctioned Tenure
                  </span>
                  <strong style={{ color: "#0F172A" }}>
                    {successReceipt.tenure_months} Months ({(Number(successReceipt.tenure_months || 12) / 12).toFixed(1)} Years)
                  </strong>
                </div>

                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>
                    Standard Agreed Monthly EMI
                  </span>
                  <strong style={{ color: "#0891B2" }}>
                    {fmt(successReceipt.emi_amount)}
                  </strong>
                </div>

                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>
                    Activation / Disbursed Date
                  </span>
                  <span style={{ color: "#334155", fontWeight: 600 }}>
                    {formatDate(successReceipt.disbursed_at)}
                  </span>
                </div>

                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>
                    Facility Status
                  </span>
                  <span
                    style={{
                      fontWeight: 800,
                      color: successReceipt.new_balance <= 0 ? "#059669" : "#2563EB",
                      fontSize: "0.78rem",
                    }}
                  >
                    ● {successReceipt.new_balance <= 0 ? "Fully Paid & Settled" : (successReceipt.loan_status || "Disbursed & Active")}
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 3: Repayment & Tenure Progress (KEY REQUIREMENT: How many months paid, how long paid, remaining) */}
            <div
              style={{
                background: "linear-gradient(135deg, #F0FDF4 0%, #ECFEFF 100%)",
                border: "1px solid #A7F3D0",
                borderRadius: "var(--radius-md)",
                padding: "14px 16px",
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  color: "#059669",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: 12,
                  borderBottom: "1px solid #BBF7D0",
                  paddingBottom: 6,
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <CalendarCheck size={15} /> Tenure & Cumulative Repayment Milestones
                </div>
                <span
                  style={{
                    background: "#059669",
                    color: "#FFFFFF",
                    padding: "2px 8px",
                    borderRadius: 12,
                    fontSize: "0.68rem",
                    fontWeight: 700,
                  }}
                >
                  {successReceipt.repayment_progress_pct}% Completed
                </span>
              </div>

              {/* 4 Stat Highlights */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    background: "#FFFFFF",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <span style={{ fontSize: "0.7rem", color: "#64748B", display: "block", textTransform: "uppercase", fontWeight: 700 }}>
                    Months Paid
                  </span>
                  <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0F172A", marginTop: 2 }}>
                    Month {successReceipt.months_paid} <span style={{ fontSize: "0.78rem", color: "#64748B", fontWeight: 600 }}>/ {successReceipt.tenure_months}</span>
                  </div>
                  <span style={{ fontSize: "0.68rem", color: "#059669", fontWeight: 700 }}>
                    {successReceipt.months_paid} Installments Cleared
                  </span>
                </div>

                <div
                  style={{
                    background: "#FFFFFF",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <span style={{ fontSize: "0.7rem", color: "#64748B", display: "block", textTransform: "uppercase", fontWeight: 700 }}>
                    How Long Paid
                  </span>
                  <div style={{ fontSize: "1.02rem", fontWeight: 800, color: "#0891B2", marginTop: 2 }}>
                    {successReceipt.how_long_paid}
                  </div>
                  <span style={{ fontSize: "0.68rem", color: "#64748B" }}>
                    Since {formatDate(successReceipt.disbursed_at)}
                  </span>
                </div>

                <div
                  style={{
                    background: "#FFFFFF",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <span style={{ fontSize: "0.7rem", color: "#64748B", display: "block", textTransform: "uppercase", fontWeight: 700 }}>
                    Remaining Months
                  </span>
                  <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#F59E0B", marginTop: 2 }}>
                    {successReceipt.months_remaining} Month{successReceipt.months_remaining === 1 ? "" : "s"}
                  </div>
                  <span style={{ fontSize: "0.68rem", color: "#64748B" }}>
                    Maturity: {successReceipt.maturity_date}
                  </span>
                </div>

                <div
                  style={{
                    background: "#FFFFFF",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <span style={{ fontSize: "0.7rem", color: "#64748B", display: "block", textTransform: "uppercase", fontWeight: 700 }}>
                    Tenure Progress
                  </span>
                  <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#059669", marginTop: 2 }}>
                    {successReceipt.repayment_progress_pct}%
                  </div>
                  <div style={{ width: "100%", height: 5, background: "#E2E8F0", borderRadius: 3, marginTop: 4, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(0, Number(successReceipt.repayment_progress_pct || 0)))}%`,
                        height: "100%",
                        background: "#059669",
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Cumulative Financial Ledger */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 14px",
                  fontSize: "0.8rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ color: "#64748B" }}>Total Principal Repaid to Date</span>
                  <strong style={{ color: "#059669" }}>{fmt(successReceipt.total_repaid)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ color: "#64748B" }}>Total Cumulative Interest Serviced</span>
                  <strong style={{ color: "#D97706" }}>{fmt(successReceipt.total_interest_paid)}</strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: 6,
                    borderTop: "1px dashed #E2E8F0",
                    marginBottom: 5,
                  }}
                >
                  <span style={{ color: "#334155", fontWeight: 700 }}>Total Payments Remitted Across Loan</span>
                  <strong style={{ color: "#0F172A", fontWeight: 800 }}>
                    {fmt(successReceipt.total_amount_paid)}
                  </strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: 6,
                    borderTop: "1px solid #CBD5E1",
                    fontSize: "0.86rem",
                  }}
                >
                  <span style={{ color: "#0F172A", fontWeight: 800 }}>Remaining Outstanding Principal</span>
                  <strong style={{ color: "#0F172A", fontWeight: 900, fontSize: "0.95rem" }}>
                    {fmt(successReceipt.new_balance)}
                  </strong>
                </div>
              </div>
            </div>

            {/* SECTION 4: Current Transaction Particulars */}
            <div
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "var(--radius-md)",
                padding: "12px 16px",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  color: "#0891B2",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: 10,
                  borderBottom: "1px solid #E2E8F0",
                  paddingBottom: 6,
                }}
              >
                <Receipt size={14} /> Current Transaction Details
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.82rem" }}>
                <span style={{ color: "#64748B" }}>Transaction UTR / Ref</span>
                <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{successReceipt.transaction_ref}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.82rem" }}>
                <span style={{ color: "#64748B" }}>Payment Channel & Mode</span>
                <span style={{ fontWeight: 700 }}>{successReceipt.payment_mode}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.82rem" }}>
                <span style={{ color: "#64748B" }}>Payment Classification</span>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: "#EFF6FF",
                    color: "#2563EB",
                    border: "1px solid #BFDBFE",
                  }}
                >
                  {successReceipt.payment_type}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                  fontSize: "0.95rem",
                  paddingTop: 4,
                }}
              >
                <span style={{ color: "#0F172A", fontWeight: 800 }}>Gross Amount Remitted</span>
                <span style={{ fontWeight: 900, color: "#0F172A", fontSize: "1.1rem" }}>
                  {fmt(successReceipt.amount)}
                </span>
              </div>

              {/* Itemized Split */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "var(--radius-sm)",
                  padding: "8px 12px",
                  margin: "8px 0",
                  fontSize: "0.82rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "#059669", fontWeight: 700 }}>✓ Principal Balance Deduction</span>
                  <span style={{ fontWeight: 800, color: "#059669" }}>+{fmt(successReceipt.principal_component)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#D97706", fontWeight: 700 }}>✓ Interest Servicing Fee</span>
                  <span style={{ fontWeight: 800, color: "#D97706" }}>+{fmt(successReceipt.interest_component)}</span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                  color: "#64748B",
                  marginTop: 6,
                }}
              >
                <span>Balance Before Payment: {fmt(successReceipt.previous_balance)}</span>
                <span style={{ fontWeight: 700, color: "#0F172A" }}>
                  Balance After Payment: {fmt(successReceipt.new_balance)}
                </span>
              </div>

              {successReceipt.notes && (
                <div style={{ marginTop: 8, fontSize: "0.75rem", color: "#64748B", borderTop: "1px dashed #E2E8F0", paddingTop: 6 }}>
                  <strong>Narration:</strong> {successReceipt.notes}
                </div>
              )}
            </div>

            {/* Verification Watermark & Seal */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                background: "#F8FAFC",
                border: "1px dashed #CBD5E1",
                borderRadius: "var(--radius-sm)",
                marginBottom: 16,
              }}
            >
              <QrCode size={36} color="#475569" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: "0.7rem", color: "#64748B", lineHeight: 1.4 }}>
                <strong style={{ color: "#334155", display: "block" }}>
                  Digitally Verified Electronic Acknowledgement
                </strong>
                Generated by FundMatrix Core Amortization Engine. Real-time balance reconciled under RBI digital lending guidelines. No physical signature required.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="modal-footer no-print" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setSuccessReceipt(null)}>
                Close
              </button>
              <button
                className="btn btn-accent"
                onClick={() => {
                  window.print();
                }}
              >
                <Download size={14} /> Print / Save PDF Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}