// AssetsRegister.js
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import "../assets/DHRStyle.css";

/*
Firestore collections used:
- assets_columns  (single doc: id = "default", field: columns -> array of column objects { key, label })
- assets_register (documents keyed by Unique ID or generated ids; fields per columns)
*/

const DEFAULT_COLUMNS = [
  { key: "UniqueID", label: "Unique ID (Don't edit)" },
  { key: "DedicatedNo", label: "Dedicated No (Don't edit)" },
  { key: "Region", label: "Region" },
  { key: "Circle", label: "Circle" },
  { key: "SiteName", label: "Site Name" },
  { key: "UniqueCode", label: "Unique Code" },
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
  // add other common columns (DG tank capacity, running CPH etc.) as needed
];

export default function AssetsRegister({ userData }) {
  const userRole = userData?.role;
  const userSite = userData?.site;
  const userRegion = userData?.region;
  const userCircle = userData?.circle;

  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [rows, setRows] = useState([]); // assets_register docs
  const [loading, setLoading] = useState(true);

  // UI states
  const [fileToImport, setFileToImport] = useState(null);
  const [newColumnLabel, setNewColumnLabel] = useState("");
  const [addingColumn, setAddingColumn] = useState(false);

  const [newRowForm, setNewRowForm] = useState(() => {
    const base = {};
    DEFAULT_COLUMNS.forEach(c => (base[c.key] = ""));
    return base;
  });

  const [editingRowId, setEditingRowId] = useState(null);
  const [editingRowForm, setEditingRowForm] = useState({});

  // --- Firestore helpers ---
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
      // fallback to default
      setColumns(DEFAULT_COLUMNS);
    } catch (err) {
      console.error("Error loading columns:", err);
      setColumns(DEFAULT_COLUMNS);
    }
  };

  const saveColumnsToFirestore = async (cols) => {
    const docRef = doc(db, "assets_columns", "default");
    try {
      await setDoc(docRef, { columns: cols, updatedAt: serverTimestamp() }, { merge: true });
      setColumns(cols);
    } catch (err) {
      console.error("Error saving columns:", err);
      alert("Failed to save columns.");
    }
  };

  // subscribe to rows (assets_register)
  useEffect(() => {
    const q = collection(db, "assets_register");
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRows(arr);
      setLoading(false);
    }, (err) => {
      console.error("error listening assets_register:", err);
      setLoading(false);
    });

    // load columns once
    loadColumnsFromFirestore();

    return () => unsub();
  }, []);

  // --- Column management (Admin / Super Admin) ---
  const handleAddColumn = async () => {
    const label = (newColumnLabel || "").trim();
    if (!label) return alert("Enter column label");
    // create a simple key from label
    const keyBase = label.replace(/\s+/g, "_").replace(/[^\w_]/g, "");
    let key = keyBase;
    let i = 1;
    while (columns.some(c => c.key === key)) {
      key = `${keyBase}_${i++}`;
    }
    const newCols = [...columns, { key, label }];
    await saveColumnsToFirestore(newCols);
    setNewColumnLabel("");
    setAddingColumn(false);
  };

  const handleDeleteColumn = async (key) => {
    if (!window.confirm("Delete this column? This will remove data for this column from existing records.")) return;
    const newCols = columns.filter(c => c.key !== key);
    // update columns doc
    await saveColumnsToFirestore(newCols);

    // remove the field from all assets_register documents
    const snap = await getDocs(collection(db, "assets_register"));
    const batchPromises = snap.docs.map(async d => {
      const docRef = doc(db, "assets_register", d.id);
      // update doc by removing the key (set to null or remove using updateDoc with deleteField)
      const obj = {};
      obj[key] = "";
      await updateDoc(docRef, obj);
    });
    await Promise.all(batchPromises);
  };

  // --- Excel/CSV import ---
  const handleFileChange = (e) => {
    setFileToImport(e.target.files?.[0] || null);
  };

  const importFileToFirestore = async () => {
    if (!fileToImport) return alert("Select a file first (Excel or CSV)");
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: "binary" });
        // assume first sheet
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "" }); // defval to keep empty strings
        // Determine headers (columns) from file
        const fileHeaders = json.length > 0 ? Object.keys(json[0]) : [];

        // Map file headers to our column keys: try to match using label equality ignoring spaces/case
        // Build a mapping: fileHeader -> key (existing or new)
        const mapping = {};
        const existingKeysLower = {};
        columns.forEach(c => existingKeysLower[c.label.replace(/\s+/g, "").toLowerCase()] = c.key);

        fileHeaders.forEach(hdr => {
          const keyCandidate = hdr.replace(/\s+/g, "").toLowerCase();
          if (existingKeysLower[keyCandidate]) {
            mapping[hdr] = existingKeysLower[keyCandidate];
          } else {
            // create a new column automatically (admin only allowed normally; here we create new columns and persist)
            const keyBase = hdr.replace(/\s+/g, "_").replace(/[^\w_]/g, "");
            let key = keyBase || `col_${Date.now()}`;
            let idx = 1;
            while (columns.some(c => c.key === key)) {
              key = `${keyBase}_${idx++}`;
            }
            mapping[hdr] = key;
            columns.push({ key, label: hdr });
          }
        });

        // persist new columns if any added
        await saveColumnsToFirestore(columns);

        // now create/update documents in assets_register
        const promises = json.map(async (row) => {
          // row is an object with file header names as keys
          // take UniqueID as doc id if present
          const uniqueIdVal = row["Unique ID"] || row["UniqueID"] || row["Unique ID (Don't edit)"] || row["Unique ID (Don't edit)"] || row["Unique ID (Don't edit)"]; // try variants
          const docId = uniqueIdVal ? String(uniqueIdVal).trim() : Date.now().toString() + Math.floor(Math.random() * 1000);
          const payload = {};
          // fill columns according to mapping
          Object.keys(row).forEach(fh => {
            const k = mapping[fh];
            if (!k) return;
            payload[k] = row[fh];
          });
          // make sure site/region/circle fields exist (try to fall back)
          if (!payload["SiteName"] && (row["Site Name"] || row["SiteName"])) payload["SiteName"] = row["Site Name"] || row["SiteName"];
          if (!payload["Region"] && row["Region"]) payload["Region"] = row["Region"];
          if (!payload["Circle"] && row["Circle"]) payload["Circle"] = row["Circle"];
          payload._importedAt = serverTimestamp();
          // save doc
          await setDoc(doc(db, "assets_register", docId), payload);
        });

        await Promise.all(promises);
        alert("Import complete.");
        setFileToImport(null);
        setLoading(false);
      };

      // decide binary vs arrayBuffer per file type
      if (fileToImport.name.endsWith(".csv")) {
        reader.readAsText(fileToImport);
      } else {
        reader.readAsBinaryString(fileToImport);
      }
    } catch (err) {
      console.error("Import error:", err);
      alert("Import failed: " + (err.message || err));
      setLoading(false);
    }
  };

  // --- Row CRUD ---
  const addNewRow = async () => {
    // must provide UniqueID
    const uid = newRowForm.UniqueID?.trim() || Date.now().toString();
    // create payload using current columns
    const payload = {};
    columns.forEach(c => payload[c.key] = newRowForm[c.key] || "");
    payload.createdAt = serverTimestamp();
    await setDoc(doc(db, "assets_register", uid), payload);
    // reset newRowForm
    const base = {};
    columns.forEach(c => (base[c.key] = ""));
    setNewRowForm(base);
  };

  const startEditRow = (row) => {
    setEditingRowId(row.id);
    const copy = {};
    columns.forEach(c => copy[c.key] = row[c.key] || "");
    setEditingRowForm(copy);
  };

  const saveEditedRow = async () => {
    if (!editingRowId) return;
    const updates = {};
    columns.forEach(c => updates[c.key] = editingRowForm[c.key] || "");
    // update doc
    await updateDoc(doc(db, "assets_register", editingRowId), updates);
    setEditingRowId(null);
    setEditingRowForm({});
  };

  const deleteRow = async (id) => {
    if (!window.confirm("Delete this asset record?")) return;
    await deleteDoc(doc(db, "assets_register", id));
  };

  // --- helpers / render ---
  const isAdmin = userRole === "Admin" || userRole === "Super Admin";
  const canEditThisRow = (r) => {
    if (isAdmin) return true;
    if (userRole === "Super User") return r.site === userSite;
    return false; // normal User cannot edit
  };

  // Build table columns header labels (columns state)
  return (
    <div className="dhr-dashboard-container" style={{ padding: 16 }}>
      <h2 className="dashboard-header">Assets Register</h2>

      <div style={{ marginBottom: 12 }}>
        {isAdmin && (
          <>
            <label style={{ display: "block", marginBottom: 6 }}>Admin: Add new column</label>
            {!addingColumn ? (
              <button className="btn-primary" onClick={() => setAddingColumn(true)}>+ Add Column</button>
            ) : (
              <>
                <input value={newColumnLabel} placeholder="Column label (e.g. DG tank capacity)" onChange={(e) => setNewColumnLabel(e.target.value)} />
                <button className="btn-primary" onClick={handleAddColumn} style={{ marginLeft: 8 }}>Save</button>
                <button className="btn-secondary" onClick={() => { setAddingColumn(false); setNewColumnLabel(""); }} style={{ marginLeft: 6 }}>Cancel</button>
              </>
            )}
          </>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>Import Excel / CSV (Admin / Super Admin recommended)</label>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
        <button className="btn-success" onClick={importFileToFirestore} disabled={!fileToImport}>Import</button>
      </div>

      {/* quick add row (Admin / Super User for their site) */}
      {(isAdmin || userRole === "Super User") && (
        <div style={{ marginBottom: 12 }}>
          <h4>Add New Asset Row</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
            {columns.map(c => {
              // Admin must fill region/circle/site appropriately for Admin; Super User form will auto-fill Site from userSite
              if (!isAdmin && userRole === "Super User" && (c.key === "SiteName" || c.key === "Site")) {
                // show site as fixed
                return (
                  <div key={c.key}>
                    <label>{c.label}</label>
                    <input value={newRowForm[c.key] || userSite} onChange={(e) => setNewRowForm({...newRowForm, [c.key]: e.target.value})} />
                  </div>
                );
              }
              return (
                <div key={c.key}>
                  <label>{c.label}</label>
                  <input value={newRowForm[c.key] || ""} onChange={(e) => setNewRowForm({...newRowForm, [c.key]: e.target.value})} />
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 8 }}>
            <button className="btn-success" onClick={addNewRow}>Add Row</button>
          </div>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        {loading ? <p>Loading...</p> : (
          <table className="dhr-table" style={{ width: "100%", minWidth: 900 }}>
            <thead>
              <tr>
                {columns.map(c => (
                  <th key={c.key}>
                    {c.label}
                    {isAdmin && (
                      <button style={{ marginLeft: 8 }} className="btn-small" onClick={() => handleDeleteColumn(c.key)}>🗑</button>
                    )}
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                // role-based filtering: user sees only their site (User). Super User and Admin see all
                if (userRole === "User" && row.SiteName !== userSite && row.site !== userSite) return null;
                return (
                  <tr key={row.id}>
                    {columns.map(col => (
                      <td key={col.key}>
                        {editingRowId === row.id ? (
                          <input value={editingRowForm[col.key] || ""} onChange={(e) => setEditingRowForm({...editingRowForm, [col.key]: e.target.value})} />
                        ) : (
                          row[col.key] ?? row[col.key] === 0 ? row[col.key] : ""
                        )}
                      </td>
                    ))}
                    <td>
                      {editingRowId === row.id ? (
                        <>
                          <button className="btn-primary" onClick={saveEditedRow}>Save</button>
                          <button className="btn-secondary" onClick={() => setEditingRowId(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          {canEditThisRow(row) && <button className="btn-primary" onClick={() => startEditRow(row)}>Edit</button>}
                          {canEditThisRow(row) && <button className="btn-danger" onClick={() => deleteRow(row.id)}>Delete</button>}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
