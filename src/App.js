import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AdminPanel from "./pages/AdminPanel";
import SitePage from "./pages/SitePage";
import Profile from "./pages/Profile"; // optional
import PMHistoryPage from "./pages/PMHistoryPage";
import Layout from "./components/Layout";
import RoleProtectedRoute from "./components/RoleProtectedRoute";
import ExcelDataManager from "./pages/ExcelDataManager";
import ExcelLiveEditPage from "./pages/ExcelLiveEditPage";
import DailyDashboard from "./pages/DailyDashboard";
import PMCalendarManagement from "./pages/PMCalendarManagement";
import IncidentDashboard from "./pages/IncidentDashboard";
import IncidentManagement from "./pages/IncidentManagement";
import DHRDashboard from "./pages/DHRDashboard";
import CreateDHR from "./pages/CreateDHR";
import ComplianceDashboard from "./pages/ComplianceDashboard";
import ManageCompliance from "./pages/ManageCompliance";
import AssetsRegister from "./pages/AssetsRegister";
import AssetsDashboard from "./pages/AssetsDashboard";


function App() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🔁 Restore login info on reload
  useEffect(() => {
    const storedUser = localStorage.getItem("userData");
    if (storedUser) {
      try {
        setUserData(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse user data:", e);
        localStorage.removeItem("userData");
      }
    }
    setLoading(false); // ⏳ Mark done loading
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login setUserData={setUserData} />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Layout Routes */}
        <Route
          path="/pdf-dashboard"
          element={
            <RoleProtectedRoute userData={userData} allowedRoles={["User", "Super User", "Admin", "Super Admin"]}>
              <Layout userData={userData}>
                <Dashboard userData={userData} />
              </Layout>
            </RoleProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin"]}>
              <Layout userData={userData}>
                <AdminPanel userData={userData} />
              </Layout>
            </RoleProtectedRoute>
          }
        />

        <Route
          path="/site/:siteName"
          element={
            <RoleProtectedRoute userData={userData} allowedRoles={["Super User", "Admin", "Super Admin", "User"]}>
              <Layout userData={userData}>
                <SitePage userData={userData} />
              </Layout>
            </RoleProtectedRoute>
          }
        />

        <Route
          path="/history"
          element={
            <RoleProtectedRoute userData={userData} allowedRoles={["User", "Super User", "Admin", "Super Admin"]}>
              <Layout userData={userData}>
                <PMHistoryPage userData={userData} />
              </Layout>
            </RoleProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <RoleProtectedRoute userData={userData} allowedRoles={["User", "Super User", "Admin", "Super Admin"]}>
              <Layout userData={userData}>
                <Profile userData={userData} />
              </Layout>
            </RoleProtectedRoute>
          }
        />
        <Route path="/excel-data-manager" element={<ExcelDataManager userData={userData} />} />
        <Route path="/excel-live-edit" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["User", "Super User", "Admin", "Super Admin"]}>
              <Layout userData={userData}>
                <ExcelLiveEditPage userData={userData} />
                </Layout>
              </RoleProtectedRoute>
            }
        />
        
        <Route path="/daily-dashboard" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <DailyDashboard userData={userData} />
              </Layout>
        </RoleProtectedRoute>} />

        <Route path="/pm-calendar" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User"]}>
            <Layout userData={userData}>
              <PMCalendarManagement userData={userData} />
              </Layout>
        </RoleProtectedRoute>} />

        <Route path="/incident-dashboard" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <IncidentDashboard userData={userData} />
              </Layout>
        </RoleProtectedRoute>} />

        <Route path="/incident-management" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <IncidentManagement userData={userData} />
              </Layout>
        </RoleProtectedRoute>} />

        <Route path="/dhr-dashboard" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <DHRDashboard userData={userData} />
              </Layout>
        </RoleProtectedRoute>} />

        <Route path="/create-dhr" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <CreateDHR userData={userData} />
              </Layout>
        </RoleProtectedRoute>} />

        <Route path="/compliance-dashboard" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <ComplianceDashboard userData={userData} />
              </Layout>
        </RoleProtectedRoute>} />

        <Route path="/manage-compliance" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User"]}>
            <Layout userData={userData}>
              <ManageCompliance userData={userData} />
              </Layout>
        </RoleProtectedRoute>} />

        <Route path="/assets-register" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User"]}>
            <Layout userData={userData}>
              <AssetsRegister userData={userData} />
              </Layout>
        </RoleProtectedRoute>} />

        <Route path="/assets-dashboard" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <AssetsDashboard userData={userData} />
              </Layout>
        </RoleProtectedRoute>} />
              

        {/* Fallback */}
        <Route path="/" element={<Navigate to="/dhr-dashboard" />} />
        <Route path="*" element={<Navigate to="/dhr-dashboard" />} />
      </Routes>
    </Router>
  );
}

export default App;
