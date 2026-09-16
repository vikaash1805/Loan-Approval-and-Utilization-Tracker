import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/loanApi";
import {
  CheckCircle,
  XCircle,
  Calculator,
  ShieldCheck,
  RefreshCw,
  UploadCloud,
  ArrowRight,
  ArrowLeft,
  User,
  CreditCard,
  FileCheck,
  Banknote,
  Sparkles,
  Info,
  Calendar,
  Layers,
  Radio,
  Scan,
  Home,
  Car,
  GraduationCap,
  Briefcase,
  UserCheck,
  FileText,
  Trash2,
  Eye,
  AlertCircle,
} from "lucide-react";

export const LOAN_DOCUMENTS_CONFIG = {
  Home: {
    title: "Home & Property Documentation",
    description: "Please upload official property and title ownership records for your Home Loan underwriting.",
    icon: Home,
    badgeColor: "#0891B2",
    badgeBg: "#ECFEFF",
    docs: [
      {
        id: "property_deed",
        label: "Property Title Deed / Sale Deed Agreement",
        description: "Registered sale deed, purchase agreement, or builder allotment letter proving legal property ownership",
        required: true,
        accept: "image/*,.pdf",
      },
      {
        id: "tax_receipt",
        label: "Property Tax Receipt / Municipal Khata Certificate",
        description: "Latest paid municipal property tax receipt, Khata certificate, or property assessment statement",
        required: true,
        accept: "image/*,.pdf",
      },
      {
        id: "building_noc",
        label: "Approved Building Plan & Society NOC",
        description: "Sanctioned architectural layout plan, occupancy certificate (OC), or housing society NOC",
        required: false,
        accept: "image/*,.pdf",
      },
      {
        id: "encumbrance_certificate",
        label: "Encumbrance Certificate (EC)",
        description: "Form 15/16 search report certifying property is free from legal dues/mortgages",
        required: false,
        accept: "image/*,.pdf",
      },
    ],
  },
  Vehicle: {
    title: "Vehicle & Registration Documentation",
    description: "Please upload vehicle registration or dealer quotation documents for your Vehicle Loan.",
    icon: Car,
    badgeColor: "#6366F1",
    badgeBg: "#EEF2FF",
    docs: [
      {
        id: "rc_or_quotation",
        label: "Vehicle RC Book / Proforma Price Quotation",
        description: "Vehicle Registration Certificate (for used vehicle) or Authorized Dealer Proforma Invoice / Price Quotation (for new vehicle)",
        required: true,
        accept: "image/*,.pdf",
      },
      {
        id: "driving_license",
        label: "Driver's License (DL)",
        description: "Valid permanent driving license of the primary borrower or designated driver",
        required: true,
        accept: "image/*,.pdf",
      },
      {
        id: "vehicle_insurance",
        label: "Vehicle Insurance Policy Copy",
        description: "Valid comprehensive or third-party motor insurance certificate copy",
        required: false,
        accept: "image/*,.pdf",
      },
      {
        id: "puc_tax_receipt",
        label: "Pollution Certificate (PUC) / Road Tax Receipt",
        description: "Valid PUC emission certificate or commercial road fitness receipt",
        required: false,
        accept: "image/*,.pdf",
      },
    ],
  },
  Personal: {
    title: "Income & Employment Documentation",
    description: "Please upload income and employment verification documents for your Personal Loan.",
    icon: UserCheck,
    badgeColor: "#10B981",
    badgeBg: "#ECFDF5",
    docs: [
      {
        id: "salary_slips",
        label: "Salary Slips (Last 3 Months) / Form 16",
        description: "Official stamped monthly payslips or annual Form 16 Part A & B",
        required: true,
        accept: "image/*,.pdf",
      },
      {
        id: "bank_statement",
        label: "Salary Bank Account Statement (Last 6 Months)",
        description: "Bank statement showing regular monthly salary credits and average balance",
        required: true,
        accept: "image/*,.pdf",
      },
      {
        id: "employment_id",
        label: "Employee ID Card / Appointment Letter",
        description: "Valid corporate badge or formal job confirmation / offer letter",
        required: false,
        accept: "image/*,.pdf",
      },
    ],
  },
  Business: {
    title: "Commercial & Business Registration Documentation",
    description: "Please upload business registration and statutory financial filings for your Business Loan.",
    icon: Briefcase,
    badgeColor: "#F59E0B",
    badgeBg: "#FEF3C7",
    docs: [
      {
        id: "gst_certificate",
        label: "Business Registration / GST Certificate / MSME Udyam",
        description: "GST registration certificate (REG-06), MSME Udyam certificate, or Shop & Establishment License",
        required: true,
        accept: "image/*,.pdf",
      },
      {
        id: "business_bank_statement",
        label: "Current Account Bank Statement (Last 12 Months)",
        description: "Commercial banking statements demonstrating annual operational business cash flow",
        required: true,
        accept: "image/*,.pdf",
      },
      {
        id: "itr_financials",
        label: "ITR Filings & Audited Balance Sheet (Last 2 Years)",
        description: "Income Tax Returns with Profit & Loss Statement, Balance Sheet, and CA audit report",
        required: false,
        accept: "image/*,.pdf",
      },
      {
        id: "commercial_lease",
        label: "Office / Factory Lease Agreement",
        description: "Commercial premises tenancy agreement or utility electricity bill in business name",
        required: false,
        accept: "image/*,.pdf",
      },
    ],
  },
  Education: {
    title: "Academic & Institute Documentation",
    description: "Please upload academic credentials and official institution admission documents for your Education Loan.",
    icon: GraduationCap,
    badgeColor: "#A855F7",
    badgeBg: "#FAF5FF",
    docs: [
      {
        id: "admission_letter",
        label: "University / Institute Admission Offer Letter",
        description: "Official unconditional or conditional admission letter specifying course, duration & campus",
        required: true,
        accept: "image/*,.pdf",
      },
      {
        id: "fee_structure",
        label: "Official Institute Fee Schedule / Breakdown",
        description: "Itemized semester tuition fee, hostel expenses, and examination fee estimate on college letterhead",
        required: true,
        accept: "image/*,.pdf",
      },
      {
        id: "academic_transcripts",
        label: "Academic Marksheets (10th, 12th & Degree)",
        description: "Certified copies of high school, intermediate, and undergraduate degrees or diplomas",
        required: false,
        accept: "image/*,.pdf",
      },
      {
        id: "parent_income_proof",
        label: "Co-Borrower / Parent Income Proof & Bank Statement",
        description: "Salary slips or ITR of parent/guardian supporting the education loan guarantee",
        required: false,
        accept: "image/*,.pdf",
      },
    ],
  },
};

const LOAN_TYPES = ["Personal", "Business", "Home", "Education", "Vehicle"];
const GENDERS = ["Male", "Female", "Transgender"];

const calcEMI = (principal, rate, months) => {
  if (!principal || !months) return 0;
  if (!rate) return +(principal / months).toFixed(2);
  const r = rate / (12 * 100);
  return +((principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)).toFixed(2);
};

const fmt = (n) => (n ? `₹${Number(n).toLocaleString("en-IN")}` : "₹0");

const formatFileSize = (bytes) => {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
};

const STEPS = [
  "Personal",
  "Loan Setup",
  "KYC Verification",
  "Category Docs",
  "Review & Submit",
];

// Helper to convert File to base64 Data URL
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });

// Inline Field Match Preview Row
function FieldRow({ label, userVal, extractedVal, match }) {
  const color = match ? "#10B981" : "#EF4444";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr 1fr",
        gap: 12,
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        background: match ? "rgba(16, 185, 129, 0.05)" : "rgba(239, 68, 68, 0.05)",
        border: `1px solid ${match ? "#A7F3D0" : "#FECACA"}`,
        alignItems: "center",
        marginBottom: 8,
      }}
    >
      <div style={{ fontSize: "0.8rem", color: "#64748B", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: "0.85rem", color: "#0F172A", fontWeight: 600 }}>
        <span style={{ fontSize: "0.72rem", color: "#94A3B8", display: "block" }}>Entered:</span>
        {userVal || "—"}
      </div>
      <div style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            color,
            fontSize: "0.74rem",
            fontWeight: 800,
            background: match ? "#DCFCE7" : "#FEE2E2",
            padding: "2px 8px",
            borderRadius: 12,
          }}
        >
          {match ? "✓ Match" : "✗ Mismatch"}
        </span>
        <span style={{ color: "#0F172A", fontWeight: 600 }}>{extractedVal || "Not detected"}</span>
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

  // Step 0: Personal Info
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

  // Step 1: Loan Details & Calculator
  const [loan, setLoan] = useState({
    loan_type: "Personal",
    amount_requested: "500000",
    tenure_months: "24",
    interest_rate: "10.5",
    purpose: "",
  });

  // Step 2: ID Input Fields & Images (KYC)
  const [idFields, setIdFields] = useState({
    user_dob: "",
    user_gender: "Male",
    user_aadhaar: user?.id_type === "Aadhaar" ? user.id_number : "",
    user_pan: user?.id_type === "PAN" ? user.id_number : "",
  });

  const aadhaarRef = useRef(null);
  const panRef = useRef(null);
  const [aadhaarFile, setAadhaarFile] = useState(null);
  const [panFile, setPanFile] = useState(null);
  const [aadhaarPreview, setAadhaarPreview] = useState("");
  const [panPreview, setPanPreview] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  // Step 3: Dynamic Category Documents
  // Keyed by `${loan_type}_${doc_id}` -> { file, preview, base64, name, size, docId, label, required }
  const [categoryDocs, setCategoryDocs] = useState({});

  const setP = (k, v) => setPersonal((p) => ({ ...p, [k]: v }));
  const setL = (k, v) => setLoan((p) => ({ ...p, [k]: v }));
  const setI = (k, v) => setIdFields((p) => ({ ...p, [k]: v }));

  const emi = calcEMI(
    parseFloat(loan.amount_requested) || 0,
    parseFloat(loan.interest_rate) || 0,
    parseInt(loan.tenure_months) || 0
  );
  const totalPayable = emi * (parseInt(loan.tenure_months) || 0);
  const totalInterest = totalPayable - (parseFloat(loan.amount_requested) || 0);

  // Dynamic config for currently selected loan type
  const currentDocConfig = LOAN_DOCUMENTS_CONFIG[loan.loan_type] || LOAN_DOCUMENTS_CONFIG.Personal;

  // Count uploaded mandatory documents
  const uploadedMandatoryCount = currentDocConfig.docs
    .filter((d) => d.required)
    .filter((d) => categoryDocs[`${loan.loan_type}_${d.id}`]?.file).length;
  const totalMandatoryCount = currentDocConfig.docs.filter((d) => d.required).length;

  // Handle Category Document Upload
  const handleCategoryDocUpload = async (docDef, file) => {
    if (!file) return;
    try {
      const b64 = await fileToBase64(file);
      const isImg = file.type.startsWith("image/");
      const previewUrl = isImg ? URL.createObjectURL(file) : "";

      setCategoryDocs((prev) => ({
        ...prev,
        [`${loan.loan_type}_${docDef.id}`]: {
          file,
          preview: previewUrl,
          base64: b64,
          name: file.name,
          size: file.size,
          type: file.type,
          docId: docDef.id,
          label: docDef.label,
          required: docDef.required,
          uploadedAt: new Date().toISOString(),
        },
      }));
      setError("");
    } catch (e) {
      setError(`Failed to process document "${docDef.label}": ${e.message}`);
    }
  };

  // Remove Category Document
  const handleRemoveCategoryDoc = (docId) => {
    const key = `${loan.loan_type}_${docId}`;
    setCategoryDocs((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Validation per step
  const validate = () => {
    if (step === 0) {
      if (!personal.applicant_name.trim()) return "Full legal name is required.";
      if (!personal.email.trim() || !/\S+@\S+\.\S+/.test(personal.email)) return "Valid email address is required.";
      if (!personal.phone.trim() || personal.phone.length < 7) return "Valid phone number is required.";
    }
    if (step === 1) {
      const amt = parseFloat(loan.amount_requested);
      if (!amt || amt < 10000) return "Loan amount must be at least ₹10,000.";
      if (!loan.purpose.trim()) return "Please state the purpose or utilization statement for this loan.";
    }
    if (step === 2) {
      if (!idFields.user_dob.trim()) return "Date of birth is required.";
      if (!idFields.user_aadhaar.trim() || idFields.user_aadhaar.replace(/\D/g, "").length !== 12)
        return "Valid 12-digit Aadhaar number required.";
      if (!idFields.user_pan.trim() || idFields.user_pan.length !== 10)
        return "Valid 10-character PAN number required.";
      if (!aadhaarFile) return "Please upload your Aadhaar card image.";
      if (!panFile) return "Please upload your PAN card image.";
      if (!verifyResult) return "Please click 'Run AI Document Verification' before proceeding.";
      if (!verifyResult.overall_match)
        return "Document verification did not pass. Please ensure clear images matching your details.";
    }
    if (step === 3) {
      const requiredDocs = currentDocConfig.docs.filter((d) => d.required);
      const missing = requiredDocs.filter(
        (d) => !categoryDocs[`${loan.loan_type}_${d.id}`]?.file
      );
      if (missing.length > 0) {
        return `Please upload mandatory ${loan.loan_type} Loan document(s): ${missing
          .map((d) => d.label)
          .join(", ")}`;
      }
    }
    return null;
  };

  const handleNext = () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setError("");
    setStep((s) => s - 1);
  };

  const handleAadhaarUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setAadhaarFile(file);
      setAadhaarPreview(URL.createObjectURL(file));
      setVerifyResult(null);
    }
  };

  const handlePanUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPanFile(file);
      setPanPreview(URL.createObjectURL(file));
      setVerifyResult(null);
    }
  };

  const runVerification = async () => {
    if (!aadhaarFile || !panFile) {
      setError("Please select both Aadhaar and PAN card image files.");
      return;
    }
    setVerifying(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("user_name", personal.applicant_name);
      fd.append("user_dob", idFields.user_dob);
      fd.append("user_gender", idFields.user_gender);
      fd.append("user_aadhaar", idFields.user_aadhaar.replace(/\D/g, ""));
      fd.append("user_pan", idFields.user_pan.toUpperCase());
      fd.append("aadhaar_image", aadhaarFile);
      fd.append("pan_image", panFile);

      const res = await api.verifyDocuments(fd);
      setVerifyResult(res);
    } catch (err) {
      setError(err.message || "AI Verification failed. Please ensure the backend engine is running.");
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      // Gather all attached category documents for the selected loan type
      const attachedCategoryDocs = currentDocConfig.docs
        .map((d) => {
          const docItem = categoryDocs[`${loan.loan_type}_${d.id}`];
          if (!docItem) return null;
          return {
            doc_id: d.id,
            label: d.label,
            required: d.required,
            filename: docItem.name,
            file_size_bytes: docItem.size,
            file_size_formatted: formatFileSize(docItem.size),
            file_type: docItem.type,
            file_data: docItem.base64,
            uploaded_at: docItem.uploadedAt,
          };
        })
        .filter(Boolean);

      const payload = {
        applicant_name: personal.applicant_name,
        email: personal.email,
        phone: personal.phone,
        loan_type: loan.loan_type,
        amount_requested: parseFloat(loan.amount_requested),
        tenure_months: parseInt(loan.tenure_months),
        interest_rate: parseFloat(loan.interest_rate),
        purpose: loan.purpose,
        dob: idFields.user_dob,
        gender: idFields.user_gender,
        aadhaar_number: idFields.user_aadhaar.replace(/\D/g, ""),
        pan_number: idFields.user_pan.toUpperCase(),
        id_verified: Boolean(verifyResult?.overall_match),
        loan_documents: attachedCategoryDocs,
        verification_data: verifyResult || {},
      };

      const res = await api.applyLoan(payload);
      setSuccess(res.application || { _id: "APPLIED", emi, ...payload });
    } catch (err) {
      setError(err.message || "Failed to submit loan application.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    const LoanIcon = LOAN_DOCUMENTS_CONFIG[success.loan_type]?.icon || Banknote;
    const attachedCount = success.loan_documents?.length || 0;

    return (
      <div className="fade-in" style={{ maxWidth: 680, margin: "30px auto" }}>
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "40px 32px",
            borderTop: "4px solid #10B981",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "#ECFDF5",
              color: "#10B981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 18px",
              boxShadow: "0 0 24px rgba(16, 185, 129, 0.25)",
            }}
          >
            <CheckCircle size={40} />
          </div>

          <h2
            style={{
              fontFamily: "Outfit, sans-serif",
              fontSize: "1.8rem",
              fontWeight: 800,
              color: "#0F172A",
              marginBottom: 6,
            }}
          >
            {success.loan_type} Loan Application Submitted!
          </h2>
          <p style={{ color: "#64748B", fontSize: "0.92rem", marginBottom: 24 }}>
            Your application and verified {success.loan_type} documents have been securely transmitted to underwriting.
          </p>

          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "var(--radius-md)",
              padding: "20px 22px",
              textAlign: "left",
              marginBottom: 26,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: "0.84rem", color: "#64748B" }}>Application Ref ID</span>
              <span style={{ fontSize: "0.84rem", fontWeight: 800, color: "#0F172A", fontFamily: "monospace" }}>
                {success._id || "REF-892189"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: "0.84rem", color: "#64748B" }}>Loan Category</span>
              <span style={{ fontSize: "0.84rem", fontWeight: 800, color: "#0891B2", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <LoanIcon size={15} /> {success.loan_type} Loan • {fmt(success.amount_requested)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: "0.84rem", color: "#64748B" }}>Estimated Monthly EMI</span>
              <span style={{ fontSize: "0.84rem", fontWeight: 800, color: "#10B981" }}>
                {fmt(success.emi)}/mo ({success.tenure_months} months)
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: "0.84rem", color: "#64748B" }}>AI KYC Verification</span>
              <span className="badge badge-approved" style={{ fontSize: "0.74rem" }}>
                ✓ Passed (100% Match)
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.84rem", color: "#64748B" }}>{success.loan_type} Documents</span>
              <span style={{ fontSize: "0.84rem", fontWeight: 700, color: "#0F172A" }}>
                ✓ {attachedCount} Document{attachedCount !== 1 ? "s" : ""} Attached
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button className="btn btn-accent" onClick={() => navigate("/approvals")}>
              Track Application Status <ArrowRight size={15} />
            </button>
            <button className="btn btn-ghost" onClick={() => navigate("/")}>
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const CurrentIcon = currentDocConfig.icon;

  return (
    <div className="fade-in" style={{ maxWidth: 880, margin: "0 auto" }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1>Enterprise Loan Application</h1>
        <p>AI-powered document verification, category-specific proofs & instant underwriting cross-checks</p>
      </div>

      {/* Stepper Bar */}
      <div className="steps">
        {STEPS.map((s, i) => (
          <div key={s} className={`step ${i === step ? "active" : i < step ? "done" : ""}`}>
            <div className="step-num">{i < step ? "✓" : i + 1}</div>
            <span className="step-label">{s}</span>
            {i < STEPS.length - 1 && <div className="step-connector" />}
          </div>
        ))}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error">
          <XCircle size={17} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* ─── STEP 0: PERSONAL PROFILE ────────────────────────────────────────── */}
      {step === 0 && (
        <div className="card fade-in">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <User size={18} color="#06B6D4" />
            <span style={{ fontFamily: "Outfit", fontSize: "1.15rem", fontWeight: 800 }}>
              Applicant Personal Profile
            </span>
          </div>
          <p style={{ color: "#64748B", fontSize: "0.86rem", marginBottom: 20 }}>
            Ensure your name matches your official government identity documents exactly.
          </p>

          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label>Full Legal Name (as per ID Cards) *</label>
              <input
                className="form-control"
                placeholder="Enter full legal name"
                value={personal.applicant_name}
                onChange={(e) => setP("applicant_name", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Email Address *</label>
              <input
                className="form-control"
                type="email"
                placeholder="Enter email address"
                value={personal.email}
                onChange={(e) => setP("email", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Contact Phone Number *</label>
              <input
                className="form-control"
                placeholder="Enter contact phone number"
                value={personal.phone}
                onChange={(e) => setP("phone", e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
            <button className="btn btn-primary" onClick={handleNext}>
              Next: Select Loan Category <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 1: LOAN DETAILS & SIMULATOR ──────────────────────────────────── */}
      {step === 1 && (
        <div className="card fade-in">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Calculator size={18} color="#06B6D4" />
            <span style={{ fontFamily: "Outfit", fontSize: "1.15rem", fontWeight: 800 }}>
              Loan Category & Repayment Simulator
            </span>
          </div>
          <p style={{ color: "#64748B", fontSize: "0.86rem", marginBottom: 20 }}>
            Select your loan purpose. Documentation requirements in subsequent steps will dynamically adjust to your choice.
          </p>

          {/* Loan Category Selector Pills */}
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: "block", marginBottom: 10, fontSize: "0.84rem", fontWeight: 700, color: "#334155" }}>
              Select Loan Type:
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              {LOAN_TYPES.map((type) => {
                const isSel = loan.loan_type === type;
                const IconCmp = LOAN_DOCUMENTS_CONFIG[type]?.icon || Banknote;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setL("loan_type", type)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                      padding: "14px 10px",
                      borderRadius: "var(--radius-md)",
                      border: isSel ? "2px solid #0891B2" : "1px solid #E2E8F0",
                      background: isSel ? "linear-gradient(135deg, #ECFEFF 0%, #E0F2FE 100%)" : "#FFFFFF",
                      color: isSel ? "#0891B2" : "#475569",
                      fontWeight: isSel ? 800 : 600,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: isSel ? "0 4px 14px rgba(6, 182, 212, 0.18)" : "var(--shadow-xs)",
                    }}
                  >
                    <IconCmp size={22} color={isSel ? "#0891B2" : "#64748B"} />
                    <span style={{ fontSize: "0.85rem" }}>{type} Loan</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 24, alignItems: "flex-start" }}>
            {/* Left Controls */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <label>Loan Amount (Principal)</label>
                  <span style={{ fontWeight: 800, color: "#0891B2" }}>{fmt(loan.amount_requested)}</span>
                </div>
                <input
                  type="range"
                  min="50000"
                  max="10000000"
                  step="25000"
                  value={loan.amount_requested}
                  onChange={(e) => setL("amount_requested", e.target.value)}
                />
                <input
                  className="form-control"
                  type="number"
                  placeholder="Enter amount in ₹"
                  value={loan.amount_requested}
                  onChange={(e) => setL("amount_requested", e.target.value)}
                  style={{ marginTop: 6 }}
                />
              </div>

              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <label>Loan Tenure (Months)</label>
                  <span style={{ fontWeight: 800, color: "#0891B2" }}>{loan.tenure_months} months</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="84"
                  step="6"
                  value={loan.tenure_months}
                  onChange={(e) => setL("tenure_months", e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Loan Purpose / Utilization Statement *</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder={`State the intended purpose for this ${loan.loan_type} loan`}
                  value={loan.purpose}
                  onChange={(e) => setL("purpose", e.target.value)}
                />
              </div>
            </div>

            {/* Right: Live EMI Breakdown Card */}
            <div
              style={{
                background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
                color: "#FFFFFF",
                borderRadius: "var(--radius-lg)",
                padding: "24px 22px",
                boxShadow: "0 10px 30px rgba(15, 23, 42, 0.2)",
              }}
            >
              <div style={{ fontSize: "0.76rem", textTransform: "uppercase", color: "#94A3B8", fontWeight: 700 }}>
                Estimated Monthly Repayment
              </div>
              <div
                style={{
                  fontFamily: "Outfit, sans-serif",
                  fontSize: "2.1rem",
                  fontWeight: 800,
                  color: "#38BDF8",
                  margin: "6px 0 16px",
                }}
              >
                {fmt(emi)}
                <span style={{ fontSize: "0.85rem", color: "#94A3B8", fontWeight: 500 }}>/month</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 14, borderTop: "1px solid rgba(255, 255, 255, 0.12)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.84rem" }}>
                  <span style={{ color: "#94A3B8" }}>Selected Type</span>
                  <span style={{ fontWeight: 700, color: "#38BDF8" }}>{loan.loan_type} Loan</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.84rem" }}>
                  <span style={{ color: "#94A3B8" }}>Principal Amount</span>
                  <span style={{ fontWeight: 700 }}>{fmt(loan.amount_requested)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.84rem" }}>
                  <span style={{ color: "#94A3B8" }}>Interest Rate (p.a.)</span>
                  <span style={{ fontWeight: 700, color: "#34D399" }}>{loan.interest_rate}%</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.84rem" }}>
                  <span style={{ color: "#94A3B8" }}>Total Interest</span>
                  <span style={{ fontWeight: 700, color: "#F59E0B" }}>{fmt(totalInterest)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", paddingTop: 8, borderTop: "1px solid rgba(255, 255, 255, 0.1)" }}>
                  <span style={{ color: "#FFFFFF", fontWeight: 700 }}>Total Payable</span>
                  <span style={{ fontWeight: 800, color: "#38BDF8" }}>{fmt(totalPayable)}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
            <button className="btn btn-ghost" onClick={handleBack}>
              <ArrowLeft size={15} /> Back
            </button>
            <button className="btn btn-primary" onClick={handleNext}>
              Next: Identity Verification <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 2: ID DETAILS & AI KYC VERIFICATION ────────────────────────── */}
      {step === 2 && (
        <div className="card fade-in">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Sparkles size={18} color="#06B6D4" />
            <span style={{ fontFamily: "Outfit", fontSize: "1.15rem", fontWeight: 800 }}>
              Government Identity & AI KYC Verification
            </span>
          </div>
          <p style={{ color: "#64748B", fontSize: "0.86rem", marginBottom: 20 }}>
            Enter your credentials and upload clear front images of your Aadhaar and PAN cards. The AI OCR engine validates authenticity in real-time.
          </p>

          <div className="form-grid" style={{ marginBottom: 20 }}>
            <div className="form-group">
              <label>Date of Birth *</label>
              <input
                type="date"
                className="form-control"
                value={idFields.user_dob}
                onChange={(e) => setI("user_dob", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Gender *</label>
              <select
                className="form-control"
                value={idFields.user_gender}
                onChange={(e) => setI("user_gender", e.target.value)}
              >
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>12-Digit Aadhaar Number *</label>
              <input
                className="form-control"
                placeholder="Enter 12-digit Aadhaar number"
                value={idFields.user_aadhaar}
                onChange={(e) => setI("user_aadhaar", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>10-Character PAN Number *</label>
              <input
                className="form-control"
                placeholder="Enter 10-character PAN number"
                value={idFields.user_pan}
                onChange={(e) => setI("user_pan", e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 20 }}>
            {/* Aadhaar Dropzone */}
            <div
              style={{
                border: "2px dashed #CBD5E1",
                borderRadius: "var(--radius-md)",
                padding: "20px 16px",
                textAlign: "center",
                background: "#F8FAFC",
                cursor: "pointer",
                position: "relative",
                overflow: "hidden",
                transition: "all 0.2s ease",
              }}
              onClick={() => aadhaarRef.current?.click()}
            >
              {verifying && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    height: "3px",
                    background: "linear-gradient(90deg, transparent, #06B6D4, transparent)",
                    boxShadow: "0 0 10px #06B6D4",
                    animation: "scanLine 1.5s ease-in-out infinite",
                    zIndex: 2,
                  }}
                />
              )}
              <input
                ref={aadhaarRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleAadhaarUpload}
              />
              {aadhaarPreview ? (
                <div>
                  <img
                    src={aadhaarPreview}
                    alt="Aadhaar preview"
                    style={{ maxHeight: 110, maxWidth: "100%", borderRadius: 6, objectFit: "contain" }}
                  />
                  <div style={{ fontSize: "0.78rem", color: "#10B981", fontWeight: 700, marginTop: 8 }}>
                    ✓ Aadhaar Attached ({aadhaarFile?.name})
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <UploadCloud size={30} color="#0891B2" />
                  <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#0F172A" }}>
                    Upload Aadhaar Card Image
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "#94A3B8" }}>Supports JPG, PNG, WebP</div>
                </div>
              )}
            </div>

            {/* PAN Dropzone */}
            <div
              style={{
                border: "2px dashed #CBD5E1",
                borderRadius: "var(--radius-md)",
                padding: "20px 16px",
                textAlign: "center",
                background: "#F8FAFC",
                cursor: "pointer",
                position: "relative",
                overflow: "hidden",
                transition: "all 0.2s ease",
              }}
              onClick={() => panRef.current?.click()}
            >
              {verifying && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    height: "3px",
                    background: "linear-gradient(90deg, transparent, #06B6D4, transparent)",
                    boxShadow: "0 0 10px #06B6D4",
                    animation: "scanLine 1.5s ease-in-out infinite",
                    zIndex: 2,
                  }}
                />
              )}
              <input
                ref={panRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handlePanUpload}
              />
              {panPreview ? (
                <div>
                  <img
                    src={panPreview}
                    alt="PAN preview"
                    style={{ maxHeight: 110, maxWidth: "100%", borderRadius: 6, objectFit: "contain" }}
                  />
                  <div style={{ fontSize: "0.78rem", color: "#10B981", fontWeight: 700, marginTop: 8 }}>
                    ✓ PAN Attached ({panFile?.name})
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <UploadCloud size={30} color="#0891B2" />
                  <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#0F172A" }}>
                    Upload PAN Card Image
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "#94A3B8" }}>Supports JPG, PNG, WebP</div>
                </div>
              )}
            </div>
          </div>

          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <button
              type="button"
              className="btn btn-accent"
              style={{ padding: "12px 26px" }}
              onClick={runVerification}
              disabled={verifying || !aadhaarFile || !panFile}
            >
              {verifying ? (
                <>
                  <RefreshCw size={16} style={{ animation: "spin 0.8s linear infinite" }} /> AI OCR Engine Scanning Credentials...
                </>
              ) : (
                <>
                  <ShieldCheck size={16} /> Run AI Document Verification
                </>
              )}
            </button>
          </div>

          {/* Verification Results Comparison */}
          {verifyResult && (
            <div
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "var(--radius-md)",
                padding: "16px 20px",
                marginBottom: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: "0.92rem", fontWeight: 800, color: "#0F172A" }}>
                  AI Verification Results
                </span>
                <span
                  className={verifyResult.overall_match ? "badge badge-approved" : "badge badge-rejected"}
                  style={{ fontSize: "0.78rem" }}
                >
                  {verifyResult.overall_match ? "✓ 100% Match Passed" : "✗ Verification Discrepancies"}
                </span>
              </div>

              <FieldRow
                label="Name Match"
                userVal={personal.applicant_name}
                extractedVal={verifyResult.extracted_data?.name || verifyResult.fields?.Name?.extracted_value || "Extracted Name"}
                match={verifyResult.checks?.name_match ?? verifyResult.fields?.Name?.match ?? Boolean(verifyResult.overall_match)}
              />
              <FieldRow
                label="Aadhaar No."
                userVal={idFields.user_aadhaar}
                extractedVal={verifyResult.extracted_data?.aadhaar_number || verifyResult.fields?.["Aadhaar Number"]?.extracted_value || "Extracted Aadhaar"}
                match={verifyResult.checks?.aadhaar_match ?? verifyResult.fields?.["Aadhaar Number"]?.match ?? Boolean(verifyResult.overall_match)}
              />
              <FieldRow
                label="PAN No."
                userVal={idFields.user_pan}
                extractedVal={verifyResult.extracted_data?.pan_number || verifyResult.fields?.["PAN Number"]?.extracted_value || "Extracted PAN"}
                match={verifyResult.checks?.pan_match ?? verifyResult.fields?.["PAN Number"]?.match ?? Boolean(verifyResult.overall_match)}
              />
              {idFields.user_dob && (
                <FieldRow
                  label="Date of Birth"
                  userVal={idFields.user_dob}
                  extractedVal={verifyResult.extracted_data?.dob || verifyResult.fields?.["Date of Birth"]?.extracted_value || "Extracted DOB"}
                  match={verifyResult.checks?.dob_match ?? verifyResult.fields?.["Date of Birth"]?.match ?? true}
                />
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
            <button className="btn btn-ghost" onClick={handleBack}>
              <ArrowLeft size={15} /> Back
            </button>
            <button className="btn btn-primary" onClick={handleNext}>
              Next: Upload {loan.loan_type} Documents <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 3: DYNAMIC CATEGORY DOCUMENTS ─────────────────────────────── */}
      {step === 3 && (
        <div className="card fade-in">
          {/* Header with Category Badge */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <CurrentIcon size={22} color={currentDocConfig.badgeColor} />
                <span style={{ fontFamily: "Outfit", fontSize: "1.25rem", fontWeight: 800, color: "#0F172A" }}>
                  {currentDocConfig.title}
                </span>
              </div>
              <p style={{ color: "#64748B", fontSize: "0.88rem" }}>
                {currentDocConfig.description}
              </p>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                borderRadius: "var(--radius-full)",
                background: currentDocConfig.badgeBg,
                border: `1px solid ${currentDocConfig.badgeColor}40`,
                fontSize: "0.82rem",
                fontWeight: 800,
                color: currentDocConfig.badgeColor,
              }}
            >
              <CurrentIcon size={14} />
              {loan.loan_type} Loan • {uploadedMandatoryCount} / {totalMandatoryCount} Mandatory Uploaded
            </div>
          </div>

          {/* Info Banner for the Specific Loan Type */}
          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "var(--radius-md)",
              padding: "12px 16px",
              marginBottom: 22,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: "0.82rem",
              color: "#475569",
            }}
          >
            <Info size={16} color="#0891B2" style={{ flexShrink: 0 }} />
            <span>
              {loan.loan_type === "Home" && "Upload valid property ownership deeds and municipal tax slips to establish clear title verification."}
              {loan.loan_type === "Vehicle" && "Upload Vehicle Registration Certificate (RC) for used vehicle or Authorized Dealer Proforma Invoice for new vehicle along with Driver's License."}
              {loan.loan_type === "Personal" && "Upload recent 3 months payslips and 6 months salary bank statements to verify income stability."}
              {loan.loan_type === "Business" && "Upload GST registration certificate / Udyam MSME and 12-month current account commercial bank statements."}
              {loan.loan_type === "Education" && "Upload official institute admission offer letter and fee structure schedule for direct university disbursement."}
            </span>
          </div>

          {/* Document Upload Cards Grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {currentDocConfig.docs.map((docDef) => {
              const uploadKey = `${loan.loan_type}_${docDef.id}`;
              const docState = categoryDocs[uploadKey];
              const isUploaded = Boolean(docState?.file);

              return (
                <div
                  key={docDef.id}
                  style={{
                    border: isUploaded ? "1px solid #A7F3D0" : "1px solid #E2E8F0",
                    borderRadius: "var(--radius-md)",
                    padding: "18px 20px",
                    background: isUploaded ? "rgba(236, 253, 245, 0.3)" : "#FFFFFF",
                    boxShadow: "var(--shadow-xs)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#0F172A" }}>
                          {docDef.label}
                        </span>
                        {docDef.required ? (
                          <span
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: 800,
                              color: "#DC2626",
                              background: "#FEE2E2",
                              padding: "2px 8px",
                              borderRadius: "var(--radius-full)",
                            }}
                          >
                            Mandatory *
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              color: "#64748B",
                              background: "#F1F5F9",
                              padding: "2px 8px",
                              borderRadius: "var(--radius-full)",
                            }}
                          >
                            Optional
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748B", marginTop: 4 }}>
                        {docDef.description}
                      </div>
                    </div>

                    {isUploaded && (
                      <span className="badge badge-approved" style={{ fontSize: "0.75rem", flexShrink: 0 }}>
                        <CheckCircle size={13} /> Attached
                      </span>
                    )}
                  </div>

                  {/* Upload Controls or Attached File Preview */}
                  {isUploaded ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "#FFFFFF",
                        border: "1px solid #CBD5E1",
                        borderRadius: "var(--radius-sm)",
                        padding: "10px 14px",
                        marginTop: 12,
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        {docState.preview ? (
                          <img
                            src={docState.preview}
                            alt="preview"
                            style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover", border: "1px solid #E2E8F0" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 6,
                              background: "#EEF2FF",
                              color: "#6366F1",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <FileText size={20} />
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#0F172A", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {docState.name}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                            {formatFileSize(docState.size)} • {docState.type || "Document"}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <label
                          className="btn btn-ghost btn-sm"
                          style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}
                        >
                          <UploadCloud size={13} /> Replace
                          <input
                            type="file"
                            accept={docDef.accept}
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleCategoryDocUpload(docDef, f);
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: "#EF4444" }}
                          onClick={() => handleRemoveCategoryDoc(docDef.id)}
                        >
                          <Trash2 size={13} /> Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        border: "2px dashed #CBD5E1",
                        borderRadius: "var(--radius-sm)",
                        padding: "18px 14px",
                        marginTop: 12,
                        background: "#F8FAFC",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const f = e.dataTransfer.files?.[0];
                        if (f) handleCategoryDocUpload(docDef, f);
                      }}
                    >
                      <input
                        type="file"
                        accept={docDef.accept}
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleCategoryDocUpload(docDef, f);
                        }}
                      />
                      <UploadCloud size={24} color="#0891B2" />
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0F172A" }}>
                        Click to upload or drag & drop {docDef.label}
                      </div>
                      <div style={{ fontSize: "0.74rem", color: "#94A3B8" }}>
                        Supports JPG, PNG, WebP, or PDF (Max 15MB)
                      </div>
                    </label>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 26 }}>
            <button className="btn btn-ghost" onClick={handleBack}>
              <ArrowLeft size={15} /> Back
            </button>
            <button className="btn btn-primary" onClick={handleNext}>
              Next: Review & Submit <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 4: EXECUTIVE REVIEW & SUBMIT ─────────────────────────────────── */}
      {step === 4 && (
        <div className="card fade-in">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <FileCheck size={18} color="#06B6D4" />
            <span style={{ fontFamily: "Outfit", fontSize: "1.15rem", fontWeight: 800 }}>
              Executive Application Summary
            </span>
          </div>
          <p style={{ color: "#64748B", fontSize: "0.86rem", marginBottom: 20 }}>
            Please review the verified parameters and attached {loan.loan_type} documents below before final transmission to underwriting.
          </p>

          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "var(--radius-md)",
              padding: "20px",
              marginBottom: 20,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: "0.74rem", color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>
                  Applicant
                </span>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0F172A" }}>
                  {personal.applicant_name}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#64748B" }}>
                  {personal.email} • {personal.phone}
                </div>
              </div>

              <div>
                <span style={{ fontSize: "0.74rem", color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>
                  Loan Requested
                </span>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0891B2" }}>
                  {fmt(loan.amount_requested)} ({loan.loan_type} Loan)
                </div>
                <div style={{ fontSize: "0.8rem", color: "#64748B" }}>
                  {loan.tenure_months} months @ {loan.interest_rate}% p.a.
                </div>
              </div>

              <div>
                <span style={{ fontSize: "0.74rem", color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>
                  Aadhaar & PAN Verification
                </span>
                <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                  {idFields.user_aadhaar} • {idFields.user_pan}
                  <span className="badge badge-approved" style={{ fontSize: "0.7rem", padding: "1px 6px" }}>
                    ✓ 100% Match
                  </span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: "0.74rem", color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>
                  Monthly EMI Estimate
                </span>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#10B981" }}>
                  {fmt(emi)}/month
                </div>
              </div>
            </div>

            {/* Attached Category Documents List */}
            <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#0F172A", textTransform: "uppercase" }}>
                  Attached {loan.loan_type} Documents:
                </span>
                <span style={{ fontSize: "0.78rem", color: "#64748B" }}>
                  {currentDocConfig.docs.filter((d) => categoryDocs[`${loan.loan_type}_${d.id}`]?.file).length} files attached
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {currentDocConfig.docs.map((docDef) => {
                  const docItem = categoryDocs[`${loan.loan_type}_${docDef.id}`];
                  if (!docItem?.file) return null;
                  return (
                    <div
                      key={docDef.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: "var(--radius-sm)",
                        padding: "8px 12px",
                        fontSize: "0.82rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <FileText size={15} color="#0891B2" />
                        <span style={{ fontWeight: 700, color: "#0F172A" }}>{docDef.label}:</span>
                        <span style={{ color: "#64748B" }}>{docItem.name}</span>
                      </div>
                      <span style={{ color: "#94A3B8", fontSize: "0.76rem" }}>
                        {formatFileSize(docItem.size)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
            <button className="btn btn-ghost" onClick={handleBack} disabled={submitting}>
              <ArrowLeft size={15} /> Back
            </button>
            <button className="btn btn-accent btn-lg" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <RefreshCw size={16} style={{ animation: "spin 0.8s linear infinite" }} /> Submitting Application...
                </>
              ) : (
                <>
                  <ShieldCheck size={18} /> Confirm & Submit Application
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
