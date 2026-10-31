import React, { useState } from "react";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { canManageAllPowerMappings } from "../components/powerMeterMapping";
import { meterHealth } from "./meterHealth";

export default function SiteMeterCleanup({ siteId, meters, userData, now, fromCache, loading, error }) {
  const [checked, setChecked] = useState([]);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const canEdit = canManageAllPowerMappings(userData);
  const selected = meters.filter(m => checked.includes(m.id));
  const unavailable = loading || fromCache || Boolean(error);
  const remove = async () => {
    if (!canEdit || unavailable || busy || !review || !selected.length || selected.length > 450) return;
    setBusy(true); setMessage("");
    try {
      const batch = writeBatch(db);
      selected.forEach(m => batch.delete(doc(db, "energyMonitor", siteId, "meters", m.id)));
      await batch.commit();
      setChecked([]); setReview(false);
      setMessage(`Removed ${selected.length} meter records.`);
    } catch {
      setMessage("Could not remove meters. Check your connection and admin permissions, then try again.");
    } finally { setBusy(false); }
  };
  return <section className="energy-card" aria-label="Manage energy meters">
    <h2>Manage energy meters</h2>
    <p>All {meters.length} meter records, including offline and duplicate records. Check extra meters to remove them.</p>
    <p>Removal deletes the current meter record. Saved history remains. Update collector configuration first if a meter should stop uploading; an active collector can recreate it. Review any power-switch and SLD mappings that use removed IDs.</p>
    {!canEdit && <p>Only Admin and Super Admin can remove meters.</p>}
    {unavailable && <p role="status">Waiting for current site meter data before removal is available.</p>}
    <div className="energy-table-wrap"><table><thead><tr><th>Select</th><th>Meter</th><th>Meter ID</th><th>Point ID</th><th>Status</th><th>Last reading</th></tr></thead>
      <tbody>{meters.map(m => <tr key={m.id}>
        <td><input type="checkbox" aria-label={`Remove ${m.id}`} checked={checked.includes(m.id)} disabled={!canEdit || unavailable || busy || review} onChange={e => { setMessage(""); setChecked(ids => e.target.checked ? [...ids, m.id] : ids.filter(id => id !== m.id)); }} /></td>
        <td>{m.name || m.id}</td><td>{m.id}</td><td>{m.pointId || m.point_id || m.point || m.energyBookPointId || "—"}</td>
        <td>{meterHealth(m, now, fromCache)}</td><td>{m.observedAt?.toMillis?.() ? new Date(m.observedAt.toMillis()).toLocaleString() : "No timestamp"}</td>
      </tr>)}</tbody></table></div>
    {canEdit && (!review ? <button type="button" disabled={unavailable || busy || !selected.length || selected.length > 450} onClick={() => setReview(true)}>Review removal ({selected.length})</button> : <div>
      <p>Remove these meter records from site {siteId}: {selected.map(m => `${m.name || m.id} (${m.id})`).join(", ")}?</p>
      <button type="button" disabled={unavailable || busy || !selected.length} onClick={remove}>{busy ? "Removing…" : "Confirm removal"}</button>
      <button type="button" disabled={busy} onClick={() => setReview(false)}>Cancel</button>
    </div>)}
    {selected.length > 450 && <p role="alert">Select at most 450 meters per removal.</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
