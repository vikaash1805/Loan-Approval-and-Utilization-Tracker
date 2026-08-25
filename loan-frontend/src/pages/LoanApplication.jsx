import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/loanApi";
import { CheckCircle, XCircle, Calculator, ShieldCheck, Loader } from "lucide-react";

const LOAN_TYPES = ["Personal", "Business", "Home", "Education", "Vehicle"];
const GENDERS = ["Male", "Female", "Transgender"];

const calcEMI = (principal, rate, months) => {
  if (!principal || !months) return 0;
  if (!rate) return +(principal / months).toFixed(2);
  const r = rate / (12 * 100);
  return +((principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)).toFixed(2);
};
const fmt = (n) => n ? `₹${Number(n).toLocaleString("en-IN")}` : "₹0";

const STEPS = [
  "Personal Info",
  "ID Details",
  "Document Verify",
  "Loan Details",
  "Review & Submit",
];

// ─── Inline field preview ───────────────────────────────────────────────────
function FieldRow({ label, userVal, extractedVal, match }) {
  const color = match ? "#10b981" : "#ef4444";
  const icon = match ? "✓" : "✗";
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "140px 1fr 1fr",
      gap: 10, padding: "10px 0",
      borderBottom: "1px solid #edf2f7",
      alignItems: "center",
    }}>
      <div style={{ fontSize: "0.82rem", color: "#64748b", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: "0.88rem", color: "#0F172A" }}>
        <span style={{ fontSize: "0.72rem", color: "#64748b" }}>Entered: </span>{userVal || "—"}
      </div>
      <div style={{ fontSize: "0.88rem", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color, fontSize: "1.1rem", fontWeight: 700 }}>{icon}</span>
        <span style={{ color: "#0F172A", fontWeight: 500 }}>{extractedVal || "Not detected"}</span>
      </div>
    </div>
  );
}

export default function LoanApplication() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState("");

  // Step 0: Personal info - prefill from logged-in user if available
  const [personal, setPersonal] = useState({
    applicant_name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });

  useEffect(() => {
    if (user) {
      setPersonal((prev) => ({
        ...prev,
        applicant_name: prev.applicant_name || user.name || "",
        email: prev.email || user.email || "",
        phone: prev.phone || user.phone || "",
      }));
    }
  }, [user]);

  // Step 1: ID input fields (cross-checked with uploaded images)
  const [idFields, setIdFields] = useState({
    user_dob: "", user_gender: "Male", user_aadhaar: user?.id_type === "Aadhaar" ? user.id_number : "", user_pan: user?.id_type === "PAN" ? user.id_number : "",
  });

  // Step 2: Document images + verification result
  const aadhaarRef = useRef(null);
  const panRef = useRef(null);
  const [aadhaarFile, setAadhaarFile] = useState(null);
  const [panFile, setPanFile] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null); // from /verify

  // Step 3: Loan details
  const [loan, setLoan] = useState({
    loan_type: "Personal", amount_requested: "", tenure_months: "12",
    interest_rate: "10.5", purpose: "",
  });

  const setP = (k, v) => setPersonal((p) => ({ ...p, [k]: v }));
  const setI = (k, v) => setIdFields((p) => ({ ...p, [k]: v }));
  const setL = (k, v) => setLoan((p) => ({ ...p, [k]: v }));

  const emi = calcEMI(parseFloat(loan.amount_requested) || 0, parseFloat(loan.interest_rate) || 0, parseInt(loan.tenure_months) || 0);
  const totalPayable = emi * (parseInt(loan.tenure_months) || 0);
  const totalInterest = totalPayable - (parseFloat(loan.amount_requested) || 0);

  // ── Validation per step ──────────────────────────────────────────────────
  const validate = () => {
    if (step === 0) {
      if (!personal.applicant_name.trim()) return "Full name is required.";
      if (!personal.email.trim() || !/\S+@\S+\.\S+/.test(personal.email)) return "Valid email required.";
      if (!personal.phone.trim() || personal.phone.length < 7) return "Valid phone number required.";
    }
    if (step === 1) {
      if (!idFields.user_dob.trim()) return "Date of birth is required.";
      if (!idFields.user_aadhaar.trim() || idFields.user_aadhaar.replace(/\D/g,"").length !== 12)
        return "Valid 12-digit Aadhaar number required.";
      if (!idFields.user_pan.trim() || idFields.user_pan.length !== 10)
        return "Valid 10-character PAN number required.";
    }
    if (step === 2) {
      if (!aadhaarFile) return "Please upload your Aadhaar card image.";
      if (!panFile) return "Please upload your PAN card image.";
      if (!verifyResult) return "Please click 'Verify Aadhaar + PAN Documents' before proceeding.";
      if (!verifyResult.overall_match)
        return "Document verification failed. Details do not match. Please check and retry.";
    }
    if (step === 3) {
      if (!loan.amount_requested || parseFloat(loan.amount_requested) <= 0) return "Enter a valid loan amount.";
      if (!loan.tenure_months || parseInt(loan.tenure_months) <= 0) return "Enter valid tenure.";
    }
    return null;
  };

  // ── Step navigation ──────────────────────────────────────────────────────
  const next = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setStep((s) => s + 1);
  };

  const back = () => { setError(""); setStep((s) => s - 1); };

  // ── Step 2: Call /verify ─────────────────────────────────────────────────
  const runVerify = async () => {
    if (!aadhaarFile || !panFile) { setError("Upload both Aadhaar and PAN images first."); return; }
    setVerifying(true); setError(""); setVerifyResult(null);
    try {
      const fd = new FormData();
      fd.append("user_name", personal.applicant_name);
      fd.append("user_dob", idFields.user_dob);
      fd.append("user_gender", idFields.user_gender);
      fd.append("user_aadhaar", idFields.user_aadhaar);
      fd.append("user_pan", idFields.user_pan);
      fd.append("aadhaar_image", aadhaarFile);
      fd.append("pan_image", panFile);
      const result = await api.verifyDocuments(fd);
      setVerifyResult(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setVerifying(false);
    }
  };

  // ── Final submit ─────────────────────────────────────────────────────────
  const submit = async () => {
    setSubmitting(true); setError("");
    try {
      const res = await api.applyLoan({
        applicant_name: personal.applicant_name,
        email: personal.email,
        phone: personal.phone,
        dob: idFields.user_dob,
        gender: idFields.user_gender,
        aadhaar_number: idFields.user_aadhaar,
        pan_number: idFields.user_pan,
        id_verified: verifyResult?.overall_match === true,
        loan_type: loan.loan_type,
        amount_requested: parseFloat(loan.amount_requested),
        tenure_months: parseInt(loan.tenure_months),
        interest_rate: parseFloat(loan.interest_rate),
        purpose: loan.purpose,
      });
      setSuccess(res.application);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ───────────────────────────────────────────────────────
  if (success) return (
    <div className="fade-in" style={{ maxWidth: 580, margin: "40px auto", textAlign: "center" }}>
      <div className="card" style={{ padding: "40px 32px" }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "linear-gradient(135deg, #10b981, #059669)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px", boxShadow: "0 8px 24px rgba(16, 185, 129, 0.35)",
        }}>
          <CheckCircle size={38} color="#fff" />
        </div>
        <h2 style={{ fontFamily: "Outfit", fontSize: "1.6rem", fontWeight: 800, color: "#0F172A", marginBottom: 8 }}>
          Application Submitted!
        </h2>
        <p style={{ color: "#64748B", fontSize: "0.95rem", marginBottom: 24 }}>
          Your loan application has been received and queued for officer review.
        </p>

        <div style={{
          background: "#f8fafc", borderRadius: 10, padding: "18px 20px",
          border: "1px solid #e2e8f0", marginBottom: 24, textAlign: "left",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              ["Application ID", success._id?.slice(-8)?.toUpperCase()],
              ["Applicant", success.applicant_name],
              ["ID Verified", success.id_verified ? "✓ Verified" : "✗ Pending"],
              ["Loan Type", success.loan_type],
              ["Amount", fmt(success.amount_requested)],
              ["Monthly EMI", fmt(success.emi)],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: "0.74rem", color: "#64748b", marginBottom: 2, fontWeight: 600, textTransform: "uppercase" }}>{k}</div>
                <div style={{ fontWeight: 600, color: k === "ID Verified" ? "#10b981" : "#0F172A", fontSize: "0.95rem" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button className="btn btn-ghost" onClick={() => {
            setSuccess(null); setStep(0); setVerifyResult(null);
            setAadhaarFile(null); setPanFile(null);
          }}>New Application</button>
          <button className="btn btn-primary" onClick={() => navigate("/approvals")}>View Applications</button>
        </div>
      </div>
    </div>
  );

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="fade-in" style={{ maxWidth: 740, margin: "0 auto" }}>
      <div className="page-header">
        <h1>Apply for a Loan</h1>
        <p>Automated identity verification & loan underwriting pipeline</p>
      </div>

      {/* Step Indicator */}
      <div className="steps" style={{ marginBottom: 28 }}>
        {STEPS.map((label, i) => (
          <div key={i} className={`step ${i < step ? "done" : i === step ? "active" : ""}`}>
            <div className="step-num">{i < step ? "✓" : i + 1}</div>
            <div className="step-label">{label}</div>
            {i < STEPS.length - 1 && <div className="step-connector" />}
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">

        {/* ═══ STEP 0: PERSONAL INFO ═══════════════════════════════════════ */}
        {step === 0 && (
          <>
            <div className="section-title">👤 Personal Information</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Full Name *</label>
                <input className="form-control" placeholder="Enter full name"
                  value={personal.applicant_name} onChange={(e) => setP("applicant_name", e.target.value)} />
              </div>
              <div className="form-group">
                <label>Email Address *</label>
                <input className="form-control" type="email" placeholder="Enter email address"
                  value={personal.email} onChange={(e) => setP("email", e.target.value)} />
              </div>
              <div className="form-group">
                <label>Phone Number *</label>
                <input className="form-control" placeholder="Enter the Phone Number"
                  value={personal.phone} onChange={(e) => setP("phone", e.target.value)} />
              </div>
            </div>
          </>
        )}

        {/* ═══ STEP 1: ID DETAILS ══════════════════════════════════════════ */}
        {step === 1 && (
          <>
            <div className="section-title">🪪 Identity Details</div>
            <p style={{ color: "#5a6e85", fontSize: "0.88rem", marginBottom: 20 }}>
              Enter your identity details exactly as printed on your Aadhaar and PAN cards.
              These will be cross-verified with the uploaded document images in the next step.
            </p>
            <div className="form-grid">
              <div className="form-group">
                <label>Date of Birth *</label>
                <input className="form-control" type="text" placeholder="DD/MM/YYYY"
                  value={idFields.user_dob} onChange={(e) => setI("user_dob", e.target.value)} />
              </div>
              <div className="form-group">
                <label>Gender *</label>
                <select className="form-control" value={idFields.user_gender}
                  onChange={(e) => setI("user_gender", e.target.value)}>
                  {GENDERS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Aadhaar Number (12 digits) *</label>
                <input className="form-control" placeholder="123456789012" maxLength={12}
                  value={idFields.user_aadhaar} onChange={(e) => setI("user_aadhaar", e.target.value)} />
              </div>
              <div className="form-group">
                <label>PAN Card Number (10 characters) *</label>
                <input className="form-control" placeholder="ABCDE1234F" maxLength={10}
                  style={{ textTransform: "uppercase" }}
                  value={idFields.user_pan} onChange={(e) => setI("user_pan", e.target.value.toUpperCase())} />
              </div>
            </div>
          </>
        )}

        {/* ═══ STEP 2: DOCUMENT UPLOAD & VERIFICATION ═══════════════════ */}
        {step === 2 && (
          <>
            <div className="section-title">📄 Document Cross-Verification</div>
            <p style={{ color: "#64748b", fontSize: "0.88rem", marginBottom: 20 }}>
              Upload clear images of both your <strong>Aadhaar Card</strong> and <strong>PAN Card</strong>.
              The system will extract and match all details against your application.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 20 }}>
              {/* Aadhaar upload */}
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0F172A", marginBottom: 6, display: "block" }}>
                  Aadhaar Card Image *
                </label>
                <input ref={aadhaarRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={(e) => { setAadhaarFile(e.target.files[0]); setVerifyResult(null); }} />
                <div
                  onClick={() => aadhaarRef.current.click()}
                  style={{
                    padding: "22px", border: `2px dashed ${aadhaarFile ? "#10b981" : "#06b6d4"}`,
                    borderRadius: 10, textAlign: "center", cursor: "pointer",
                    background: aadhaarFile ? "#ecfdf5" : "#ecfeff",
                    transition: "all 0.2s ease",
                  }}>
                  {aadhaarFile
                    ? <><span style={{ color: "#10b981", fontSize: "1.6rem" }}>✓</span><div style={{ color: "#065f46", fontSize: "0.88rem", fontWeight: 600, marginTop: 4 }}>{aadhaarFile.name}</div></>
                    : <><div style={{ fontSize: "1.8rem" }}>🪪</div><div style={{ color: "#0891b2", fontWeight: 600, fontSize: "0.88rem", marginTop: 4 }}>Click to upload Aadhaar</div></>
                  }
                </div>
              </div>

              {/* PAN upload */}
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0F172A", marginBottom: 6, display: "block" }}>
                  PAN Card Image *
                </label>
                <input ref={panRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={(e) => { setPanFile(e.target.files[0]); setVerifyResult(null); }} />
                <div
                  onClick={() => panRef.current.click()}
                  style={{
                    padding: "22px", border: `2px dashed ${panFile ? "#10b981" : "#06b6d4"}`,
                    borderRadius: 10, textAlign: "center", cursor: "pointer",
                    background: panFile ? "#ecfdf5" : "#ecfeff",
                    transition: "all 0.2s ease",
                  }}>
                  {panFile
                    ? <><span style={{ color: "#10b981", fontSize: "1.6rem" }}>✓</span><div style={{ color: "#065f46", fontSize: "0.88rem", fontWeight: 600, marginTop: 4 }}>{panFile.name}</div></>
                    : <><div style={{ fontSize: "1.8rem" }}>💳</div><div style={{ color: "#0891b2", fontWeight: 600, fontSize: "0.88rem", marginTop: 4 }}>Click to upload PAN</div></>
                  }
                </div>
              </div>
            </div>

            {/* Verify button */}
            <button className="btn btn-primary" onClick={runVerify} disabled={verifying || !aadhaarFile || !panFile}
              style={{ width: "100%", marginBottom: 20 }}>
              {verifying
                ? <><Loader size={16} style={{ animation: "spin 0.8s linear infinite" }} /> Verifying Document Data...</>
                : <><ShieldCheck size={16} /> Verify Aadhaar + PAN Documents</>
              }
            </button>

            {/* Verification results */}
            {verifyResult && (
              <div style={{
                padding: "20px 22px",
                background: verifyResult.overall_match ? "#ecfdf5" : "#fef2f2",
                border: `1px solid ${verifyResult.overall_match ? "#a7f3d0" : "#fecaca"}`,
                borderRadius: 10,
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
                  fontFamily: "Outfit", fontSize: "1.05rem", fontWeight: 700,
                  color: verifyResult.overall_match ? "#065f46" : "#991b1b",
                }}>
                  {verifyResult.overall_match
                    ? <><CheckCircle size={20} /> All Details Verified Successfully</>
                    : <><XCircle size={20} /> Verification Failed — Details Do Not Match</>
                  }
                </div>

                {!verifyResult.overall_match && (
                  <div style={{ marginTop: 6, color: "#b91c1c", fontSize: "0.88rem", fontWeight: 500 }}>
                    ⚠ The entered details are mismatched with the uploaded documents. Please verify your information and try again.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ═══ STEP 3: LOAN DETAILS + EMI CALC ════════════════════════════ */}
        {step === 3 && (
          <>
            <div className="section-title">💰 Loan Details</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Loan Type *</label>
                <select className="form-control" value={loan.loan_type}
                  onChange={(e) => setL("loan_type", e.target.value)}>
                  {LOAN_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Loan Amount (₹) *</label>
                <input className="form-control" type="number" placeholder="500000"
                  value={loan.amount_requested} onChange={(e) => setL("amount_requested", e.target.value)} />
              </div>
              <div className="form-group">
                <label>Tenure (months) *</label>
                <input className="form-control" type="number" min="1" max="360" placeholder="36"
                  value={loan.tenure_months} onChange={(e) => setL("tenure_months", e.target.value)} />
              </div>
              <div className="form-group">
                <label>Interest Rate (% p.a.)</label>
                <input className="form-control" type="number" step="0.1" placeholder="10.5"
                  value={loan.interest_rate} onChange={(e) => setL("interest_rate", e.target.value)} />
              </div>
              <div className="form-group" style={{ gridColumn: "1/-1" }}>
                <label>Purpose of Loan</label>
                <input className="form-control" placeholder="e.g. Home renovation, Business expansion"
                  value={loan.purpose} onChange={(e) => setL("purpose", e.target.value)} />
              </div>
            </div>

            {/* Live EMI Card */}
            {loan.amount_requested && loan.tenure_months && (
              <div style={{
                marginTop: 22, padding: "20px 22px",
                background: "#f1f5f9",
                border: "1px solid #cbd5e1", borderRadius: 10,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, color: "#0F172A", fontWeight: 700 }}>
                  <Calculator size={17} color="#06b6d4" /> EMI Calculator Breakdown
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                  {[
                    ["Monthly EMI", fmt(emi), "#10b981"],
                    ["Total Payable", fmt(totalPayable), "#0F172A"],
                    ["Total Interest", fmt(totalInterest > 0 ? totalInterest : 0), "#0891b2"],
                  ].map(([k, v, c]) => (
                    <div key={k} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.74rem", color: "#64748b", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>{k}</div>
                      <div style={{ fontFamily: "Outfit", fontSize: "1.3rem", fontWeight: 700, color: c }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ STEP 4: REVIEW & SUBMIT ══════════════════════════════════════ */}
        {step === 4 && (
          <>
            <div className="section-title">📋 Review Your Application</div>

            {/* Verification badges */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
                background: "#ecfdf5", border: "1px solid #a7f3d0",
                borderRadius: 20, fontSize: "0.82rem", color: "#065f46", fontWeight: 600 }}>
                <ShieldCheck size={14} /> ID Verified & Authenticated
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
              {[
                ["Full Name", personal.applicant_name],
                ["Email", personal.email],
                ["Phone", personal.phone],
                ["Date of Birth", idFields.user_dob],
                ["Gender", idFields.user_gender],
                ["Aadhaar", idFields.user_aadhaar],
                ["PAN", idFields.user_pan],
                ["Loan Type", loan.loan_type],
                ["Amount Requested", fmt(parseFloat(loan.amount_requested) || 0)],
                ["Tenure", `${loan.tenure_months} months`],
                ["Interest Rate", `${loan.interest_rate}% p.a.`],
                ["Monthly EMI", fmt(emi)],
                ["Purpose", loan.purpose || "Not specified"],
              ].map(([k, v]) => (
                <div key={k} style={{
                  background: "#f8fafc", padding: "12px 16px",
                  borderRadius: 8, border: "1px solid #e2e8f0",
                }}>
                  <div style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: 3, fontWeight: 600, textTransform: "uppercase" }}>{k}</div>
                  <div style={{ fontWeight: 600, color: "#0F172A", fontSize: "0.92rem" }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 18, padding: "14px 16px",
              background: "#ecfdf5", border: "1px solid #a7f3d0",
              borderRadius: 8, color: "#065f46", fontSize: "0.85rem", fontWeight: 500 }}>
              ✓ I confirm all the above information is accurate and I consent to the loan terms and identity verification.
            </div>
          </>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 28 }}>
          {step > 0
            ? <button className="btn btn-ghost" onClick={back}>← Back</button>
            : <div />
          }
          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary" onClick={next}>
              Next →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={submit} disabled={submitting}>
              {submitting ? "Submitting..." : "🚀 Submit Application"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
