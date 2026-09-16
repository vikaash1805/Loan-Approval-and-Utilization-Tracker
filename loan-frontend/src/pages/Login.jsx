import { useState } from "react";
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

  // Status indicators
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Handle standard login
  const handleLoginSubmit = async (e) => {
    e?.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!email.trim()) {
      setError("Please enter your email address.");
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

    if (!regName.trim()) {
      setError("Please provide your full legal name.");
      return;
    }
    if (!regEmail.trim() || !/\S+@\S+\.\S+/.test(regEmail)) {
      setError("Please provide a valid email address.");
      return;
    }
    if (!regPhone.trim() || regPhone.length < 7) {
      setError("Please enter a valid phone number.");
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
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        phone: regPhone.trim(),
        password: regPassword,
        role: "user",
      };

      try {
        await api.registerUser(payload);
      } catch (apiRegErr) {
        // Fallback to local storage persistence
      }

      register("user", payload.email, payload.name, payload.phone, payload.password);

      setSuccessMsg("Account created successfully! Redirecting to loan application...");
      setTimeout(() => {
        navigate("/apply");
      }, 1000);
    } catch (err) {
      setError(err.message || "Registration failed. Please review your information.");
    } finally {
      setLoading(false);
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
        ) : (
          /* ─── Form 2: REGISTRATION ───────────────────────────────────────────────── */
          <form onSubmit={handleRegisterSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                  Creating Account...
                </>
              ) : (
                <>
                  <ShieldCheck size={17} /> Create Account
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
