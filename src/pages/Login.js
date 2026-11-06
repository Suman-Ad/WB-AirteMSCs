import { disableDeviceNotifications } from "../services/deviceNotifications";
import React, { useRef, useState } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import "../assets/Login.css";

const Login = ({ setUserData }) => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const resetInFlight = useRef(false);
  const navigate = useNavigate();

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setResetMsg("");
    try {
      const { user } = await signInWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      if (!user.emailVerified) {
        setError("⚠️ Please verify your email before logging in.");
        return;
      }

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.isActive === false) {
          setError("🚫 Your account is inactive. Please contact with Admin.");
          await disableDeviceNotifications();
          await auth.signOut();
          return;
        }
        const userData = {
          uid: user.uid,
          circle: data.circle,
          region: data.region,
          siteId: data.siteId,
          empId: data.empId,
          mobileNo: data.mobileNo,
          name: data.name,
          role: data.role,
          site: data.site,
          email: data.email,
          designation: data.designation,
          photoURL: data.photoURL || "",
          isAdminAssigned: data.isAdminAssigned,
          adminAssignFrom: data.adminAssignFrom,
          adminAssignTo: data.adminAssignTo,
          isActive: data.isActive,
        };
        localStorage.setItem("userData", JSON.stringify(userData));
        setUserData(userData);
        await updateDoc(doc(db, "users", user.uid), {
          lastActiveAt: new Date()
        });
        navigate("/");
      } else {
        setError("User data not found in Firestore.");
      }
    } catch (err) {
      setError("Login failed: " + err.message);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetInFlight.current) return;
    const email = resetEmail.trim();
    setError("");
    setResetMsg("");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address to reset your password.");
      return;
    }
    resetInFlight.current = true;
    setResetSending(true);
    const successMessage = "If an account exists for this email, a password reset link has been sent. Check your inbox and spam folder, then follow the link to choose a new password.";
    try {
      await sendPasswordResetEmail(auth, email);
      setResetMsg(successMessage);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        setResetMsg(successMessage);
      } else {
        const messages = {
          "auth/invalid-email": "Enter a valid email address to reset your password.",
          "auth/too-many-requests": "Too many reset requests. Please wait a few minutes and try again.",
          "auth/network-request-failed": "Unable to connect. Check your internet connection and try again.",
        };
        setError(messages[err.code] || "Unable to send the reset email. Please try again later or contact your administrator.");
      }
    } finally {
      resetInFlight.current = false;
      setResetSending(false);
    }
  };

  const switchMode = (reset) => {
    if (resetInFlight.current) return;
    if (reset) setResetEmail(formData.email.trim());
    setShowReset(reset);
    setError("");
    setResetMsg("");
  };

  return (
    <main className="nolini-login" style={{
      backgroundImage: `url(${process.env.PUBLIC_URL}/nolini-login-background.png)`,
    }}>
      <section className="nolini-login-card" aria-labelledby="login-heading">
        <div className="nolini-login-brand">
          <img
            src={`${process.env.PUBLIC_URL}/nolini-logo-transparent.png`}
            alt="NOLINI TechEngineering Pvt Ltd"
            className="logo nolini-logo nolini-login-transparent-logo"
          />
        </div>
        <p className="nolini-login-project">WB-AirtelMSCS</p>
        <h1 id="login-heading">{showReset ? "Reset password" : "Employee login"}</h1>
        <form aria-busy={resetSending} onSubmit={showReset ? handleResetPassword : handleLogin} className="nolini-login-form">
          {showReset && <p className="nolini-reset-help">Enter your registered email address. We’ll send you a link to choose a new password.</p>}
          {error && <p className="nolini-login-error" role="alert">{error}</p>}
          {resetMsg && <p className="nolini-login-success" role="status">{resetMsg}</p>}
          <label className="nolini-login-sr-only" htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            name={showReset ? "resetEmail" : "email"}
            placeholder={showReset ? "Enter your email" : "Email address"}
            autoComplete="email"
            disabled={resetSending}
            value={showReset ? resetEmail : formData.email}
            onChange={showReset ? (e) => setResetEmail(e.target.value) : handleChange}
            required
          />
          {!showReset && (
            <div className="nolini-login-password">
              <label className="nolini-login-sr-only" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <button type="button" className="nolini-login-eye" onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                  {!showPassword && <path d="m3 3 18 18" />}
                </svg>
              </button>
            </div>
          )}
          <button type="submit" className="nolini-login-submit" disabled={resetSending}>{resetSending ? "Sending…" : showReset ? "Send reset email" : "Login"}</button>
        </form>
        <div className="nolini-login-links">
          <button type="button" disabled={resetSending} onClick={() => switchMode(!showReset)}>{showReset ? "Back to login" : "Forgot password?"}</button>
          {!showReset && <Link to="/register">Create new account</Link>}
        </div>
      </section>
      <footer className="nolini-login-footer">
        &copy; {new Date().getFullYear()} NOLINI TechEngineering Pvt Ltd. All rights reserved.
      </footer>
    </main>
  );
};

export default Login;
