import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { buildDailyAutofill, previousDate } from "../utils/dailyDashboardAutofill";

export default function useDailyDashboardAutofill(sites, date, enabled = true) {
  const [result, setResult] = useState({ patches: {}, error: "" });
  const siteKey = JSON.stringify([...new Set(sites)].sort());
  const scope = `${siteKey}:${date}:${enabled}`;
  useEffect(() => {
    setResult({ patches: {}, error: "" });
    if (!enabled || !date) return;
    let active = true;
    const state = {};
    const stops = [];
    let activitySheets = null;
    let sourceError = "";
    const fail = error => {
      sourceError = `Autofill unavailable: ${error.message}`;
      if (active) setResult(previous => ({ ...previous, error: sourceError }));
    };
    const publish = () => {
      if (!active) return;
      const patches = {};
      Object.entries(state).forEach(([site, source]) => {
        if (!source.logReady || !source.configReady || activitySheets === null) return;
        const patch = buildDailyAutofill({ site, date, ...source, activitySheets });
        // A current day's closing stock is available only after 4 PM IST.
        if (Date.now() < Date.parse(`${date}T16:00:00+05:30`)) {
          delete patch.Diesel_Back_Up;
          delete patch.DG_EB_Backup;
        }
        patches[site] = patch;
      });
      setResult({ patches, error: sourceError, scope });
    };
    stops.push(onSnapshot(query(collection(db, "daily_activity_sheets"),
      where("date", "in", [previousDate(date), date])), snapshot => {
      activitySheets = snapshot.docs.map(item => item.data());
      publish();
    }, fail));
    JSON.parse(siteKey).forEach(site => {
      state[site] = {};
      // Match DailyDGLog's siteName normalization and YYYY-MM storage month.
      const logSites = [...new Set([site, site.charAt(0) + site.slice(1).toLowerCase()])];
      const logs = {};
      logSites.forEach(logSite => {
        stops.push(onSnapshot(doc(db, "dailyDGLogs", logSite, date.slice(0, 7), date), snapshot => {
          logs[logSite] = snapshot.exists() ? snapshot.data() : null;
          state[site].log = logSites.map(name => logs[name]).find(Boolean) || null;
          state[site].logReady = logSites.every(name => Object.prototype.hasOwnProperty.call(logs, name));
          publish();
        }, fail));
      });
      stops.push(onSnapshot(doc(db, "siteConfigs", site.toUpperCase()), snapshot => {
        state[site].config = snapshot.exists() ? snapshot.data() : {};
        state[site].configReady = true;
        publish();
      }, fail));
    });
    // Advance the cutoff even if there is no source write at exactly 4 PM.
    const timer = setInterval(publish, 60000);
    return () => { active = false; clearInterval(timer); stops.forEach(stop => stop()); };
  }, [siteKey, date, enabled, scope]);
  return result.scope === scope ? result : { patches: {}, error: result.error || "" };
}
