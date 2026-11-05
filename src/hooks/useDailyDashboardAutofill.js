import { configuredDGSitePaths, siteDataPaths } from "../services/allSitesDGSubscriptions";
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where, orderBy, limit, documentId } from "firebase/firestore";
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
    let incidents = null;
    let sourceError = "";
    const fail = error => {
      sourceError = `Autofill unavailable: ${error.message}`;
      if (active) setResult(previous => ({ ...previous, error: sourceError }));
    };
    const publish = () => {
      if (!active) return;
      const patches = {};
      Object.entries(state).forEach(([site, source]) => {
        if (!source.configReady) return;
        const patch = buildDailyAutofill({ site, date, ...source,
          log: source.logReady ? source.log : null, stockLog: source.stockReady ? source.stockLog : null, runs: source.runsReady ? source.runs : null, runHoursFromRuns: true, incidents, activitySheets: activitySheets || [] });
        if (activitySheets === null) delete patch.Planned_Activity_Details;
        patches[site] = patch;
      });
      setResult({ patches, error: sourceError, scope });
    };
    stops.push(onSnapshot(query(collection(db, "daily_activity_sheets"),
      where("date", "in", [previousDate(date), date])), snapshot => {
      activitySheets = snapshot.docs.map(item => item.data());
      publish();
    }, fail));
    stops.push(onSnapshot(collection(db, "incidents"), snapshot => {
      incidents = snapshot.docs.map(item => ({ ...item.data(), id: item.id }));
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
      // DGLogTable can be opened with either the stored or normalized site name.
      const canonical = configuredDGSitePaths({ [site]: { siteName: site } })[0];
      const runSites = [...new Set([...logSites, canonical])];
      const runSnapshots = {};
      siteDataPaths("runs", runSites, date.slice(0, 7), date).forEach(runPath => {
        stops.push(onSnapshot(collection(db, ...runPath.path), snapshot => {
          runSnapshots[runPath.site] = snapshot.docs.map(item => ({ ...item.data(), __runId: item.id }));
          state[site].runsReady = runSites.every(name => Object.prototype.hasOwnProperty.call(runSnapshots, name));
          // Mirrored documents with the same ID represent one run.
          const unique = new Map();
          runSites.forEach(name => (runSnapshots[name] || []).forEach(run => unique.set(run.__runId, run)));
          state[site].runs = [...unique.values()];
          publish();
        }, fail));
      });
      const month = date.slice(0, 7);
      const previousMonth = previousDate(`${month}-01`).slice(0, 7);
      const stockSnapshots = {};
      const stockSources = logSites.flatMap(name => [month, previousMonth].map(period => ({ name, period, key: `${name}:${period}` })));
      stockSources.forEach(({ name, period, key }) => {
        stops.push(onSnapshot(query(collection(db, "dailyDGLogs", name, period),
          where(documentId(), "<=", date), orderBy(documentId(), "desc"), limit(1)), snapshot => {
          stockSnapshots[key] = snapshot.docs.map(item => ({ date: item.id, data: item.data() }));
          state[site].stockReady = stockSources.every(source => Object.prototype.hasOwnProperty.call(stockSnapshots, source.key));
          const latest = Object.values(stockSnapshots).flat().sort((a, b) => b.date.localeCompare(a.date))[0];
          state[site].stockLog = latest ? { ...latest.data, Date: latest.date } : null;
          publish();
        }, fail));
      });
      stops.push(onSnapshot(doc(db, "siteConfigs", site.toUpperCase()), snapshot => {
        state[site].config = snapshot.exists() ? snapshot.data() : {};
        state[site].configReady = true;
        publish();
      }, fail));
    });
    // Refresh reporting data while the page remains open.
    const timer = setInterval(publish, 60000);
    return () => { active = false; clearInterval(timer); stops.forEach(stop => stop()); };
  }, [siteKey, date, enabled, scope]);
  return result.scope === scope ? result : { patches: {}, error: result.error || "" };
}
