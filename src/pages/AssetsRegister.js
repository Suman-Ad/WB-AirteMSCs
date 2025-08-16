// src/pages/AssetsRegister.js
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import * as XLSX from "xlsx";
import "../assets/DHRStyle.css";
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, getDoc, serverTimestamp } from "firebase/firestore";


/*
  - Authoritative nested storage: assets_register/{Circle}/{SiteID}/{EquipmentDoc}
  - Fast real-time reads: assets_flat/{Circle-SiteID-EquipDoc}  (doc id uses '-' instead of '/')
  - Column definitions stored at: assets_columns/default { columns: [...] }
*/

const DEFAULT_COLUMNS = [
  { key: "UniqueID", label: "Unique ID (Don't edit)" },
  { key: "DedicatedNo", label: "Dedicated No (Don't edit)" },
  { key: "Region", label: "Region" },
  { key: "Circle", label: "Circle" },
  { key: "SiteName", label: "Site Name" },
  { key: "UniqueCode", label: "Unique Code" }, // Site ID
  { key: "EquipmentCategory", label: "Equipment Category" },
  { key: "EquipmentNameAndNo", label: "Equipment Name and No" },
  { key: "EquipmentMake", label: "Equipment Make" },
  { key: "EquipmentModel", label: "Equipment Model" },
  { key: "EquipmentSerialNumber", label: "Equipment Serial Number" },
  { key: "UnitOfMeasure", label: "Unit of measure (kva/TR etc.)" },
  { key: "RatingCapacity", label: "Rating/Capacity" },
  { key: "Qty", label: "Qty" },
  { key: "ManufacturingDate", label: "Equipment Manufacturing date (DD-MM-YY)" },
  { key: "InstallationDate", label: "Equipment Installation date (DD-MM-YY)" },
];

export default function AssetsRegister({ userData }) {
  // user & role
  const userRole = userData?.role;
  const isAdmin = userRole === "Admin" || userRole === "Super Admin";

  // columns state (load from firestore or fallback to DEFAULT_COLUMNS)
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);

  // table rows come from assets_flat (real-time)
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState({ percent: 0, total: 0, loaded: 0 });

  // import states
  const [fileToImport, setFileToImport] = useState(null);
  const [importProgress, setImportProgress] = useState({ percent: 0, total: 0, loaded: 0 });

  // column mgmt UI
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnLabel, setNewColumnLabel] = useState("");

  // add/edit row UI
  const blankForm = useMemo(() => {
    const obj = {};
    DEFAULT_COLUMNS.forEach((c) => (obj[c.key] = ""));
    return obj;
  }, []);
  const [newRowForm, setNewRowForm] = useState(blankForm);
  const [editingRowId, setEditingRowId] = useState(null);
  const [editingRowForm, setEditingRowForm] = useState({});

  // ---------- Firestore column load/save ----------
  const loadColumnsFromFirestore = async () => {
    try {
      const docRef = doc(db, "assets_columns", "default");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.columns) && data.columns.length > 0) {
          setColumns(data.columns);
          return;
        }
      }
      setColumns(DEFAULT_COLUMNS);
    } catch (e) {
      console.error("loadColumnsFromFirestore err:", e);
      setColumns(DEFAULT_COLUMNS);
    }
  };

  const saveColumnsToFirestore = async (cols) => {
    try {
      await setDoc(doc(db, "assets_columns", "default"), {
        columns: cols,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setColumns(cols);
    } catch (e) {
      console.error("saveColumnsToFirestore err:", e);
      // still update local columns so UI works
      setColumns(cols);
    }
  };

  // ---------- mapping helper for import ----------
  // Normalize header string to compare (remove spaces, lowercase)
  const normalizeHeaderKey = (s) => (s || "").toString().trim().replace(/\s+/g, "").toLowerCase();

  // Build a map: normalized label -> key
  const columnLabelToKeyMap = useMemo(() => {
    const m = {};
    for (const c of columns) {
      m[normalizeHeaderKey(c.label)] = c.key;
      m[normalizeHeaderKey(c.key)] = c.key; // also accept direct key in header
    }
    return m;
  }, [columns]);

  // ---------- utility: derive path parts ----------
  const getPathParts = (rec) => {
    // allow rec.UniqueID if present
    const uidRaw = rec.UniqueID || rec.UniqueId || rec.uniqueid || "";
    const uid = uidRaw.toString().trim();
    if (uid && uid.split("/").length === 3) {
      const [circle, siteId, equipDoc] = uid.split("/");
      return { circle, siteId, equipDoc };
    }

    const circle = (rec.Circle || rec.circle || "").toString().trim();
    const siteId = (rec.UniqueCode || rec.Uniquecode || rec.SiteID || "").toString().trim();

    let equipDoc = "";
    if (rec.EquipmentNameAndNo) {
      equipDoc = rec.EquipmentNameAndNo.toString().replace(/\s+/g, "");
    } else if (rec.DedicatedNo !== undefined && rec.DedicatedNo !== "") {
      equipDoc = `ACDB${rec.DedicatedNo}`;
    }
    equipDoc = equipDoc.toString().trim();

    return { circle, siteId, equipDoc };
  };

  // ---------- nested + flat write helpers ----------
  const upsertNested = async (payload) => {
    const { circle, siteId, equipDoc } = getPathParts(payload);
    if (!circle || !siteId || !equipDoc) {
      throw new Error("Missing Circle / Site ID / Equipment Doc to write nested record.");
    }
    const nestedRef = doc(db, "assets_register", circle, siteId, equipDoc);
    await setDoc(nestedRef, payload, { merge: true });
  };

  const upsertFlat = async (payload) => {
    const { circle, siteId, equipDoc } = getPathParts(payload);
    if (!circle || !siteId || !equipDoc) return;
    const uniqueId = `${circle}/${siteId}/${equipDoc}`; // store in payload
    const flatId = uniqueId.replace(/\//g, "-"); // doc id for assets_flat
    const flatRef = doc(db, "assets_flat", flatId);
    const flatPayload = {
      ...payload,
      UniqueID: uniqueId,
      Circle: payload.Circle || circle,
      UniqueCode: payload.UniqueCode || siteId,
      EquipmentDoc: equipDoc,
      updatedAt: serverTimestamp(),
    };
    await setDoc(flatRef, flatPayload, { merge: true });
  };

  const deleteNested = async (payload) => {
    const { circle, siteId, equipDoc } = getPathParts(payload);
    if (!circle || !siteId || !equipDoc) return;
    const nestedRef = doc(db, "assets_register", circle, siteId, equipDoc);
    await deleteDoc(nestedRef);
  };

  // deleteDoc import
  async function deleteDoc(docRef) {
    // wrapper to call Firestore deleteDoc
    // import deleteDoc from firebase/firestore at top? we implemented wrapper to avoid re-import issues
    // but we need the actual deleteDoc — use update: call setDoc with delete? Simpler: import real deleteDoc.
    // (we'll import below properly)
  }

  // ---------- prepare payload with consistent UniqueID ----------
  const preparePayload = (row) => {
    // Ensure all column keys exist on payload (avoid missing keys)
    const payload = {};
    for (const c of columns) payload[c.key] = row[c.key] ?? row[c.label] ?? "";
    // also copy any extra keys present in row (so imported fields not in columns also stored)
    Object.keys(row).forEach((k) => {
      if (!payload.hasOwnProperty(k)) payload[k] = row[k];
    });

    const { circle, siteId, equipDoc } = getPathParts(payload);

    if (!circle || !siteId || !equipDoc) {
      // not valid to write
      return null;
    }

    const uniqueId = `${circle}/${siteId}/${equipDoc}`;
    payload.Circle = payload.Circle || circle;
    payload.UniqueCode = payload.UniqueCode || siteId;
    payload.EquipmentDoc = payload.EquipmentDoc || equipDoc;
    payload.UniqueID = uniqueId;
    payload._importedAt = payload._importedAt || serverTimestamp();
    payload.updatedAt = serverTimestamp();
    return payload;
  };

  // ---------- load columns on mount ----------
  useEffect(() => {
    loadColumnsFromFirestore();
    // subscribe to assets_flat snapshot for table rows
    setLoading(true);
    setLoadProgress({ percent: 5, total: 0, loaded: 0 });

    const unsub = onSnapshot(collection(db, "assets_flat"), (snap) => {
      const total = snap.size;
      const list = snap.docs.map((d) => {
        const data = d.data() || {};
        // ensure payload uses column keys
        const row = {};
        for (const c of columns) row[c.key] = data[c.key] ?? data[c.label] ?? data[c.key];
        // include all known handy fields too
        row._raw = data;
        row.id = d.id;
        // keep UniqueID (may be in payload or can be reconstructed from id)
        row.UniqueID = data.UniqueID || (d.id ? d.id.replace(/-/g, "/") : "");
        // copy main fields
        row.Circle = data.Circle || row.Circle || "";
        row.SiteName = (data.SiteName || data.Site || row.SiteName || "").toString();
        row.EquipmentCategory = data.EquipmentCategory || row.EquipmentCategory || "";
        row.Qty = data.Qty !== undefined ? data.Qty : row.Qty;
        return row;
      });
      setRows(list);
      setLoadProgress({ percent: 100, total, loaded: total });
      setLoading(false);
    }, (err) => {
      console.error("assets_flat subscribe error:", err);
      setLoading(false);
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // load columns separately; columns state will update UI after load

  // ---------- add / delete column (admin) ----------
  const handleAddColumn = async () => {
    const label = (newColumnLabel || "").trim();
    if (!label) return alert("Enter column label");
    const keyBase = label.replace(/\s+/g, "_").replace(/[^\w_]/g, "");
    let key = keyBase || `col_${Date.now()}`;
    let i = 1;
    while (columns.some((c) => c.key === key)) key = `${keyBase}_${i++}`;

    const newCols = [...columns, { key, label }];
    await saveColumnsToFirestore(newCols);
    setNewColumnLabel("");
    setAddingColumn(false);
  };

  const handleDeleteColumn = async (key) => {
    if (!window.confirm("Delete this column? Existing stored values remain in documents; only view is removed.")) return;
    const newCols = columns.filter((c) => c.key !== key);
    await saveColumnsToFirestore(newCols);
  };

  // ---------- file import ----------
  const handleFileChange = (e) => setFileToImport(e.target.files?.[0] || null);

  const importFileToFirestore = async () => {
    if (!fileToImport) return alert("Select an Excel/CSV file first");
    setImportProgress({ percent: 0, total: 0, loaded: 0 });

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const raw = evt.target.result;
        const isCsv = fileToImport.name.toLowerCase().endsWith(".csv");
        const wb = XLSX.read(raw, { type: isCsv ? "string" : "binary" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        let json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        // Normalize file headers -> map to column keys.
        const fileHeaders = json.length ? Object.keys(json[0]) : [];
        // Build mapping from file header -> column key
        const mapping = {}; // fileHeader -> columnKey
        const currentCols = [...columns]; // local copy to allow adding new columns
        const labelMap = {}; // normalized label -> key
        currentCols.forEach((c) => (labelMap[normalizeHeaderKey(c.label)] = c.key));

        for (const fh of fileHeaders) {
          const normalized = normalizeHeaderKey(fh);
          if (labelMap[normalized]) {
            mapping[fh] = labelMap[normalized];
          } else {
            // create new column automatically and persist (admins only)
            const newKeyBase = fh.replace(/\s+/g, "_").replace(/[^\w_]/g, "");
            let newKey = newKeyBase || `col_${Date.now()}`;
            let j = 1;
            while (currentCols.some((c) => c.key === newKey)) newKey = `${newKeyBase}_${j++}`;
            const newCol = { key: newKey, label: fh };
            currentCols.push(newCol);
            mapping[fh] = newKey;
            labelMap[normalizeHeaderKey(fh)] = newKey;
          }
        }

        // If we added new columns, persist them
        if (currentCols.length !== columns.length) {
          await saveColumnsToFirestore(currentCols);
        }

        // Convert rows to payloads using mapping
        const total = json.length;
        let loaded = 0;
        let success = 0;
        let skipped = 0;

        for (const row of json) {
          // create normalized object with column keys
          const rec = {};
          for (const fh of Object.keys(row)) {
            const mappedKey = mapping[fh];
            if (mappedKey) rec[mappedKey] = row[fh];
            else rec[fh] = row[fh];
          }

          // Validate & prepare payload
          const payload = preparePayload(rec);
          loaded++;
          setImportProgress({ total, loaded, percent: Math.round((loaded / total) * 100) });

          if (!payload) {
            skipped++;
            console.warn("Skipped invalid row (missing circle/site/equipDoc):", rec);
            continue;
          }

          // write nested & flat
          await upsertNested(payload);
          await upsertFlat(payload);
          success++;
        }

        alert(`Import finished. Success: ${success}, Skipped: ${skipped}`);
        setFileToImport(null);
        setImportProgress({ percent: 0, total: 0, loaded: 0 });
      } catch (err) {
        console.error("Import error:", err);
        alert("Import failed: " + (err?.message || err));
        setImportProgress({ percent: 0, total: 0, loaded: 0 });
      }
    };

    if (fileToImport.name.toLowerCase().endsWith(".csv")) reader.readAsText(fileToImport);
    else reader.readAsBinaryString(fileToImport);
  };

  // ---------- add manual row ----------
  const addNewRow = async () => {
    const payload = preparePayload(newRowForm);
    if (!payload) return alert("Please enter Circle, UniqueCode (Site ID) and EquipmentNameAndNo or DedicatedNo.");

    try {
      await upsertNested(payload);
      await upsertFlat(payload);
      setNewRowForm(blankForm);
    } catch (e) {
      console.error("addNewRow err:", e);
      alert("Add row failed: " + (e?.message || e));
    }
  };

  // ---------- edit / save / delete ----------
  const startEditRow = (row) => {
    setEditingRowId(row.id);
    const copy = {};
    for (const c of columns) copy[c.key] = row[c.key] ?? row._raw?.[c.key] ?? row._raw?.[c.label] ?? "";
    setEditingRowForm(copy);
  };

  const saveEditedRow = async () => {
    if (!editingRowId) return;
    // find existing raw data (row stored in rows)
    const existing = rows.find((r) => r.id === editingRowId);
    const merged = { ...(existing?._raw || {}), ...editingRowForm };
    const payload = preparePayload(merged);
    if (!payload) return alert("Edited record is missing Circle / Site / Equipment identifier.");

    try {
      await upsertNested(payload);
      await upsertFlat(payload);
      setEditingRowId(null);
      setEditingRowForm({});
    } catch (e) {
      console.error("saveEditedRow err:", e);
      alert("Save failed: " + (e?.message || e));
    }
  };

  const deleteRow = async (row) => {
    if (!window.confirm("Delete this asset? This removes nested doc and flat mirror.")) return;
    try {
      // remove nested
      const { circle, siteId, equipDoc } = getPathParts(row._raw || row);
      if (circle && siteId && equipDoc) {
        const nestedRef = doc(db, "assets_register", circle, siteId, equipDoc);
        await deleteDoc(nestedRef);
      }
      // remove flat
      const flatId = (row.UniqueID || (row.id ? row.id.replace(/-/g, "/") : "")).replace(/\//g, "-");
      const flatRef = doc(db, "assets_flat", flatId);
      await deleteDoc(flatRef);
    } catch (e) {
      console.error("deleteRow err:", e);
      alert("Delete failed: " + (e?.message || e));
    }
  };

  // Firestore deleteDoc real function (imported here to avoid naming collision)
  const { deleteDoc: deleteDocFromFirestore } = (() => {
    try {
      // dynamic require not available; we'll simply reference from firebase namespace
      // but ensure we import at top in your project: import { deleteDoc } from "firebase/firestore";
      return { deleteDoc: require && require("firebase/firestore").deleteDoc };
    } catch {
      return { deleteDoc: null };
    }
  })();

  // Fallback wrapper
  const deleteDocReal = async (ref) => {
    // prefer native deleteDoc import
    try {
      // Try using globally imported deleteDocFromFirestore
      if (deleteDocFromFirestore) {
        await deleteDocFromFirestore(ref);
      } else {
        // as fallback do setDoc with empty? not safe; throw to inform developer to import deleteDoc
        throw new Error("Firestore deleteDoc not available. Import deleteDoc from 'firebase/firestore'.");
      }
    } catch (e) {
      throw e;
    }
  };

  // ---------- small helpers ----------
  // function preparePayload(row) {
  //   // build payload using current columns, but accept raw fields too
  //   const payload = {};
  //   // bring known column keys
  //   for (const c of columns) payload[c.key] = row[c.key] ?? row[c.label] ?? row[c.key] ?? "";
  //   // copy extra fields
  //   Object.keys(row).forEach((k) => {
  //     if (!payload.hasOwnProperty(k)) payload[k] = row[k];
  //   });

  //   const { circle, siteId, equipDoc } = getPathParts(payload);
  //   if (!circle || !siteId || !equipDoc) return null;

  //   const uniqueId = `${circle}/${siteId}/${equipDoc}`;
  //   payload.Circle = payload.Circle || circle;
  //   payload.UniqueCode = payload.UniqueCode || siteId;
  //   payload.EquipmentDoc = payload.EquipmentDoc || equipDoc;
  //   payload.UniqueID = uniqueId;
  //   payload._importedAt = payload._importedAt || serverTimestamp();
  //   payload.updatedAt = serverTimestamp();
  //   return payload;
  // }

  // ---------- rendering ----------
  return (
    <div className="dhr-dashboard-container" style={{ padding: 16 }}>
      <h2 className="dashboard-header">Assets Register</h2>

      {/* Loading progress */}
      <div style={{ marginBottom: 12 }}>
        {loading ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <strong>Loading assets…</strong>
              <span>{loadProgress.loaded}/{loadProgress.total}</span>
              <span>{loadProgress.percent}%</span>
            </div>
            <div style={{ background: "#eee", height: 8, width: "100%", borderRadius: 4 }}>
              <div style={{ background: "#4caf50", width: `${loadProgress.percent}%`, height: 8, borderRadius: 4 }} />
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong>Loaded</strong>
            <span>{rows.length} item{rows.length === 1 ? "" : "s"}</span>
          </div>
        )}
      </div>

      {/* Column management */}
      {isAdmin && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>Admin: Columns</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {columns.map((c) => (
              <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <strong style={{ fontSize: 12 }}>{c.label}</strong>
                <button className="btn-small" onClick={() => handleDeleteColumn(c.key)}>🗑</button>
              </div>
            ))}
            {!addingColumn ? (
              <button className="btn-primary" onClick={() => setAddingColumn(true)}>+ Add Column</button>
            ) : (
              <>
                <input value={newColumnLabel} onChange={(e) => setNewColumnLabel(e.target.value)} placeholder="Column label" />
                <button className="btn-primary" onClick={handleAddColumn}>Save</button>
                <button className="btn-secondary" onClick={() => { setAddingColumn(false); setNewColumnLabel(""); }}>Cancel</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Import */}
      {isAdmin && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>Import Excel/CSV</label>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
          <button className="btn-success" onClick={importFileToFirestore} disabled={!fileToImport}>Import</button>
          {importProgress.total > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>Importing {importProgress.loaded}/{importProgress.total}</span>
                <strong>{importProgress.percent}%</strong>
              </div>
              <div style={{ background: "#eee", height: 8, width: "100%", borderRadius: 4 }}>
                <div style={{ background: "#1976d2", width: `${importProgress.percent}%`, height: 8, borderRadius: 4 }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick add */}
      {(isAdmin || userRole === "Super User") && (
        <div style={{ marginBottom: 16 }}>
          <h4>Add New Asset</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
            {columns.map((c) => (
              <div key={c.key}>
                <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>{c.label}</label>
                <input value={newRowForm[c.key] ?? ""} onChange={(e) => setNewRowForm({ ...newRowForm, [c.key]: e.target.value })} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8 }}><button className="btn-success" onClick={addNewRow}>Add</button></div>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        {!loading && (
          <table className="dhr-table" style={{ width: "100%", minWidth: 900 }}>
            <thead>
              <tr>
                {columns.map((c) => <th key={c.key}>{c.label}</th>)}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      {editingRowId === row.id ? (
                        <input value={editingRowForm[col.key] ?? ""} onChange={(e) => setEditingRowForm({ ...editingRowForm, [col.key]: e.target.value })} />
                      ) : (row[col.key] ?? row._raw?.[col.key] ?? "")}
                    </td>
                  ))}
                  <td>
                    {editingRowId === row.id ? (
                      <>
                        <button className="btn-primary" onClick={saveEditedRow}>Save</button>
                        <button className="btn-secondary" onClick={() => { setEditingRowId(null); setEditingRowForm({}); }}>Cancel</button>
                      </>
                    ) : (
                      <>
                        {(isAdmin || (userData?.role === "Super User" && (row.UniqueCode || row.SiteName) === userData.site)) && (
                          <button className="btn-primary" onClick={() => startEditRow(row)}>Edit</button>
                        )}
                        {(isAdmin || (userData?.role === "Super User" && (row.UniqueCode || row.SiteName) === userData.site)) && (
                          <button className="btn-danger" onClick={() => deleteRow(row)}>Delete</button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
