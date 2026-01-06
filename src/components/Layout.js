// src/components/Layout.js
import React, { useState, useEffect, use } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import "../assets/Layout.css";
import Vertiv from "../assets/Vertiv1.png";
import { FaArrowLeft } from "react-icons/fa"; // Using react-icons for the arrow
import NotificationBell from "./NotificationBell";
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, serverTimestamp, setDoc, addDoc } from "firebase/firestore";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { db } from "../firebase";
import { useRef } from "react";
import Modal from "./Modal";
import AsansolOperationSimulator from "./SOP/AsansolOperationSimulator";


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
  // Mobile Detection for Shift details
  const isMobile = window.innerWidth <= 568;
  const [showDrawer, setShowDrawer] = useState(false);
  const [drawerShift, setDrawerShift] = useState(null);
  // Power Source Change
  const [powerSource, setPowerSource] = useState("EB");
  const [updatedByName, setUpdatedByName] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loadingPower, setLoadingPower] = useState(true);
  const [dgSeconds, setDgSeconds] = useState(0);
  // Timer Count
  const formatDuration = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}h ${m}m ${s}s`;
  };

  // Change Toggle
  const [canTogglePower, setCanTogglePower] = useState(false);
  const powerLockRef = useRef(false);

  // For Show Simulator
  const [showSimulator, setShowSimulator] = useState(false);
  const [simMinimized, setSimMinimized] = useState(false);
  const prevPowerSourceRef = useRef(null);

  const [unaddCount, setUnaddCount] = useState(0);
  const [dgRunCountMap, setDgRunCountMap] = useState({});


  // Fetch Site Config
  const [siteConfig, setSiteConfig] = useState({});
  const siteKey = userData?.site?.toUpperCase();
  const [selectedDG, setSelectedDG] = useState(null);

  const callUser = (mobile) => {
    if (!mobile || mobile === "N/A") return;
    window.location.href = `tel:${mobile}`;
  };


  const fetchConfig = async () => {
    if (!siteKey) return;
    const snap = await getDoc(doc(db, "siteConfigs", siteKey));
    if (snap.exists()) {
      setSiteConfig(snap.data());
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [siteKey])

  useEffect(() => {
    if (!powerSource) return;

    if (
      prevPowerSourceRef.current &&
      prevPowerSourceRef.current !== powerSource
    ) {
      setShowSimulator(true);
      setSimMinimized(false); // open full on change
    }

    prevPowerSourceRef.current = powerSource;
  }, [powerSource]);

  // useEffect(() => {
  //   if (showSimulator && !simMinimized) {
  //     document.body.style.overflow = "hidden";
  //   } else {
  //     document.body.style.overflow = "";
  //   }

  //   return () => {
  //     document.body.style.overflow = "";
  //   };
  // }, [showSimulator, simMinimized]);

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

      // 🔹 Fetch user details (name + mobile)
      const userMap = {};
      await Promise.all(
        allUids.map(async (uid) => {
          const uSnap = await getDoc(doc(db, "users", uid));
          if (uSnap.exists()) {
            const u = uSnap.data();
            userMap[uid] = {
              name: u.name || "Unknown",
              mobile: u.mobileNo || u.phone || "N/A", // support old fields
            };
          }
        })
      );

      // 🔹 Map shift → user objects
      const shiftUserMap = {};
      ["G", "M", "E", "N", "WO"].forEach((s) => {
        shiftUserMap[s] = (shifts[s] || []).map((uid) => ({
          uid,
          name: userMap[uid]?.name || uid.slice(0, 6),
          mobile: userMap[uid]?.mobile || "N/A",
        }));
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
      if (!snap.exists()) return;

      const data = snap.data();
      setPowerSource(data.powerSource);
      setUpdatedByName(data.updatedByName || "");
      setUpdatedAt(data.updatedAt ? data.updatedAt.toDate() : null);

      if (data.powerSource === "DG" && data.dgStartTime) {
        const start = data.dgStartTime.toDate();

        const tick = () => {
          const now = new Date();
          const liveSeconds = Math.floor((now - start) / 1000);
          setDgSeconds(liveSeconds);
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);

      } else {
        // default EB if doc not exists
        setPowerSource("EB");
        setDgSeconds(data.dgTotalSeconds || 0);
      }
      setLoadingPower(false);
    });

    return () => unsub();
  }, [userData?.site]);

  const canChangePowerSource = async () => {
    // Admin override
    if (["Admin", "Super Admin", "Super User", "User"].includes(userData?.role)) {
      return true;
    }

    if (!userData?.site || !userData?.uid) return false;

    const todayISO = format(new Date(), "yyyy-MM-dd");
    const ref = doc(db, "dutyRoster", `${userData.site}_${todayISO}`);
    const snap = await getDoc(ref);

    if (!snap.exists()) return false;

    const shifts = snap.data().shifts || {};

    // find current shift
    const currentShift = Object.keys(shifts).find(s =>
      (shifts[s] || []).includes(userData.uid)
    );

    if (!currentShift) return false;

    // ✅ In-charge rule (FIRST UID)
    const inChargeUid = shifts[currentShift]?.[0];

    return inChargeUid === userData.uid;
  };

  useEffect(() => {
    if (!userData?.uid || !userData?.site) return;

    const checkPermission = async () => {
      const allowed = await canChangePowerSource();
      setCanTogglePower(allowed);
    };

    checkPermission();

    // re-check every minute (shift may change)
    const interval = setInterval(checkPermission, 60000);
    return () => clearInterval(interval);

  }, [userData?.uid, userData?.site]);

  // Update Power Source
  const updatePowerSource = async () => {
    if (powerLockRef.current) return;

    if (!canTogglePower) {
      alert("Only shift in-charge can change power source");
      return;
    }

    const nextSource = powerSource === "EB" ? "DG" : "EB";
    const confirmMsg =
      nextSource === "DG"
        ? `⚠️ Confirm Power Change\n\nEB → DG\n\n• ${selectedDG} will start running\n• DG log entry will be created\n\nDo you want to continue?`
        : `⚠️ Confirm Power Change\n\nDG → EB\n\n• ${selectedDG} will be stopped\n• DG run time will be logged\n\nDo you want to continue?`;

    const confirmed = window.confirm(confirmMsg);
    if (!confirmed) return; // ❌ stop toggle

    powerLockRef.current = true;
    try {
      const now = new Date();
      const powerRef = doc(db, "sitePowerStatus", userData.site);
      const snap = await getDoc(powerRef);

      const prev = snap.exists() ? snap.data() : {};
      const newSource = powerSource === "EB" ? "DG" : "EB";

      let updateData = {
        powerSource: newSource,
        dgNumber: selectedDG,
        updatedBy: userData.uid,
        updatedByName: userData.name || "",
        updatedByEmpId: userData.empId || "",
        updatedAt: serverTimestamp(),
      };

      // ▶️ DG START
      if (newSource === "DG") {
        updateData.dgStartTime = now;
        updateData.currentDgRunSeconds = 0; // 🔥 reset
      }

      // ⏹ DG STOP → log per run
      if (newSource === "EB" && prev.dgStartTime) {
        const start = prev.dgStartTime.toDate();
        const end = new Date();

        const runSeconds = Math.floor((end - start) / 1000);
        const runMinutes = Math.ceil(runSeconds / 60);
        // format HH:mm for form inputs
        const formatTime = (d) =>
          d.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });

        updateData.dgStartTime = null;

        // optional cumulative (keep if you want monthly reports)
        updateData.dgTotalSeconds =
          (prev.dgTotalSeconds || 0) + runSeconds;

        // 🔥 SAVE DG RUN LOG ENTRY
        const historyRef = await addDoc(
          collection(db, "dgRunLogs", userData.site, "entries"),
          {
            site: userData.site,
            siteId: userData.siteId || "",
            dgNumber: selectedDG, // or dynamic later
            startTime: formatTime(start),
            endTime: formatTime(end),
            runSeconds,
            runMinutes,
            startedBy: userData.name || "",
            empId: userData.empId || "",
            designation: userData.designation || "",
            date: format(new Date(), "yyyy-MM-dd"),
            createdAt: serverTimestamp(),
            dgLogAdded: false,
          }
        );
        // 🔥 NAVIGATE to DG Log Form with auto times
        navigate("/dg-log-entry", {
          state: {
            autoFromDgStop: true,
            runId: historyRef.id,
            dgNumber: selectedDG, // later make dynamic
            startTime: formatTime(start),
            stopTime: formatTime(end),
            date: format(new Date(), "yyyy-MM-dd"),
          },
        });
        // optional: keep cumulative seconds
        updateData.dgStartTime = null;
        updateData.dgTotalSeconds =
          (prev.dgTotalSeconds || 0) +
          Math.floor((end - start) / 1000);

      }

      await setDoc(powerRef, updateData, { merge: true });

      // Notify All Site User
      const allUserQuery = query(
        collection(db, "users"),
        where("role", "in", ["Super User", "User"]),
        where("site", "==", userData?.site)
      );

      const allUserSnap = await getDocs(allUserQuery);
      const todayISO = new Date().toISOString().split("T")[0];
      const message = newSource === "DG" ?
        `${userData.site} MSC Power fail from ${now.toLocaleString()}, Site On ${newSource} (${selectedDG}) Source. 
    Reported By:\nName: ${userData?.name}.
    Emp ID: ${userData?.empId}
    Designation: ${userData?.designation}`
        :
        `${userData.site} MSC Power Restored At ${now.toLocaleString()}, Site On ${newSource} Source. 
    Reported By:\nName: ${userData?.name}.
    Emp ID: ${userData?.empId}
    Designation: ${userData?.designation}`

      for (const allUserDoc of allUserSnap.docs) {
        await addDoc(
          collection(db, "notifications", allUserDoc.id, "items"),
          {
            title: `${userData?.site} MSC Site Status`,
            message,
            date: todayISO,
            createdAt: serverTimestamp(),
            siteStatus: newSource,
            site: userData?.site,
            siteId: userData?.siteId,
            actionType: "change_power_source",
            requesterId: userData?.uid,
            roleRequested: userData?.role,
            designation: userData?.designation,

            read: false
          }
        );
      }
      // Notify All Admin
      const adminQuery = query(
        collection(db, "users"),
        where("role", "in", ["Admin", "Super Admin"]),
        // where("site", "==", userData?.site)
      );

      const adminSnap = await getDocs(adminQuery);
      for (const adminDoc of adminSnap.docs) {
        await addDoc(
          collection(db, "notifications", adminDoc.id, "items"),
          {
            title: `${userData?.site} MSC Site Status`,
            message,
            date: todayISO,
            createdAt: serverTimestamp(),
            siteStatus: newSource,
            site: userData?.site,
            siteId: userData?.siteId,
            actionType: "change_power_source",
            requesterId: userData?.uid,
            roleRequested: userData?.role,
            designation: userData?.designation,

            read: false
          }
        );
      }
    } finally {
      powerLockRef.current = false;
    }
  };

  const saveSelectedDG = async (dg) => {
    try {
      await setDoc(
        doc(db, "sitePowerStatus", userData.site),
        {
          selectedDG: dg,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Notify All Site User
      const allUserQuery = query(
        collection(db, "users"),
        where("role", "in", ["Super User", "User", "Admin", "Super Admin"]),
        where("site", "==", userData?.site)
      );

      const allUserSnap = await getDocs(allUserQuery);
      const todayISO = new Date().toISOString().split("T")[0];
      const message = dg &&
        `${userData.site} MSC Selected On (${dg}) for Backup Source. 
    Reported By:\nName: ${userData?.name}.
    Emp ID: ${userData?.empId}
    Designation: ${userData?.designation}`

      for (const allUserDoc of allUserSnap.docs) {
        await addDoc(
          collection(db, "notifications", allUserDoc.id, "items"),
          {
            title: `${userData?.site} MSC "DG" Selection Changed:`,
            message,
            date: todayISO,
            createdAt: serverTimestamp(),
            selectedDG: dg,
            site: userData?.site,
            siteId: userData?.siteId,
            actionType: "change_dg_select",
            requesterId: userData?.uid,
            roleRequested: userData?.role,
            designation: userData?.designation,

            read: false
          }
        );
      }

    } catch (err) {
      console.error("Failed to save selected DG", err);
    }
  };

  const confirmAndSelectDG = async (dg) => {
    // If already selected, do nothing
    if (selectedDG === dg) return;

    // Block DG change if DG is already running
    if (powerSource === "DG") {
      alert("❌ Cannot change DG while DG is running.\n\nPlease switch to EB first.");
      return;
    }

    const confirmed = window.confirm(
      `⚠️ Confirm DG Selection\n\nYou are about to select ${dg} as the backup DG.\n\nDo you want to continue?`
    );

    if (!confirmed) return;

    setSelectedDG(dg);
    await saveSelectedDG(dg);
  };

  useEffect(() => {
    if (!userData?.site) return;

    const unsub = onSnapshot(
      doc(db, "sitePowerStatus", userData.site),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();

          if (data.selectedDG) {
            setSelectedDG(data.selectedDG);
          }
        }
      }
    );

    return () => unsub();
  }, [userData.site]);

  useEffect(() => {
    if (!siteConfig?.dgCount || !selectedDG) return;

    const maxDG = siteConfig.dgCount;
    const dgIndex = Number(selectedDG.split("-")[1]);

    if (dgIndex > maxDG) {
      setSelectedDG(selectedDG);
      saveSelectedDG(selectedDG);
    }
  }, [siteConfig, selectedDG]);

  useEffect(() => {
    if (!userData?.site) return;

    const q = query(
      collection(db, "dgRunLogs", userData.site, "entries"),
      where("dgLogAdded", "==", false)
    );

    const unsub = onSnapshot(q, (snap) => {
      setUnaddCount(snap.size); // 🔥 count of pending DG logs
    });

    return () => unsub();
  }, [userData?.site]);

  useEffect(() => {
    if (!userData?.site) return;

    const today = format(new Date(), "yyyy-MM-dd");

    const q = query(
      collection(db, "dgRunLogs", userData.site, "entries"),
      where("date", "==", today)
    );

    const unsub = onSnapshot(q, (snap) => {
      const countMap = {};

      snap.docs.forEach((doc) => {
        const { dgNumber } = doc.data();
        if (!dgNumber) return;

        countMap[dgNumber] = (countMap[dgNumber] || 0) + 1;
      });

      setDgRunCountMap(countMap);
    });

    return () => unsub();
  }, [userData?.site]);


  return (
    <div className="layout">
      {/* Sidebar */}
      <Sidebar userData={userData} collapsed={collapsed} setCollapsed={setCollapsed} powerSource={powerSource} />
      {/* Main Area */}
      <div className="main" >
        {/* Navbar */}
        <div className="navbar" style={{ background: powerSource === "EB" ? "" : "#db1e1eff" }} >
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
                  <>
                    {/* 👤 Profile Avatar (image OR letter) – ONLY for large screen */}
                    {userData?.photoURL ? (
                      <img
                        src={userData.photoURL}
                        alt="Profile"
                        className="profile-avatar"
                        style={{
                          width: "50px",
                          height: "50px",
                          borderRadius: "50%",
                          border: "2px solid black",
                          cursor: "pointer",
                        }}
                        onClick={() => navigate("/profile")}
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
                          cursor: "pointer",
                        }}
                        title={userData.name}
                        onClick={() => navigate("/profile")}
                      >
                        {userData.name.charAt(0).toUpperCase()}
                      </div>
                    ) : null}

                    {/* 🏷️ Title */}
                    <h1 className="title" title="Prepared By @Sumen Adhikari">
                      WB Airtel MSC Data Base Management System
                    </h1>
                  </>
                ) : userData?.photoURL ? (
                  <img
                    src={userData.photoURL}
                    alt="Profile"
                    className="profile-avatar"
                    style={{ width: "50px", height: "50px", borderRadius: "50%", border: "2px solid black", cursor: "pointer", }}
                    onClick={() => navigate("/profile")}
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
                      cursor: "pointer",
                    }}
                    title={userData.name}
                    onClick={() => navigate("/profile")}
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
                {/* ⚡ Power Source Toggle */}
                {isMobile && (
                  <div>
                    {siteConfig?.dgCount > 0 && (
                      <div style={{ display: "flex", marginTop: "2px", gap: "2px", justifyContent: "center", alignItems: "center" }}>
                        {Array.from({ length: siteConfig.dgCount }, (_, i) => {
                          const dg = `DG-${i + 1}`;
                          const runCount = dgRunCountMap[dg] || 0;
                          const dgCapacity = siteConfig.dgConfigs?.[dg]?.capacityKva;
                          return (
                            <button
                              key={dg}
                              onClick={() => confirmAndSelectDG(dg)}
                              style={{
                                position: "relative",
                                padding: selectedDG === dg ? "4px 8px" : "4px 8px",
                                borderRadius: "6px",
                                border: "1px solid #ccc",
                                background: selectedDG === dg && powerSource === "DG" ? "green" : "#0c2046ff",
                                color: selectedDG === dg ? "#c9b71aff" : "#fff",
                                cursor: powerSource === "DG" ? "not-allowed" : "pointer",
                                fontWeight: selectedDG === dg ? "bold" : "normal",
                                opacity: selectedDG === dg ? 1 : 0.6,
                              }}
                              disabled={powerSource === "DG"}
                            >
                              <div>
                              <p style={{ fontSize: selectedDG === dg ? "15px" : "10px" }}>{dg}</p>
                              <p style={{ fontSize: "7px" }}>{dgCapacity}kVA</p>
                              </div>

                              {/* 🔥 DG Run Count Badge */}
                              {runCount > 0 && (
                                <span
                                  style={{
                                    position: "absolute",
                                    top: "-6px",
                                    right: "-6px",
                                    background: "#16a34a",
                                    color: "#fff",
                                    borderRadius: "999px",
                                    padding: "2px 6px",
                                    fontSize: "10px",
                                    fontWeight: "bold",
                                    lineHeight: 1,
                                  }}
                                  title={`Runs today: ${runCount}`}
                                >
                                  {runCount}
                                </span>
                              )}
                            </button>

                          );
                        })}
                      </div>
                    )}

                    <div
                      title="Click to toggle power source state"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        background: "#0f172aff",
                        borderRadius: "10px",
                        fontSize: "13px",
                        padding: "3px 3px"
                      }}
                    >
                      <span style={{ opacity: powerSource === "EB" ? 1 : 0.5, backgroundColor: "transparent", color: powerSource === "EB" ? "#ffffffff" : "#ffffffaa" }}>
                        <strong>⚡EB</strong>
                      </span>

                      <div
                        onClick={powerLockRef.current || !canTogglePower ? undefined : updatePowerSource}
                        style={{
                          width: "42px",
                          height: "22px",
                          background: powerSource === "DG" ? "#dc2626" : "#16a34a",
                          borderRadius: "12px",
                          position: "relative",
                          cursor:
                            !canTogglePower
                              ? "not-allowed"
                              : "pointer",
                          pointerEvents: powerLockRef.current ? "none" : "auto",
                          opacity: powerLockRef.current ? 0.5 : 1,
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
                    </div>
                    {powerSource === "DG" && (
                      <div style={{
                        background: "#7f1d1d",
                        color: "#fff",
                        padding: "2px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: 'pointer'
                      }}
                        onClick={() => navigate("/dg-run-history")}
                      >
                        ⛽ DG Running: {formatDuration(dgSeconds)}
                      </div>
                    )}
                  </div>
                )}

                <Modal
                  isOpen={showSimulator}
                  isMinimized={simMinimized}
                  onMinimize={() => setSimMinimized((p) => !p)}
                >
                  <AsansolOperationSimulator
                    triggeredBy={powerSource}
                    site={userData.site}
                    selectedDG={selectedDG}
                  />
                </Modal>


              </div>

              <p className="dashboard-subinfo">
                <strong>🏢{userData?.site || "All"}</strong>
                |&nbsp;<strong>🆔{userData.siteId || "All"}</strong>
                |&nbsp;<strong style={{ color: "whitesmoke", background: `${userData?.isActive ? "#3f8a2985" : "#8a0f0f85"}`, height: "fit-content", borderRadius: "6px", borderBottom: "1px solid" }}>{userData?.isActive ? "Active" : "Inactive"}</strong>
                |&nbsp;
                {isMobile && (
                  <strong
                    onClick={() => navigate("/dg-run-history")}
                    style={{
                      position: "relative",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      background: "#8685be0a",
                    }}
                    title="DG Run Logs"
                    onMouseMove={(e) => e.currentTarget.style.backgroundColor = "#4660aa98"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#8685be0a"}
                  >
                    <strong style={{ textDecoration: "underline", color: "blue", opacity: 100 }}>
                      🔗
                    </strong>

                    {unaddCount > 0 && (
                      <span
                        style={{
                          position: "absolute",
                          top: "-6px",
                          right: "-10px",
                          background: "#dc2626",
                          color: "#fff",
                          borderRadius: "999px",
                          padding: "2px 6px",
                          fontSize: "10px",
                          fontWeight: "bold",
                          lineHeight: 1,
                        }}
                      >
                        {unaddCount}
                      </span>
                    )}
                  </strong>
                )}
                <p style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
                  {siteConfig?.dgCount > 0 && !isMobile && (
                    <div style={{ display: "flex", gap: "4px", marginTop: "2px", justifyContent: "center", alignItems: "center" }}>
                      <label style={{ color: "ButtonShadow" }}>Select DG: </label>
                      {Array.from({ length: siteConfig.dgCount }, (_, i) => {
                        const dg = `DG-${i + 1}`;
                        const runCount = dgRunCountMap[dg] || 0;
                        const dgCapacity = siteConfig.dgConfigs?.[dg]?.capacityKva;
                        return (
                          <button
                            key={dg}
                            onClick={() => confirmAndSelectDG(dg)}
                            style={{
                              position: "relative",
                              padding: selectedDG === dg ? "5px 12px" : "4px 10px",
                              borderRadius: "6px",
                              border: "1px solid #ccc",
                              background: selectedDG === dg && powerSource === "DG" ? "green" : "#0c2046ff",
                              color: selectedDG === dg ? "#c9b71aff" : "#fff",
                              cursor: powerSource === "DG" ? "not-allowed" : "pointer",
                              fontWeight: selectedDG === dg ? "bold" : "normal",
                              opacity: selectedDG === dg ? 1 : 0.6,
                            }}
                            disabled={powerSource === "DG"}
                          >
                            <div>
                              <p style={{ fontSize: selectedDG === dg ? "18px" : "12px" }}>{dg}</p>
                              <p style={{ fontSize: "8px" }}>{dgCapacity}kVA</p>
                            </div>

                            {/* 🔥 DG Run Count Badge */}
                            {runCount > 0 && (
                              <span
                                style={{
                                  position: "absolute",
                                  top: "-6px",
                                  right: "-6px",
                                  background: "#16a34a",
                                  color: "#fff",
                                  borderRadius: "999px",
                                  padding: "2px 6px",
                                  fontSize: "10px",
                                  fontWeight: "bold",
                                  lineHeight: 1,
                                }}
                                title={`Runs today: ${runCount}`}
                              >
                                {runCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {!isMobile && (
                    <div>
                      <b
                        style={{ color: "white", background: powerSource === "EB" ? "#429e4eff" : "#b95e5eff", padding: "0px 2px", borderRadius: "6px", cursor: "pointer", alignItems: "center" }}
                      >
                        ℹ️Site Status:
                        <strong onClick={() => navigate("/dg-run-history")} style={{
                          position: "relative",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          background: "#00000010",
                        }}>
                          🔗
                          {unaddCount > 0 && (
                            <span
                              style={{
                                position: "absolute",
                                top: "-6px",
                                right: "-10px",
                                background: "#dc2626",
                                color: "#fff",
                                borderRadius: "999px",
                                padding: "2px 6px",
                                fontSize: "10px",
                                fontWeight: "bold",
                                lineHeight: 1,
                              }}
                            >
                              {unaddCount}
                            </span>
                          )}
                        </strong>
                      </b>

                      <div
                        title="Click to toggle power source state"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          background: "#0f172aff",
                          borderRadius: "10px",
                          fontSize: "13px",
                          padding: "2px 6px"
                        }}
                      >
                        <span style={{ opacity: powerSource === "EB" ? 1 : 0.5, backgroundColor: "transparent", color: powerSource === "EB" ? "#ffffffff" : "#ffffffaa" }}>
                          <strong>⚡EB</strong>
                        </span>

                        <div
                          onClick={powerLockRef.current || !canTogglePower ? undefined : updatePowerSource}
                          style={{
                            width: "42px",
                            height: "22px",
                            background: powerSource === "DG" ? "#dc2626" : "#16a34a",
                            borderRadius: "12px",
                            position: "relative",
                            cursor:
                              !canTogglePower
                                ? "not-allowed"
                                : "pointer",
                            pointerEvents: powerLockRef.current ? "none" : "auto",
                            opacity: powerLockRef.current ? 0.5 : 1,
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
                        {powerSource === "DG" && (
                          <div style={{
                            background: "#7f1d1d",
                            color: "#fff",
                            padding: "2px 10px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: 'pointer'
                          }}
                            onClick={() => navigate("/dg-run-history")}
                          >
                            ⛽ DG Running: {formatDuration(dgSeconds)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <Modal
                    isOpen={showSimulator}
                    isMinimized={simMinimized}
                    onMinimize={() => setSimMinimized((p) => !p)}
                  >
                    <AsansolOperationSimulator
                      triggeredBy={powerSource}
                      site={userData.site}
                      selectedDG={selectedDG}
                    />
                  </Modal>

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
                            padding: "2px 10px",
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
                                shiftUsers[activeShift]?.map((u, i) => (
                                  <li key={i} style={{ marginBottom: "6px" }}>
                                    <strong style={{ color: "#16a34a" }}>{u.name}</strong>
                                    <div style={{ fontSize: "12px", color: "#475569" }}>
                                      📞 {u.mobile}
                                    </div>
                                  </li>
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
              <small style={{ fontSize: "9px", color: "#94a3b8" }}>
                <b>{loadingPower ? "Loading..." : `Updated By: ${updatedByName} on ${updatedAt ? updatedAt.toLocaleString() : "N/A"} Site on "${powerSource}" Source (Live) `}</b>
              </small>
            </header>

          </div>
        </div>

        {/* Page Content */}
        <div className="main-content" onClick={() => setCollapsed(true)}>
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
                      ? "🌅 Morning Shift"
                      : drawerShift === "E"
                        ? "🌇 Evening Shift"
                        : drawerShift === "N"
                          ? "🌙 Night Shift"
                          : "Weekly Off"}
                </h3>

                <ul style={{ listStyle: "none", padding: 0 }}>
                  {shiftUsers[drawerShift]?.length ? (
                    shiftUsers[drawerShift]?.map((u, i) => (
                      <li
                        key={i}
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #e5e7eb",
                          fontSize: "15px",
                        }}
                      >
                        👷 <strong>{u.name}</strong>
                        <div style={{ fontSize: "13px", color: "#475569" }}>
                          {u.mobile !== "N/A" && (
                            <b
                              onClick={() => callUser(u.mobile)}
                              title={`Call ${u.name}`}
                              style={{ cursor: "pointer" }}
                            >📞</b>
                          )}
                          {u.mobile}
                        </div>
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