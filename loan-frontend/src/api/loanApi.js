const BASE = "http://localhost:5000/loan";
const FLASK = "http://localhost:5000";

const request = async (url, opts = {}) => {
  let res;
  try {
    res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
  } catch (netErr) {
    throw new Error(
      netErr.message?.includes("Failed to fetch")
        ? "Unable to connect to backend server. Please verify the server is running."
        : netErr.message || "Network request failed"
    );
  }

  let data;
  try {
    data = await res.json();
  } catch (_) {
    throw new Error(`Server returned non-JSON response (${res.status} ${res.statusText})`);
  }

  if (!res.ok || data?.success === false) {
    const errorMsg =
      (typeof data?.error === "object" ? data.error?.message || JSON.stringify(data.error) : data?.error) ||
      data?.message ||
      `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }
  return data;
};

export const api = {
  sendOtp: (body) =>
    request(`${BASE}/auth/send-otp`, { method: "POST", body: JSON.stringify(body) }),

  verifyOtp: (body) =>
    request(`${BASE}/auth/verify-otp`, { method: "POST", body: JSON.stringify(body) }),

  sendLoginOtp: (body) =>
    request(`${BASE}/auth/send-login-otp`, { method: "POST", body: JSON.stringify(body) }),

  verifyLoginOtp: (body) =>
    request(`${BASE}/auth/verify-login-otp`, { method: "POST", body: JSON.stringify(body) }),

  forgotPassword: (body) =>
    request(`${BASE}/auth/forgot-password`, { method: "POST", body: JSON.stringify(body) }),

  resetPassword: (body) =>
    request(`${BASE}/auth/reset-password`, { method: "POST", body: JSON.stringify(body) }),

  registerUser: (body) =>
    request(`${BASE}/auth/register`, { method: "POST", body: JSON.stringify(body) }),

  loginUser: (body) =>
    request(`${BASE}/auth/login`, { method: "POST", body: JSON.stringify(body) }),

  getAuthProfile: (email) =>
    request(`${BASE}/auth/me?email=${encodeURIComponent(email)}`),

  getDashboard: (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v))
    ).toString();
    return request(`${BASE}/dashboard${q ? "?" + q : ""}`);
  },

  getApplications: (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v))
    ).toString();
    return request(`${BASE}/applications${q ? "?" + q : ""}`);
  },

  getApplication: (id) => request(`${BASE}/applications/${id}`),

  applyLoan: (body) =>
    request(`${BASE}/apply`, { method: "POST", body: JSON.stringify(body) }),

  updateStatus: (id, body) =>
    request(`${BASE}/applications/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  recordUtilization: (body) =>
    request(`${BASE}/utilization`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getUtilization: (loanId) => request(`${BASE}/utilization/${loanId}`),

  repayLoan: (body) =>
    request(`${BASE}/repay`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getAmortization: (loanId) => request(`${BASE}/applications/${loanId}/amortization`),

  updateDocumentStatus: (loanId, docId, body) =>
    request(`${BASE}/applications/${loanId}/documents/${docId}/status`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  requestAdditionalDocument: (loanId, body) =>
    request(`${BASE}/applications/${loanId}/request-document`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // ──────────────────────────────────────────────────────────────
  // Document verification — calls existing /verify endpoint (app.py)
  // formData must contain: user_name, user_dob, user_gender,
  //   user_aadhaar, user_pan, aadhaar_image (File), pan_image (File)
  // ──────────────────────────────────────────────────────────────
  verifyDocuments: async (formData) => {
    try {
      const res = await fetch(`${FLASK}/verify`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok && !data.overall_match) {
        let errMsg = data.error;
        if (typeof errMsg === "object") {
          errMsg = errMsg.message || JSON.stringify(errMsg);
        }
        if (res.status === 503 || (errMsg && errMsg.includes("Deadline expired"))) {
          throw new Error("Verification Service Timeout (503): The verification engine took too long to respond. Please click Verify again to retry.");
        }
        throw new Error(errMsg || "Verification failed");
      }
      return data;
    } catch (err) {
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        throw new Error("Unable to connect to Flask backend at http://localhost:5000. Ensure app.py is running.");
      }
      throw err;
    }
  },

  // ──────────────────────────────────────────────────────────────
  // Single ID verification for customer registration
  // formData contains: id_type, user_name, id_number, user_dob, user_gender, id_image (File)
  // ──────────────────────────────────────────────────────────────
  verifySingleId: async (formData) => {
    try {
      const res = await fetch(`${FLASK}/verify-single-id`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        let errMsg = data.error;
        if (typeof errMsg === "object") {
          errMsg = errMsg.message || JSON.stringify(errMsg);
        }
        throw new Error(errMsg || "ID Verification failed");
      }
      return data;
    } catch (err) {
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        throw new Error("Unable to connect to verification server at http://localhost:5000. Ensure app.py is running.");
      }
      throw err;
    }
  },

  // ──────────────────────────────────────────────────────────────
  // Image duplicate check — calls existing /check-image endpoint (app.py)
  // Returns { status: "positive"|"negative", exists: bool, message }
  // ──────────────────────────────────────────────────────────────
  checkImageDuplicate: async (imageFile) => {
    try {
      const fd = new FormData();
      fd.append("image", imageFile);
      const res = await fetch(`${FLASK}/check-image`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        let errMsg = data.error;
        if (typeof errMsg === "object") {
          errMsg = errMsg.message || JSON.stringify(errMsg);
        }
        throw new Error(errMsg || "Duplicate check failed");
      }
      return data;
    } catch (err) {
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        throw new Error("Unable to connect to Flask backend at http://localhost:5000. Ensure app.py is running.");
      }
      throw err;
    }
  },

  // ──────────────────────────────────────────────────────────────
  // Notifications API
  // ──────────────────────────────────────────────────────────────
  getNotifications: (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""))
    ).toString();
    return request(`${BASE}/notifications${q ? "?" + q : ""}`);
  },

  postNotification: (body) =>
    request(`${BASE}/notifications`, { method: "POST", body: JSON.stringify(body) }),

  markNotificationRead: (id) =>
    request(`${BASE}/notifications/${id}/read`, { method: "PUT" }),

  markAllNotificationsRead: (body = {}) =>
    request(`${BASE}/notifications/read-all`, { method: "PUT", body: JSON.stringify(body) }),

  deleteNotification: (id) =>
    request(`${BASE}/notifications/${id}`, { method: "DELETE" }),

  clearAllNotifications: (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""))
    ).toString();
    return request(`${BASE}/notifications${q ? "?" + q : ""}`, { method: "DELETE" });
  },
};


