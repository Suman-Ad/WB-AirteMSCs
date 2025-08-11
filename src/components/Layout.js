// src/components/Layout.js
import React, { useState } from "react";
import Sidebar from "./Sidebar";
import "../assets/Layout.css";

const Layout = ({ userData, children }) => {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="layout">
      {/* Sidebar */}
      <Sidebar userData={userData} collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* Main Area */}
      <div className="main">
        {/* Navbar */}
        <div className="navbar">
          <div style={{ flex: 1, textAlign: "center" }}>
            <h1>WB Airtel - Vertiv - MSC Data Management System</h1>
          </div>
        </div>

        {/* Page Content */}
        <div className="content">{children}</div>
      </div>
    </div>
  );
};

export default Layout;
