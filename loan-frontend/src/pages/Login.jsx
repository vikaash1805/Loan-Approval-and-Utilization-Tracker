import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/loanApi";
import {
  ShieldCheck,
  User,
  Lock,
  Mail,
  Phone,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Key,
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
  const [regStep, setRegStep] = useState(1); // 1 = Details, 2 = In-Page Email OTP Verification

  // OTP Verification State (Registration)
  const [otpValue, setOtpValue] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1 = enter email, 2 = enter OTP & new password
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");

  // Status indicators
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Resend OTP Countdown Timer
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle standard login
  const handleLoginSubmit = async (e) => {
    e?.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      let localUser = null;
      try {
        const regList = JSON.parse(localStorage.getItem("loan_registered_users") || "[]");
        localUser = regList.find((u) => u.email?.toLowerCase() === email.trim().toLowerCase());
      } catch (_) {}

      let authRes;
      try {
        authRes = await api.loginUser({
          email: email.trim(),
          password,
          role,
        });
      } catch (apiErr) {
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
      const targetRole = role === "officer" ? "officer" : (userData.role || role);
      const loggedInUser = login(
        targetRole,
        userData.email || email.trim(),
        userData.name || (localUser?.name || (targetRole === "officer" ? "Senior Underwriting Officer" : "")),
        userData.phone || (localUser?.phone || ""),
        {
          id_type: userData.id_type || localUser?.id_type,
          id_number: userData.id_number || localUser?.id_number,
          id_verified: userData.id_verified ?? localUser?.id_verified,
        }
      );

      if (targetRole === "officer") {
        navigate("/approvals");
      } else {
        navigate("/apply");
      }
    } catch (err) {
      setError(err.message || "Failed to sign in. Please verify your credentials or register an account.");
    } finally {
      setLoading(false);
    }
  };

  // Handle customer registration
  const handleRegisterSubmit = async (e) => {
    e?.preventDefault();
    setError("");
    setSuccessMsg("");

    const nameTrimmed = regName.trim();
    if (!nameTrimmed || nameTrimmed.length < 2) {
      setError("Please provide your full legal name (at least 2 characters).");
      return;
    }
    if (!/^[A-Za-z\s.'-]+$/.test(nameTrimmed)) {
      setError("Legal name should contain only alphabetic letters.");
      return;
    }
    if (!regEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      setError("Please provide a valid email address.");
      return;
    }
    const cleanPhone = regPhone.replace(/\D/g, "");
    if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      setError("Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).");
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: nameTrimmed,
        email: regEmail.trim().toLowerCase(),
        phone: cleanPhone,
        password: regPassword,
        role: "user",
      };

      const res = await api.sendOtp(payload);
      setRegStep(2); // Seamless in-page OTP verification step
      setOtpValue("");
      setOtpError("");
      setOtpSuccess(res.message || `A 6-digit verification code was sent to ${payload.email}.`);
      setResendCooldown(60);
    } catch (err) {
      setError(err.message || "Failed to dispatch verification code. Please check your information.");
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP verification for Registration
  const handleVerifyOtpSubmit = async (e) => {
    e?.preventDefault();
    setOtpError("");
    setOtpSuccess("");

    const cleanOtp = otpValue.trim();
    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setOtpError("Please enter all 6 digits of the verification code.");
      return;
    }

    setOtpLoading(true);
    try {
      const emailNorm = regEmail.trim().toLowerCase();
      await api.verifyOtp({
        email: emailNorm,
        otp: cleanOtp,
      });

      setOtpSuccess("✓ Email verified successfully! Redirecting to loan application...");
      register("user", emailNorm, regName.trim(), regPhone.trim(), regPassword);

      setTimeout(() => {
        navigate("/apply");
      }, 1000);
    } catch (err) {
      setOtpError(err.message || "Verification failed. Please check the code and try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  // Resend OTP handler for Registration
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || otpLoading) return;
    setOtpError("");
    setOtpSuccess("");
    setOtpLoading(true);
    try {
      const payload = {
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        phone: regPhone.replace(/\D/g, ""),
        password: regPassword,
        role: "user",
      };
      const res = await api.sendOtp(payload);
      setOtpSuccess("✓ A fresh 6-digit verification code has been dispatched!");
      setResendCooldown(60);
    } catch (err) {
      setOtpError(err.message || "Failed to resend verification code.");
    } finally {
      setOtpLoading(false);
    }
  };

  // Forgot password handlers
  const handleForgotSendOtp = async (e) => {
    e?.preventDefault();
    setForgotError("");
    setForgotSuccess("");
    const cleanMail = forgotEmail.trim().toLowerCase();
    if (!cleanMail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanMail)) {
      setForgotError("Please enter a valid email address.");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await api.forgotPassword({ email: cleanMail });
      setForgotSuccess(res.message || "Verification code dispatched to your email.");
      setForgotStep(2);
    } catch (err) {
      setForgotError(err.message || "Failed to dispatch reset code.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotResetSubmit = async (e) => {
    e?.preventDefault();
    setForgotError("");
    setForgotSuccess("");
    if (!forgotOtp || forgotOtp.trim().length !== 6) {
      setForgotError("Please enter the 6-digit verification code.");
      return;
    }
    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      setForgotError("Password must be at least 6 characters.");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError("Passwords do not match.");
      return;
    }
    setForgotLoading(true);
    try {
      await api.resetPassword({
        email: forgotEmail.trim().toLowerCase(),
        otp_code: forgotOtp.trim(),
        new_password: forgotNewPassword,
      });
      setForgotSuccess("Password reset successfully! Redirecting to sign in...");
      setTimeout(() => {
        setShowForgotModal(false);
        setSuccessMsg("Password reset successfully! You can now sign in with your new password.");
        setEmail(forgotEmail.trim().toLowerCase());
        setPassword("");
        setForgotStep(1);
      }, 1400);
    } catch (err) {
      setForgotError(err.message || "Failed to reset password.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0B1120 0%, #0F172A 50%, #1E293B 100%)",
        color: "#FFFFFF",
        position: "relative",
        overflow: "hidden",
        padding: "24px 16px",
      }}
    >
      {/* Ambient background glows */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          left: "-5%",
          width: "45vw",
          height: "45vw",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-15%",
          right: "-5%",
          width: "45vw",
          height: "45vw",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Centered Clean Auth Card */}
      <div
        style={{
          width: "100%",
          maxWidth: isRegister ? 460 : 440,
          background: "#FFFFFF",
          borderRadius: "var(--radius-xl)",
          padding: "32px 30px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.35)",
          color: "#0F172A",
          border: "1px solid rgba(255, 255, 255, 0.8)",
          position: "relative",
          zIndex: 1,
          maxHeight: "92vh",
          overflowY: "auto",
          transition: "max-width 0.3s ease",
        }}
      >
        {/* Brand Logo & Title */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img
            src={fundmatrixLogo}
            alt="FUNDMATRIX"
            style={{
              height: 38,
              width: "auto",
              margin: "0 auto 8px",
              display: "block",
            }}
          />
          <h2
            style={{
              fontFamily: "Outfit, sans-serif",
              fontSize: "1.45rem",
              fontWeight: 800,
              color: "#0F172A",
              letterSpacing: "-0.5px",
            }}
          >
            {isRegister ? "Create Account" : "Sign In to Your Account"}
          </h2>
        </div>

        {/* Switcher: Sign In vs Register */}
        <div
          style={{
            display: "flex",
            background: "#F1F5F9",
            padding: 4,
            borderRadius: "var(--radius-md)",
            marginBottom: 18,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setIsRegister(false);
              setError("");
              setSuccessMsg("");
            }}
            style={{
              flex: 1,
              padding: "9px 14px",
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: !isRegister ? "#FFFFFF" : "transparent",
              color: !isRegister ? "#0F172A" : "#64748B",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
              boxShadow: !isRegister ? "0 2px 6px rgba(15, 23, 42, 0.08)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegister(true);
              setRegStep(1);
              setError("");
              setSuccessMsg("");
              setRole("user");
            }}
            style={{
              flex: 1,
              padding: "9px 14px",
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: isRegister ? "#FFFFFF" : "transparent",
              color: isRegister ? "#0F172A" : "#64748B",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
              boxShadow: isRegister ? "0 2px 6px rgba(15, 23, 42, 0.08)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            Create Account
          </button>
        </div>

        {/* Role Switcher (Sign In mode) */}
        {!isRegister && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                type="button"
                onClick={() => setRole("user")}
                style={{
                  padding: "9px 10px",
                  borderRadius: "var(--radius-md)",
                  border: role === "user" ? "2px solid #06B6D4" : "1px solid #E2E8F0",
                  background: role === "user" ? "#ECFEFF" : "#F8FAFC",
                  color: role === "user" ? "#0891B2" : "#475569",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <User size={15} /> Customer
              </button>

              <button
                type="button"
                onClick={() => setRole("officer")}
                style={{
                  padding: "9px 10px",
                  borderRadius: "var(--radius-md)",
                  border: role === "officer" ? "2px solid #10B981" : "1px solid #E2E8F0",
                  background: role === "officer" ? "#ECFDF5" : "#F8FAFC",
                  color: role === "officer" ? "#059669" : "#475569",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <ShieldCheck size={15} /> Loan Officer
              </button>
            </div>

          </div>
        )}

        {/* Feedback alerts */}
        {error && (
          <div className="alert alert-error" style={{ fontSize: "0.82rem", padding: "10px 14px", marginBottom: 14 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert alert-success" style={{ fontSize: "0.82rem", padding: "10px 14px", marginBottom: 14 }}>
            <CheckCircle size={16} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ─── Form 1: SIGN IN ──────────────────────────────────────────────────────── */}
        {!isRegister ? (
          <form onSubmit={handleLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-group">
              <label>Email Address</label>
              <div style={{ position: "relative" }}>
                <Mail
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
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label>Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotStep(1);
                    setForgotError("");
                    setForgotSuccess("");
                    setShowForgotModal(true);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#2563EB",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Forgot password?
                </button>
              </div>
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
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: "100%", marginTop: 6 }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} style={{ animation: "spin 0.8s linear infinite" }} /> Authenticating...
                </>
              ) : (
                <>
                  Sign In <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        ) : regStep === 1 ? (
          /* ─── Form 2A: REGISTRATION STEP 1 (DETAILS) ───────────────────────────────── */
          <form onSubmit={handleRegisterSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Step progress pills */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: "#06B6D4" }} />
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: "#E2E8F0" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", color: "#64748B", marginBottom: 6 }}>
              <span style={{ color: "#0891B2", fontWeight: 800 }}>Step 1: Account Information</span>
              <span>Step 2: Email OTP</span>
            </div>

            <div className="form-group">
              <label>Full Legal Name *</label>
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
                  placeholder="Enter full legal name"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Email Address *</label>
              <div style={{ position: "relative" }}>
                <Mail
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
                  placeholder="Enter email address"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Phone Number *</label>
              <div style={{ position: "relative" }}>
                <Phone
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
                  placeholder="Enter contact phone number"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="form-group">
                <label>Password *</label>
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
                    placeholder="Min 6 chars"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Confirm *</label>
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
                    placeholder="Re-enter"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-accent btn-lg"
              style={{ width: "100%", marginTop: 4 }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} style={{ animation: "spin 0.8s linear infinite" }} />
                  Sending Verification Code...
                </>
              ) : (
                <>
                  <Mail size={17} /> Verify Email & Continue <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        ) : (
          /* ─── Form 2B: REGISTRATION STEP 2 (IN-PAGE EMAIL OTP VERIFICATION) ───────── */
          <form onSubmit={handleVerifyOtpSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Step progress pills */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: "#10B981" }} />
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: "#06B6D4" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", color: "#64748B", marginBottom: 8 }}>
              <span style={{ color: "#10B981", fontWeight: 700 }}>✓ Step 1: Details</span>
              <span style={{ color: "#0891B2", fontWeight: 800 }}>Step 2: Email OTP Verification</span>
            </div>

            <div style={{ textAlign: "center", padding: "6px 0 2px" }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "#EFF6FF",
                  color: "#2563EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 10px",
                }}
              >
                <Mail size={26} />
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>
                Verify Your Email Address
              </h3>
              <p style={{ fontSize: "0.82rem", color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                Enter the 6-digit one-time passcode sent to:
                <br />
                <strong style={{ color: "#0F172A" }}>{regEmail.toLowerCase()}</strong>{" "}
                <button
                  type="button"
                  onClick={() => { setRegStep(1); setOtpError(""); }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#2563EB",
                    fontSize: "0.78rem",
                    textDecoration: "underline",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  (change email)
                </button>
              </p>
            </div>



            {otpError && (
              <div className="alert alert-error" style={{ fontSize: "0.82rem", padding: "10px" }}>
                {otpError}
              </div>
            )}

            {otpSuccess && (
              <div className="alert alert-success" style={{ fontSize: "0.82rem", padding: "10px" }}>
                {otpSuccess}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 2 }}>
              <label style={{ textAlign: "center", display: "block", marginBottom: 6, fontWeight: 700 }}>
                6-Digit Email Verification Code
              </label>
              <input
                type="text"
                maxLength={6}
                inputMode="numeric"
                placeholder="• • • • • •"
                value={otpValue}
                onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
                style={{
                  fontSize: "2rem",
                  letterSpacing: "12px",
                  textAlign: "center",
                  fontWeight: 800,
                  color: "#0F172A",
                  fontFamily: "monospace",
                  height: 56,
                  borderRadius: 10,
                  border: "2px solid #CBD5E1",
                  background: "#F8FAFC",
                  width: "100%",
                }}
                autoFocus
                disabled={otpLoading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-accent btn-lg"
              style={{ width: "100%", marginTop: 2 }}
              disabled={otpLoading || otpValue.length !== 6}
            >
              {otpLoading ? (
                <>
                  <RefreshCw size={16} style={{ animation: "spin 0.8s linear infinite" }} />
                  Verifying Code...
                </>
              ) : (
                <>
                  <ShieldCheck size={18} /> Verify & Complete Registration
                </>
              )}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || otpLoading}
                style={{ fontSize: "0.8rem", color: resendCooldown > 0 ? "#94A3B8" : "#2563EB" }}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => { setRegStep(1); setOtpError(""); }}
                disabled={otpLoading}
                style={{ fontSize: "0.8rem", color: "#64748B" }}
              >
                ← Back to Edit Info
              </button>
            </div>
          </form>
        )}
      </div>



      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div
            className="modal"
            style={{
              maxWidth: 440,
              width: "90vw",
              padding: "32px 28px",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "#EFF6FF",
                  color: "#2563EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                }}
              >
                <Key size={26} />
              </div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                Reset Your Password
              </h3>
              <p style={{ fontSize: "0.82rem", color: "#64748B", marginTop: 6 }}>
                {forgotStep === 1
                  ? "Enter your account email to receive a 6-digit verification code."
                  : `Enter the 6-digit code sent to ${forgotEmail} and choose a new password.`}
              </p>
            </div>



            {forgotError && (
              <div className="alert alert-error" style={{ fontSize: "0.82rem", marginBottom: 14, padding: "10px" }}>
                {forgotError}
              </div>
            )}

            {forgotSuccess && (
              <div className="alert alert-success" style={{ fontSize: "0.82rem", marginBottom: 14, padding: "10px" }}>
                {forgotSuccess}
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleForgotSendOtp} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="form-group">
                  <label>Account Email</label>
                  <div style={{ position: "relative" }}>
                    <Mail
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
                      placeholder="name@domain.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      disabled={forgotLoading}
                      autoFocus
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ flex: 1 }}
                    onClick={() => setShowForgotModal(false)}
                    disabled={forgotLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 2 }}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? (
                      <>
                        <RefreshCw size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Sending...
                      </>
                    ) : (
                      "Send Verification Code"
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleForgotResetSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="form-group">
                  <label>6-Digit Verification Code</label>
                  <input
                    className="form-control"
                    style={{
                      letterSpacing: 8,
                      textAlign: "center",
                      fontWeight: 800,
                      fontSize: "1.3rem",
                      fontFamily: "monospace",
                    }}
                    maxLength={6}
                    placeholder="••••••"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    disabled={forgotLoading}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label>New Password (min 6 characters)</label>
                  <input
                    className="form-control"
                    type="password"
                    placeholder="New password"
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    disabled={forgotLoading}
                  />
                </div>

                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input
                    className="form-control"
                    type="password"
                    placeholder="Confirm new password"
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    disabled={forgotLoading}
                  />
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ flex: 1 }}
                    onClick={() => setForgotStep(1)}
                    disabled={forgotLoading}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="btn btn-accent"
                    style={{ flex: 2 }}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? (
                      <>
                        <RefreshCw size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Updating...
                      </>
                    ) : (
                      "Update Password"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
