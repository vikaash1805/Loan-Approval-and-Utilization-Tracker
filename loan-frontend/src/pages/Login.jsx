import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/loanApi";
import {
  ShieldCheck, User, Lock, Mail, Phone, ArrowRight, UserPlus,
  CheckCircle2, CreditCard, UploadCloud, FileCheck, AlertTriangle,
  XCircle, CheckCircle, RefreshCw, Sparkles, ShieldX
} from "lucide-react";
import fundmatrixLogo from "../assets/fundmatrix_logo.png";

export default function Login() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [role, setRole] = useState("user"); // 'user' or 'officer'
  const [isRegister, setIsRegister] = useState(false); // false = sign in, true = register

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Registration form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");

  // ID Proof Verification state
  const [regIdType, setRegIdType] = useState("Aadhaar"); // "Aadhaar" or "PAN"
  const [regIdNumber, setRegIdNumber] = useState("");
  const [regDob, setRegDob] = useState("");
  const [regGender, setRegGender] = useState("Male");
  const [regIdFile, setRegIdFile] = useState(null);
  const [regIdPreview, setRegIdPreview] = useState(null);

  // Status indicators
  const [loading, setLoading] = useState(false);
  const [verifyingStage, setVerifyingStage] = useState(""); // "dup" | "ai" | "save"
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [verificationFeedback, setVerificationFeedback] = useState(null);
  const [dupFeedback, setDupFeedback] = useState(null);

  // Format date helper (YYYY-MM-DD -> DD/MM/YYYY)
  const formatDateToDDMMYYYY = (isoDate) => {
    if (!isoDate) return "";
    const parts = isoDate.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (JPG, PNG, WebP).");
      return;
    }

    setRegIdFile(file);
    setRegIdPreview(URL.createObjectURL(file));
    setError("");
    setVerificationFeedback(null);
    setDupFeedback(null);
  };

  // Handle standard login
  const handleLoginSubmit = async (e) => {
    e?.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!email.trim()) {
      setError("Please enter your email address or login ID.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      // 1. Check local registered users store if available
      let localUser = null;
      try {
        const regList = JSON.parse(localStorage.getItem("loan_registered_users") || "[]");
        localUser = regList.find((u) => u.email?.toLowerCase() === email.trim().toLowerCase());
      } catch (_) {}

      // 2. Call backend auth endpoint
      let authRes;
      try {
        authRes = await api.loginUser({
          email: email.trim(),
          password,
          role,
        });
      } catch (apiErr) {
        // If backend explicitly rejected or is offline, check if local user exists
        if (localUser && role === "user") {
          if (localUser.password !== password) {
            throw new Error("Incorrect password. Please try again.");
          }
          authRes = {
            success: true,
            user: {
              email: localUser.email,
              name: localUser.name,
              phone: localUser.phone,
              role: localUser.role || "user",
              id_type: localUser.id_type,
              id_number: localUser.id_number,
              id_verified: localUser.id_verified,
            },
          };
        } else {
          throw apiErr;
        }
      }

      const userData = authRes?.user || {};
      const loggedInUser = login(
        userData.role || role,
        userData.email || email.trim(),
        userData.name || (localUser?.name || ""),
        userData.phone || (localUser?.phone || ""),
        {
          id_type: userData.id_type || localUser?.id_type,
          id_number: userData.id_number || localUser?.id_number,
          id_verified: userData.id_verified ?? localUser?.id_verified,
        }
      );

      if (loggedInUser.role === "officer") {
        navigate("/");
      } else {
        navigate("/apply");
      }
    } catch (err) {
      setError(err.message || "Failed to sign in. Please verify your credentials or register a new account.");
    } finally {
      setLoading(false);
    }
  };

  // Handle new customer registration with document duplication + AI verification
  const handleRegisterSubmit = async (e) => {
    e?.preventDefault();
    setError("");
    setSuccessMsg("");
    setVerificationFeedback(null);
    setDupFeedback(null);

    // 1. Validation checks
    if (!regName.trim()) {
      setError("Please enter your full name as printed on your ID proof.");
      return;
    }
    if (!regEmail.trim() || !/\S+@\S+\.\S+/.test(regEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!regPhone.trim() || regPhone.replace(/\D/g, "").length < 10) {
      setError("Please enter a valid 10-digit mobile phone number.");
      return;
    }
    if (!regIdNumber.trim()) {
      setError(`Please enter your ${regIdType === "Aadhaar" ? "12-digit Aadhaar" : "10-character PAN"} number.`);
      return;
    }
    if (regIdType === "Aadhaar" && regIdNumber.replace(/\D/g, "").length !== 12) {
      setError("Aadhaar number must contain exactly 12 digits.");
      return;
    }
    if (regIdType === "PAN" && regIdNumber.trim().length !== 10) {
      setError("PAN card number must contain exactly 10 alphanumeric characters (e.g. ABCDE1234F).");
      return;
    }
    if (!regIdFile) {
      setError(`Please upload a clear photo/scan of your ${regIdType} card.`);
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);

    try {
      // ══════════════════════════════════════════════════════════════
      // STAGE 1: Check Document Originality / Duplicate in MongoDB
      // ══════════════════════════════════════════════════════════════
      setVerifyingStage("dup");
      let dupRes;
      try {
        dupRes = await api.checkImageDuplicate(regIdFile);
        setDupFeedback(dupRes);
      } catch (dupErr) {
        throw new Error(`Originality Scan Error: ${dupErr.message || "Failed to check document originality."}`);
      }

      if (dupRes?.status === "negative" || dupRes?.exists === true) {
        throw new Error(`❌ Document Duplication Detected: This ${regIdType} image is already registered in the database. Please upload your original ID document.`);
      }

      // ══════════════════════════════════════════════════════════════
      // STAGE 2: AI Identity Details Verification with Gemini Vision
      // ══════════════════════════════════════════════════════════════
      setVerifyingStage("ai");
      const formattedDob = formatDateToDDMMYYYY(regDob);
      const fd = new FormData();
      fd.append("id_type", regIdType);
      fd.append("user_name", regName.trim());
      fd.append("id_number", regIdNumber.trim());
      if (formattedDob) fd.append("user_dob", formattedDob);
      if (regIdType === "Aadhaar" && regGender) fd.append("user_gender", regGender);
      fd.append("id_image", regIdFile);

      let verifyRes;
      try {
        verifyRes = await api.verifySingleId(fd);
      } catch (verifyErr) {
        throw new Error(verifyErr.message || "Could not analyze the uploaded document.");
      }

      if (!verifyRes || !verifyRes.overall_match) {
        throw new Error("The entered details are mismatched with the uploaded ID proof. Please verify your information and try again.");
      }

      // ══════════════════════════════════════════════════════════════
      // STAGE 3: Register Account & Save Authenticated Profile
      // ══════════════════════════════════════════════════════════════
      setVerifyingStage("save");
      try {
        await api.registerUser({
          name: regName.trim(),
          email: regEmail.trim(),
          phone: regPhone.trim(),
          password: regPassword,
          role: "user",
          id_type: regIdType,
          id_number: regIdNumber.trim(),
          id_verified: true,
        });
      } catch (apiErr) {
        if (apiErr.message && (apiErr.message.includes("already exists") || apiErr.message.includes("409"))) {
          throw apiErr;
        }
        console.warn("Backend registration note:", apiErr);
      }

      // Save user session in context and localStorage
      register("user", regEmail.trim(), regName.trim(), regPhone.trim(), regPassword, {
        id_type: regIdType,
        id_number: regIdNumber.trim(),
        id_verified: true,
      });

      setSuccessMsg(`✓ ${regIdType} ID Verified & Authenticated (Originality Confirmed)! Creating your account...`);

      setTimeout(() => {
        navigate("/apply");
      }, 1000);
    } catch (err) {
      setError(err.message || "Registration failed. Please verify your document and details.");
    } finally {
      setLoading(false);
      setVerifyingStage("");
    }
  };

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setError("");
    setSuccessMsg("");
    setVerificationFeedback(null);
    setDupFeedback(null);
    setEmail("");
    setPassword("");
    if (newRole === "officer") {
      setIsRegister(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "36px 20px",
        background: "linear-gradient(145deg, #020617 0%, #0F172A 40%, #1E293B 70%, #0F172A 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Merged Background Ambient Glow Orbs */}
      <div
        style={{
          position: "absolute",
          top: "-15%",
          left: "-10%",
          width: "55vw",
          height: "55vw",
          maxWidth: 650,
          maxHeight: 650,
          background: "radial-gradient(circle, rgba(6, 182, 212, 0.25) 0%, rgba(15, 23, 42, 0.08) 50%, transparent 70%)",
          borderRadius: "50%",
          pointerEvents: "none",
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-15%",
          right: "-10%",
          width: "50vw",
          height: "50vw",
          maxWidth: 600,
          maxHeight: 600,
          background: "radial-gradient(circle, rgba(255, 255, 255, 0.5) 0%, rgba(226, 232, 240, 0.25) 45%, transparent 70%)",
          borderRadius: "50%",
          pointerEvents: "none",
          filter: "blur(50px)",
        }}
      />

      {/* Main Glassmorphic Merged Card */}
      <div
        className="card fade-in"
        style={{
          width: "100%",
          maxWidth: isRegister ? 580 : 450,
          padding: "38px 34px",
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 255, 255, 0.8)",
          borderRadius: 24,
          boxShadow: "0 28px 75px -12px rgba(2, 6, 23, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.5) inset",
          position: "relative",
          zIndex: 2,
          transition: "max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Logo & Portal Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-flex", justifyContent: "center", alignItems: "center", marginBottom: 12 }}>
            <img
              src={fundmatrixLogo}
              alt="FUNDMATRIX"
              style={{
                height: 52,
                width: "auto",
                maxWidth: "280px",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
          {isRegister ? (
            <div>
              <h2
                style={{
                  fontFamily: "Outfit, sans-serif",
                  fontSize: "1.38rem",
                  fontWeight: 700,
                  color: "#0F172A",
                  marginBottom: 4,
                  letterSpacing: "-0.3px",
                }}
              >
                Customer Registration & ID Verification
              </h2>
              <p style={{ color: "#64748B", fontSize: "0.85rem", marginTop: 2 }}>
                Originality check & AI biometric verification for secure instant loans
              </p>
            </div>
          ) : (
            <p style={{ color: "#64748B", fontSize: "0.88rem", marginTop: 4 }}>
              Secure Core Banking & SaaS Loan Processing Suite
            </p>
          )}
        </div>

        {/* Role Switcher Tabs */}
        {!isRegister && (
          <div
            style={{
              display: "flex",
              background: "#f1f5f9",
              padding: 4,
              borderRadius: 12,
              marginBottom: 24,
              border: "1px solid #e2e8f0",
            }}
          >
            <button
              type="button"
              onClick={() => handleRoleChange("user")}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: "0.88rem",
                fontWeight: 600,
                transition: "all 0.2s ease",
                background: role === "user" ? "linear-gradient(135deg, #0F172A, #1E293B)" : "transparent",
                color: role === "user" ? "#ffffff" : "#64748B",
                boxShadow: role === "user" ? "0 2px 8px rgba(15, 23, 42, 0.3)" : "none",
              }}
            >
              <User size={16} /> Customer / User
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange("officer")}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: "0.88rem",
                fontWeight: 600,
                transition: "all 0.2s ease",
                background: role === "officer" ? "linear-gradient(135deg, #0F172A, #1E293B)" : "transparent",
                color: role === "officer" ? "#ffffff" : "#64748B",
                boxShadow: role === "officer" ? "0 2px 8px rgba(15, 23, 42, 0.3)" : "none",
              }}
            >
              <ShieldCheck size={16} /> Loan Officer
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div
            className="alert alert-error"
            style={{
              marginBottom: 18,
              fontSize: "0.84rem",
              lineHeight: 1.45,
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              borderRadius: 10,
            }}
          >
            <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>{error}</div>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div
            className="alert alert-success"
            style={{
              marginBottom: 18,
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 10,
            }}
          >
            <CheckCircle2 size={17} /> {successMsg}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* CASE A: CUSTOMER REGISTRATION FORM                         */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {isRegister ? (
          <form onSubmit={handleRegisterSubmit}>
            {/* Step 1: Personal Details */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                padding: "16px",
                marginBottom: 14,
              }}
            >
              <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0F172A", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <User size={16} color="#06b6d4" /> Personal Information
              </div>

              <div className="form-group" style={{ marginBottom: 10 }}>
                <label style={{ color: "#334155", fontWeight: 600, fontSize: "0.82rem" }}>Full Legal Name *</label>
                <div style={{ position: "relative" }}>
                  <User size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  <input
                    className="form-control"
                    style={{ paddingLeft: 32, fontSize: "0.88rem" }}
                    placeholder="e.g. Ramesh Kumar"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 10 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ color: "#334155", fontWeight: 600, fontSize: "0.82rem" }}>Email Address *</label>
                  <div style={{ position: "relative" }}>
                    <Mail size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                    <input
                      className="form-control"
                      style={{ paddingLeft: 30, fontSize: "0.84rem" }}
                      type="email"
                      placeholder="user@example.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ color: "#334155", fontWeight: 600, fontSize: "0.82rem" }}>Phone Number *</label>
                  <div style={{ position: "relative" }}>
                    <Phone size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                    <input
                      className="form-control"
                      style={{ paddingLeft: 30, fontSize: "0.84rem" }}
                      placeholder="9876543210"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: ID Proof Selection & Details */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                padding: "16px",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                  <CreditCard size={16} color="#06b6d4" /> Select ID Proof *
                </span>
                <span style={{ fontSize: "0.72rem", background: "#ecfeff", color: "#0891b2", padding: "3px 9px", borderRadius: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, border: "1px solid #a5f3fc" }}>
                  <Sparkles size={11} /> Anti-Duplicate & AI Verified
                </span>
              </div>

              {/* ID Type Switcher */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => {
                    setRegIdType("Aadhaar");
                    setVerificationFeedback(null);
                    setDupFeedback(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: regIdType === "Aadhaar" ? "1.5px solid #06b6d4" : "1px solid #cbd5e1",
                    background: regIdType === "Aadhaar" ? "#ecfeff" : "#ffffff",
                    color: regIdType === "Aadhaar" ? "#0891b2" : "#475569",
                    fontWeight: 600,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  🪪 Aadhaar Card (12-Digit)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegIdType("PAN");
                    setVerificationFeedback(null);
                    setDupFeedback(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: regIdType === "PAN" ? "1.5px solid #06b6d4" : "1px solid #cbd5e1",
                    background: regIdType === "PAN" ? "#ecfeff" : "#ffffff",
                    color: regIdType === "PAN" ? "#0891b2" : "#475569",
                    fontWeight: 600,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  💳 PAN Card (10-Char)
                </button>
              </div>

              {/* ID Number input */}
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label style={{ color: "#334155", fontWeight: 600, fontSize: "0.82rem" }}>
                  {regIdType === "Aadhaar" ? "12-Digit Aadhaar Number *" : "10-Character PAN Number *"}
                </label>
                <input
                  className="form-control"
                  type="text"
                  placeholder={regIdType === "Aadhaar" ? "e.g. 1234 5678 9012" : "e.g. ABCDE1234F"}
                  value={regIdNumber}
                  onChange={(e) => {
                    const val = regIdType === "PAN" ? e.target.value.toUpperCase() : e.target.value;
                    setRegIdNumber(val);
                  }}
                  disabled={loading}
                  style={{ fontSize: "0.88rem", letterSpacing: "0.5px" }}
                />
              </div>

              {/* Optional DOB & Gender */}
              <div style={{ display: "grid", gridTemplateColumns: regIdType === "Aadhaar" ? "1.2fr 1fr" : "1fr", gap: 10, marginBottom: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ color: "#334155", fontWeight: 600, fontSize: "0.8rem" }}>
                    Date of Birth (as on ID)
                  </label>
                  <input
                    className="form-control"
                    type="date"
                    value={regDob}
                    onChange={(e) => setRegDob(e.target.value)}
                    disabled={loading}
                    style={{ fontSize: "0.82rem" }}
                  />
                </div>

                {regIdType === "Aadhaar" && (
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ color: "#334155", fontWeight: 600, fontSize: "0.8rem" }}>Gender</label>
                    <select
                      className="form-control"
                      value={regGender}
                      onChange={(e) => setRegGender(e.target.value)}
                      disabled={loading}
                      style={{ fontSize: "0.82rem" }}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Transgender">Other</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Document Image Upload Zone */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: "#334155", fontWeight: 600, fontSize: "0.82rem" }}>
                  Upload {regIdType} Card Photo *
                </label>

                {regIdPreview ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "8px 12px",
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 10,
                    }}
                  >
                    <img
                      src={regIdPreview}
                      alt="ID Preview"
                      style={{
                        width: 64,
                        height: 42,
                        objectFit: "cover",
                        borderRadius: 6,
                        border: "1px solid #e2e8f0",
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {regIdFile?.name || "Uploaded ID Image"}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#64748B" }}>
                        {(regIdFile?.size / 1024).toFixed(1)} KB • Ready for Anti-Duplicate & AI scan
                      </div>
                    </div>
                    <label
                      style={{
                        background: "#ecfeff",
                        color: "#0891b2",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        padding: "5px 10px",
                        borderRadius: 6,
                        cursor: "pointer",
                        border: "1px solid #a5f3fc",
                      }}
                    >
                      Change
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        disabled={loading}
                        style={{ display: "none" }}
                      />
                    </label>
                  </div>
                ) : (
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "18px 14px",
                      background: "#ffffff",
                      border: "1.5px dashed #06b6d4",
                      borderRadius: 10,
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <UploadCloud size={26} color="#06b6d4" style={{ marginBottom: 4 }} />
                    <div style={{ fontSize: "0.84rem", fontWeight: 600, color: "#0F172A" }}>
                      Click to upload {regIdType} document image
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#64748B", marginTop: 2 }}>
                      JPG, PNG or WebP (Checks originality & extracts details)
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={loading}
                      style={{ display: "none" }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Step 3: Passwords */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: "#1e293b", fontWeight: 600, fontSize: "0.84rem" }}>Password *</label>
                <div style={{ position: "relative" }}>
                  <Lock
                    size={14}
                    style={{
                      position: "absolute",
                      left: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#64748B",
                    }}
                  />
                  <input
                    className="form-control"
                    style={{ paddingLeft: 30, fontSize: "0.84rem" }}
                    type="password"
                    placeholder="Min 6 chars"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: "#1e293b", fontWeight: 600, fontSize: "0.84rem" }}>Confirm Password *</label>
                <div style={{ position: "relative" }}>
                  <Lock
                    size={14}
                    style={{
                      position: "absolute",
                      left: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#64748B",
                    }}
                  />
                  <input
                    className="form-control"
                    style={{ paddingLeft: 30, fontSize: "0.84rem" }}
                    type="password"
                    placeholder="Confirm password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Submit Button with Live Progress */}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                width: "100%",
                padding: "13px",
                fontSize: "0.95rem",
                fontWeight: 600,
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderRadius: 10,
                boxShadow: "0 4px 14px rgba(15, 23, 42, 0.35)",
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="spinner" />
                  {verifyingStage === "dup"
                    ? "1/3 Checking Document Originality..."
                    : verifyingStage === "ai"
                    ? "2/3 Verifying Details with AI..."
                    : "3/3 Creating Account..."}
                </>
              ) : (
                <>
                  <FileCheck size={17} /> Verify ID & Create Account <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Back to Sign In Toggle */}
            <div style={{ textAlign: "center", paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "0.85rem", color: "#64748B" }}>Already have an account? </span>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setError("");
                  setSuccessMsg("");
                  setVerificationFeedback(null);
                  setDupFeedback(null);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#0891b2",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  padding: "4px 8px",
                  textDecoration: "underline",
                }}
              >
                Sign In here
              </button>
            </div>
          </form>
        ) : (
          /* ═══════════════════════════════════════════════════════════ */
          /* CASE B: LOGIN FORM                                         */
          /* ═══════════════════════════════════════════════════════════ */
          <form onSubmit={handleLoginSubmit}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ color: "#1e293b", fontWeight: 600 }}>
                {role === "officer" ? "Officer Email / ID" : "Customer Email / Login ID"}
              </label>
              <div style={{ position: "relative" }}>
                <User
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
                  type="email"
                  placeholder={role === "officer" ? "Enter officer email" : "Enter email or Login ID"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 22 }}>
              <label style={{ color: "#1e293b", fontWeight: 600 }}>Password</label>
              <div style={{ position: "relative" }}>
                <Lock
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
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "0.95rem",
                fontWeight: 600,
                marginBottom: 16,
                borderRadius: 10,
              }}
            >
              {loading
                ? "Signing in..."
                : `Login as ${role === "officer" ? "Loan Officer" : "Customer"}`}{" "}
              <ArrowRight size={16} />
            </button>

            {/* Customer Register Prompt */}
            {role === "user" && (
              <div
                style={{
                  marginTop: 6,
                  paddingTop: 18,
                  borderTop: "1px solid #e2e8f0",
                  textAlign: "center",
                  background: "#f8fafc",
                  borderRadius: 12,
                  padding: "14px 12px",
                }}
              >
                <div style={{ fontSize: "0.85rem", color: "#64748B", marginBottom: 8 }}>
                  Don't have a customer Login ID or account?
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setError("");
                    setSuccessMsg("");
                    setVerificationFeedback(null);
                    setDupFeedback(null);
                  }}
                  className="btn btn-ghost"
                  style={{
                    width: "100%",
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    color: "#0891b2",
                    borderColor: "#a5f3fc",
                    background: "#ecfeff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    borderRadius: 10,
                  }}
                >
                  <UserPlus size={15} /> Register New Customer Account
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
