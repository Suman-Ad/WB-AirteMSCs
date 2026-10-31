import { useEffect, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { shiftHistoryDate, validHistoryDate } from "../pages/energyMeterHistoryData";

const initial = key => ({ key, records: [], loading: true, cached: false, error: "" });
function subscribe(ref, key, receive, message, document = false) {
  let active = true;
  receive(initial(key));
  const stop = onSnapshot(ref, { includeMetadataChanges: true }, snapshot => {
    if (!active) return;
    receive({ key, records: document ? [] : snapshot.docs.map(d => ({ ...d.data(), id: d.id })), settings: document ? { enabled: true, retentionDays: 7, ...(snapshot.exists() ? snapshot.data() : {}) } : undefined,
      loading: false, cached: Boolean(snapshot.metadata?.fromCache || snapshot.metadata?.hasPendingWrites), error: "" });
  }, () => { if (active) receive({ ...initial(key), loading: false, error: message }); });
  return () => { active = false; stop(); };
}
export function subscribeMeterDailyHistory(siteId, date, receive) {
  const key = `${siteId}/${date}`;
  if (!siteId || !validHistoryDate(date)) { receive({ ...initial(key), loading: false, error: "Select a site and valid report date." }); return () => {}; }
  return subscribe(query(collection(db, "energyMonitor", siteId, "dailyReadings"), where("date", ">=", shiftHistoryDate(date, -7)), where("date", "<=", date)), key, receive, "Saved meter daily history could not be loaded. Check site permissions and connection.");
}
export function subscribeMeterSamples(siteId, meterKey, date, receive) {
  const key = `${siteId}/${meterKey}/${date}`;
  if (!siteId || !meterKey || !validHistoryDate(date)) { receive({ ...initial(key), loading: false }); return () => {}; }
  const start = Date.parse(`${shiftHistoryDate(date, -6)}T00:00:00+05:30`), end = Date.parse(`${shiftHistoryDate(date, 1)}T00:00:00+05:30`);
  return subscribe(query(collection(db, "energyMonitor", siteId, "historyMeters", meterKey, "samples"), where("observedAtMs", ">=", start), where("observedAtMs", "<", end), orderBy("observedAtMs", "desc"), limit(1000)), key, receive, "Saved meter samples could not be loaded. Check site permissions and connection.");
}
export function useMeterDailyHistory(siteId, date) {
  const key = `${siteId}/${date}`, [state, setState] = useState(() => initial(key));
  useEffect(() => subscribeMeterDailyHistory(siteId, date, setState), [siteId, date]);
  return state.key === key ? state : initial(key);
}
export function useMeterSamples(siteId, meterKey, date) {
  const key = `${siteId}/${meterKey}/${date}`, [state, setState] = useState(() => initial(key));
  useEffect(() => subscribeMeterSamples(siteId, meterKey, date, setState), [siteId, meterKey, date]);
  return state.key === key ? state : initial(key);
}
export function useMeterHistorySettings(siteId) {
  const [state, setState] = useState(() => initial(siteId));
  useEffect(() => {
    if (!siteId) { setState({ ...initial(siteId), loading: false }); return undefined; }
    return subscribe(doc(db, "energyMonitor", siteId, "config", "meterHistory"), siteId, setState, "Meter history settings could not be loaded. Check site access and connection.", true);
  }, [siteId]);
  return state.key === siteId ? state : initial(siteId);
}

