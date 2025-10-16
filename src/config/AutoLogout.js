// src/components/AutoLogout.js
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function AutoLogout({ timeoutMs = 12 * 60 * 60 * 1000 }) {
  const navigate = useNavigate();
  const intervalRef = useRef(null);

  useEffect(() => {
    const TWO_HOURS = timeoutMs;
    const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "touchstart"];

    // update activity: refresh lastActivity and expiry
    const updateActivity = () => {
      const now = Date.now();
      localStorage.setItem("lastActivity", String(now));
      localStorage.setItem("expiry", String(now + TWO_HOURS));
      console.clear();
      console.log("🔄 Activity detected — reset 2-hour timer.");
    };

    // Convert milliseconds to readable h:m:s
    const formatTimeLeft = (ms) => {
      const totalSeconds = Math.max(0, Math.floor(ms / 1000));
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return `${hours}h ${minutes}m ${seconds}s`;
    };

    // check expiry and force logout if expired
    const checkExpiry = async () => {
      try {
        const expiryStr = localStorage.getItem("expiry");
        const userData = localStorage.getItem("userData");
        if (!userData) {
          // no logged in user, nothing to do
          return;
        }
        if (!expiryStr) {
          // no expiry set (maybe previous login didn't set it) -> set fresh expiry
          updateActivity();
          return;
        }

        const expiry = Number(expiryStr);
        const now = Date.now();
        const timeLeft = expiry - now;
        if (isNaN(expiry)) {
          updateActivity();
          return;
        }

        // Countdown console
        console.clear();
        console.log(
          "⏳ Auto logout in:",
          formatTimeLeft(timeLeft),
          "| Current time:",
          new Date().toLocaleTimeString()
        );

        if (timeLeft <= 0) {
          console.log("🚪 Session expired — logging out...");
          try {
            await signOut(auth);
          } catch (e) {
            console.warn("signOut error (ignored):", e);
          }
          localStorage.removeItem("userData");
          localStorage.removeItem("lastActivity");
          localStorage.removeItem("expiry");
          localStorage.removeItem("userData");
          localStorage.removeItem("summary");
          localStorage.removeItem("dailyLogs");
          localStorage.removeItem("incidents");
          localStorage.removeItem("incidentSummary");
          localStorage.removeItem("incidentTextSummary");
          localStorage.removeItem("assets");
          localStorage.removeItem("pmData");
          localStorage.removeItem("thermalReports");
          localStorage.removeItem("lastFilling")
          // Redirect to login
          navigate("/login", { replace: true });
          // Optionally show an alert
          try {
            // guard: window may not be available in some test env
            window.alert("You were logged out after 12 hours of inactivity.");
          } catch (e) { }
        }
      } catch (err) {
        console.error("AutoLogout check error:", err);
      }
    };

    // attach activity listeners
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, updateActivity));

    // initial check + set interval
    if (!localStorage.getItem("expiry")) updateActivity();
    intervalRef.current = setInterval(checkExpiry, 1000); // every 30s

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, updateActivity));
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [navigate, timeoutMs]);

  return null; // renders nothing; mount once in App
}
