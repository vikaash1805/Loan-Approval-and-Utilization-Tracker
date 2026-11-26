import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
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
  Lock,
  Unlock,
  Clock,
  Download,
} from "lucide-react";

import { LOAN_DOCUMENTS_CONFIG } from "../config/loanDocuments";
export { LOAN_DOCUMENTS_CONFIG };


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

// Cryptographic SHA-256 document integrity calculation
const computeSHA256 = async (file) => {
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
};

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
  const { addNotification } = useNotifications();
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
  const [aadhaarVerifying, setAadhaarVerifying] = useState(false);
  const [aadhaarResult, setAadhaarResult] = useState(null);
  const [panVerifying, setPanVerifying] = useState(false);
  const [panResult, setPanResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  const aadhaarMatched = Boolean(aadhaarResult?.matched);
  const panMatched = Boolean(panResult?.matched);

  // Keep overall verifyResult synced when both documents match
  useEffect(() => {
    if (aadhaarResult?.matched && panResult?.matched) {
      setVerifyResult({
        overall_match: true,
        success: true,
        extracted_data: {
          name: personal.applicant_name,
          dob: idFields.user_dob,
          gender: idFields.user_gender,
          aadhaar_number: aadhaarResult.extracted_number || idFields.user_aadhaar.replace(/\D/g, ""),
          pan_number: panResult.extracted_number || idFields.user_pan.toUpperCase(),
        },
        checks: {
          name_match: true,
          dob_match: true,
          gender_match: true,
          aadhaar_match: true,
          pan_match: true,
        },
        fields: {
          Name: { match: true, user_value: personal.applicant_name, extracted_value: personal.applicant_name },
          "Aadhaar Number": { match: true, user_value: idFields.user_aadhaar, extracted_value: aadhaarResult.extracted_number },
          "PAN Number": { match: true, user_value: idFields.user_pan, extracted_value: panResult.extracted_number },
        },
      });
    } else {
      setVerifyResult(null);
    }
  }, [aadhaarResult, panResult, personal.applicant_name, idFields.user_dob, idFields.user_gender, idFields.user_aadhaar, idFields.user_pan]);

  // Step 3: Dynamic Category Documents
  // Keyed by `${loan_type}_${doc_id}` -> { file, preview, base64, name, size, docId, label, required, section, upload_status, verification_status, sha256_hash }
  const [categoryDocs, setCategoryDocs] = useState({});
  const [previewDoc, setPreviewDoc] = useState(null);

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

  // Auto-sync KYC Aadhaar and PAN documents into categoryDocs for the current loan type
  useEffect(() => {
    if (aadhaarFile) {
      fileToBase64(aadhaarFile).then(async (b64) => {
        const sha = await computeSHA256(aadhaarFile);
        const docId = loan.loan_type === "Education" ? "student_aadhaar" : "aadhaar";
        const key = `${loan.loan_type}_${docId}`;
        setCategoryDocs((prev) => ({
          ...prev,
          [key]: {
            file: aadhaarFile,
            preview: aadhaarPreview || (aadhaarFile.type?.startsWith("image/") ? URL.createObjectURL(aadhaarFile) : ""),
            base64: b64,
            name: aadhaarFile.name,
            size: aadhaarFile.size,
            type: aadhaarFile.type,
            docId,
            label: "Aadhaar",
            section: loan.loan_type === "Education" ? "Student" : "",
            required: true,
            sha256_hash: sha,
            upload_status: "Uploaded",
            verification_status: aadhaarMatched ? "Verified" : (aadhaarResult ? "Mismatch" : "Pending Verification"),
            uploadedAt: prev[key]?.uploadedAt || new Date().toISOString(),
          },
        }));
      }).catch(() => {});
    }
  }, [aadhaarFile, aadhaarPreview, aadhaarMatched, aadhaarResult, loan.loan_type]);

  useEffect(() => {
    if (panFile) {
      fileToBase64(panFile).then(async (b64) => {
        const sha = await computeSHA256(panFile);
        const docId = loan.loan_type === "Education" ? "student_pan" : "pan";
        const key = `${loan.loan_type}_${docId}`;
        setCategoryDocs((prev) => ({
          ...prev,
          [key]: {
            file: panFile,
            preview: panPreview || (panFile.type?.startsWith("image/") ? URL.createObjectURL(panFile) : ""),
            base64: b64,
            name: panFile.name,
            size: panFile.size,
            type: panFile.type,
            docId,
            label: loan.loan_type === "Education" ? "PAN where applicable" : "PAN",
            section: loan.loan_type === "Education" ? "Student" : "",
            required: loan.loan_type !== "Education",
            sha256_hash: sha,
            upload_status: "Uploaded",
            verification_status: panMatched ? "Verified" : (panResult ? "Mismatch" : "Pending Verification"),
            uploadedAt: prev[key]?.uploadedAt || new Date().toISOString(),
          },
        }));
      }).catch(() => {});
    }
  }, [panFile, panPreview, panMatched, panResult, loan.loan_type]);

  // Count uploaded mandatory documents
  const uploadedMandatoryCount = currentDocConfig.docs
    .filter((d) => d.required)
    .filter((d) => categoryDocs[`${loan.loan_type}_${d.id}`]?.file).length;
  const totalMandatoryCount = currentDocConfig.docs.filter((d) => d.required).length;

  // Handle Category Document Upload
  const handleCategoryDocUpload = async (docDef, file) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setError(`File "${file.name}" exceeds the maximum allowed limit of 15 MB.`);
      return;
    }
    try {
      const b64 = await fileToBase64(file);
      const isImg = file.type.startsWith("image/");
      const previewUrl = isImg ? URL.createObjectURL(file) : "";
      const sha256 = await computeSHA256(file);

      // If uploading Aadhaar or PAN in checklist, sync to KYC state
      if (docDef.id === "aadhaar" || docDef.id === "student_aadhaar") {
        setAadhaarFile(file);
        setAadhaarPreview(previewUrl);
        const currentNum = idFields.user_aadhaar.replace(/\D/g, "");
        if (currentNum.length === 12) {
          verifyAadhaarDoc(file, currentNum);
        }
      } else if (docDef.id === "pan" || docDef.id === "student_pan") {
        setPanFile(file);
        setPanPreview(previewUrl);
        const currentPan = idFields.user_pan.trim().toUpperCase();
        if (currentPan.length === 10) {
          verifyPanDoc(file, currentPan);
        }
      }

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
          section: docDef.section || "",
          required: docDef.required,
          sha256_hash: sha256,
          upload_status: "Uploaded",
          verification_status:
            (docDef.id === "aadhaar" && aadhaarMatched) || (docDef.id === "pan" && panMatched)
              ? "Verified"
              : "Pending Officer Review",
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
    if (docId === "aadhaar" || docId === "student_aadhaar") {
      setAadhaarFile(null);
      setAadhaarPreview("");
      setAadhaarResult(null);
    } else if (docId === "pan" || docId === "student_pan") {
      setPanFile(null);
      setPanPreview("");
      setPanResult(null);
    }
  };


  // Validation per step
  const validate = () => {
    if (step === 0) {
      const name = personal.applicant_name.trim();
      if (!name || name.length < 2) return "Full legal name is required (at least 2 characters).";
      if (!/^[A-Za-z\s.'-]+$/.test(name))
        return "Applicant name should contain only alphabetic letters.";
      if (!personal.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personal.email.trim()))
        return "Valid email address is required (e.g. name@domain.com).";
      const cleanedPhone = personal.phone.replace(/\D/g, "");
      if (cleanedPhone.length !== 10)
        return "Valid 10-digit mobile number is required.";
      if (!/^[6-9]/.test(cleanedPhone))
        return "Please enter a valid mobile number starting with 6, 7, 8, or 9.";
    }
    if (step === 1) {
      const amt = parseFloat(loan.amount_requested);
      if (isNaN(amt) || amt < 10000) return "Loan amount must be at least ₹10,000.";
      if (amt > 50000000) return "Maximum loan amount cannot exceed ₹5,00,00,000 (₹5 Crore).";
      const tenure = parseInt(loan.tenure_months);
      if (isNaN(tenure) || tenure < 1 || tenure > 360) return "Loan tenure must be between 1 and 360 months.";
      const rate = parseFloat(loan.interest_rate);
      if (isNaN(rate) || rate <= 0 || rate > 50) return "Interest rate must be between 0.1% and 50% p.a.";
      if (!loan.purpose.trim() || loan.purpose.trim().length < 5)
        return "Please state the purpose or utilization statement for this loan (at least 5 characters).";
    }
    if (step === 2) {
      if (!idFields.user_dob.trim()) return "Date of birth is required.";
      const dobDate = new Date(idFields.user_dob);
      if (isNaN(dobDate.getTime())) return "Please enter a valid date of birth.";
      const today = new Date();
      let age = today.getFullYear() - dobDate.getFullYear();
      const m = today.getMonth() - dobDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) age--;
      if (age < 18) return "Applicant must be at least 18 years of age to apply for a loan.";
      if (age > 100) return "Please enter a valid date of birth.";

      const cleanAadhaar = idFields.user_aadhaar.replace(/\D/g, "");
      if (cleanAadhaar.length !== 12)
        return "Valid 12-digit Aadhaar number required.";
      if (!aadhaarFile) return "Please upload your Aadhaar card image.";
      if (!aadhaarMatched)
        return "Aadhaar number must match the uploaded Aadhaar card before proceeding.";

      const cleanPan = idFields.user_pan.trim().toUpperCase();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan))
        return "Valid 10-character PAN number required (format: ABCDE1234F).";
      if (!panFile) return "Please upload your PAN card image.";
      if (!panMatched)
        return "PAN number must match the uploaded PAN card before proceeding.";
    }
    if (step === 3) {
      const requiredDocs = currentDocConfig.docs.filter((d) => d.required);
      const missing = requiredDocs.filter(
        (d) => !categoryDocs[`${loan.loan_type}_${d.id}`]?.file
      );
      if (missing.length > 0) {
        return `Please upload mandatory ${loan.loan_type} Loan document(s): ${missing
          .map((d) => d.label + (d.section ? ` (${d.section})` : ""))
          .join(", ")}`;
      }

    }
    return null;
  };

  // Comprehensive validation across all steps before submission
  const validateAll = () => {
    // Step 0 check
    const name = personal.applicant_name.trim();
    if (!name || name.length < 2) return "Full legal name is required (at least 2 characters).";
    if (!personal.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personal.email.trim()))
      return "Valid email address is required.";
    const cleanedPhone = personal.phone.replace(/\D/g, "");
    if (cleanedPhone.length !== 10 || !/^[6-9]/.test(cleanedPhone))
      return "Valid 10-digit mobile number is required.";

    // Step 1 check
    const amt = parseFloat(loan.amount_requested);
    if (isNaN(amt) || amt < 10000 || amt > 50000000)
      return "Loan amount must be between ₹10,000 and ₹5,00,00,000.";
    const tenure = parseInt(loan.tenure_months);
    if (isNaN(tenure) || tenure < 1 || tenure > 360)
      return "Loan tenure must be between 1 and 360 months.";
    const rate = parseFloat(loan.interest_rate);
    if (isNaN(rate) || rate <= 0 || rate > 50)
      return "Interest rate must be between 0.1% and 50% p.a.";
    if (!loan.purpose.trim())
      return "Please enter the purpose of the loan.";

    // Step 2 check
    if (!idFields.user_dob.trim()) return "Date of birth is required.";
    const dobDate = new Date(idFields.user_dob);
    if (isNaN(dobDate.getTime())) return "Please enter a valid date of birth.";
    const today = new Date();
    let age = today.getFullYear() - dobDate.getFullYear();
    const m = today.getMonth() - dobDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) age--;
    if (age < 18) return "Applicant must be at least 18 years of age.";

    const cleanAadhaar = idFields.user_aadhaar.replace(/\D/g, "");
    if (cleanAadhaar.length !== 12) return "Valid 12-digit Aadhaar number required.";
    if (!aadhaarMatched) return "Aadhaar card must be verified and matched.";

    const cleanPan = idFields.user_pan.trim().toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) return "Valid 10-character PAN number required.";
    if (!panMatched) return "PAN card must be verified and matched.";

    // Step 3 check
    const requiredDocs = currentDocConfig.docs.filter((d) => d.required);
    const missing = requiredDocs.filter(
      (d) => !categoryDocs[`${loan.loan_type}_${d.id}`]?.file
    );
    if (missing.length > 0) {
      return `Please upload mandatory ${loan.loan_type} Loan document(s): ${missing
        .map((d) => d.label + (d.section ? ` (${d.section})` : ""))
        .join(", ")}`;
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

  // ─── AADHAAR VERIFICATION (SINGLE ID) ───
  const verifyAadhaarDoc = async (fileToVerify = aadhaarFile, numberToVerify = idFields.user_aadhaar) => {
    const rawNumber = (numberToVerify || "").replace(/\D/g, "");
    if (!rawNumber || rawNumber.length !== 12) {
      setError("Please enter all 12 digits of your Aadhaar number to verify with the card.");
      return;
    }
    if (!fileToVerify) {
      setError("Please select or upload your Aadhaar card image.");
      return;
    }

    setAadhaarVerifying(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("id_type", "Aadhaar");
      fd.append("id_number", rawNumber);
      fd.append("user_name", personal.applicant_name || "");
      fd.append("user_dob", idFields.user_dob || "");
      fd.append("user_gender", idFields.user_gender || "");
      fd.append("id_image", fileToVerify);

      const res = await api.verifySingleId(fd);
      const isMatch = Boolean(res.number_match ?? res.overall_match);
      setAadhaarResult({
        matched: isMatch,
        extracted_number: res.extracted_number || res.extracted_data?.aadhaar_number || "Not detected",
        message: res.message || (isMatch ? "Aadhaar verified & matched successfully." : "Aadhaar number mismatched with card."),
        details: res,
      });
      if (!isMatch) {
        setError(res.message || "Aadhaar number does not match uploaded card. Field remains editable to correct.");
      }
    } catch (err) {
      setAadhaarResult({
        matched: false,
        extracted_number: "Not detected",
        message: err.message || "Verification failed.",
      });
      setError(err.message || "Aadhaar AI verification failed. Ensure backend server is running.");
    } finally {
      setAadhaarVerifying(false);
    }
  };

  // ─── PAN VERIFICATION (SINGLE ID) ───
  const verifyPanDoc = async (fileToVerify = panFile, numberToVerify = idFields.user_pan) => {
    const panNum = (numberToVerify || "").trim().toUpperCase();
    if (!panNum || panNum.length !== 10) {
      setError("Please enter all 10 characters of your PAN number to verify with the card.");
      return;
    }
    if (!fileToVerify) {
      setError("Please select or upload your PAN card image.");
      return;
    }

    setPanVerifying(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("id_type", "PAN");
      fd.append("id_number", panNum);
      fd.append("user_name", personal.applicant_name || "");
      fd.append("user_dob", idFields.user_dob || "");
      fd.append("id_image", fileToVerify);

      const res = await api.verifySingleId(fd);
      const isMatch = Boolean(res.number_match ?? res.overall_match);
      setPanResult({
        matched: isMatch,
        extracted_number: res.extracted_number || res.extracted_data?.pan_number || "Not detected",
        message: res.message || (isMatch ? "PAN verified & matched successfully." : "PAN number mismatched with card."),
        details: res,
      });
      if (!isMatch) {
        setError(res.message || "PAN number does not match uploaded card. Field remains editable to correct.");
      }
    } catch (err) {
      setPanResult({
        matched: false,
        extracted_number: "Not detected",
        message: err.message || "Verification failed.",
      });
      setError(err.message || "PAN AI verification failed. Ensure backend server is running.");
    } finally {
      setPanVerifying(false);
    }
  };

  // Auto-run when Aadhaar image is selected
  const handleAadhaarUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Aadhaar card file size exceeds 5 MB limit. Please upload an image under 5 MB.");
        return;
      }
      setAadhaarFile(file);
      setAadhaarPreview(URL.createObjectURL(file));
      setAadhaarResult(null);
      setError("");
      const currentNum = idFields.user_aadhaar.replace(/\D/g, "");
      if (currentNum.length === 12) {
        verifyAadhaarDoc(file, currentNum);
      } else {
        setError("Aadhaar image uploaded. Please enter your 12-digit Aadhaar number to verify.");
      }
    }
  };

  // Input change for Aadhaar: freeze if matched, auto-verify if 12 digits reached with image present
  const handleAadhaarNumberChange = (e) => {
    if (aadhaarMatched) return; // Freezed: not allowed to change if matched
    const val = e.target.value;
    setI("user_aadhaar", val);
    const cleaned = val.replace(/\D/g, "");
    if (cleaned.length === 12 && aadhaarFile) {
      verifyAadhaarDoc(aadhaarFile, cleaned);
    }
  };

  // Auto-run when PAN image is selected
  const handlePanUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("PAN card file size exceeds 5 MB limit. Please upload an image under 5 MB.");
        return;
      }
      setPanFile(file);
      setPanPreview(URL.createObjectURL(file));
      setPanResult(null);
      setError("");
      const currentPan = idFields.user_pan.trim().toUpperCase();
      if (currentPan.length === 10) {
        verifyPanDoc(file, currentPan);
      } else {
        setError("PAN image uploaded. Please enter your 10-character PAN number to verify.");
      }
    }
  };

  // Input change for PAN: freeze if matched, auto-verify if 10 characters reached with image present
  const handlePanNumberChange = (e) => {
    if (panMatched) return; // Freezed: not allowed to change if matched
    const val = e.target.value.toUpperCase();
    setI("user_pan", val);
    if (val.trim().length === 10 && panFile) {
      verifyPanDoc(panFile, val.trim());
    }
  };

  // Explicit reload / re-check handlers for AI document verification
  const handleRecheckAadhaar = () => {
    if (!aadhaarFile) {
      setError("Please attach your Aadhaar card image to check with AI.");
      return;
    }
    const cleanNum = (idFields.user_aadhaar || "").replace(/\D/g, "");
    if (cleanNum.length !== 12) {
      setError("Please enter all 12 digits of your Aadhaar number before re-checking.");
      return;
    }
    verifyAadhaarDoc(aadhaarFile, cleanNum);
  };

  const handleRecheckPan = () => {
    if (!panFile) {
      setError("Please attach your PAN card image to check with AI.");
      return;
    }
    const cleanPan = (idFields.user_pan || "").trim().toUpperCase();
    if (cleanPan.length !== 10) {
      setError("Please enter all 10 characters of your PAN number before re-checking.");
      return;
    }
    verifyPanDoc(panFile, cleanPan);
  };

  const handleSubmit = async () => {
    const allErr = validateAll();
    if (allErr) {
      setError(allErr);
      return;
    }

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
            section: d.section || "",
            required: d.required,
            filename: docItem.name,
            file_size_bytes: docItem.size,
            file_size_formatted: formatFileSize(docItem.size),
            file_type: docItem.type,
            file_data: docItem.base64,
            sha256_hash: docItem.sha256_hash || "",
            upload_status: docItem.upload_status || "Uploaded",
            verification_status: docItem.verification_status || (d.is_kyc ? "Verified" : "Pending Officer Review"),
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
      const appRecord = res.application || { _id: "APPLIED", emi, ...payload };
      setSuccess(appRecord);
      addNotification({
        title: "Loan Application Submitted",
        desc: `Your ${payload.loan_type} loan request for ₹${Number(payload.amount_requested).toLocaleString("en-IN")} has been submitted for underwriting.`,
        type: "info",
        link: "/approvals",
        metadata: { loan_id: appRecord._id }
      });
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
                placeholder="e.g. Sample Applicant"
                value={personal.applicant_name}
                onChange={(e) => setP("applicant_name", e.target.value)}
              />
            </div>
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label>Email Address *</label>
                {personal.email && (
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: "#059669",
                      background: "#ECFDF5",
                      border: "1px solid #A7F3D0",
                      padding: "2px 8px",
                      borderRadius: 12,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <ShieldCheck size={12} /> Verified Email
                  </span>
                )}
              </div>
              <input
                className="form-control"
                type="email"
                placeholder="sample@example.com"
                value={personal.email}
                onChange={(e) => setP("email", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Contact Phone Number *</label>
              <input
                className="form-control"
                placeholder="e.g. 98XXXXXXXX"
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
            Enter your credentials and upload clear front images of your Aadhaar and PAN cards. Verification runs automatically as soon as cards are uploaded.
          </p>

          {/* DOB & Gender */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div className="form-group">
              <label>Date of Birth *</label>
              <input
                type="date"
                className="form-control"
                placeholder="DD/MM/YYYY"
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
          </div>

          {/* ────────────────── SECTION 1: AADHAAR CARD ────────────────── */}
          <div
            style={{
              border: aadhaarMatched
                ? "2px solid #10B981"
                : aadhaarResult && !aadhaarResult.matched
                ? "2px solid #EF4444"
                : "1px solid #E2E8F0",
              borderRadius: "var(--radius-lg, 12px)",
              padding: "20px 22px",
              background: aadhaarMatched ? "#F0FDF4" : "#FFFFFF",
              marginBottom: 24,
              boxShadow: aadhaarMatched ? "0 4px 14px rgba(16, 185, 129, 0.08)" : "0 2px 8px rgba(0,0,0,0.03)",
              transition: "all 0.3s ease",
            }}
          >
            {/* Aadhaar Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CreditCard size={18} color={aadhaarMatched ? "#10B981" : "#0891B2"} />
                <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0F172A" }}>
                  Aadhaar Card Verification
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {aadhaarFile && !aadhaarMatched && (
                  <button
                    type="button"
                    onClick={handleRecheckAadhaar}
                    disabled={aadhaarVerifying || idFields.user_aadhaar.replace(/\D/g, "").length !== 12}
                    title="Re-check Aadhaar card with AI"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "4px 10px",
                      borderRadius: 20,
                      background: "#F0FDFA",
                      border: "1px solid #06B6D4",
                      color: "#0891B2",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      cursor: (aadhaarVerifying || idFields.user_aadhaar.replace(/\D/g, "").length !== 12) ? "not-allowed" : "pointer",
                      opacity: (aadhaarVerifying || idFields.user_aadhaar.replace(/\D/g, "").length !== 12) ? 0.6 : 1,
                      transition: "all 0.2s ease",
                    }}
                  >
                    <RefreshCw size={11} style={{ animation: aadhaarVerifying ? "spin 0.8s linear infinite" : "none" }} />
                    {aadhaarVerifying ? "Scanning..." : "Re-check AI"}
                  </button>
                )}
                {aadhaarVerifying ? (
                  <span className="badge" style={{ background: "#E0F2FE", color: "#0284C7", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <RefreshCw size={12} style={{ animation: "spin 0.8s linear infinite" }} /> AI OCR Scanning...
                  </span>
                ) : aadhaarMatched ? (
                  <span className="badge badge-approved" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <CheckCircle size={12} /> Verified
                  </span>
                ) : aadhaarResult && !aadhaarResult.matched ? (
                  <span className="badge badge-rejected" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <XCircle size={12} /> Mismatched — Edit to Correct
                  </span>
                ) : (
                  <span className="badge" style={{ background: "#F1F5F9", color: "#64748B" }}>
                    Step 1
                  </span>
                )}
              </div>
            </div>

            {/* 2-Column Grid: Aadhaar Field + Dropzone Near Each Other */}
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20, alignItems: "start" }}>
              {/* Left: Input Field */}
              <div>
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontWeight: 700, fontSize: "0.85rem" }}>
                  <span>12-Digit Aadhaar Number *</span>
                  {aadhaarMatched && (
                    <span className="badge badge-approved" style={{ fontSize: "0.72rem", padding: "2px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle size={11} /> Verified
                    </span>
                  )}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    className="form-control"
                    placeholder="Enter 12-digit Aadhaar number (e.g. XXXX XXXX 1234)"
                    value={aadhaarMatched ? "•••• •••• ••••" : idFields.user_aadhaar}
                    onChange={handleAadhaarNumberChange}
                    disabled={aadhaarMatched}
                    readOnly={aadhaarMatched}
                    style={{
                      paddingRight: aadhaarMatched ? 36 : aadhaarFile ? 40 : 12,
                      backgroundColor: aadhaarMatched ? "#F0FDF4" : aadhaarResult && !aadhaarResult.matched ? "#FEF2F2" : "#FFFFFF",
                      borderColor: aadhaarMatched ? "#10B981" : aadhaarResult && !aadhaarResult.matched ? "#EF4444" : "#CBD5E1",
                      color: aadhaarMatched ? "#065F46" : "#0F172A",
                      fontWeight: aadhaarMatched ? 700 : 500,
                      cursor: aadhaarMatched ? "not-allowed" : "text",
                      letterSpacing: aadhaarMatched ? "2px" : "normal",
                    }}
                  />
                  {aadhaarMatched && (
                    <Lock
                      size={16}
                      color="#10B981"
                      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}
                    />
                  )}
                  {!aadhaarMatched && aadhaarFile && (
                    <button
                      type="button"
                      onClick={handleRecheckAadhaar}
                      disabled={aadhaarVerifying || idFields.user_aadhaar.replace(/\D/g, "").length !== 12}
                      title="Click to reload / re-check with AI"
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "transparent",
                        border: "none",
                        cursor: (aadhaarVerifying || idFields.user_aadhaar.replace(/\D/g, "").length !== 12) ? "not-allowed" : "pointer",
                        color: aadhaarResult && !aadhaarResult.matched ? "#DC2626" : "#0891B2",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 6,
                        borderRadius: 4,
                      }}
                    >
                      <RefreshCw
                        size={16}
                        style={{
                          animation: aadhaarVerifying ? "spin 0.8s linear infinite" : "none",
                          opacity: (aadhaarVerifying || idFields.user_aadhaar.replace(/\D/g, "").length !== 12) ? 0.4 : 1,
                        }}
                      />
                    </button>
                  )}
                </div>

                {/* Status Feedback - Show ONLY Verified Badge */}
                {aadhaarMatched && (
                  <div style={{ marginTop: 10 }}>
                    <span
                      className="badge badge-approved"
                      style={{
                        fontSize: "0.82rem",
                        padding: "6px 14px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontWeight: 700,
                      }}
                    >
                      <CheckCircle size={14} /> Verified
                    </span>
                  </div>
                )}

                {aadhaarResult && !aadhaarResult.matched && (
                  <div style={{ marginTop: 10, padding: "10px 14px", background: "#FEE2E2", borderRadius: 8, fontSize: "0.78rem", color: "#991B1B", border: "1px solid #FECACA" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                        <AlertCircle size={15} color="#DC2626" />
                        <span>Value Mismatched — Field Remains Editable</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRecheckAadhaar}
                        disabled={aadhaarVerifying || idFields.user_aadhaar.replace(/\D/g, "").length !== 12}
                        title="Reload and re-check with AI"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "4px 10px",
                          background: "#FFFFFF",
                          border: "1px solid #DC2626",
                          color: "#DC2626",
                          borderRadius: 6,
                          fontWeight: 700,
                          fontSize: "0.75rem",
                          cursor: (aadhaarVerifying || idFields.user_aadhaar.replace(/\D/g, "").length !== 12) ? "not-allowed" : "pointer",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <RefreshCw size={12} style={{ animation: aadhaarVerifying ? "spin 0.8s linear infinite" : "none" }} />
                        {aadhaarVerifying ? "Re-checking AI..." : "Re-check with AI"}
                      </button>
                    </div>
                    <div>
                      Aadhaar card details do not match entered number. Please check the number or upload a clearer card image.
                      {aadhaarResult.extracted_number && aadhaarResult.extracted_number !== "Not detected" && (
                        <div style={{ marginTop: 4, color: "#7F1D1D", fontWeight: 600 }}>
                          AI detected on card: <code style={{ background: "#FEE2E2", padding: "1px 5px", borderRadius: 4, border: "1px solid #FCA5A5" }}>{aadhaarResult.extracted_number}</code>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Explicit Re-check Action Button */}
                {!aadhaarMatched && aadhaarFile && (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={handleRecheckAadhaar}
                      disabled={aadhaarVerifying || idFields.user_aadhaar.replace(/\D/g, "").length !== 12}
                      className="btn"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 14px",
                        background: aadhaarVerifying
                          ? "#CBD5E1"
                          : aadhaarResult && !aadhaarResult.matched
                          ? "#DC2626"
                          : "linear-gradient(135deg, #0891B2, #0E7490)",
                        color: "#FFFFFF",
                        border: "none",
                        borderRadius: 6,
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        cursor: (aadhaarVerifying || idFields.user_aadhaar.replace(/\D/g, "").length !== 12) ? "not-allowed" : "pointer",
                        opacity: (aadhaarVerifying || idFields.user_aadhaar.replace(/\D/g, "").length !== 12) ? 0.65 : 1,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <RefreshCw size={13} style={{ animation: aadhaarVerifying ? "spin 0.8s linear infinite" : "none" }} />
                      {aadhaarVerifying ? "Re-checking AI..." : "Re-check with AI"}
                    </button>
                    <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                      {idFields.user_aadhaar.replace(/\D/g, "").length === 12
                        ? "Click to re-run AI matching against attached card"
                        : "Type 12 digits to enable AI check"}
                    </span>
                  </div>
                )}

                {!aadhaarResult && !aadhaarFile && (
                  <div style={{ marginTop: 8, fontSize: "0.76rem", color: "#64748B" }}>
                    Upload your Aadhaar card to auto-run AI matching.
                  </div>
                )}
              </div>

              {/* Right: Dropzone Near Field */}
              <div>
                <div
                  style={{
                    border: aadhaarMatched ? "2px solid #10B981" : "2px dashed #CBD5E1",
                    borderRadius: "var(--radius-md, 8px)",
                    padding: "16px 14px",
                    textAlign: "center",
                    background: aadhaarMatched ? "#ECFDF5" : "#F8FAFC",
                    cursor: aadhaarMatched ? "default" : "pointer",
                    position: "relative",
                    overflow: "hidden",
                    minHeight: 120,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => {
                    if (!aadhaarMatched) aadhaarRef.current?.click();
                  }}
                >
                  {aadhaarVerifying && (
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
                    disabled={aadhaarMatched}
                  />
                  {aadhaarPreview ? (
                    <div>
                      <img
                        src={aadhaarPreview}
                        alt="Aadhaar preview"
                        style={{ maxHeight: 90, maxWidth: "100%", borderRadius: 6, objectFit: "contain" }}
                      />
                      <div style={{ fontSize: "0.76rem", color: aadhaarMatched ? "#10B981" : "#0F172A", fontWeight: 700, marginTop: 6 }}>
                        {aadhaarMatched ? "✓ Verified" : "✓ Attached"} ({aadhaarFile?.name})
                      </div>
                      {!aadhaarMatched && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRecheckAadhaar();
                            }}
                            disabled={aadhaarVerifying || idFields.user_aadhaar.replace(/\D/g, "").length !== 12}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 5,
                              padding: "4px 10px",
                              borderRadius: 4,
                              border: "1px solid #CBD5E1",
                              background: "#FFFFFF",
                              color: "#0891B2",
                              fontSize: "0.73rem",
                              fontWeight: 700,
                              cursor: (aadhaarVerifying || idFields.user_aadhaar.replace(/\D/g, "").length !== 12) ? "not-allowed" : "pointer",
                            }}
                          >
                            <RefreshCw size={11} style={{ animation: aadhaarVerifying ? "spin 0.8s linear infinite" : "none" }} />
                            {aadhaarVerifying ? "Scanning..." : "Re-scan with AI"}
                          </button>
                          <div style={{ fontSize: "0.7rem", color: "#64748B" }}>
                            Click box to upload a different image
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <UploadCloud size={26} color="#0891B2" />
                      <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0F172A" }}>
                        Upload Aadhaar Card Image
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "#94A3B8" }}>Auto-scans upon upload</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ────────────────── SECTION 2: PAN CARD ────────────────── */}
          <div
            style={{
              border: panMatched
                ? "2px solid #10B981"
                : panResult && !panResult.matched
                ? "2px solid #EF4444"
                : "1px solid #E2E8F0",
              borderRadius: "var(--radius-lg, 12px)",
              padding: "20px 22px",
              background: panMatched ? "#F0FDF4" : !aadhaarMatched ? "#F8FAFC" : "#FFFFFF",
              marginBottom: 24,
              boxShadow: panMatched ? "0 4px 14px rgba(16, 185, 129, 0.08)" : "0 2px 8px rgba(0,0,0,0.03)",
              opacity: !aadhaarMatched ? 0.65 : 1,
              transition: "all 0.3s ease",
              position: "relative",
            }}
          >
            {/* Overlay if Aadhaar is not matched */}
            {!aadhaarMatched && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(248, 250, 252, 0.75)",
                  borderRadius: "var(--radius-lg, 12px)",
                  zIndex: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backdropFilter: "blur(1px)",
                }}
              >
                <div
                  style={{
                    background: "#FFFFFF",
                    padding: "10px 18px",
                    borderRadius: 20,
                    boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "#475569",
                  }}
                >
                  <Lock size={15} color="#64748B" /> Complete Aadhaar Verification first to unlock PAN field
                </div>
              </div>
            )}

            {/* PAN Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CreditCard size={18} color={panMatched ? "#10B981" : "#0891B2"} />
                <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0F172A" }}>
                  PAN Card Verification
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {aadhaarMatched && panFile && !panMatched && (
                  <button
                    type="button"
                    onClick={handleRecheckPan}
                    disabled={panVerifying || idFields.user_pan.trim().length !== 10}
                    title="Re-check PAN card with AI"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "4px 10px",
                      borderRadius: 20,
                      background: "#F0FDFA",
                      border: "1px solid #06B6D4",
                      color: "#0891B2",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      cursor: (panVerifying || idFields.user_pan.trim().length !== 10) ? "not-allowed" : "pointer",
                      opacity: (panVerifying || idFields.user_pan.trim().length !== 10) ? 0.6 : 1,
                      transition: "all 0.2s ease",
                    }}
                  >
                    <RefreshCw size={11} style={{ animation: panVerifying ? "spin 0.8s linear infinite" : "none" }} />
                    {panVerifying ? "Scanning..." : "Re-check AI"}
                  </button>
                )}
                {!aadhaarMatched ? (
                  <span className="badge" style={{ background: "#F1F5F9", color: "#94A3B8", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Lock size={12} /> Locked
                  </span>
                ) : panVerifying ? (
                  <span className="badge" style={{ background: "#E0F2FE", color: "#0284C7", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <RefreshCw size={12} style={{ animation: "spin 0.8s linear infinite" }} /> AI OCR Scanning...
                  </span>
                ) : panMatched ? (
                  <span className="badge badge-approved" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <CheckCircle size={12} /> Verified
                  </span>
                ) : panResult && !panResult.matched ? (
                  <span className="badge badge-rejected" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <XCircle size={12} /> Mismatched — Edit to Correct
                  </span>
                ) : (
                  <span className="badge" style={{ background: "#F1F5F9", color: "#64748B" }}>
                    Step 2
                  </span>
                )}
              </div>
            </div>

            {/* 2-Column Grid: PAN Field + Dropzone Near Each Other */}
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20, alignItems: "start" }}>
              {/* Left: Input Field */}
              <div>
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontWeight: 700, fontSize: "0.85rem" }}>
                  <span>10-Character PAN Number *</span>
                  {panMatched && (
                    <span className="badge badge-approved" style={{ fontSize: "0.72rem", padding: "2px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle size={11} /> Verified
                    </span>
                  )}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    className="form-control"
                    placeholder="Enter 10-character PAN number (e.g. ABCDE1234F)"
                    value={panMatched ? "••••••••••" : idFields.user_pan}
                    onChange={handlePanNumberChange}
                    disabled={!aadhaarMatched || panMatched}
                    readOnly={panMatched}
                    style={{
                      paddingRight: panMatched ? 36 : panFile ? 40 : 12,
                      backgroundColor: panMatched ? "#F0FDF4" : panResult && !panResult.matched ? "#FEF2F2" : (!aadhaarMatched ? "#F1F5F9" : "#FFFFFF"),
                      borderColor: panMatched ? "#10B981" : panResult && !panResult.matched ? "#EF4444" : "#CBD5E1",
                      color: panMatched ? "#065F46" : "#0F172A",
                      fontWeight: panMatched ? 700 : 500,
                      cursor: panMatched || !aadhaarMatched ? "not-allowed" : "text",
                      letterSpacing: panMatched ? "2px" : "normal",
                    }}
                  />
                  {panMatched && (
                    <Lock
                      size={16}
                      color="#10B981"
                      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}
                    />
                  )}
                  {aadhaarMatched && !panMatched && panFile && (
                    <button
                      type="button"
                      onClick={handleRecheckPan}
                      disabled={panVerifying || idFields.user_pan.trim().length !== 10}
                      title="Click to reload / re-check PAN with AI"
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "transparent",
                        border: "none",
                        cursor: (panVerifying || idFields.user_pan.trim().length !== 10) ? "not-allowed" : "pointer",
                        color: panResult && !panResult.matched ? "#DC2626" : "#0891B2",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 6,
                        borderRadius: 4,
                      }}
                    >
                      <RefreshCw
                        size={16}
                        style={{
                          animation: panVerifying ? "spin 0.8s linear infinite" : "none",
                          opacity: (panVerifying || idFields.user_pan.trim().length !== 10) ? 0.4 : 1,
                        }}
                      />
                    </button>
                  )}
                </div>

                {/* Status Feedback - Show ONLY Verified Badge */}
                {panMatched && (
                  <div style={{ marginTop: 10 }}>
                    <span
                      className="badge badge-approved"
                      style={{
                        fontSize: "0.82rem",
                        padding: "6px 14px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontWeight: 700,
                      }}
                    >
                      <CheckCircle size={14} /> Verified
                    </span>
                  </div>
                )}

                {panResult && !panResult.matched && (
                  <div style={{ marginTop: 10, padding: "10px 14px", background: "#FEE2E2", borderRadius: 8, fontSize: "0.78rem", color: "#991B1B", border: "1px solid #FECACA" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                        <AlertCircle size={15} color="#DC2626" />
                        <span>Value Mismatched — Field Remains Editable</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRecheckPan}
                        disabled={panVerifying || idFields.user_pan.trim().length !== 10}
                        title="Reload and re-check with AI"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "4px 10px",
                          background: "#FFFFFF",
                          border: "1px solid #DC2626",
                          color: "#DC2626",
                          borderRadius: 6,
                          fontWeight: 700,
                          fontSize: "0.75rem",
                          cursor: (panVerifying || idFields.user_pan.trim().length !== 10) ? "not-allowed" : "pointer",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <RefreshCw size={12} style={{ animation: panVerifying ? "spin 0.8s linear infinite" : "none" }} />
                        {panVerifying ? "Re-checking AI..." : "Re-check with AI"}
                      </button>
                    </div>
                    <div>
                      PAN card details do not match entered number. Please check the number or upload a clearer card image.
                      {panResult.extracted_number && panResult.extracted_number !== "Not detected" && (
                        <div style={{ marginTop: 4, color: "#7F1D1D", fontWeight: 600 }}>
                          AI detected on card: <code style={{ background: "#FEE2E2", padding: "1px 5px", borderRadius: 4, border: "1px solid #FCA5A5" }}>{panResult.extracted_number}</code>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Explicit Re-check Action Button */}
                {aadhaarMatched && !panMatched && panFile && (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={handleRecheckPan}
                      disabled={panVerifying || idFields.user_pan.trim().length !== 10}
                      className="btn"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 14px",
                        background: panVerifying
                          ? "#CBD5E1"
                          : panResult && !panResult.matched
                          ? "#DC2626"
                          : "linear-gradient(135deg, #0891B2, #0E7490)",
                        color: "#FFFFFF",
                        border: "none",
                        borderRadius: 6,
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        cursor: (panVerifying || idFields.user_pan.trim().length !== 10) ? "not-allowed" : "pointer",
                        opacity: (panVerifying || idFields.user_pan.trim().length !== 10) ? 0.65 : 1,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <RefreshCw size={13} style={{ animation: panVerifying ? "spin 0.8s linear infinite" : "none" }} />
                      {panVerifying ? "Re-checking AI..." : "Re-check with AI"}
                    </button>
                    <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                      {idFields.user_pan.trim().length === 10
                        ? "Click to re-run AI matching against attached PAN card"
                        : "Type 10 characters to enable AI check"}
                    </span>
                  </div>
                )}

                {!panResult && !panFile && aadhaarMatched && (
                  <div style={{ marginTop: 8, fontSize: "0.76rem", color: "#64748B" }}>
                    Upload your PAN card to auto-run AI matching.
                  </div>
                )}
              </div>

              {/* Right: Dropzone Near Field */}
              <div>
                <div
                  style={{
                    border: panMatched ? "2px solid #10B981" : "2px dashed #CBD5E1",
                    borderRadius: "var(--radius-md, 8px)",
                    padding: "16px 14px",
                    textAlign: "center",
                    background: panMatched ? "#ECFDF5" : "#F8FAFC",
                    cursor: panMatched || !aadhaarMatched ? "default" : "pointer",
                    position: "relative",
                    overflow: "hidden",
                    minHeight: 120,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => {
                    if (aadhaarMatched && !panMatched) panRef.current?.click();
                  }}
                >
                  {panVerifying && (
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
                    disabled={!aadhaarMatched || panMatched}
                  />
                  {panPreview ? (
                    <div>
                      <img
                        src={panPreview}
                        alt="PAN preview"
                        style={{ maxHeight: 90, maxWidth: "100%", borderRadius: 6, objectFit: "contain" }}
                      />
                      <div style={{ fontSize: "0.76rem", color: panMatched ? "#10B981" : "#0F172A", fontWeight: 700, marginTop: 6 }}>
                        {panMatched ? "✓ Verified" : "✓ Attached"} ({panFile?.name})
                      </div>
                      {aadhaarMatched && !panMatched && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRecheckPan();
                            }}
                            disabled={panVerifying || idFields.user_pan.trim().length !== 10}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 5,
                              padding: "4px 10px",
                              borderRadius: 4,
                              border: "1px solid #CBD5E1",
                              background: "#FFFFFF",
                              color: "#0891B2",
                              fontSize: "0.73rem",
                              fontWeight: 700,
                              cursor: (panVerifying || idFields.user_pan.trim().length !== 10) ? "not-allowed" : "pointer",
                            }}
                          >
                            <RefreshCw size={11} style={{ animation: panVerifying ? "spin 0.8s linear infinite" : "none" }} />
                            {panVerifying ? "Scanning..." : "Re-scan with AI"}
                          </button>
                          <div style={{ fontSize: "0.7rem", color: "#64748B" }}>
                            Click box to upload a different image
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <UploadCloud size={26} color="#0891B2" />
                      <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0F172A" }}>
                        Upload PAN Card Image
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "#94A3B8" }}>Auto-scans upon upload</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Both Matched Success Summary */}
          {aadhaarMatched && panMatched && (
            <div
              style={{
                background: "#ECFDF5",
                border: "1px solid #A7F3D0",
                borderRadius: "var(--radius-md, 8px)",
                padding: "14px 18px",
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CheckCircle size={20} color="#10B981" />
                <div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#065F46" }}>
                    KYC Verification Complete
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#047857" }}>
                    Both Aadhaar and PAN documents have been authenticated successfully.
                  </div>
                </div>
              </div>
              <span className="badge badge-approved" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <CheckCircle size={13} /> Verified
              </span>
            </div>
          )}

          {/* Navigation Buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
            <button className="btn btn-ghost" onClick={handleBack}>
              <ArrowLeft size={15} /> Back
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {(!aadhaarMatched || !panMatched) && (
                <span style={{ fontSize: "0.78rem", color: "#64748B" }}>
                  Match {!aadhaarMatched ? "Aadhaar" : "PAN"} to proceed
                </span>
              )}
              <button
                className="btn btn-primary"
                onClick={handleNext}
                disabled={!aadhaarMatched || !panMatched}
              >
                Next: Upload {loan.loan_type} Documents <ArrowRight size={15} />
              </button>
            </div>
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

          {/* Document Upload Cards Grid — Dynamically Grouped for Education Loan or Standard Checklist */}
          {loan.loan_type === "Education" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {[
                {
                  sectionName: "Student",
                  sectionTitle: "🎓 Student Documents (Primary Applicant)",
                  sectionDesc: "Official academic admissions and personal credentials of the student borrower",
                  badgeBg: "#FAF5FF",
                  badgeColor: "#9333EA",
                },
                {
                  sectionName: "Parent / Co-borrower",
                  sectionTitle: "👨‍👩‍👧 Parent / Co-borrower Documents (Financial Guarantor)",
                  sectionDesc: "Income verification and banking credentials of parent or co-borrower",
                  badgeBg: "#F0FDF4",
                  badgeColor: "#16A34A",
                },
                {
                  sectionName: "Additional",
                  sectionTitle: "📋 Additional Documentation",
                  sectionDesc: "Collateral and institutional security records where applicable",
                  badgeBg: "#F8FAFC",
                  badgeColor: "#64748B",
                },
              ].map((grp) => {
                const grpDocs = currentDocConfig.docs.filter((d) => d.section === grp.sectionName);
                if (grpDocs.length === 0) return null;

                return (
                  <div
                    key={grp.sectionName}
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                      borderRadius: "var(--radius-md, 8px)",
                      padding: "18px 20px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div style={{ marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #F1F5F9" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#0F172A" }}>
                          {grp.sectionTitle}
                        </span>
                        <span
                          className="badge"
                          style={{
                            background: grp.badgeBg,
                            color: grp.badgeColor,
                            fontWeight: 700,
                            fontSize: "0.72rem",
                          }}
                        >
                          {grpDocs.filter((d) => categoryDocs[`${loan.loan_type}_${d.id}`]?.file).length} / {grpDocs.length} Uploaded
                        </span>
                      </div>
                      <p style={{ color: "#64748B", fontSize: "0.8rem", margin: "4px 0 0 0" }}>
                        {grp.sectionDesc}
                      </p>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {grpDocs.map((docDef) => {
                        const uploadKey = `${loan.loan_type}_${docDef.id}`;
                        const docState = categoryDocs[uploadKey];
                        const isUploaded = Boolean(docState?.file);
                        const isVerified =
                          docState?.verification_status === "Verified" ||
                          (docDef.is_kyc && ((docDef.id === "student_aadhaar" && aadhaarMatched) || (docDef.id === "student_pan" && panMatched)));
                        const isMismatch =
                          docState?.verification_status === "Mismatch" ||
                          (docDef.is_kyc && ((docDef.id === "student_aadhaar" && aadhaarResult && !aadhaarResult.matched) || (docDef.id === "student_pan" && panResult && !panResult.matched)));
                        const isRejected = docState?.verification_status === "Rejected";

                        return (
                          <div
                            key={docDef.id}
                            style={{
                              border: isUploaded ? "1px solid #A7F3D0" : "1px solid #E2E8F0",
                              borderRadius: "var(--radius-sm, 6px)",
                              padding: "14px 16px",
                              background: isUploaded ? "rgba(236, 253, 245, 0.4)" : "#F8FAFC",
                              transition: "all 0.2s ease",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 10, flexWrap: "wrap" }}>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                  <span style={{ fontWeight: 800, fontSize: "0.92rem", color: "#0F172A" }}>
                                    {docDef.label}
                                  </span>
                                  {docDef.required ? (
                                    <span
                                      className="badge"
                                      style={{
                                        fontSize: "0.68rem",
                                        fontWeight: 800,
                                        color: "#DC2626",
                                        background: "#FEE2E2",
                                        border: "1px solid #FECACA",
                                        padding: "1px 7px",
                                      }}
                                    >
                                      Required *
                                    </span>
                                  ) : (
                                    <span
                                      className="badge"
                                      style={{
                                        fontSize: "0.68rem",
                                        fontWeight: 700,
                                        color: "#64748B",
                                        background: "#F1F5F9",
                                        border: "1px solid #E2E8F0",
                                        padding: "1px 7px",
                                      }}
                                    >
                                      Optional (Where applicable)
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: "0.78rem", color: "#64748B", marginTop: 3 }}>
                                  {docDef.description}
                                </div>
                              </div>

                              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                {/* Upload Status Badge */}
                                {isUploaded ? (
                                  <span className="badge badge-approved" style={{ fontSize: "0.72rem", padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                    <CheckCircle size={11} /> Uploaded
                                  </span>
                                ) : (
                                  <span className="badge" style={{ fontSize: "0.72rem", background: "#F1F5F9", color: "#64748B", padding: "3px 8px" }}>
                                    Not Uploaded
                                  </span>
                                )}

                                {/* Verification Status Badge */}
                                {isVerified ? (
                                  <span className="badge badge-approved" style={{ fontSize: "0.72rem", padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                    <ShieldCheck size={11} /> Verified
                                  </span>
                                ) : isMismatch ? (
                                  <span className="badge badge-rejected" style={{ fontSize: "0.72rem", padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                    <AlertCircle size={11} /> Value Mismatch
                                  </span>
                                ) : isRejected ? (
                                  <span className="badge badge-rejected" style={{ fontSize: "0.72rem", padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                    <XCircle size={11} /> Rejected
                                  </span>
                                ) : isUploaded ? (
                                  <span className="badge" style={{ fontSize: "0.72rem", background: "#FEF3C7", color: "#B45309", padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                    <Clock size={11} /> Pending Review
                                  </span>
                                ) : (
                                  <span className="badge" style={{ fontSize: "0.72rem", background: "#F8FAFC", color: "#94A3B8", padding: "3px 8px" }}>
                                    Pending Upload
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Uploaded File Controls vs Upload Dropzone */}
                            {isUploaded ? (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  background: "#FFFFFF",
                                  border: "1px solid #CBD5E1",
                                  borderRadius: "var(--radius-sm)",
                                  padding: "8px 12px",
                                  marginTop: 8,
                                  gap: 10,
                                  flexWrap: "wrap",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                  {docState.preview ? (
                                    <img
                                      src={docState.preview}
                                      alt="preview"
                                      style={{ width: 40, height: 40, borderRadius: 4, objectFit: "cover", border: "1px solid #E2E8F0" }}
                                    />
                                  ) : (
                                    <div
                                      style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 4,
                                        background: "#EEF2FF",
                                        color: "#6366F1",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <FileText size={18} />
                                    </div>
                                  )}
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0F172A", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                                      {docState.name}
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "#64748B", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                      <span>{formatFileSize(docState.size)}</span>
                                      <span>•</span>
                                      <span>{docState.type || "Document"}</span>
                                      {docState.sha256_hash && (
                                        <span style={{ fontSize: "0.68rem", color: "#0891B2", background: "#ECFEFF", padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>
                                          SHA-256: {docState.sha256_hash.substring(0, 12)}...
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setPreviewDoc(docState)}
                                    style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.76rem" }}
                                  >
                                    <Eye size={12} /> Preview
                                  </button>
                                  <label
                                    className="btn btn-ghost btn-sm"
                                    style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.76rem" }}
                                  >
                                    <UploadCloud size={12} /> Replace
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
                                    style={{ color: "#EF4444", fontSize: "0.76rem" }}
                                    onClick={() => handleRemoveCategoryDoc(docDef.id)}
                                  >
                                    <Trash2 size={12} /> Remove
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                                <label
                                  className="btn btn-primary btn-sm"
                                  style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}
                                >
                                  <UploadCloud size={13} /> Upload {docDef.label}
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
                                <span style={{ fontSize: "0.74rem", color: "#64748B" }}>
                                  Supports PDF, JPG/JPEG, PNG (Max 15MB)
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {currentDocConfig.docs.map((docDef) => {
                const uploadKey = `${loan.loan_type}_${docDef.id}`;
                const docState = categoryDocs[uploadKey];
                const isUploaded = Boolean(docState?.file);
                const isVerified =
                  docState?.verification_status === "Verified" ||
                  (docDef.is_kyc && ((docDef.id === "aadhaar" && aadhaarMatched) || (docDef.id === "pan" && panMatched)));
                const isMismatch =
                  docState?.verification_status === "Mismatch" ||
                  (docDef.is_kyc && ((docDef.id === "aadhaar" && aadhaarResult && !aadhaarResult.matched) || (docDef.id === "pan" && panResult && !panResult.matched)));
                const isRejected = docState?.verification_status === "Rejected";

                return (
                  <div
                    key={docDef.id}
                    style={{
                      border: isUploaded ? "1px solid #A7F3D0" : "1px solid #E2E8F0",
                      borderRadius: "var(--radius-md, 8px)",
                      padding: "16px 18px",
                      background: isUploaded ? "rgba(236, 253, 245, 0.4)" : "#FFFFFF",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 10, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#0F172A" }}>
                            {docDef.label}
                          </span>
                          {docDef.required ? (
                            <span
                              className="badge"
                              style={{
                                fontSize: "0.7rem",
                                fontWeight: 800,
                                color: "#DC2626",
                                background: "#FEE2E2",
                                border: "1px solid #FECACA",
                                padding: "2px 8px",
                              }}
                            >
                              Required *
                            </span>
                          ) : (
                            <span
                              className="badge"
                              style={{
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                color: "#64748B",
                                background: "#F1F5F9",
                                border: "1px solid #E2E8F0",
                                padding: "2px 8px",
                              }}
                            >
                              Optional (Where applicable)
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#64748B", marginTop: 4 }}>
                          {docDef.description}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        {/* Upload Status Badge */}
                        {isUploaded ? (
                          <span className="badge badge-approved" style={{ fontSize: "0.74rem", padding: "3px 9px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <CheckCircle size={12} /> Uploaded
                          </span>
                        ) : (
                          <span className="badge" style={{ fontSize: "0.74rem", background: "#F1F5F9", color: "#64748B", padding: "3px 9px" }}>
                            Not Uploaded
                          </span>
                        )}

                        {/* Verification Status Badge */}
                        {isVerified ? (
                          <span className="badge badge-approved" style={{ fontSize: "0.74rem", padding: "3px 9px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <ShieldCheck size={12} /> Verified
                          </span>
                        ) : isMismatch ? (
                          <span className="badge badge-rejected" style={{ fontSize: "0.74rem", padding: "3px 9px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <AlertCircle size={12} /> Value Mismatch
                          </span>
                        ) : isRejected ? (
                          <span className="badge badge-rejected" style={{ fontSize: "0.74rem", padding: "3px 9px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <XCircle size={12} /> Rejected
                          </span>
                        ) : isUploaded ? (
                          <span className="badge" style={{ fontSize: "0.74rem", background: "#FEF3C7", color: "#B45309", padding: "3px 9px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Clock size={12} /> Pending Review
                          </span>
                        ) : (
                          <span className="badge" style={{ fontSize: "0.74rem", background: "#F8FAFC", color: "#94A3B8", padding: "3px 9px" }}>
                            Pending Upload
                          </span>
                        )}
                      </div>
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
                          marginTop: 10,
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
                            <div style={{ fontSize: "0.74rem", color: "#64748B", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span>{formatFileSize(docState.size)}</span>
                              <span>•</span>
                              <span>{docState.type || "Document"}</span>
                              {docState.sha256_hash && (
                                <span style={{ fontSize: "0.68rem", color: "#0891B2", background: "#ECFEFF", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace" }}>
                                  SHA-256: {docState.sha256_hash.substring(0, 14)}...
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setPreviewDoc(docState)}
                            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                          >
                            <Eye size={13} /> Preview
                          </button>
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
                      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <label
                          className="btn btn-primary btn-sm"
                          style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          <UploadCloud size={14} /> Upload {docDef.label}
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
                        <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                          Supports PDF, JPG/JPEG, PNG (Max 15MB) • Upload individually
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* In-Page Document Preview Modal */}
          {previewDoc && (
            <div className="modal-overlay" style={{ zIndex: 1200 }}>
              <div className="modal" style={{ width: "min(720px, 95vw)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", margin: 0, color: "#0F172A" }}>
                      {previewDoc.label} {previewDoc.section ? `(${previewDoc.section})` : ""}
                    </h3>
                    <p style={{ color: "#64748B", fontSize: "0.78rem", margin: "2px 0 0 0" }}>
                      {previewDoc.name} • {formatFileSize(previewDoc.size)}
                    </p>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setPreviewDoc(null)}>✕ Close</button>
                </div>

                {previewDoc.preview || (previewDoc.base64?.startsWith("data:image/")) ? (
                  <div style={{ textAlign: "center", background: "#0F172A", padding: 14, borderRadius: 8 }}>
                    <img
                      src={previewDoc.preview || previewDoc.base64}
                      alt={previewDoc.name}
                      style={{ maxHeight: 420, maxWidth: "100%", objectFit: "contain", borderRadius: 6, background: "#FFFFFF", padding: 4 }}
                    />
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "36px 20px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                    <FileText size={52} color="#0891B2" style={{ margin: "0 auto 12px" }} />
                    <p style={{ fontWeight: 800, color: "#0F172A", marginBottom: 4, fontSize: "0.95rem" }}>{previewDoc.name}</p>
                    <p style={{ fontSize: "0.82rem", color: "#64748B", marginBottom: 18 }}>
                      PDF Document Attachment ({formatFileSize(previewDoc.size)})
                    </p>
                    {previewDoc.base64 && (
                      <a href={previewDoc.base64} download={previewDoc.name} className="btn btn-accent btn-sm">
                        <Download size={14} /> Download {previewDoc.name}
                      </a>
                    )}
                  </div>
                )}

                <div className="modal-footer" style={{ marginTop: 16 }}>
                  <button className="btn btn-ghost" onClick={() => setPreviewDoc(null)}>Close Preview</button>
                </div>
              </div>
            </div>
          )}


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
