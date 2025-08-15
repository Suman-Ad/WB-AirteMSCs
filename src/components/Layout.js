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
      {/* Sidebar */}
      <Sidebar userData={userData} collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* Main Area */}
      <div className="main">
        {/* Navbar */}
        <div className="navbar">
          <div style={{ flex: 1, textAlign: "center" }}>
            <header className="main-header">
              <div className="header-top">
                
                <h1 className="title">
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
                  WB - Airtel - MSC Data Management System
                </h1>
              </div>
              <h2 className="dashboard-subinfo">
                👋 Welcome, <strong>{userData?.name || "Team Member"}</strong>
              </h2>
              <p className="dashboard-subinfo">
                {userData?.role === "Super Admin" && <span>🔒 <strong>Super Admin</strong></span>}
                {userData?.role === "Admin" && <span>🛠️ <strong>Admin</strong></span>}
                {userData?.role === "Super User" && <span>📍 <strong>Super User</strong></span>}
                {userData?.role === "User" && <span>👤 <strong>User</strong></span>}
                &nbsp; | &nbsp; 🎖️ Designation: <strong>{userData?.designation || "All"}</strong> | &nbsp; 🏢 Site: <strong>{userData?.site || "All"}</strong> | &nbsp; 🛡️ Site ID: <strong>{userData.siteId || "All"}</strong>
              </p>
            </header>
          </div>
        </div>
        {/* Page Content */}  
        <div className="content">
          <button 
            onClick={() => navigate(-1)} 
            className="content"
          >
            <FaArrowLeft /> Back
          </button>
          {children}</div>
      </div>
    </div>
  );
};

export default Layout;