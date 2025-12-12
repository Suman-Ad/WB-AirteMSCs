// src/components/Layout.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import "../assets/Layout.css";
import Vertiv from "../assets/Vertiv1.png";
import { FaArrowLeft } from "react-icons/fa"; // Using react-icons for the arrow
import NotificationBell from "./NotificationBell";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { db } from "../firebase";

// Fetch today's shift
export async function getTodayDuty(siteId, uid) {
  const todayISO = format(new Date(), "yyyy-MM-dd");
  const ref = doc(db, "dutyRoster", `${siteId}_${todayISO}`);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const shifts = snap.data().shifts || {};
  const shift = Object.keys(shifts).find((s) => shifts[s]?.includes(uid));

  return shift ? { shift, date: todayISO } : null;
}

// Fetch next assigned duty after today
export async function getNextDuty(siteId, uid) {
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  let found = null;

  for (let d of days) {
    const iso = format(d, "yyyy-MM-dd");
    if (iso <= format(new Date(), "yyyy-MM-dd")) continue;

    const snap = await getDoc(doc(db, "dutyRoster", `${siteId}_${iso}`));
    if (!snap.exists()) continue;

    const data = snap.data().shifts;
    const shift = Object.keys(data).find((s) => data[s]?.includes(uid));
    if (shift) {
      found = { date: iso, shift };
      break;
    }
  }

  return found;
}

async function getTodayDutyForUser(siteId, uid) {
  const todayISO = format(new Date(), "yyyy-MM-dd");
  const docRef = doc(db, "dutyRoster", `${siteId}_${todayISO}`);
  const snap = await getDoc(docRef);

  if (!snap.exists()) return null;

  const data = snap.data();

  const shift = Object.keys(data.shifts || {}).find(s =>
    (data.shifts[s] || []).includes(uid)
  );

  return shift ? { shift, date: todayISO } : null;
}

export function shiftColor(shift) {
  switch (shift) {
    case "M": return "#facc15"; // yellow
    case "E": return "#fb923c"; // orange
    case "N": return "#60a5fa"; // blue
    case "G": return "#34d399"; // green
    case "WO": return "#9ca3af"; // gray
    default: return "#e2e8f0";
  }
}


const Layout = ({ userData, children }) => {
  const [collapsed, setCollapsed] = useState(true);
  const navigate = useNavigate();
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth > 512);
  const [todayDuty, setTodayDuty] = useState(null);
  const [nextDuty, setNextDuty] = useState(null);
  const [dutySummary, setDutySummary] = useState({
    M: 0, E: 0, N: 0
  });

  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth > 512);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!userData?.uid || !userData?.site) return;

    getTodayDutyForUser(userData.site, userData.uid).then((res) => {
      setTodayDuty(res);  // { shift: "M", date: "2025-11-30" }
    });

  }, [userData]);

  useEffect(() => {
    if (!userData.site || !userData?.uid) return;

    async function loadData() {
      const today = await getTodayDuty(userData.site, userData.uid);
      const next = await getNextDuty(userData.site, userData.uid);
      setTodayDuty(today);
      setNextDuty(next);
    }

    if (!userData?.site) return;
    async function load() {
      const start = startOfMonth(new Date());
      const end = endOfMonth(new Date());
      const days = eachDayOfInterval({ start, end });
      const currentUser = userData;

      let M = 0, E = 0, N = 0, G = 0, WO = 0;

      for (let day of days) {
        const iso = format(day, "yyyy-MM-dd");
        const snap = await getDoc(doc(db, "dutyRoster", `${currentUser.site}_${iso}`));
        if (!snap.exists()) continue;

        const data = snap.data().shifts;
        if (data.M?.includes(currentUser.uid)) M++;
        if (data.E?.includes(currentUser.uid)) E++;
        if (data.N?.includes(currentUser.uid)) N++;
        if (data.G?.includes(currentUser.uid)) G++;
        if (data.WO?.includes(currentUser.uid)) WO++;
      }

      setDutySummary({ M, E, N, G, WO });
    }

    load();

    loadData();

    const interval = setInterval(loadData, 60000); // refresh every minute
    return () => clearInterval(interval);

  }, [userData]);


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
                <p style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
                  {todayDuty ? (
                    <div
                      style={{
                        // padding: "4px 10px",
                        backgroundColor: shiftColor(todayDuty.shift),
                        color: "white",
                        borderRadius: "6px",
                        cursor: "pointer",
                        display: "flex",
                        gap: "6px",
                      }}
                      onClick={() => navigate("/my-duty")}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#0285c7ff"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = shiftColor(todayDuty.shift)}
                    >
                      ⏱ Today Shift: <strong>{todayDuty.shift === "M" ? "Morning" : todayDuty.shift === "E" ? "Evening" : todayDuty.shift === "N" ? "Night" : todayDuty.shift === "G" ? "General" : "W/O"}</strong>
                      || {nextDuty && (
                        <div style={{ fontSize: "12px", marginTop: "2px" }}>
                          Next: {nextDuty.date} → <strong>"{nextDuty.shift}"</strong>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: "4px 10px",
                        backgroundColor: "#e2e8f0",
                        borderRadius: "6px",
                        cursor:"pointer"
                      }}
                      onClick={() => navigate("/my-duty")}
                    >
                      No Duty Today
                    </div>
                  )}

                  <NotificationBell user={userData} />
                  <button
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
          {/* <div className="border p-3 rounded mt-4">
            <h3 className="font-semibold mb-2">Duty Summary (This Month)</h3>

            <p>🌅 Morning: <strong>{dutySummary.M}</strong></p>
            <p>🌇 Evening: <strong>{dutySummary.E}</strong></p>
            <p>🌙 Night: <strong>{dutySummary.N}</strong></p>
          </div> */}

          {/* {todayDuty && (
            <div
              style={{
                position: "fixed",
                top: "100px",
                right: "20px",
                background: shiftColor(todayDuty.shift),
                color: "black",
                padding: "10px 14px",
                borderRadius: "10px",
                boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
                zIndex: 999,
                cursor: "pointer"
              }}
              onClick={() => navigate("/my-duty")}
            >
              <div style={{ fontSize: "14px", fontWeight: "600" }}>
                Today: {todayDuty.shift} Shift
              </div>

              {nextDuty && (
                <div style={{ fontSize: "12px", marginTop: "2px" }}>
                  Next: {nextDuty.date} → {nextDuty.shift} Shift
                </div>
              )}
            </div>
          )} */}

          {children}
        </div>
        <div style={{ background: "#55b3ab" }}>
          {/* {todayDuty && (
            <div
              className="mobile-duty-bar"
              onClick={() => navigate("/my-duty")}
              style={{
                position: "fixed",
                bottom: 0,
                left: 0,
                width: "100%",
                background: shiftColor(todayDuty.shift),
                padding: "12px 16px",
                textAlign: "center",
                fontWeight: 600,
                fontSize: "16px",
                boxShadow: "0 -4px 8px rgba(0,0,0,0.15)",
                zIndex: 999
              }}
            >
              Today: {todayDuty.shift} Shift
              {nextDuty && (
                <span style={{ fontSize: "13px", fontWeight: 400 }}>
                  • Next: {nextDuty.date}
                </span>
              )}
            </div>
          )} */}

          <h4>© 2025 Crash Algo. All rights reserved.</h4>
        </div>
      </div>
    </div>
  );
};

export default Layout;