// src/components/Layout.js
import React, { useState } from "react";
import Sidebar from "./Sidebar";
import "../assets/Layout.css";

const Layout = ({ userData, children }) => {
  const [collapsed, setCollapsed] = useState(false);

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
          <div style={{ flex: 1, textAlign: "center" }}>
            <h1>WB Airtel - Vertiv - MSC PM Managment Tracker</h1>
          </div>
        </div>

        {/* Page Content */}
        <div className="content">{children}</div>
      </div>
    </div>
  );
};

export default Layout;
