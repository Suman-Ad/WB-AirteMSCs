import React, { useState } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth"; // <-- CHANGE: import sendPasswordResetEmail
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import "../assets/Login.css";
import Vertiv from "../assets/vertiv.png";

const Login = ({ setUserData }) => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [resetMsg, setResetMsg] = useState(""); // <-- CHANGE: For feedback after reset
  const [showReset, setShowReset] = useState(false); // <-- CHANGE: control visibility
  const [resetEmail, setResetEmail] = useState(""); // <-- CHANGE: separate state
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
        const userData = {
          uid: user.uid,
          circle: data.circle,
          region: data.region,
          siteId: data.siteId,
          empId: data.empId,
          name: data.name,
          role: data.role,
          site: data.site,
          email: data.email,
          designation: data.designation,
          photoURL: data.photoURL || "",
        };
        localStorage.setItem("userData", JSON.stringify(userData));
        setUserData(userData);
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
    setError("");
    setResetMsg("");
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMsg("✅ Password reset email sent! Please check your inbox.");
    } catch (err) {
      setError("Failed to send reset email: " + err.message);
    }
  };

  return (
    <div className="auth-container"
      style={{
        background: `url(${require("../assets/loginbg0.png")}) no-repeat center center fixed`,
        // position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        zIndex: -1,
      }}>
      <form onSubmit={handleLogin} className="auth-form" style={{
        background: "rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        borderRadius: "10px",
        padding: "2rem",
        maxWidth: "400px",
      }}>
        <h2 className="title">
          <img 
            src={Vertiv} 
            alt="Vertiv Logo" 
            className="logo"
            style={{
              height: '2.5em',
              verticalAlign: 'middle',
              margin: '0 0.2em'
            }}
          />
        </h2>

        <h2 style={{color: "white"}}>Employee Login</h2>
        {error && <p className="auth-error">{error}</p>}
        {resetMsg && <p className="auth-success">{resetMsg}</p>} {/* SUCCESS MESSAGE */}

        {!showReset && (<>
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
          className="w-full p-2 mb-2 border rounded"
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          required
          className="w-full p-2 mb-4 border rounded"
        />

        <button
          type="submit"
          className="auth-button"
        >
          Login
        </button>
        </>
        )}

        {/* FORGOT PASSWORD */}
        <p style={{ marginTop: '1em', textAlign: 'center', color: 'white', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setShowReset(!showReset)}>
          {!showReset ? "Forgot Password?" : "Back to Login"}
        </p>
        {showReset && (
          <form onSubmit={handleResetPassword} style={{ marginTop: '1em' }}>
            <input
              type="email"
              name="resetEmail"
              placeholder="Enter your email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
              className="w-full p-2 mb-2 border rounded"
            />
            <button type="submit" className="auth-button" style={{ marginBottom: '1em' }}>
              Send Reset Email
            </button>
          </form>
        )}

        {/* REGISTER */}
        {!showReset && (
        <Link to={"/register"}>
          <button
            className="auth-button"
          >
            Create New Account
          </button>
        </Link>
        )}
      </form>
      <div style={{position: "absolute", width: "100%", bottom: "1em"}}>
        <footer className="auth-footer" style={{color: "white", marginTop: "1em", bottom: 0, textAlign: "center", backdropFilter: "blur(8px)"}}>
          &copy; {new Date().getFullYear()} Vertiv Corporation. All rights reserved. Prepared By <strong style={{fontSize:"12px"}}>@ Crash Algo Corporation</strong>
        </footer>
      </div>
    </div>
  );
};

export default Login;
