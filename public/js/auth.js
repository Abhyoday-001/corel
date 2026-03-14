const API_BASE = '/api/auth';

const state = {
  verificationId: null,
  flow: null,
  resendCooldown: 0,
  resendTimerId: null
};

const elements = {
  message: document.getElementById("form-message"),
  tabs: document.querySelectorAll(".tab-btn"),
  sections: {
    login: document.getElementById("login-section"),
    signup: document.getElementById("signup-section"),
    otp: document.getElementById("otp-section"),
    forgot: document.getElementById("forgot-section"),
    reset: document.getElementById("reset-section")
  },
  loginBtn: document.getElementById("login-btn"),
  signupBtn: document.getElementById("signup-btn"),
  verifyBtn: document.getElementById("verify-btn"),
  forgotLink: document.getElementById("forgot-link"),
  forgotBtn: document.getElementById("forgot-btn"),
  backToLogin: document.getElementById("back-to-login"),
  resetBtn: document.getElementById("reset-btn"),
  resetBack: document.getElementById("reset-back")
};

const resendButtons = Array.from(document.querySelectorAll('[data-resend="button"]'));
const resendTimers = Array.from(document.querySelectorAll('[data-resend="timer"]'));

/* ── If already logged in, redirect to main app ───────────── */
if (sessionStorage.getItem("accessToken")) {
  window.location.href = "./index.html";
}

/* ── UI helpers ───────────────────────────────────────────── */
const showMessage = (text, type = "success") => {
  elements.message.textContent = text;
  elements.message.classList.toggle("error", type === "error");
  elements.message.style.display = "block";
};

const clearMessage = () => {
  elements.message.style.display = "none";
  elements.message.textContent = "";
  elements.message.classList.remove("error");
};

const setActiveSection = (name) => {
  Object.values(elements.sections).forEach((section) => section.classList.remove("active"));
  if (elements.sections[name]) elements.sections[name].classList.add("active");
};

const setActiveTab = (name) => {
  elements.tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === name);
  });
  clearMessage();
  state.flow = null;
  if (name === "login") setActiveSection("login");
  if (name === "signup") setActiveSection("signup");
};

/* ── API wrapper ──────────────────────────────────────────── */
const apiPost = async (path, body) => {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.message || "Something went wrong";
    throw new Error(message);
  }
  return data;
};

/* ── OTP grid helpers ─────────────────────────────────────── */
const collectOtp = (key) => {
  const grid = document.querySelector(`.otp-grid[data-otp="${key}"]`);
  if (!grid) return "";
  return Array.from(grid.querySelectorAll("input"))
    .map((input) => input.value.trim())
    .join("");
};

const clearOtpGrid = (key) => {
  const grid = document.querySelector(`.otp-grid[data-otp="${key}"]`);
  if (!grid) return;
  grid.querySelectorAll("input").forEach((input) => { input.value = ""; });
  grid.querySelector("input")?.focus();
};

const setupOtpGrid = (grid) => {
  const inputs = Array.from(grid.querySelectorAll("input"));
  inputs.forEach((input, idx) => {
    input.addEventListener("input", (event) => {
      const value = event.target.value.replace(/\D/g, "");
      event.target.value = value.slice(0, 1);
      if (value && inputs[idx + 1]) inputs[idx + 1].focus();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" && !event.target.value && inputs[idx - 1]) {
        inputs[idx - 1].focus();
      }
    });
    input.addEventListener("paste", (event) => {
      const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
      if (pasted.length === inputs.length) {
        inputs.forEach((inputEl, i) => { inputEl.value = pasted[i]; });
        inputs[inputs.length - 1].focus();
      }
      event.preventDefault();
    });
  });
};

/* ── Resend timer ─────────────────────────────────────────── */
const startResendTimer = (seconds = 30) => {
  state.resendCooldown = seconds;
  resendButtons.forEach((btn) => { btn.disabled = true; });
  if (state.resendTimerId) clearInterval(state.resendTimerId);

  resendTimers.forEach((t) => { t.textContent = `Resend available in ${state.resendCooldown}s`; });

  state.resendTimerId = setInterval(() => {
    state.resendCooldown -= 1;
    if (state.resendCooldown <= 0) {
      clearInterval(state.resendTimerId);
      resendButtons.forEach((btn) => { btn.disabled = false; });
      resendTimers.forEach((t) => { t.textContent = "You can resend now"; });
      return;
    }
    resendTimers.forEach((t) => { t.textContent = `Resend available in ${state.resendCooldown}s`; });
  }, 1000);
};

/* ── Inline validation ────────────────────────────────────── */
const emailRegex = /^\S+@\S+\.\S+$/;
const phoneRegex = /^\+?[0-9\s()-]{7,}$/;

const loginIdentifier = document.getElementById("login-identifier");
const loginIdentifierHelper = document.getElementById("login-identifier-helper");
const signupEmail = document.getElementById("signup-email");
const signupPhone = document.getElementById("signup-phone");
const signupEmailHelper = document.getElementById("signup-email-helper");
const signupPhoneHelper = document.getElementById("signup-phone-helper");

loginIdentifier.addEventListener("input", () => {
  const value = loginIdentifier.value.trim();
  if (!value) { loginIdentifierHelper.textContent = ""; return; }
  if (emailRegex.test(value)) { loginIdentifierHelper.textContent = "✓ Email format"; }
  else if (phoneRegex.test(value)) { loginIdentifierHelper.textContent = "✓ Phone format"; }
  else { loginIdentifierHelper.textContent = "Enter a valid email or phone number"; }
});

signupEmail.addEventListener("input", () => {
  const value = signupEmail.value.trim();
  if (!value) { signupEmailHelper.textContent = ""; return; }
  signupEmailHelper.textContent = emailRegex.test(value) ? "✓ Valid email" : "Enter a valid email";
});

signupPhone.addEventListener("input", () => {
  const value = signupPhone.value.trim();
  if (!value) { signupPhoneHelper.textContent = ""; return; }
  signupPhoneHelper.textContent = phoneRegex.test(value) ? "✓ Valid phone" : "Enter a valid phone";
});

/* ── Tab switching ────────────────────────────────────────── */
elements.tabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
});

elements.forgotLink.addEventListener("click", () => {
  clearMessage();
  setActiveSection("forgot");
});

elements.backToLogin.addEventListener("click", () => setActiveTab("login"));
elements.resetBack.addEventListener("click", () => setActiveTab("login"));

/* ── Signup ───────────────────────────────────────────────── */
elements.signupBtn.addEventListener("click", async () => {
  clearMessage();
  const payload = {
    name: document.getElementById("signup-name").value.trim(),
    email: signupEmail.value.trim(),
    phone: signupPhone.value.trim(),
    password: document.getElementById("signup-password").value
  };
  try {
    const data = await apiPost("/signup", payload);
    state.verificationId = data.verificationId;
    state.flow = "signup";
    setActiveSection("otp");
    let message = data.message || "OTP sent! Check your email and phone.";
    if (data.debugOtp) {
      // Expose OTP directly in the UI in this demo environment
      message += ` (OTP: ${data.debugOtp})`;
    }
    showMessage(message);
    startResendTimer();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

/* ── Verify OTP (signup) ──────────────────────────────────── */
elements.verifyBtn.addEventListener("click", async () => {
  clearMessage();
  if (!state.verificationId) {
    showMessage("Missing verification session", "error");
    return;
  }
  const otp = collectOtp("code");
  if (otp.length !== 6) {
    showMessage("Please enter all 6 digits", "error");
    return;
  }
  const payload = {
    verificationId: state.verificationId,
    otp
  };
  try {
    const data = await apiPost("/verify-signup", payload);
    if (data.accessToken) {
      sessionStorage.setItem("accessToken", data.accessToken);
    }
    showMessage(data.message || "Account created!");
    setTimeout(() => { window.location.href = "./index.html"; }, 800);
  } catch (error) {
    showMessage(error.message, "error");
    clearOtpGrid("code");
  }
});

/* ── Login ────────────────────────────────────────────────── */
elements.loginBtn.addEventListener("click", async () => {
  clearMessage();
  const payload = {
    identifier: loginIdentifier.value.trim(),
    password: document.getElementById("login-password").value
  };
  try {
    const data = await apiPost("/login", payload);
    if (data.accessToken) {
      sessionStorage.setItem("accessToken", data.accessToken);
    }
    showMessage(data.message || "Login successful!");
    setTimeout(() => { window.location.href = "./index.html"; }, 800);
  } catch (error) {
    showMessage(error.message, "error");
  }
});

/* ── Forgot password ──────────────────────────────────────── */
elements.forgotBtn.addEventListener("click", async () => {
  clearMessage();
  const payload = {
    identifier: document.getElementById("forgot-identifier").value.trim()
  };
  try {
    const data = await apiPost("/forgot", payload);
    if (!data.verificationId) {
      showMessage(data.message || "If the account exists, an OTP has been sent.");
      return;
    }
    state.verificationId = data.verificationId;
    state.flow = "reset";
    setActiveSection("reset");
    let message = data.message || "OTP sent! Check your email and phone.";
    if (data.debugOtp) {
      message += ` (OTP: ${data.debugOtp})`;
    }
    showMessage(message);
    startResendTimer();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

/* ── Reset password ───────────────────────────────────────── */
elements.resetBtn.addEventListener("click", async () => {
  clearMessage();
  if (!state.verificationId) {
    showMessage("Missing verification session", "error");
    return;
  }
  const otp = collectOtp("reset-code");
  if (otp.length !== 6) {
    showMessage("Please enter all 6 digits", "error");
    return;
  }
  const payload = {
    verificationId: state.verificationId,
    otp,
    newPassword: document.getElementById("reset-password").value
  };
  try {
    const data = await apiPost("/reset", payload);
    showMessage(data.message || "Password updated! You can now login.");
    setTimeout(() => { setActiveTab("login"); }, 1500);
  } catch (error) {
    showMessage(error.message, "error");
    clearOtpGrid("reset-code");
  }
});

/* ── Resend OTP ───────────────────────────────────────────── */
const handleResend = async () => {
  if (state.resendCooldown > 0) return;
  if (!state.verificationId) {
    showMessage("Missing verification session", "error");
    return;
  }
  try {
    const data = await apiPost("/resend-otp", {
      verificationId: state.verificationId
    });
    let message = data.message || "New OTP sent!";
    if (data.debugOtp) {
      message += ` (OTP: ${data.debugOtp})`;
    }
    showMessage(message);
    startResendTimer();
  } catch (error) {
    showMessage(error.message, "error");
  }
};

resendButtons.forEach((btn) => { btn.addEventListener("click", handleResend); });

/* ── Init OTP grids ───────────────────────────────────────── */
document.querySelectorAll(".otp-grid").forEach(setupOtpGrid);

/* ── Silent token refresh ─────────────────────────────────── */
const refreshAccessToken = async () => {
  try {
    const data = await apiPost("/refresh", {});
    if (data.accessToken) {
      sessionStorage.setItem("accessToken", data.accessToken);
    }
  } catch { /* ignore */ }
};
refreshAccessToken();

/* ── Handle deep link: #signup opens signup tab ───────────── */
if (window.location.hash === "#signup") {
  setActiveTab("signup");
}
