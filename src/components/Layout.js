// src/components/Layout.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { auth } from "../firebase";
import "../assets/Layout.css";

const Layout = ({ userData, children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await auth.signOut();
    localStorage.removeItem("userData");
    navigate("/login");
  };

  return (
    <div className="layout">
      {/* Sidebar */}
      <div className={`sidebar ${collapsed ? "collapsed" : "expanded"}`}>
        <Sidebar userData={userData} collapsed={collapsed} />
      </div>

      {/* Main Area */}
      <div className="main">
        {/* Navbar */}
        <div className="navbar">
          <button className="toggle-btn" onClick={() => setCollapsed(!collapsed)}>
            ☰
          </button>
          <div>
            Welcome, {userData.name} ({userData.role})
          </div>
          <button onClick={handleLogout}>Logout</button>
        </div>

        {/* Page Content */}
        <div className="content">{children}</div>
      </div>
    </div>
  );
};

export default Layout;
