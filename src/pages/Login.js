// src/pages/Login.js
import React, { useState } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import "../assets/Login.css";


const Login = ({ setUserData }) => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

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
          name: data.name,
          role: data.role,
          site: data.site,
          email: data.email,
          designation: data.designation,
          photoURL: data.photoURL || "",
        };
        console.log("User data:", userData);
        localStorage.setItem("userData", JSON.stringify(userData));
        setUserData(userData); // <-- very important for App.js routing
        navigate("/dashboard");
      } else {
        setError("User data not found in Firestore.");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Login failed: " + err.message);
    }
  };

  return (
    <div className="auth-container">
      <form onSubmit={handleLogin} className="auth-form">
        <strong><h2>WB Airtel MSC's - Vertiv</h2></strong>

        <h2 className="text-2xl font-bold mb-4">Login</h2>
        {error && <p className="auth-error">{error}</p>}

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
          className="bg-blue-600 text-white p-2 w-full rounded"
        >
          Login
        </button>
        <Link to={"/register"}>
        <button
          className="bg-blue-600 text-white p-2 w-full rounded"
        >
          Register
        </button>
        </Link>
      </form>
    </div>
  );
};

export default Login;
