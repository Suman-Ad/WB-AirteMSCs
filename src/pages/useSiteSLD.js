import { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { restoreSiteSLD, storedSLD, validateSLD } from "./energySLDData";
const keyFor = (siteId) => `energy-monitor:sld:v1:${siteId}`;
function readLocal(siteId) {
  if (!siteId) return null;
  const raw = localStorage.getItem(keyFor(siteId));
  return raw ? restoreSiteSLD(JSON.parse(raw)) : null;
}
export default function useSiteSLD(siteId, canEdit = false) {
  const [payload, setPayload] = useState(null), [status, setStatus] = useState("Loading saved SLD…"), [storageError, setStorageError] = useState("");
  const [saving, setSaving] = useState(false);
  const current = useRef(null), dirty = useRef(false), revision = useRef(0), hadRemote = useRef(false);
  const writeLocal = (value) => {
    if (!siteId) { setStatus("Assign a site to save this drawing"); return false; }
    try { localStorage.setItem(keyFor(siteId), JSON.stringify(value)); return true; }
    catch { setStorageError("Device storage is unavailable. Use Save site SLD to keep these changes."); return false; }
  };
  useEffect(() => {
    let active = true;
    current.current = null; dirty.current = false; hadRemote.current = false; revision.current += 1;
    setPayload(null); setStorageError(""); setSaving(false);
    try {
      const local = canEdit ? readLocal(siteId) : null;
      if (local) { current.current = local; dirty.current = local.dirty; setPayload(local); setStatus(local.dirty ? "Saved on this device · site save pending" : "Loaded from this device"); }
      else setStatus(siteId ? "Loading saved site SLD…" : "Assign a site to save drawings");
    } catch { setStorageError("The saved device drawing could not be restored. You can import it again."); }
    if (!siteId) return undefined;
    const stop = onSnapshot(doc(db, "energyMonitor", siteId, "config", "sld"), { includeMetadataChanges: true }, (snapshot) => {
      if (!active || snapshot.metadata.hasPendingWrites) return;
      if (!snapshot.exists()) {
        if (!snapshot.metadata.fromCache && (!canEdit || hadRemote.current || !current.current?.dirty)) {
          revision.current += 1; dirty.current = false; current.current = null; setPayload(null);
          try { localStorage.removeItem(keyFor(siteId)); } catch { /* Cloud remains authoritative. */ }
        }
        setStatus(current.current ? "Saved on this device · not saved to site" : "No saved site SLD yet"); return;
      }
      hadRemote.current = true;
      if (canEdit && dirty.current) return;
      try {
        const remote = restoreSiteSLD(JSON.parse(snapshot.data().payloadJson));
        remote.dirty = false; setStorageError(""); current.current = remote; setPayload(remote);
        try { localStorage.setItem(keyFor(siteId), JSON.stringify(remote)); } catch { /* Cloud copy remains available. */ }
        setStatus(snapshot.metadata.fromCache ? "Loaded cached site SLD" : "Loaded saved site SLD");
      } catch { setStorageError("The saved site SLD is invalid; your device copy has been kept."); }
    }, () => { if (active) setStorageError("Site SLD could not be loaded. Device changes remain available; check your connection and site permissions."); });
    return () => { active = false; revision.current += 1; stop(); };
  }, [siteId, canEdit]);
  const update = (graph, meterLinks, edgeLinks) => {
    if (!canEdit) return;
    const next = { version: 1, drawing: storedSLD(graph), meterLinks, edgeLinks, modifiedAt: new Date().toISOString(), dirty: true };
    revision.current += 1; dirty.current = true; current.current = next; setPayload(next); setStorageError("");
    const savedLocally = writeLocal(next); if (siteId) setStatus(savedLocally ? "Saved on this device · site save pending" : "Device save unavailable · site save pending");
  };
  const save = async () => {
    if (!canEdit || !siteId || !current.current || saving) return;
    const value = current.current, savedRevision = revision.current;
    setSaving(true); setStorageError("");
    try {
      // JSON avoids Firestore's restriction on nested waypoint arrays.
      await setDoc(doc(db, "energyMonitor", siteId, "config", "sld"), { version: 1, payloadJson: JSON.stringify({ ...value, dirty: false }), updatedAt: serverTimestamp() }, { merge: true });
      if (revision.current !== savedRevision) return;
      const saved = { ...value, dirty: false }; current.current = saved; dirty.current = false; setPayload(saved); const savedLocally = writeLocal(saved); setStatus(savedLocally ? "Saved to site and this device" : "Saved to site · device save unavailable");
    } catch { setStorageError("Site save failed. Your device copy is kept. Check your connection and site write permissions, then retry."); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!canEdit || !siteId || saving) return;
    setSaving(true); setStorageError("");
    try {
      await deleteDoc(doc(db, "energyMonitor", siteId, "config", "sld"));
      revision.current += 1; dirty.current = false; current.current = null; setPayload(null);
      try { localStorage.removeItem(keyFor(siteId)); } catch { /* Remote delete succeeded. */ }
      setStatus("Site SLD deleted");
    } catch { setStorageError("Site delete failed. Check Admin permissions and connection."); }
    finally { setSaving(false); }
  };
  const graph = useMemo(() => payload ? validateSLD(payload.drawing) : null, [payload]);
  return { graph, meterLinks: payload?.meterLinks || {}, edgeLinks: payload?.edgeLinks || {}, update, save, remove, saving, status, storageError };
}
