// src/components/Layout.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import "../assets/Layout.css";
import Vertiv from "../assets/vertiv.png";
import { FaArrowLeft } from "react-icons/fa"; // Using react-icons for the arrow

const Layout = ({ userData, children }) => {
  const [collapsed, setCollapsed] = useState(true);
  const navigate = useNavigate();

  return (
    <div className="layout">
      
      {/* Main Area */}
      <div className="main">    
        {/* Navbar */}
        <div className="navbar">
          <button
            className="toggle-btn"
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? "Expand Menu" : "Collapse Menu"}
            >
              {collapsed ? "☰" : "◀" }
          </button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <header className="main-header">
              <div className="header-top">
                <h1 className="title" title="Prepared By Sumen Adhikari">
                  WB - Airtel - MSC - DBMS
                </h1>
                <img
                  src={Vertiv}
                  alt="Vertiv Logo"
                  className="logo"
                  title="Prepaired By Sumen Adhikari"
                  style={{
                    height: '4em',
                    verticalAlign: 'middle',
                    margin: '0 0.2em',
                  }}
                />
              </div>
              <p className="dashboard-subinfo">
                <strong>🏢{userData?.site || "All"}</strong>|&nbsp;<strong>🆔{userData.siteId || "All"}</strong>
              </p>
            </header>
          </div>
        </div>
        
        {/* Page Content */}  
        <div>
          {/* Sidebar */}
          <Sidebar userData={userData} collapsed={collapsed} setCollapsed={setCollapsed} />
          <button 
            onClick={() => navigate(-1)} 
            className="back-button"
          >
            <FaArrowLeft /> Back
          </button>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;