// src/components/Layout.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import "../assets/Layout.css";
import Vertiv from "../assets/Vertiv1.png";
import { FaArrowLeft } from "react-icons/fa"; // Using react-icons for the arrow

const Layout = ({ userData, children }) => {
  const [collapsed, setCollapsed] = useState(true);
  const navigate = useNavigate();
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth > 512);
  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth > 512);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="layout">
      {/* Sidebar */}
      <Sidebar userData={userData} collapsed={collapsed} setCollapsed={setCollapsed} />
      {/* Main Area */}
      <div className="main" >
        {/* Navbar */}
        <div className="navbar" >
          <button
            className="toggle-btn"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand Menu" : "Collapse Menu"}
          >
            {collapsed ? "☰" : "◀"}
          </button>
          <div style={{ flex: "1", textAlign: "center" }}>
            <header className="main-header">
              <div className="header-top">
                {isLargeScreen && <h1 className="title" title="Prepared By @Sumen Adhikari" >
                  WB Airtel MSC Data Base Management System
                </h1>}
                <img
                  src={Vertiv}
                  alt="Vertiv Logo"
                  className="logo"
                  title="Prepaired By @Sumen Adhikari"
                  style={{
                    height: '4em',
                    verticalAlign: 'middle',
                    margin: '0 0.2em',
                  }}
                  onClick={() => { navigate("/") }}
                />

              </div>
              <p className="dashboard-subinfo">
                <strong>🏢{userData?.site || "All"}</strong>|&nbsp;<strong>🆔{userData.siteId || "All"}</strong>
                <p style={{ marginLeft: "auto" }}><button
                  onClick={() => navigate(-1)}
                  className="back-button"
                >
                  <FaArrowLeft />
                </button></p>
              </p>
            </header>
          </div>
        </div>

        {/* Page Content */}
        <div className="main-content" onClick={() => setCollapsed(true)}>
          {children}
        </div>
        <div style={{ background:"#55b3ab"}}>
          <h4>© 2025 Crash Algo. All rights reserved.</h4>
        </div>
      </div>
    </div>
  );
};

export default Layout;