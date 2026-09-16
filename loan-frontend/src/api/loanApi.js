const BASE = "http://localhost:5000/loan";
const FLASK = "http://localhost:5000";

const request = async (url, opts = {}) => {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json();
  if (!data.success && !res.ok) throw new Error(data.error || "API error");
  return data;
};

export const api = {
  registerUser: (body) =>
    request(`${BASE}/auth/register`, { method: "POST", body: JSON.stringify(body) }),

  loginUser: (body) =>
    request(`${BASE}/auth/login`, { method: "POST", body: JSON.stringify(body) }),

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
};


