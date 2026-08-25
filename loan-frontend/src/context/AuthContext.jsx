import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("loan_auth_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const login = (role, email, name, phone = "", extra = {}) => {
    // Check if user was registered locally
    let resolvedName = name;
    let resolvedPhone = phone;
    let resolvedIdType = extra.id_type || "";
    let resolvedIdNumber = extra.id_number || "";
    let resolvedIdVerified = extra.id_verified || false;

    try {
      const regList = JSON.parse(localStorage.getItem("loan_registered_users") || "[]");
      const found = regList.find((u) => u.email?.toLowerCase() === email?.toLowerCase());
      if (found) {
        resolvedName = found.name || resolvedName;
        resolvedPhone = found.phone || resolvedPhone;
        resolvedIdType = found.id_type || resolvedIdType;
        resolvedIdNumber = found.id_number || resolvedIdNumber;
        resolvedIdVerified = found.id_verified !== undefined ? found.id_verified : resolvedIdVerified;
      }
    } catch (_) {}

    const userData = {
      role, // 'user' | 'officer'
      email: email || (role === "officer" ? "officer@bank.com" : "applicant@bank.com"),
      name: resolvedName || (role === "officer" ? "Loan Officer" : "Customer Applicant"),
      phone: resolvedPhone || "",
      id_type: resolvedIdType,
      id_number: resolvedIdNumber,
      id_verified: resolvedIdVerified,
    };
    setUser(userData);
    localStorage.setItem("loan_auth_user", JSON.stringify(userData));
    return userData;
  };

  const register = (role, email, name, phone = "", password = "", extra = {}) => {
    const userData = {
      role: role || "user",
      email: email.trim().toLowerCase(),
      name: name.trim(),
      phone: phone.trim(),
      id_type: extra.id_type || "Aadhaar",
      id_number: extra.id_number || "",
      id_verified: extra.id_verified !== undefined ? extra.id_verified : true,
    };

    // Save to local registered list for persistence across demo sessions
    try {
      const regList = JSON.parse(localStorage.getItem("loan_registered_users") || "[]");
      const filtered = regList.filter((u) => u.email?.toLowerCase() !== userData.email);
      filtered.push({ ...userData, password });
      localStorage.setItem("loan_registered_users", JSON.stringify(filtered));
    } catch (_) {}

    setUser(userData);
    localStorage.setItem("loan_auth_user", JSON.stringify(userData));
    return userData;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("loan_auth_user");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        isOfficer: user?.role === "officer",
        isUser: user?.role === "user",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
