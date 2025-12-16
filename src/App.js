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
import DailyActivityDashboard from "./pages/DailyActivityDashboard";
import DailyActivityManage from "./pages/DailyActivityManage"
import PMRegister from "./pages/PMRegister";
import ThermalImageAnalysis from "./pages/ThermalImageAnalysis";
import ThermalReportGenerator from "./pages/ThermalReportGenerator"
import CreateBigDHR from "./pages/CreateBigDHR";
import AsansolOperationSimulator from "./components/SOP/AsansolOperationSimulator";
import BerhamporeOperationSimulator from "./components/SOP/BerhamporeOperationSimulator";
import SLDEditor from "./pages/SLDEditor"
import DailyDGLog from "./pages/DailyDGLog";
import DGLogForm from "./components/DGLogForm";
import DGLogTable from "./components/DGLogTable";
import FuelRequisition from "./pages/FuelRequisition";
import CCMSCopy from "./pages/CCMSCopy";
import RackTrackerForm from "./pages/RackTrackerForm";
import SiteConfigEditor from "./pages/SiteConfigEditor";
import MonthlyData from "./pages/MonthlyData";
import AutoLogout from "./config/AutoLogout";
import AcDcRackDashboard from "./pages/AcDcRackDashboard";
import ActivityDashboard from "./pages/ActivityDashboard";
import HSDPrintTemplate from "./components/HSDPrintTemplate";
import AllSitesDGLogs from "./pages/AllSitesDGLogs";
import DutyTrackerPage from "./pages/DutyTracker";
import CLApplicationPage from "./pages/CLApplicationPage";
import CLApprovalPage from "./pages/CLApprovalPage";
import BackupDutyPage from "./pages/BackupDutyPage";
import CLCalendar from "./pages/CLCalendar";
import MyLeaveStatus from "./pages/MyLeaveStatus";
import MonthlyCLSummary from "./pages/MonthlyCLSummary";
import MyDutySchedule from "./components/MyDutySchedule";

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
      <AutoLogout timeoutMs={12 * 60 * 60 * 1000} />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login setUserData={setUserData} />} />
        <Route path="/register" element={<Register />} />
        <Route path="/asansol-operation" element={<AsansolOperationSimulator />} />
        <Route path="/berhampore-operation" element={<BerhamporeOperationSimulator />} />

        {/* Protected Layout Routes */}
        <Route
          path="/pdf-dashboard"
          element={
            <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin"]}>
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
            <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin"]}>
              <Layout userData={userData}>
                <SitePage userData={userData} />
              </Layout>
            </RoleProtectedRoute>
          }
        />

        <Route
          path="/history"
          element={
            <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin"]}>
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
        {/* <Route path="/excel-data-manager" element={<ExcelDataManager userData={userData} />} /> */}
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

        <Route path="/incident-edit/:incidentId" element={
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

        <Route path="/daily-activity-dashboard" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <DailyActivityDashboard userData={userData} />
            </Layout>
          </RoleProtectedRoute>} />

        <Route path="/daily-activity-management" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <DailyActivityManage userData={userData} />
            </Layout>
          </RoleProtectedRoute>} />

        <Route path="/pm-register" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User"]}>
            <Layout userData={userData}>
              <PMRegister userData={userData} />
            </Layout>
          </RoleProtectedRoute>} />

        <Route path="/thermal-analysis" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin"]}>
            <Layout userData={userData}>
              <ThermalImageAnalysis userData={userData} />
            </Layout>
          </RoleProtectedRoute>} />

        <Route path="/thermal-analysis-report" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin"]}>
            <Layout userData={userData}>
              <ThermalReportGenerator userData={userData} />
            </Layout>
          </RoleProtectedRoute>} />

        <Route path="/create-big-dhr" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <CreateBigDHR userData={userData} />
            </Layout>
          </RoleProtectedRoute>} />

        <Route path="/asansol-operation" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <AsansolOperationSimulator userData={userData} />
            </Layout>
          </RoleProtectedRoute>} />

        <Route path="/berhampore-operation" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <BerhamporeOperationSimulator userData={userData} />
            </Layout>
          </RoleProtectedRoute>} />

        <Route path="/sld-editor" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <SLDEditor userData={userData} />
            </Layout>
          </RoleProtectedRoute>} />

        <Route path="/daily-dg-log-editor" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <DailyDGLog userData={userData} />
            </Layout>
          </RoleProtectedRoute>} />

        <Route path="/dg-log-entry" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <DGLogForm userData={userData} />
            </Layout>
          </RoleProtectedRoute>} />

        <Route path="/dg-log-table" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <DGLogTable userData={userData} />
            </Layout>
          </RoleProtectedRoute>} />

        <Route path="/fuel-requisition" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <FuelRequisition userData={userData} />
            </Layout>
          </RoleProtectedRoute>} />

        {/* 👇 Add the new route here */}
        <Route path="/ccms-copy" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <CCMSCopy />
            </Layout>
          </RoleProtectedRoute>} />

        <Route path="/hsd-copy" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <HSDPrintTemplate />
            </Layout>
          </RoleProtectedRoute>} />

        <Route path="/acdc-rack-details" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <AcDcRackDashboard userData={userData} />
            </Layout>
          </RoleProtectedRoute>} />

        <Route path="/rack-details-form" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <RackTrackerForm userData={userData} />
            </Layout>
          </RoleProtectedRoute>} />

        <Route path="/site-config" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <SiteConfigEditor userData={userData} />
            </Layout>
          </RoleProtectedRoute>} />

        <Route path="/monthly-data" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <MonthlyData userData={userData} />
            </Layout>
          </RoleProtectedRoute>} />

        <Route path="/activity-dashboard" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <ActivityDashboard userData={userData} />
            </Layout>
          </RoleProtectedRoute>} />

          <Route path="/all-sites-dg-logs" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin"]}>
            <Layout userData={userData}>
              <AllSitesDGLogs userData={userData} />
            </Layout>
          </RoleProtectedRoute>} />

          <Route path="/duty-tracker" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "User", "Super User"]}>
            <Layout userData={userData}>
              <DutyTrackerPage currentUser={userData} />
            </Layout>
          </RoleProtectedRoute>} />

          <Route path="/cl-application" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "User", "Super User"]}>
            <Layout userData={userData}>
              <CLApplicationPage currentUser={userData} />
            </Layout>
          </RoleProtectedRoute>} />

          <Route path="/cl-approve" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User"]}>
            <Layout userData={userData}>
              <CLApprovalPage currentUser={userData} />
            </Layout>
          </RoleProtectedRoute>} />

          <Route path="/backup-approvals" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <BackupDutyPage currentUser={userData} />
            </Layout>
          </RoleProtectedRoute>} />

          <Route path="/cl-calendar" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <CLCalendar currentUser={userData} />
            </Layout>
          </RoleProtectedRoute>} />

          <Route path="/my-leave" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <MyLeaveStatus currentUser={userData} />
            </Layout>
          </RoleProtectedRoute>} />

          <Route path="/monthly-cl-summary" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <MonthlyCLSummary currentUser={userData} />
            </Layout>
          </RoleProtectedRoute>} />

          <Route path="/my-duty" element={
          <RoleProtectedRoute userData={userData} allowedRoles={["Admin", "Super Admin", "Super User", "User"]}>
            <Layout userData={userData}>
              <MyDutySchedule currentUser={userData} />
            </Layout>
          </RoleProtectedRoute>} />

        {/* Fallback */}
        <Route path="/" element={<Navigate to="/daily-dg-log-editor" />} />
        <Route path="*" element={<Navigate to="/daily-dg-log-editor" />} />

        {/* {DashboardWrapper()} */}
      </Routes>
    </Router>
  );
}

export default App;
