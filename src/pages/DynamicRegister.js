// src/pages/AssetsRegister.js
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import * as XLSX from "xlsx";
import "../assets/DHRStyle.css";
import { collection, doc, setDoc, updateDoc, onSnapshot, getDoc, serverTimestamp, getDocs, deleteDoc, writeBatch, arrayUnion } from "firebase/firestore";
import { useParams } from "react-router-dom";

/*
  - Authoritative nested storage: assets_register/{Circle}/{SiteID}/{EquipmentDoc}
  - Fast real-time reads: assets_flat/{Circle-SiteID-EquipDoc}  (doc id uses '-' instead of '/')
  - Column definitions stored at: assets_columns/default { columns: [...] }
*/

// const DEFAULT_COLUMNS = [
//   { key: "UniqueID", label: "Unique ID" },
//   { key: "DedicatedNo", label: "Dedicated No" },
//   { key: "Region", label: "Region" },
//   { key: "Circle", label: "Circle" },
//   { key: "SiteName", label: "Site Name" },
//   { key: "UniqueCode", label: "Unique Code" }, // Site ID
//   { key: "EquipmentCategory", label: "Equipment Category" },
//   { key: "EquipmentNameAndNo", label: "Equipment Name and No" },
//   { key: "EquipmentMake", label: "Equipment Make" },
//   { key: "EquipmentModel", label: "Equipment Model" },
//   { key: "EquipmentSerialNumber", label: "Equipment Serial Number" },
//   { key: "UnitOfMeasure", label: "Unit of measure" },
//   { key: "RatingCapacity", label: "Rating Capacity" },
//   { key: "Qty", label: "Qty" },
//   { key: "ManufacturingDate", label: "Equipment Manufacturing date" },
//   { key: "InstallationDate", label: "Equipment Installation date" },
// ];

const isAdminAssignmentValid = (userData) => {
  if (!userData?.isAdminAssigned) return false;
  if (!userData?.adminAssignFrom || !userData?.adminAssignTo) return false;

  const today = new Date();
  const from = new Date(userData.adminAssignFrom);
  const to = new Date(userData.adminAssignTo);

  return today >= from && today <= to;
};


export default function DynamicRegister({ userData }) {
  // user & role
  const userRole = userData?.role;
  const isAdmin =
    userData?.role === "Super Admin" ||
    userData?.role === "Admin" ||
    userData.isAdminAssigned ||
    isAdminAssignmentValid(userData) ||
    userData?.designation === "Vertiv Site Infra Engineer" ||
    userData?.designation === "Vertiv CIH" ||
    userData?.designation === "Vertiv ZM";

  // columns state (load from firestore or fallback to DEFAULT_COLUMNS)
  const [columns, setColumns] = useState([]);

  const { registerName } = useParams();

  useEffect(() => {
    const loadColumns = async () => {
      const snap = await getDocs(collection(db, "register_books"));

      const reg = snap.docs.find(
        (d) => d.data().name === registerName
      );

      if (reg) {
        setColumns(reg.data().columns || []);
      }
    };

    loadColumns();
  }, [registerName]);


  const BATCH_LIMIT = 500;

  const yieldToUI = () =>
    new Promise((res) => setTimeout(res, 0));


  // table rows come from assets_flat (real-time)
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState({ percent: 0, total: 0, loaded: 0 });
  const [renameSite, setRenameSite] = useState({
    circle: "",
    siteId: "",
    currentSiteName: "",
    newSiteName: "",
  });

  const [renaming, setRenaming] = useState(false);
  const [renameProgress, setRenameProgress] = useState({
    total: 0,
    completed: 0,
  });

  const [renameMaster, setRenameMaster] = useState({
    type: "",        // region | circle | category | amc
    oldValue: "",
    newValue: "",
  });

  const [renamingMaster, setRenamingMaster] = useState(false);
  const [renameMasterProgress, setRenameMasterProgress] = useState({
    total: 0,
    completed: 0,
  });

  const [renameControl, setRenameControl] = useState({
    paused: false,
    cancelled: false,
    startTime: null,
  });


  const sleep = (ms) => new Promise(res => setTimeout(res, ms));

  const waitIfPaused = async () => {
    while (renameControl.paused) {
      await sleep(300);
    }
    if (renameControl.cancelled) {
      throw new Error("OPERATION_CANCELLED");
    }
  };

  const elapsedSec = renameControl.startTime
    ? (Date.now() - renameControl.startTime) / 1000
    : 0;

  const speed = elapsedSec > 0
    ? (renameMasterProgress.completed / elapsedSec).toFixed(1)
    : 0;

  const remaining =
    speed > 0
      ? Math.ceil(
        (renameMasterProgress.total - renameMasterProgress.completed) / speed
      )
      : 0;

  const regionOptions = useMemo(
    () => [...new Set(rows.map(r => r.Region).filter(Boolean))].sort(),
    [rows]
  );

  const equipmentCategoryOptions = useMemo(
    () => [...new Set(rows.map(r => r.EquipmentCategory).filter(Boolean))].sort(),
    [rows]
  );

  const amcPartnerOptions = useMemo(() => {
    return [
      ...new Set(
        rows
          .map(r =>
            r.AMC_Partner_Name ??
            r._raw?.AMC_Partner_Name ??
            r._raw?.["AMC Partner Name"]
          )
          .filter(Boolean)
      ),
    ].sort();
  }, [rows]);


  // 🔹 Circles
  const circleOptions = useMemo(() => {
    return [...new Set(rows.map(r => r.Circle).filter(Boolean))].sort();
  }, [rows]);

  // 🔹 Site IDs by Circle
  const siteIdOptions = useMemo(() => {
    if (!renameSite.circle) return [];
    return [
      ...new Set(
        rows
          .filter(r => r.Circle === renameSite.circle)
          .map(r => r.UniqueCode)
          .filter(Boolean)
      ),
    ].sort();
  }, [rows, renameSite.circle]);

  // 🔹 Site Names by Circle + Site ID
  const siteNameOptions = useMemo(() => {
    if (!renameSite.circle || !renameSite.siteId) return [];
    return [
      ...new Set(
        rows
          .filter(
            r =>
              r.Circle === renameSite.circle &&
              r.UniqueCode === renameSite.siteId
          )
          .map(r => r.SiteName)
          .filter(Boolean)
      ),
    ];
  }, [rows, renameSite.circle, renameSite.siteId]);

  useEffect(() => {
    if (siteNameOptions.length === 1) {
      setRenameSite(prev => ({
        ...prev,
        currentSiteName: siteNameOptions[0],
      }));
    }
  }, [siteNameOptions]);

  const getFieldValue = (row, field) => {
    return (
      row[field] ??
      row._raw?.[field] ??
      row._raw?.[field.replace(/_/g, " ")] ??
      ""
    );
  };

  // Master Rename
  const renameMasterValue = async () => {
    const { type, oldValue, newValue } = renameMaster;

    const FIELD_MAP = {
      region: "Region",
      circle: "Circle",
      category: "EquipmentCategory",
      amc: "AMC_Partner_Name",
    };

    const field = FIELD_MAP[type];
    if (!field || !oldValue || !newValue) {
      alert("Invalid rename inputs");
      return;
    }

    if (!window.confirm(`Rename "${oldValue}" → "${newValue}" ?`)) return;

    try {
      setRenamingMaster(true);
      setRenameMasterProgress({ total: 0, completed: 0 });
      setRenameControl({ paused: false, cancelled: false, startTime: Date.now() });

      // 🔥 allow React to render progress UI
      // await yieldToUI();

      // 🔹 FLAT docs
      const flatDocs = rows.filter(r => getFieldValue(r, field) === oldValue);

      // 2️⃣ set PARTIAL total so UI shows instantly
      setRenameMasterProgress({
        total: flatDocs.length,
        completed: 0,
      });

      // 🔥 render immediately
      await yieldToUI();

      // 🔹 UNIQUE sites
      const siteKeys = new Set();
      flatDocs.forEach(r => {
        const { circle, siteId } = getPathParts(r._raw || r);
        if (circle && siteId) siteKeys.add(`${circle}__${siteId}`);
      });

      // 🔹 NESTED docs
      const nestedRefs = [];
      for (const key of siteKeys) {
        const [circle, siteId] = key.split("__");
        const snap = await getDocs(collection(db, "dynamic_register", registerName, circle, siteId));
        snap.docs.forEach(d => {
          if (d.data()?.[field] === oldValue) {
            nestedRefs.push(d.ref);
          }
        });
      }

      const total = flatDocs.length + nestedRefs.length;
      setRenameMasterProgress({ total, completed: 0 });

      let completed = 0;
      let batch = writeBatch(db);
      let batchCount = 0;

      const commitBatch = async () => {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      };

      // 🔹 FLAT updates
      for (const r of flatDocs) {
        await waitIfPaused();

        batch.update(doc(db, "dynamic_register_flat", registerName, "data", r.id), {
          [field]: newValue,
          updatedAt: serverTimestamp(),
        });

        batchCount++;
        completed++;

        if (batchCount === BATCH_LIMIT) await commitBatch();
        setRenameMasterProgress(p => ({ ...p, completed }));
      }

      // 🔹 NESTED updates
      for (const ref of nestedRefs) {
        await waitIfPaused();

        batch.update(ref, {
          [field]: newValue,
          updatedAt: serverTimestamp(),
        });

        batchCount++;
        completed++;

        if (batchCount === 500) await commitBatch();
        setRenameMasterProgress(p => ({ ...p, completed }));
      }

      if (batchCount > 0) await commitBatch();

      alert(`✅ ${field} renamed successfully`);
      setRenameMaster({ type: "", oldValue: "", newValue: "" });

    } catch (e) {
      if (e.message === "OPERATION_CANCELLED") {
        alert("⛔ Rename cancelled by user");
      } else {
        console.error(e);
        alert("❌ Rename failed: " + e.message);
      }
    } finally {
      setRenamingMaster(false);
    }
  };

  // 🔹 Rename Site Name
  const renameSiteName = async () => {
    const { circle, siteId, currentSiteName, newSiteName } = renameSite;

    if (!circle || !siteId || !currentSiteName || !newSiteName) {
      alert("Please select Circle, Site ID and enter New Site Name");
      return;
    }

    if (
      !window.confirm(
        `Rename site "${currentSiteName}" → "${newSiteName}"?\nThis will update all assets under this site.`
      )
    )
      return;

    try {
      setRenaming(true);
      setRenameProgress({ total: 0, completed: 0 });
      setRenameControl({
        paused: false,
        cancelled: false,
        startTime: Date.now(),
      });

      // 🔹 FLAT docs (single query from memory)
      const flatDocs = rows.filter(
        r => r.Circle === circle && r.UniqueCode === siteId
      );

      // 🔹 NESTED docs (single site)
      const siteRef = collection(db, "dynamic_register", registerName, circle, siteId);
      const snap = await getDocs(siteRef);

      const nestedRefs = snap.docs.map(d => d.ref);

      const total = flatDocs.length + nestedRefs.length;
      setRenameProgress({ total, completed: 0 });

      let completed = 0;
      let batch = writeBatch(db);
      let batchCount = 0;

      const commitBatch = async () => {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      };

      // 🔹 UPDATE assets_flat
      for (const r of flatDocs) {
        await waitIfPaused();

        batch.update(doc(db, "dynamic_register_flat", registerName, "data", r.id), {
          SiteName: newSiteName,
          updatedAt: serverTimestamp(),
        });

        batchCount++;
        completed++;

        if (batchCount === 500) await commitBatch();
        setRenameProgress(p => ({ ...p, completed }));
      }

      // 🔹 UPDATE assets_register (nested)
      for (const ref of nestedRefs) {
        await waitIfPaused();

        batch.update(ref, {
          SiteName: newSiteName,
          updatedAt: serverTimestamp(),
        });

        batchCount++;
        completed++;

        if (batchCount === 500) await commitBatch();
        setRenameProgress(p => ({ ...p, completed }));
      }

      if (batchCount > 0) await commitBatch();

      alert(`✅ Site renamed successfully (${completed} assets updated)`);

      setRenameSite({
        circle: "",
        siteId: "",
        currentSiteName: "",
        newSiteName: "",
      });

    } catch (e) {
      if (e.message === "OPERATION_CANCELLED") {
        alert("⛔ Rename cancelled by user");
      } else {
        console.error(e);
        alert("❌ Rename failed: " + e.message);
      }
    } finally {
      setRenaming(false);
    }
  };



  // import states
  const [fileToImport, setFileToImport] = useState(null);
  // const [importProgress, setImportProgress] = useState({ percent: 0, total: 0, loaded: 0 });
  const [importProgress, setImportProgress] = useState({
    percent: 0,
    total: 0,
    loaded: 0,
    success: 0,
    skipped: 0,
  });

  const [isPaused, setIsPaused] = useState(false);
  const [isStopped, setIsStopped] = useState(false);

  // column mgmt UI
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnLabel, setNewColumnLabel] = useState("");

  // add/edit row UI
  // const blankForm = useMemo(() => {
  //   const obj = {};
  //   DEFAULT_COLUMNS.forEach((c) => (obj[c.key] = ""));
  //   return obj;
  // }, []);

  const blankForm = useMemo(() => {
    const obj = {};
    columns.forEach((c) => (obj[c.key] = ""));
    return obj;
  }, [columns]);

  const [newRowForm, setNewRowForm] = useState(blankForm);
  // 🪟 Add Asset Modal
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // add | edit
  const [editingRowId, setEditingRowId] = useState(null);
  const [editingRowForm, setEditingRowForm] = useState({});

  const openEditModal = (row) => {
    setModalMode("edit");
    setEditingRowId(row.id);

    const formData = {};

    // 🔑 ensure ALL columns (default + dynamic) get values
    columns.forEach((c) => {
      formData[c.key] =
        row[c.key] ??
        row._raw?.[c.key] ??
        row._raw?.[c.label] ??
        "";
    });

    setNewRowForm(formData);
    setShowAddAssetModal(true);
  };


  // 🔍 Advanced filters
  const [filters, setFilters] = useState([
    { column: "Region", operator: "contains", value: `${userData?.siteId}` },
  ]);

  const OPERATORS = {
    contains: "Contains",
    ncontains: "Not-Contains",
    equals: "Equals",
    startsWith: "Starts With",
    endsWith: "Ends With",
    gt: ">",
    lt: "<",
  };

  const [editingColumnKey, setEditingColumnKey] = useState(null);
  const [editingColumnLabel, setEditingColumnLabel] = useState("");
  const [columnMoving, setColumnMoving] = useState(false);

  const startEditColumn = (col) => {
    setEditingColumnKey(col.key);
    setEditingColumnLabel(col.label);
  };

  const saveEditColumn = async () => {
    if (!editingColumnKey) return;

    const updated = columns.map((c) =>
      c.key === editingColumnKey
        ? { ...c, label: editingColumnLabel.trim() || c.label }
        : c
    );

    await saveColumnsToFirestore(updated);
    setEditingColumnKey(null);
    setEditingColumnLabel("");
  };

  const moveColumn = async (index, direction) => {
    setColumnMoving(true);
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= columns.length) return;

    const reordered = [...columns];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);

    await saveColumnsToFirestore(reordered);
    setColumnMoving(false);
  };

  const filteredRows = useMemo(() => {
    if (!filters.length) return rows;

    return rows.filter((row) =>
      filters.every(({ column, operator, value }) => {
        if (!value) return true;

        const cell = (row[column] ?? "").toString().toLowerCase();
        const v = value.toLowerCase();

        switch (operator) {
          case "contains":
            return cell.includes(v);
          case "ncontains":
            return cell.includes(!v);
          case "equals":
            return cell === v;
          case "startsWith":
            return cell.startsWith(v);
          case "endsWith":
            return cell.endsWith(v);
          case "gt":
            return Number(cell) > Number(v);
          case "lt":
            return Number(cell) < Number(v);
          default:
            return true;
        }
      })
    );
  }, [rows, filters]);

  const columnValueOptions = useMemo(() => {
    const map = {};

    columns.forEach((c) => {
      map[c.key] = new Set();
    });

    rows.forEach((row) => {
      columns.forEach((c) => {
        const val = row[c.key];
        if (val !== undefined && val !== null && val !== "") {
          map[c.key].add(val.toString());
        }
      });
    });

    // convert Set → sorted array
    Object.keys(map).forEach((k) => {
      map[k] = Array.from(map[k]).sort();
    });

    return map;
  }, [rows, columns]);

  useEffect(() => {
    setFilters((prev) =>
      prev.map((f) => {
        if (["Qty", "Capacity"].includes(f.column)) {
          return { ...f, operator: "equals" };
        }
        return f;
      })
    );
  }, []);

  const updateAsset = async () => {
    if (!editingRowId) return;

    const ref = doc(db, "dynamic_register_flat", editingRowId);

    const cleanData = {};
    columns.forEach((c) => {
      cleanData[c.key] = newRowForm[c.key] ?? "";
    });

    await updateDoc(ref, {
      ...cleanData,
      updatedAt: new Date(),
    });
  };

  // ---------- Firestore column load/save ----------
  const loadColumnsFromFirestore = async () => {
    try {
      const docRef = doc(db,
        "dynamic_columns",
        registerName,
        "meta",
        "columns");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.columns) && data.columns.length > 0) {
          setColumns(data.columns);
          return;
        }
      }
      setColumns([]);
    } catch (e) {
      console.error("loadColumnsFromFirestore err:", e);
      setColumns([]);
    }
  };

  const saveColumnsToFirestore = async (cols) => {
    try {
      await setDoc(doc(db,
        "dynamic_columns",
        registerName,
        "meta",
        "columns"), {
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
    const circle = (rec.Circle || rec.circle || "").toString().trim();
    const siteId = (rec.UniqueCode || rec.SiteID || rec.siteId || "").toString().trim();

    return { circle, siteId };
  };

  // ---------- nested + flat write helpers ----------
  const upsertNested = async (payload) => {
    const { circle, siteId } = getPathParts(payload);
    if (!circle || !siteId) {
      throw new Error("Missing Circle / Site ID / Equipment Doc to write nested record.");
    }
    const nestedRef = doc(db, "dynamic_register", circle, siteId, registerName);;
    await setDoc(nestedRef, {
      records: arrayUnion(payload),
      updatedAt: serverTimestamp()
    }, { merge: true });
  };

  const upsertFlat = async (payload) => {
    const { circle, siteId } = getPathParts(payload);
    if (!circle || !siteId) return;
    const flatId = `${circle}-${siteId}-${registerName}`;
    const flatRef = doc(db, "dynamic_register_flat", flatId);
    const flatPayload = {
      circle,
      siteId,
      registerName,
      data: payload,
      updatedAt: serverTimestamp(),
    };
    await setDoc(flatRef, flatPayload, { merge: true });
  };

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
    setLoadProgress({ percent: 0, total: 0, loaded: 0 });

    const unsub = onSnapshot(collection(db, "dynamic_register_flat", registerName, "data"), (snap) => {
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
      console.error(`${registerName} subscribe error:`, err);
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
    setImportProgress({
      percent: 0,
      total: 0,
      loaded: 0,
      success: 0,
      skipped: 0,
    });

    setIsPaused(false);
    setIsStopped(false);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const raw = evt.target.result;
        const isCsv = fileToImport.name.toLowerCase().endsWith(".csv");
        const wb = XLSX.read(raw, { type: isCsv ? "string" : "binary" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        let json = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

        // Normalize file headers -> map to column keys
        const fileHeaders = json.length ? Object.keys(json[0]) : [];
        const mapping = {};
        const currentCols = [...columns];
        const labelMap = {};
        currentCols.forEach((c) => {
          labelMap[normalizeHeaderKey(c.label)] = c.key;
          labelMap[normalizeHeaderKey(c.key)] = c.key; // accept key as well
        });

        // 🔁 Load existing assets_flat IDs for duplicate check
        const existingIds = new Set(rows.map(r => r.UniqueID));

        // 🔥 Firestore batch helpers (EXCEL IMPORT ONLY)
        let batch = writeBatch(db);
        let batchCount = 0;

        const BATCH_LIMIT = 500;

        const commitBatch = async () => {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;

          // let UI breathe
          await new Promise(res => setTimeout(res, 0));
        };

        for (const fh of fileHeaders) {
          const normalized = normalizeHeaderKey(fh);
          if (labelMap[normalized]) {
            mapping[fh] = labelMap[normalized];
          } else {
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

        if (currentCols.length !== columns.length) {
          await saveColumnsToFirestore(currentCols);
        }

        const total = json.length;
        let loaded = 0;
        let success = 0;
        let skipped = 0;

        // for (const row of json) {
        //   if (isStopped) {
        //     alert(`Import stopped. Imported ${success} rows so far.`);
        //     break;
        //   }

        //   while (isPaused) {
        //     await new Promise((resolve) => setTimeout(resolve, 500));
        //     if (isStopped) break;
        //   }

        //   const rec = {};
        //   for (const fh of Object.keys(row)) {
        //     let val = row[fh];

        //     // Check if it's a number that could be an Excel date serial
        //     if (typeof val === "number" && val > 30000 && val < 60000) {
        //       // Convert to JS Date using XLSX.SSF
        //       const dateObj = XLSX.SSF.parse_date_code(val);
        //       if (dateObj) {
        //         const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        //         val = `${String(dateObj.d).padStart(2, "0")}-${months[dateObj.m - 1]}-${String(dateObj.y).slice(-2)}`;
        //       }
        //     }

        //     const mappedKey = mapping[fh];
        //     if (mappedKey) rec[mappedKey] = val;
        //     else rec[fh] = val;
        //   }


        //   const payload = preparePayload(rec);
        //   loaded++;

        //   if (!payload) {
        //     skipped++;
        //     setImportProgress((prev) => ({
        //       ...prev,
        //       skipped,
        //     }));
        //     continue;
        //   }

        //   // 🔍 DUPLICATE CHECK
        //   if (existingIds.has(payload.UniqueID)) {
        //     skipped++;
        //     setImportProgress((prev) => ({
        //       ...prev,
        //       skipped,
        //     }));
        //     continue;
        //     // skip duplicate
        //   }

        //   setImportProgress({ total, loaded, percent: Math.round((loaded / total) * 100) });

        //   // if (!payload) {
        //   //   skipped++;
        //   //   setImportProgress((prev) => ({
        //   //     ...prev,
        //   //     skipped,
        //   //   }));
        //   //   continue;
        //   // }

        //   await upsertNested(payload);
        //   await upsertFlat(payload);
        //   existingIds.add(payload.UniqueID); // prevent same-file duplicates
        //   success++;
        //   setImportProgress((prev) => ({
        //     ...prev,
        //     success,
        //   }));
        // }

        for (let i = 0; i < json.length; i++) {
          if (isStopped) {
            alert(`Import stopped. Imported ${success} rows so far.`);
            break;
          }

          while (isPaused) {
            await new Promise((r) => setTimeout(r, 500));
            if (isStopped) break;
          }

          const row = json[i];
          const rec = {};

          for (const fh of Object.keys(row)) {
            let val = row[fh];

            // Excel date fix
            if (typeof val === "number" && val > 30000 && val < 60000) {
              const d = XLSX.SSF.parse_date_code(val);
              if (d) {
                const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                val = `${String(d.d).padStart(2, "0")}-${m[d.m - 1]}-${String(d.y).slice(-2)}`;
              }
            }

            const mappedKey = mapping[fh];
            if (mappedKey) rec[mappedKey] = val;
          }

          const payload = preparePayload(rec);
          loaded++;

          if (!payload) {
            skipped++;
            continue;
          }

          const circle = payload.Circle;
          const siteId = payload.UniqueCode;

          if (!circle || !siteId) {
            skipped++;
            continue;
          }

          // 🔹 MAIN REGISTER DOC
          const registerRef = doc(
            db,
            "dynamic_register",
            circle,
            siteId,
            registerName
          );

          batch.set(
            registerRef,
            {
              records: arrayUnion({
                ...payload,
                importedAt: serverTimestamp()
              })
            },
            { merge: true }
          );

          batchCount++;

          // 🔹 FLAT TABLE
          const flatId = `${circle}-${siteId}-${registerName}-${Date.now()}`;

          const flatRef = doc(
            db,
            "dynamic_register_flat",
            flatId
          );

          batch.set(
            flatRef,
            {
              circle,
              siteId,
              registerName,
              ...payload,
              importedAt: serverTimestamp()
            },
            { merge: true }
          );

          batchCount++;

          success++;

          if (batchCount >= BATCH_LIMIT) {
            await commitBatch();
          }

          if (i % 25 === 0 || i === json.length - 1) {
            setImportProgress({
              total,
              loaded,
              success,
              skipped,
              percent: Math.round((loaded / total) * 100),
            });
          }
        }

        // final commit
        if (batchCount > 0) {
          await commitBatch();
        }


        if (!isStopped) {
          alert(
            `📦 Import Completed\n\n` +
            `Total Rows: ${total}\n` +
            `✅ Added: ${success}\n` +
            `⏭ Skipped (Duplicates / Invalid): ${skipped}`
          );
        }

        setFileToImport(null);
        loaded++;

        setImportProgress((prev) => ({
          ...prev,
          total,
          loaded,
          percent: Math.round((loaded / total) * 100),
        }));

        setIsPaused(false);
        setIsStopped(false);
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
    if (!payload) {
      return alert("Please enter Circle, UniqueCode (Site ID) and Equipment Name / Dedicated No.");
    }

    try {
      const flatId = payload.UniqueID.replace(/\//g, "-");
      const ref = doc(db, "dynamic_register_flat", registerName, "data", flatId);
      const snap = await getDoc(ref);

      // 🚫 DUPLICATE FOUND
      if (snap.exists()) {
        alert("❌ Asset already exists. Duplicate entry not allowed.");
        return;
      }

      // ✅ SAFE TO ADD
      await upsertNested(payload);
      await upsertFlat(payload);

      setNewRowForm(blankForm);
      alert("✅ Asset added successfully");
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
        const nestedRef = doc(db, "dynamic_register", registerName, circle, siteId, "records", equipDoc);
        await deleteDoc(nestedRef);
      }
      // remove flat
      const flatId = (row.UniqueID || (row.id ? row.id.replace(/-/g, "/") : "")).replace(/\//g, "-");
      const flatRef = doc(db, "dynamic_register_flat", registerName, "data", flatId);
      await deleteDoc(flatRef);
    } catch (e) {
      console.error("deleteRow err:", e);
      alert("Delete failed: " + (e?.message || e));
    }
  };

  // ---------- import template download ----------
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  useEffect(() => {
    const fetchInstruction = async () => {
      const docRef = doc(db, "config", "dynamic_register_instruction");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setInstructionText(docSnap.data().text || "");
        setEditText(docSnap.data().text || "");
      }
    };
    fetchInstruction();
  }, []);

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


  const downloadDynamicImportTemplate = () => {
    if (!columns || columns.length === 0) {
      alert("Columns not loaded yet");
      return;
    }

    // 🔹 Sheet 1: Assets Import (Dynamic)
    const headerRow = columns.map((c) => c.label);

    // Optional example row (generated safely)
    const exampleRow = columns.map((c) => {
      const k = c.key.toLowerCase();

      if (k.includes("region")) return "East";
      if (k.includes("circle")) return "Odisha";
      if (k.includes("sitename")) return "BBSR-001";
      if (k.includes("uniquecode") || k.includes("site")) return "SITE001";
      if (k.includes("equipmentcategory")) return "DG";
      if (k.includes("equipmentname")) return "DG-1";
      if (k.includes("make")) return "Kirloskar";
      if (k.includes("model")) return "15KVA";
      if (k.includes("qty")) return 1;
      if (k.includes("manufacturing")) return "15-Jan-24";
      if (k.includes("installation")) return "20-Feb-24";

      return "";
    });

    const assetsSheet = XLSX.utils.aoa_to_sheet([
      headerRow,
      exampleRow,
    ]);

    // 🔹 Auto column width
    assetsSheet["!cols"] = headerRow.map((h) => ({
      wch: Math.max(18, h.length + 2),
    }));

    // 🔹 Sheet 2: Instructions (static, safe)
    const instructionsSheet = XLSX.utils.aoa_to_sheet([
      ["ASSETS IMPORT INSTRUCTIONS"],
      [],
      ["✔ Do NOT rename or remove column headers"],
      ["✔ Mandatory: Circle + UniqueCode + EquipmentNameAndNo OR DedicatedNo"],
      ["✔ Date format: DD-MMM-YY (example: 15-Jan-24)"],
      ["✔ Qty must be numeric"],
      ["✔ One row = one asset"],
      ["✔ Existing asset updates if UniqueID matches"],
    ]);

    // 🔹 Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, assetsSheet, "Assets_Import");
    XLSX.utils.book_append_sheet(wb, instructionsSheet, "Instructions");

    XLSX.writeFile(wb, `${registerName}_Import_Format.xlsx`);
  };

  const downloadFilteredExcel = () => {
    if (!filteredRows.length) {
      alert("No filtered data to download");
      return;
    }

    // Prepare header row from visible columns
    const headers = columns.map(c => c.label);

    // Prepare data rows
    const data = filteredRows.map(row =>
      columns.map(c => row[c.key] ?? row._raw?.[c.key] ?? "")
    );

    const sheetData = [headers, ...data];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Auto column width
    ws["!cols"] = headers.map(h => ({
      wch: Math.max(18, h.length + 2),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Filtered_Data");

    XLSX.writeFile(wb, "Filtered_Dynamic_Data.xlsx");
  };


  // ---------- rendering ----------
  return (
    <div className="dhr-dashboard-container" style={{ padding: 16 }}>
      {loading && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#0f172a",
              padding: "30px 40px",
              borderRadius: "12px",
              textAlign: "center",
              color: "white",
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                border: "4px solid #334155",
                borderTop: "4px solid #38bdf8",
                borderRadius: "50%",
                margin: "0 auto 15px",
                animation: "spin 1s linear infinite",
              }}
            />
            <div style={{ fontSize: "15px", fontWeight: "bold" }}>
              Fetching Assets Data…
            </div>
            <div style={{ fontSize: "12px", color: "#cbd5e1", marginTop: "4px" }}>
              Please wait
            </div>
          </div>
        </div>
      )}
      {columnMoving && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#0f172a",
              padding: "30px 40px",
              borderRadius: "12px",
              textAlign: "center",
              color: "white",
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                border: "4px solid #334155",
                borderTop: "4px solid #38bdf8",
                borderRadius: "50%",
                margin: "0 auto 15px",
                animation: "spin 1s linear infinite",
              }}
            />
            <div style={{ fontSize: "15px", fontWeight: "bold" }}>
              Moving Column…
            </div>
            <div style={{ fontSize: "12px", color: "#cbd5e1", marginTop: "4px" }}>
              Please wait
            </div>
          </div>
        </div>
      )}
      <h1 className="dashboard-header">
        <strong>
          🏷️💼 {registerName} Management
        </strong>
      </h1>

      <div className="instruction-tab">
        <h2 className="noticeboard-header">📌 Notice Board </h2>
        {/* <h3 className="dashboard-header">📘 App Overview </h3> */}
        {isEditing ? (
          <>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={5}
              className="dashboard-instruction-panel"
            />
            <div className="flex gap-2">
              <button
                className="bg-blue-600 text-white px-3 py-1 rounded"
                onClick={async () => {
                  const docRef = doc(db, "config", "assets_register_instruction");
                  await setDoc(docRef, { text: editText });
                  setInstructionText(editText);
                  setIsEditing(false);
                }}
              >
                Save
              </button>
              <button
                className="bg-gray-400 text-white px-3 py-1 rounded"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="dashboard-instruction-panel">{instructionText || "No instructions available."}</p>
            {["Admin", "Super Admin"].includes(userData?.role) && (
              <button
                className="text-blue-600 underline"
                onClick={() => setIsEditing(true)}
              >
                Edit Instruction
              </button>
            )}
          </>
        )}
        <h6 style={{ marginLeft: "90%" }}>Thanks & Regurds @Suman Adhikari</h6>
      </div>

      <div className="noticeboard-header">

        {isAdmin && (

          <div
            style={{
              marginTop: 16,
              padding: 14,
              border: "1px solid #000",
              borderRadius: 12,
              background: "#eef6ff",
            }}
          >
            <div style={{ marginTop: 16, padding: 14, border: "1px solid #000", borderRadius: 12, background: "#f0fdf4" }}>
              <h4>✏️ Rename Master Data</h4>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>

                {/* Type */}
                <select
                  value={renameMaster.type}
                  onChange={(e) =>
                    setRenameMaster({ type: e.target.value, oldValue: "", newValue: "" })
                  }
                >
                  <option value="">Select Type</option>
                  <option value="region">Region</option>
                  <option value="circle">Circle</option>
                  <option value="category">Equipment Category</option>
                  <option value="amc">AMC Partner Name</option>
                </select>

                {/* Old Value */}
                <select
                  value={renameMaster.oldValue}
                  disabled={!renameMaster.type}
                  onChange={(e) =>
                    setRenameMaster(prev => ({ ...prev, oldValue: e.target.value }))
                  }
                >
                  <option value="">Select Existing Value</option>

                  {renameMaster.type === "region" &&
                    regionOptions.map(v => <option key={v} value={v}>{v}</option>)}

                  {renameMaster.type === "circle" &&
                    circleOptions.map(v => <option key={v} value={v}>{v}</option>)}

                  {renameMaster.type === "category" &&
                    equipmentCategoryOptions.map(v => <option key={v} value={v}>{v}</option>)}

                  {renameMaster.type === "amc" &&
                    amcPartnerOptions.map(v => <option key={v} value={v}>{v}</option>)}
                </select>

                {/* New Value */}
                <input
                  placeholder="New Value"
                  value={renameMaster.newValue}
                  onChange={(e) =>
                    setRenameMaster(prev => ({ ...prev, newValue: e.target.value }))
                  }
                />

                <button className="btn-warning" onClick={renameMasterValue} disabled={renamingMaster}>
                  {renamingMaster ? "Renaming..." : "Rename"}
                </button>
              </div>

              {renamingMaster && renameMasterProgress.total > 0 && (

                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, color: "blueviolet" }}>
                    ⏳ {renameMasterProgress.completed} / {renameMasterProgress.total}
                  </div>

                  <div style={{ background: "#e5e7eb", height: 8, borderRadius: 6 }}>
                    <div
                      style={{
                        background: "#22c55e",
                        height: "100%",
                        width: `${Math.round(
                          (renameMasterProgress.completed / renameMasterProgress.total) * 100
                        )}%`,
                      }}
                    />
                  </div>

                  <div style={{ fontSize: 12, marginTop: 4, color: "blueviolet" }}>
                    ⚡ Speed: <b>{speed}</b> records/sec
                    ⏱ ETA: <b>{remaining}</b> sec
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    {!renameControl.paused ? (
                      <button
                        className="btn-warning"
                        onClick={() =>
                          setRenameControl(p => ({ ...p, paused: true }))
                        }
                      >
                        ⏸ Pause
                      </button>
                    ) : (
                      <button
                        className="btn-primary"
                        onClick={() =>
                          setRenameControl(p => ({ ...p, paused: false }))
                        }
                      >
                        ▶ Resume
                      </button>
                    )}

                    <button
                      className="btn-danger"
                      onClick={() =>
                        setRenameControl(p => ({ ...p, cancelled: true }))
                      }
                    >
                      ⛔ Cancel
                    </button>
                  </div>
                </div>
              )}

            </div>
            <h4>✏️ Rename Site Name</h4>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
                gap: 10,
              }}
            >
              {/* Circle */}
              <select
                value={renameSite.circle}
                onChange={(e) =>
                  setRenameSite({
                    circle: e.target.value,
                    siteId: "",
                    currentSiteName: "",
                    newSiteName: "",
                  })
                }
              >
                <option value="">Select Circle</option>
                {circleOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Site ID */}
              <select
                value={renameSite.siteId}
                disabled={!renameSite.circle}
                onChange={(e) =>
                  setRenameSite(prev => ({
                    ...prev,
                    siteId: e.target.value,
                    currentSiteName: "",
                    newSiteName: "",
                  }))
                }
              >
                <option value="">Select Site ID</option>
                {siteIdOptions.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Current Site Name */}
              <select
                value={renameSite.currentSiteName}
                disabled={!renameSite.siteId}
                onChange={(e) =>
                  setRenameSite(prev => ({
                    ...prev,
                    currentSiteName: e.target.value,
                  }))
                }
              >
                <option value="">Current Site Name</option>
                {siteNameOptions.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>

              {/* New Site Name */}
              <input
                placeholder="New Site Name"
                value={renameSite.newSiteName}
                onChange={(e) =>
                  setRenameSite(prev => ({
                    ...prev,
                    newSiteName: e.target.value,
                  }))
                }
              />

              <button
                className="btn-warning"
                disabled={renaming}
                onClick={renameSiteName}
              >
                {renaming ? "Renaming..." : "Rename Site"}
              </button>
            </div>
            {renaming && renameProgress.total > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13, color: "blueviolet" }}>
                  ⏳ {renameProgress.completed} / {renameProgress.total}
                </div>

                <div style={{ background: "#e5e7eb", height: 8, borderRadius: 6 }}>
                  <div
                    style={{
                      background: "#22c55e",
                      height: "100%",
                      width: `${Math.round(
                        (renameProgress.completed / renameProgress.total) * 100
                      )}%`,
                    }}
                  />
                </div>

                <div style={{ fontSize: 12, marginTop: 6, color: "blueviolet" }}>
                  ⚡ <b>{speed}</b> records/sec &nbsp; | &nbsp;
                  ⏱ ETA: <b>{remaining}</b> sec
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  {!renameControl.paused ? (
                    <button
                      className="btn-warning"
                      onClick={() =>
                        setRenameControl(p => ({ ...p, paused: true }))
                      }
                    >
                      ⏸ Pause
                    </button>
                  ) : (
                    <button
                      className="btn-primary"
                      onClick={() =>
                        setRenameControl(p => ({ ...p, paused: false }))
                      }
                    >
                      ▶ Resume
                    </button>
                  )}

                  <button
                    className="btn-danger"
                    onClick={() =>
                      setRenameControl(p => ({ ...p, cancelled: true }))
                    }
                  >
                    ⛔ Cancel
                  </button>
                </div>
              </div>
            )}

          </div>
        )}


        {/* Column management */}
        {isAdmin && (
          <div style={{ marginBottom: 12, border: "1px solid #fff", borderRadius: "5px", padding: "5px 5px", background: "#5b7d88d8" }}>
            <h3 style={{ color: "white" }} >Add Columns</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", border: "1px solid #fff", borderRadius: "5px", maxHeight: "250px", overflowY: "auto", padding: "5px 3px" }}>
              {columns.map((c, i) => (
                <div key={c.key} style={{ gap: 6, border: "1px solid #131212", borderRadius: "4px", background: "rgb(247, 247, 247)", color: "white", padding: "3px 4px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <p
                      className="btn-small"
                      disabled={i === 0}
                      onClick={() => moveColumn(i, -1)}
                      style={{ cursor: "pointer", }}
                    >
                      ⬆️
                    </p>
                    {editingColumnKey === c.key ? (
                      <>
                        <input
                          value={editingColumnLabel}
                          onChange={(e) => setEditingColumnLabel(e.target.value)}
                          style={{ width: 140 }}
                        />
                        <p className="btn-success btn-small" onClick={saveEditColumn}>✔</p>
                        <p
                          // className="btn-secondary btn-small"
                          onClick={() => setEditingColumnKey(null)}
                          style={{ cursor: "pointer" }}
                        >
                          ✕
                        </p>
                      </>
                    ) : (
                      <>
                        <strong style={{ color: "black" }}>({i + 1}) {c.label}</strong>
                        <p
                          // className="btn-primary btn-small"
                          onClick={() => startEditColumn(c)}
                          style={{ cursor: "pointer" }}
                        >
                          ✏️
                        </p>
                        <p
                          // className="btn-danger btn-small"
                          onClick={() => handleDeleteColumn(c.key)}
                          style={{ cursor: "pointer" }}
                        >
                          🗑
                        </p>
                      </>
                    )}
                    <p
                      className="btn-small"
                      disabled={i === columns.length - 1}
                      onClick={() => moveColumn(i, 1)}
                      style={{ cursor: "pointer" }}
                    >
                      ⬇️
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "5px 5px", marginTop: "10px" }}>
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
          <div className="child-container" style={{ border: "1px solid #000", borderRadius: "15px", padding: "2px 5px" }}>
            <p style={{ color: 'white', padding: "0px 4px", gap: 6 }}>Download Template:
              <b
                onClick={downloadDynamicImportTemplate}
                style={{ textDecoration: "underline", color: "blue", cursor: "pointer" }}
              >
                ⬇️ Download Import Format
              </b>
            </p>

            <label style={{ display: "block", marginBottom: 6 }}>Import Excel/CSV</label>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
            <button className="btn-success" onClick={importFileToFirestore} disabled={!fileToImport}>Import</button>
            {importProgress.total > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <span><b>Processed:</b> {importProgress.loaded}/{importProgress.total}</span>
                    <span style={{ color: "green" }}><b>✅ Added:</b> {importProgress.success}</span>
                    <span style={{ color: "orange" }}><b>⏭ Skipped:</b> {importProgress.skipped}</span>
                    <strong>{importProgress.percent}%</strong>
                  </div>
                  <strong>{importProgress.percent}%</strong>
                </div>
                <div style={{ background: "#eee", height: 8, width: "100%", borderRadius: 4, marginBottom: 8 }}>
                  <div style={{ background: "#1976d2", width: `${importProgress.percent}%`, height: 8, borderRadius: 4 }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {!isPaused ? (
                    <button className="btn-warning" onClick={() => setIsPaused(true)}>Pause</button>
                  ) : (
                    <button className="btn-primary" onClick={() => setIsPaused(false)}>Resume</button>
                  )}
                  <button className="btn-danger" onClick={() => setIsStopped(true)}>Stop</button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Quick add */}
      {(isAdmin) && (
        <div style={{ marginBottom: 16 }}>
          {(isAdmin || userRole === "Super User") && (
            <button
              className="btn-success"
              onClick={() => {
                setModalMode("add");
                setNewRowForm(blankForm);
                setShowAddAssetModal(true);
              }}
            >
              ➕💼 Add New {registerName}
            </button>
          )}

          {showAddAssetModal && (
            <div className="modal-overlay">
              <div className="modal-box">

                {/* Header */}
                <div className="modal-header">
                  <h3>
                    {modalMode === "add" ? `➕💼 Add New ${registerName}` : `✏️ Edit ${registerName}`}
                  </h3>
                  <button
                    className="modal-close"
                    onClick={() => setShowAddAssetModal(false)}
                  >
                    ✕
                  </button>
                </div>

                {/* Body */}
                <div className="modal-body">
                  <div
                    className="form-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
                      gap: 10,
                    }}
                  >
                    {columns.map((c) => (
                      <div key={c.key}>
                        <label style={{ fontSize: 12 }}>{c.label}</label>
                        <input
                          value={newRowForm[c.key] ?? ""}
                          onChange={(e) =>
                            setNewRowForm({
                              ...newRowForm,
                              [c.key]: e.target.value,
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="modal-footer">
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setNewRowForm(blankForm);
                      setShowAddAssetModal(false);
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    className="btn-success"
                    onClick={async () => {
                      if (modalMode === "add") {
                        await addNewRow();
                      } else {
                        await updateAsset();
                      }
                      setShowAddAssetModal(false);
                    }}
                  >
                    {modalMode === "add" ? `Add New ${registerName}` : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* <h4><strong>➕💼 Add New Asset</strong></h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
            {columns.map((c) => (
              <div key={c.key}>
                <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>{c.label}</label>
                <input value={newRowForm[c.key] ?? ""} onChange={(e) => setNewRowForm({ ...newRowForm, [c.key]: e.target.value })} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>➕<button className="btn-success" onClick={addNewRow}>Add</button></div> */}
        </div>
      )}

      {/* 🔍 Advanced Filter */}
      <div style={{ marginBottom: 12, background: "#f9fafb", padding: 10, borderRadius: 6 }}>
        <h4><strong>🔍 Advanced Filters</strong></h4>

        {filters.map((f, index) => (
          <div key={index} style={{ display: "flex", gap: 8, marginBottom: 6 }}>

            {/* Column */}
            <select
              value={f.column}
              onChange={(e) => {
                const copy = [...filters];
                copy[index].column = e.target.value;
                setFilters(copy);
              }}
            >
              {columns.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>

            {/* Operator */}
            <select
              value={f.operator}
              onChange={(e) => {
                const copy = [...filters];
                copy[index].operator = e.target.value;
                setFilters(copy);
              }}
            >
              {Object.entries(OPERATORS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            {/* Value input + dropdown */}
            <div style={{ display: "flex", gap: 4 }}>
              <input
                placeholder="Type value"
                value={f.value}
                onChange={(e) => {
                  const copy = [...filters];
                  copy[index].value = e.target.value;
                  setFilters(copy);
                }}
                style={{ flex: 1 }}
              />

              <select
                defaultValue=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;

                  const copy = [...filters];
                  copy[index].value = val;
                  setFilters(copy);

                  // 🔥 reset dropdown back to "▼ Select"
                  e.target.value = "";
                }}
                style={{ maxWidth: 120 }}
              >
                <option value="">▼ Select</option>
                {(columnValueOptions[f.column] || []).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>


            {/* Value */}
            {/* <input
              placeholder="Value"
              value={f.value}
              onChange={(e) => {
                const copy = [...filters];
                copy[index].value = e.target.value;
                setFilters(copy);
              }}
            /> */}

            {/* Remove */}
            <button
              className="btn-danger"
              onClick={() => setFilters(filters.filter((_, i) => i !== index))}
            >
              ✕
            </button>
          </div>
        ))}

        <button
          className="btn-primary"
          onClick={() => setFilters([...filters, { column: columns[0]?.key, operator: "contains", value: "" }])}
        >
          + Add Filter
        </button>

        <button
          className="btn-secondary"
          style={{ marginLeft: 8 }}
          onClick={() => setFilters([])}
        >
          Clear All
        </button>
      </div>

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
            <strong>📦 Loaded :</strong>
            <span>{filteredRows.length} item{rows.length === 1 ? "" : "s"}</span>
            {filteredRows.length > 0 && (
              <button
                onClick={downloadFilteredExcel}
                className="daily-activity-btn"
                style={{ background: "#16a34a", color: "#fff", marginLeft: 8 }}
              >
                ⬇ Download {registerName} Data
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      {isAdmin && (
        <div style={{ overflowX: "auto", overflowY: "auto", height: "700px" }}>
          <h4><strong>💼 {registerName} Data</strong></h4>
          {!loading && (
            <table className="dhr-table" style={{ width: "100%", minWidth: 900 }}>
              <thead>
                <tr>
                  {columns.map((c) => <th key={c.key}>{c.label}</th>)}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    {columns.map((col) => (
                      <td key={col.key} onClick={() => isAdmin ? openEditModal(row) : ""} style={{ cursor: "pointer" }}>
                        {row[col.key] ?? row._raw?.[col.key] ?? ""}
                      </td>
                    ))}
                    <td>

                      <>
                        {/* {(isAdmin || (userData?.role === "Super User" && (row.UniqueCode || row.SiteName) === userData.site)) && (
                            <button className="btn-primary" onClick={() => openEditModal(row)}>Edit</button>
                          )} */}
                        {(isAdmin || (userData?.role === "Super User" && (row.UniqueCode || row.SiteName) === userData.site)) && (
                          <button className="btn-danger" onClick={() => deleteRow(row)}>Delete</button>
                        )}
                      </>

                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
