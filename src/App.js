import React, { useEffect, useState } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import AppContent from "./AppContent";
import { db, auth } from "./firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

function App() {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (!updateInfo) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.location.reload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [updateInfo]);

  // useEffect(() => {
  //   const ref = doc(db, "app_meta", "version");

  //   const unsub = onSnapshot(ref, (snap) => {
  //     if (!snap.exists()) return;

  //     const dbVersion = snap.data().version;
  //     const lastHandledVersion = localStorage.getItem("app_version");

  //     // ✅ First time → just store version (no alert)
  //     if (!lastHandledVersion) {
  //       localStorage.setItem("app_version", dbVersion);
  //       return;
  //     }

  //     // ✅ Only trigger if version changed
  //     if (lastHandledVersion !== dbVersion) {
  //       console.log("🔥 New version detected:", dbVersion);

  //       localStorage.setItem("app_version", dbVersion);

  //       setUpdateInfo(dbVersion); // show UI
  //     }
  //   });

  //   return () => unsub();
  // }, []);

  useEffect(() => {
    let unsubscribeVersion = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeVersion) {
        unsubscribeVersion();
        unsubscribeVersion = null;
      }

      if (!user) return;

      const ref = doc(db, "app_meta", "version");

      unsubscribeVersion = onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) return;

          const dbVersion = snap.data().version;
          const lastVersion = localStorage.getItem("app_version");

          if (!lastVersion) {
            localStorage.setItem("app_version", dbVersion);
            return;
          }

          if (lastVersion !== dbVersion) {
            localStorage.setItem("app_version", dbVersion);
            setUpdateInfo(dbVersion);
          }
        },
        (error) => {
          console.warn("Version check unavailable:", error.message);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeVersion) unsubscribeVersion();
    };
  }, []);

  return (
    <Router>
      {updateInfo && (
        <div style={{
          position: "fixed",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#222",
          color: "#fff",
          padding: "10px 20px",
          borderRadius: "8px",
          zIndex: 9999
        }}>
          🚀 New version {updateInfo} available. Refreshing in {countdown}s...
          <button
            onClick={() => window.location.reload()}
            style={{ marginLeft: "10px", padding: "5px 10px" }}
          >
            Refresh Now
          </button>
        </div>
      )}
      <AppContent />
    </Router>
  );
}

export default App;