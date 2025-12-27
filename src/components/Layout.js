// src/components/Layout.js
import React, { useState, useEffect, use } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import "../assets/Layout.css";
import Vertiv from "../assets/Vertiv1.png";
import { FaArrowLeft } from "react-icons/fa"; // Using react-icons for the arrow
import NotificationBell from "./NotificationBell";
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
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

const formatDay = (ym) => {
  return ym.split("-")[2]; // just the YYYY part
};

const formatMonthName = (ym) => {
  const [year, month, day] = ym.split("-");
  const date = new Date(year, month - 1); // month is 0-based
  return date.toLocaleString("default", { month: "short" }); // , year: "numeric" 
};

const formatYear = (ym) => {
  return ym.split("-")[0]; // just the YYYY part
};

const Layout = ({ userData, children }) => {
  const [collapsed, setCollapsed] = useState(true);
  const navigate = useNavigate();
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth > 512);
  const [todayDuty, setTodayDuty] = useState(null);
  const [nextDuty, setNextDuty] = useState(null);
  const [dutySummary, setDutySummary] = useState({
    M: 0, E: 0, N: 0, G: 0, WO: 0
  });

  // Today Manpower State
  const [todayManpower, setTodayManpower] = useState(null);
  const [shiftUsers, setShiftUsers] = useState({});
  const [activeShift, setActiveShift] = useState(null);
  // Mobile Detection
  const isMobile = window.innerWidth <= 568;
  const [showDrawer, setShowDrawer] = useState(false);
  const [drawerShift, setDrawerShift] = useState(null);

  const [powerSource, setPowerSource] = useState("EB");
  const [updatedByName, setUpdatedByName] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loadingPower, setLoadingPower] = useState(true);

  // Screen Resize Listener
  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth > 512);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch Today's Duty for User
  useEffect(() => {
    if (!userData?.uid || !userData?.site) return;

    getTodayDutyForUser(userData.site, userData.uid).then((res) => {
      setTodayDuty(res);  // { shift: "M", date: "2025-11-30" }
    });

  }, [userData]);

  // Fetch Duty Summary and Today's & Next Duty
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

  // Fetch Today's Manpower
  useEffect(() => {
    if (
      !userData?.site ||
      userData?.designation !== "Vertiv Site Infra Engineer"
    ) {
      setTodayManpower(null);
      setShiftUsers({});
      return;
    }

    const fetchTodayManpower = async () => {
      const todayISO = format(new Date(), "yyyy-MM-dd");
      const docRef = doc(db, "dutyRoster", `${userData.site}_${todayISO}`);
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        setTodayManpower({ G: 0, M: 0, E: 0, N: 0, WO: 0 });
        setShiftUsers({});
        return;
      }

      const shifts = snap.data().shifts || {};

      // 🔹 Collect all unique UIDs
      const allUids = [...new Set(
        ["G", "M", "E", "N", "WO"].flatMap(s => shifts[s] || [])
      )];

      // 🔹 Fetch user details
      const userMap = {};
      await Promise.all(
        allUids.map(async (uid) => {
          const uSnap = await getDoc(doc(db, "users", uid));
          if (uSnap.exists()) {
            userMap[uid] = uSnap.data().name;
          }
        })
      );

      // 🔹 Map shift → user names
      const shiftUserMap = {};
      ["G", "M", "E", "N", "WO"].forEach((s) => {
        shiftUserMap[s] = (shifts[s] || []).map(
          uid => userMap[uid] || uid.slice(0, 6)
        );
      });

      setTodayManpower({
        G: shiftUserMap.G.length,
        M: shiftUserMap.M.length,
        E: shiftUserMap.E.length,
        N: shiftUserMap.N.length,
        WO: shiftUserMap.WO.length,
      });

      setShiftUsers(shiftUserMap);
    };

    fetchTodayManpower();
  }, [userData]);

  // Reset activeShift on mobile
  useEffect(() => {
    if (isMobile) setActiveShift(null);
  }, [isMobile]);

  // Power Source Listener
  useEffect(() => {
    if (!userData?.site) return;

    const powerRef = doc(db, "sitePowerStatus", userData.site);

    const unsub = onSnapshot(powerRef, (snap) => {
      if (snap.exists()) {
        setPowerSource(snap.data().powerSource);
        setUpdatedByName(snap.data().updatedByName || "");
        setUpdatedAt(snap.data().updatedAt ? snap.data().updatedAt.toDate() : null);
      } else {
        // default EB if doc not exists
        setPowerSource("EB");
      }
      setLoadingPower(false);
    });

    return () => unsub();
  }, [userData?.site]);

  // Update Power Source
  const updatePowerSource = async () => {
    // if (userData?.designation !== "Vertiv Site Infra Engineer", ) return;
    const newSource = powerSource === "EB" ? "DG" : "EB";

    const powerRef = doc(db, "sitePowerStatus", userData.site);

    await setDoc(
      powerRef,
      {
        powerSource: newSource,
        updatedBy: userData.uid,
        updatedByName: userData.name || "",
        updatedByEmpId: userData.empId || "",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };


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
                {isLargeScreen ? (
                  <h1 className="title" title="Prepared By @Sumen Adhikari" >
                    WB Airtel MSC Data Base Management System
                  </h1>
                ) : userData?.photoURL ? (
                  <img
                    src={userData.photoURL}
                    alt="Profile"
                    className="profile-avatar"
                    style={{ width: "50px", height: "50px", borderRadius: "50%", border: "2px solid black" }}
                  />
                ) : userData?.name ? (
                  <div
                    className="profile-avatar"
                    style={{
                      width: "50px",
                      height: "50px",
                      borderRadius: "50%",
                      border: "2px solid black",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#ccc",
                      fontWeight: "bold",
                      fontSize: "20px",
                      color: "#333",
                    }}
                    title={userData.name}
                  >
                    {userData.name.charAt(0).toUpperCase()}
                  </div>
                ) : null}
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
                  onClick={() => navigate("/")}
                />
              </div>

              <p className="dashboard-subinfo">
                <strong>🏢{userData?.site || "All"}</strong>|&nbsp;<strong>🆔{userData.siteId || "All"}</strong>|&nbsp;<strong style={{ color: "whitesmoke", background: `${userData?.isActive ? "#3f8a2985" : "#8a0f0f85"}`, height: "fit-content", borderRadius: "6px", borderBottom: "1px solid" }}>{userData?.isActive ? "Active" : "Inactive"}</strong>
                <p style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
                  <div>
                    {/* Today's Duty Info */}
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
                        ⏱ Today: <strong>{todayDuty.shift === "M" ? "Morning" : todayDuty.shift === "E" ? "Evening" : todayDuty.shift === "N" ? "Night" : todayDuty.shift === "G" ? "General" : "W/O"}</strong>
                        || {nextDuty && (
                          <div style={{ fontSize: "10px", marginTop: "5px", textAlign: "center" }}>
                            Next: <strong>"{nextDuty.shift}"</strong> → <b style={{ color: "#354383ff", fontSize: "6px" }}>{`${formatDay(nextDuty.date)}-${formatMonthName(nextDuty.date)}-${formatYear(nextDuty.date)}`}</b> {/* nextDuty.date {nextDuty.date} → */}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: "4px 10px",
                          backgroundColor: "#e2e8f0",
                          borderRadius: "6px",
                          cursor: "pointer"
                        }}
                        onClick={() => navigate("/my-duty")}
                      >
                        No Duty Today
                      </div>
                    )}
                    {/* Today's Manpower Info */}
                    {userData?.designation === "Vertiv Site Infra Engineer" && todayManpower && (
                      <div style={{ position: "relative" }}>
                        <div
                          style={{
                            display: "flex",
                            gap: "4px",
                            padding: "6px 12px",
                            background: "#0f172a",
                            color: "#fff",
                            borderRadius: "8px",
                            fontSize: "13px",
                            cursor: "pointer",
                          }}
                        >
                          <strong>👥 Today</strong>

                          {["G", "M", "E", "N", "WO"].map((s) => (
                            <span
                              key={s}
                              onClick={() => {
                                if (isMobile) {
                                  setDrawerShift(drawerShift === s ? null : s);
                                  setShowDrawer(true);
                                } else {
                                  setActiveShift(activeShift === s ? null : s);
                                }
                              }}

                              style={{
                                padding: "2px 6px",
                                borderRadius: "4px",
                                cursor: "pointer",
                                background: activeShift === s ? "#0284c7" : "transparent",
                                color: s === "G" ? "#34d399" : s === "M" ? "#facc15" : s === "E" ? "#fb923c" : s === "N" ? "#60a5fa" : "#9ca3af",
                                fontWeight: activeShift === s ? "600" : "400",
                              }}
                            >
                              {s}: {todayManpower[s]}
                            </span>
                          ))}
                        </div>

                        {/* 🔽 Shift User List */}
                        {activeShift && !isMobile && (
                          <div
                            style={{
                              position: "absolute",
                              top: "110%",
                              left: 0,
                              background: "#ffffff",
                              color: "#000",
                              borderRadius: "8px",
                              boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
                              padding: "10px",
                              minWidth: "220px",
                              zIndex: 9999,
                            }}
                          >
                            <strong>
                              {activeShift === "G"
                                ? "General Shift"
                                : activeShift === "M"
                                  ? "Morning Shift"
                                  : activeShift === "E"
                                    ? "Evening Shift"
                                    : activeShift === "N"
                                      ? "Night Shift"
                                      : "Weekly Off"}
                            </strong>

                            <ul style={{ marginTop: "6px", paddingLeft: "16px", maxHeight: "150px", overflowY: "auto", background: "#f1f5f9", borderRadius: "6px" }}>
                              {shiftUsers[activeShift]?.length ? (
                                shiftUsers[activeShift].map((name, i) => (
                                  <li key={i} style={{ color: "#2ac43eff" }}>{name}</li>
                                ))
                              ) : (
                                <li style={{ color: "#64748b" }}>No manpower</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                  </div>


                  <NotificationBell user={userData} />
                  <button
                    onClick={() => navigate(-1)}
                    className="back-button"
                  >
                    <FaArrowLeft />
                  </button>
                </p>
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
          {/* ⚡ Power Source Toggle */}
          <div
            title="Click to toggle power source state"
            style={{
              display: "flex",
              alignItems: "center",
              background: "#0f172aff",
              borderRadius: "10px",
              fontSize: "13px",
              position: "fixed",
              width: "100%",
              zIndex: 1000,
            }}
          >
            <span style={{ opacity: powerSource === "EB" ? 1 : 0.5, backgroundColor: "transparent", color: powerSource === "EB" ? "#ffffffff" : "#ffffffaa" }}>
              <strong>⚡EB</strong>
            </span>

            <div
              onClick={updatePowerSource}
              style={{
                width: "42px",
                height: "22px",
                background: powerSource === "DG" ? "#dc2626" : "#16a34a",
                borderRadius: "12px",
                position: "relative",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
            >
              <div
                style={{
                  width: "18px",
                  height: "18px",
                  background: "#fff",
                  borderRadius: "50%",
                  position: "absolute",
                  top: "2px",
                  left: powerSource === "DG" ? "22px" : "2px",
                  transition: "left 0.2s",
                }}
              />
            </div>

            <span style={{ opacity: powerSource === "DG" ? 1 : 0.5, backgroundColor: "transparent", color: powerSource === "DG" ? "#ffffffff" : "#ffffffaa" }}>
              <strong>⛽DG</strong>
            </span>
            <small style={{ fontSize: "9px", color: "#94a3b8", marginLeft: "8px" }}>
              <b>({loadingPower ? "Loading..." : `Last Updated by: ${updatedByName} Site on "${powerSource}" at ${updatedAt ? updatedAt.toLocaleString() : "N/A"}`})</b>
            </small>
          </div>
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
          {/* 📱 Mobile Slide-Up Drawer */}
          {drawerShift && showDrawer && isMobile && (
            <>
              {/* Overlay */}
              <div
                onClick={() => setShowDrawer(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.45)",
                  zIndex: 9998,
                }}
              />

              {/* Drawer */}
              <div
                style={{
                  position: "fixed",
                  bottom: 0,
                  left: 0,
                  width: "100%",
                  background: "#ffffff",
                  borderTopLeftRadius: "16px",
                  borderTopRightRadius: "16px",
                  padding: "16px",
                  zIndex: 9999,
                  animation: "slideUp 0.3s ease-out",
                }}
              >
                {/* Handle */}
                <div
                  style={{
                    width: "40px",
                    height: "4px",
                    background: "#cbd5f5",
                    borderRadius: "2px",
                    margin: "0 auto 10px",
                  }}
                />

                <h3 style={{ textAlign: "center", marginBottom: "10px" }}>
                  {drawerShift === "G"
                    ? "General Shift"
                    : drawerShift === "M"
                      ? "Morning Shift"
                      : drawerShift === "E"
                        ? "Evening Shift"
                        : drawerShift === "N"
                          ? "Night Shift"
                          : "Weekly Off"}
                </h3>

                <ul style={{ listStyle: "none", padding: 0 }}>
                  {shiftUsers[drawerShift]?.length ? (
                    shiftUsers[drawerShift].map((name, i) => (
                      <li
                        key={i}
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #e5e7eb",
                          fontSize: "15px",
                        }}
                      >
                        👷 {name}
                      </li>
                    ))
                  ) : (
                    <li style={{ padding: "12px", color: "#64748b" }}>
                      No manpower assigned
                    </li>
                  )}
                </ul>

                <button
                  onClick={() => {
                    setShowDrawer(false);
                    setDrawerShift(null);
                  }}
                  style={{
                    marginTop: "12px",
                    width: "100%",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#0f172a",
                    color: "#fff",
                    fontSize: "15px",
                  }}
                >
                  Close
                </button>
              </div>
            </>
          )}
          <h4>© 2025 Crash Algo. All rights reserved.</h4>
        </div>
      </div>
    </div>
  );
};

export default Layout;