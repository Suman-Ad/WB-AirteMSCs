import React, { useEffect, useState, useMemo } from "react";
import { db } from "../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import fieldConfig from "../config/fieldConfig";
import "../assets/CreateBigDHR.css";
import { color } from "framer-motion";

const CreateBigDHR = ({ userData }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [formData, setFormData] = useState({ ebReadings: [], dgReadings: [], dgKwhReadings: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");

  const toTwo = (s) => String(s ?? "").padStart(2, "0");
  const formatToHHMMSS = (val) => {
    if (!val) return "";
    const parts = String(val).split(":");
    if (parts.length === 2) return `${toTwo(parts[0])}:${toTwo(parts[1])}:00`;
    if (parts.length === 3) return `${toTwo(parts[0])}:${toTwo(parts[1])}:${toTwo(parts[2])}`;
    return "";
  };
  const normalizeTime = (val) => formatToHHMMSS(val);

  const ensureRows = (arr, count) => {
    const result = Array.isArray(arr) ? [...arr] : [];
    while (result.length < count) {
      result.push({ open: "", close: "" });
    }
    return result;
  };

  const buildRowsFromPrev = (prevData = {}, prefix, maxCount) => {
    const rows = [];
    for (let i = 1; i <= maxCount; i++) {
      const openKey = `${prefix}${i} OPENING READING`;
      const closeKey = `${prefix}${i} CLOSING READING`;
      if (prevData[openKey] !== undefined || prevData[closeKey] !== undefined) {
        const prevClose = prevData[closeKey] ?? prevData[openKey] ?? "";
        rows.push({ open: prevClose, close: "" });
      }
    }
    return rows;
  };

  const displayData = useMemo(() => {
    const base = { ...formData, site: userData?.site || "" };
    const updatedData = { ...base };
    fieldConfig.forEach((field) => {
      if (field.formula) {
        try {
          updatedData[field.name] = field.formula(updatedData);
        } catch (err) {
          console.warn(`Error calculating formula for ${field.name}`, err);
        }
      }
    });
    return updatedData;
  }, [formData, userData?.site]);

  useEffect(() => {
    const fetchInstruction = async () => {
      try {
        const docRef = doc(db, "config", "create_bigdhr_instruction");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setInstructionText(docSnap.data().text || "");
          setEditText(docSnap.data().text || "");
        }
      } catch (err) {
        console.error("Error fetching instructions:", err);
      }
    };
    fetchInstruction();
  }, []);

  useEffect(() => {
    const fetchDataForDate = async () => {
      setLoading(true);
      try {
        const yesterdayISO = new Date(new Date(selectedDate).getTime() - 86400000)
          .toISOString()
          .slice(0, 10);

        const docRef = doc(db, "BigDHR", selectedDate, "sites", userData.site);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            ...data,
            ebReadings: ensureRows(data.ebReadings || [], 2),
            dgReadings: ensureRows(data.dgReadings || [], 2),
            dgKwhReadings: ensureRows(data.dgKwhReadings || [], 2),
          });
        } else {
          const yDocRef = doc(db, "BigDHR", yesterdayISO, "sites", userData.site);
          const yDocSnap = await getDoc(yDocRef);

          let defaultEB = ensureRows([], 2);
          let defaultDG = ensureRows([], 2);
          let defaultKWH = ensureRows([], 2);

          if (yDocSnap.exists()) {
            const prevData = yDocSnap.data();
            const ebRows = buildRowsFromPrev(prevData, "EB", 11);
            const dgRows = buildRowsFromPrev(prevData, "DG ", 4); // Note space after DG for Run HRS keys
            const kwhRows = buildRowsFromPrev(prevData, "DG", 4);

            if (ebRows.length > 0) defaultEB = ensureRows(ebRows, 2);
            if (dgRows.length > 0) defaultDG = ensureRows(dgRows, 2);
            if (kwhRows.length > 0) defaultKWH = ensureRows(kwhRows, 2);
          }

          setFormData({
            ebReadings: defaultEB,
            dgReadings: defaultDG,
            dgKwhReadings: defaultKWH,
          });
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setFormData({
          ebReadings: ensureRows([], 2),
          dgReadings: ensureRows([], 2),
          dgKwhReadings: ensureRows([], 2),
        });
      }
      setLoading(false);
    };

    if (userData?.site) fetchDataForDate();
  }, [selectedDate, userData?.site]);

  const handleChange = (fieldName, value) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const finalData = { ...formData, site: userData.site || "" };

      if (Array.isArray(finalData.ebReadings)) {
        finalData.ebReadings.forEach((r, idx) => {
          const i = idx + 1;
          finalData[`EB${i} READING OPENIN`] = r.open ?? "";
          finalData[`EB${i} READING CLOSING`] = r.close ?? "";
        });
      }

      if (Array.isArray(finalData.dgReadings)) {
        finalData.dgReadings.forEach((r, idx) => {
          const i = idx + 1;
          finalData[`DG ${i} Run HRS -Opening Reading`] = r.open ?? "";
          finalData[`DG ${i} Run HRS -Closing Reading`] = r.close ?? "";
        });
      }

      if (Array.isArray(finalData.dgKwhReadings)) {
        finalData.dgKwhReadings.forEach((r, idx) => {
          const i = idx + 1;
          finalData[`DG${i} KWH OPENING READING`] = r.open ?? "";
          finalData[`DG${i} KWH CLOSING READING`] = r.close ?? "";
        });
      }

      if (finalData["Power Failure Hrs/Mins"]) {
        finalData["Power Failure Hrs/Mins"] = formatToHHMMSS(finalData["Power Failure Hrs/Mins"]);
      }

      fieldConfig.forEach((field) => {
        if (field.formula) {
          try {
            finalData[field.name] = field.formula(finalData);
          } catch (err) {
            console.warn(`Error calculating formula for ${field.name}`, err);
          }
        }
      });

      const docRef = doc(db, "BigDHR", selectedDate, "sites", userData.site);
      await setDoc(docRef, finalData, { merge: true });

      setFormData((prev) => ({ ...finalData }));
      alert("Data saved successfully!");
    } catch (err) {
      console.error("Error saving Big DHR:", err);
      alert("Error saving data!");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="dhr-dashboard-container">
      <h2 className="dashboard-header"><strong>☣️ Create Big DHR</strong></h2>

      {/* Notice Board */}
      <div className="instruction-tab">
        <h2 className="dashboard-header">📌 Notice Board </h2>
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
                  const docRef = doc(db, "config", "create_bigdhr_instruction");
                  await setDoc(docRef, { text: editText }, { merge: true });
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
        <h6 style={{ marginLeft: "90%" }}>Thanks & Regards @Suman Adhikari</h6>
      </div>

      <div className="mb-4">
        <label className="font-bold mr-2">Select Date:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border p-1 rounded"
        />
      </div>
      <div className="child-container" style={{ overflowY: "auto", maxHeight: "80vh", paddingRight: "10px" }}>
        {/* EB Readings */}
        <h3 className="mt-4 font-bold">EB Readings (Open / Close)</h3>
        {formData.ebReadings.map((row, idx) => (
          <div key={idx} className="flex gap-2 mb-2">
            <input
              type="number"
              placeholder={`EB${idx + 1} OPENING`}
              value={row.open}
              onChange={(e) => {
                const updated = [...formData.ebReadings];
                updated[idx].open = e.target.value;
                setFormData((prev) => ({ ...prev, ebReadings: updated }));
              }}
              className="border p-1 rounded w-1/2"
            />
            <input
              type="number"
              placeholder={`EB${idx + 1} CLOSING`}
              value={row.close}
              onChange={(e) => {
                const updated = [...formData.ebReadings];
                updated[idx].close = e.target.value;
                setFormData((prev) => ({ ...prev, ebReadings: updated }));
              }}
              className="border p-1 rounded w-1/2"
            />
          </div>
        ))}
        <button
          className="bg-blue-500 text-white px-2 py-1 rounded mb-4"
          onClick={() => setFormData((prev) => ({ ...prev, ebReadings: [...prev.ebReadings, { open: "", close: "" }] }))}
        >
          + Add EB Reading
        </button>

        {/* DG KWH Readings */}
        <h3 className="mt-4 font-bold">DG KWH Readings (Open / Close)</h3>
        {formData.dgKwhReadings.map((row, idx) => (
          <div key={idx} className="flex gap-2 mb-2">
            <input
              type="number"
              placeholder={`DG${idx + 1} KWH OPENING`}
              value={row.open}
              onChange={(e) => {
                const updated = [...formData.dgKwhReadings];
                updated[idx].open = e.target.value;
                setFormData((prev) => ({ ...prev, dgKwhReadings: updated }));
              }}
              className="border p-1 rounded w-1/2"
            />
            <input
              type="number"
              placeholder={`DG${idx + 1} KWH CLOSING`}
              value={row.close}
              onChange={(e) => {
                const updated = [...formData.dgKwhReadings];
                updated[idx].close = e.target.value;
                setFormData((prev) => ({ ...prev, dgKwhReadings: updated }));
              }}
              className="border p-1 rounded w-1/2"
            />
          </div>
        ))}
        <button
          className="bg-indigo-500 text-white px-2 py-1 rounded mb-4"
          onClick={() => setFormData((prev) => ({ ...prev, dgKwhReadings: [...prev.dgKwhReadings, { open: "", close: "" }] }))}
        >
          + Add DG KWH Reading
        </button>

        {/* DG Run Hours */}
        <h3 className="mt-4 font-bold">DG Run Hours (Open / Close)</h3>
        {formData.dgReadings.map((row, idx) => (
          <div key={idx} className="flex gap-2 mb-2">
            <input
              type="number"
              placeholder={`DG${idx + 1} RUN HRS OPENING`}
              value={row.open}
              onChange={(e) => {
                const updated = [...formData.dgReadings];
                updated[idx].open = e.target.value;
                setFormData((prev) => ({ ...prev, dgReadings: updated }));
              }}
              className="border p-1 rounded w-1/2"
            />
            <input
              type="number"
              placeholder={`DG${idx + 1} RUN HRS CLOSING`}
              value={row.close}
              onChange={(e) => {
                const updated = [...formData.dgReadings];
                updated[idx].close = e.target.value;
                setFormData((prev) => ({ ...prev, dgReadings: updated }));
              }}
              className="border p-1 rounded w-1/2"
            />
          </div>
        ))}
        <button
          className="bg-green-500 text-white px-2 py-1 rounded mb-4"
          onClick={() => setFormData((prev) => ({ ...prev, dgReadings: [...prev.dgReadings, { open: "", close: "" }] }))}
        >
          + Add DG Reading
        </button>

        {/* Dynamic fields */}
        <table className="w-full border">
          <thead>
            <tr>
              <th className="border px-2">Description Core Value</th>
              <th className="border px-2">{userData?.site}</th>
            </tr>
          </thead>
          <tbody>
            {fieldConfig.map((field, index) => (
              <tr key={index}>
                <td className="border px-2">{field.name}</td>
                <td className="border px-2">
                  {field.fixed && field.fixed[userData.site] ? (
                    <input value={field.fixed[userData.site]} disabled className="w-full p-1 bg-gray-100"
                      style={{color:"purple", fontWeight: "bold"}}
                    
                    />
                  ) : field.formula ? (
                    <input value={displayData[field.name] || ""} disabled className="w-full p-1 bg-gray-100" style={{color:"blue", fontWeight: "bold"}}/>
                  ) : field.type === "select" ? (
                    <select
                      value={formData[field.name] || ""}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      className="w-full p-1 border rounded"
                      style={{color: formData[field.name] === "YES" ? "green" : formData[field.name] === "NO" ? "red" : "black"}}
                    >
                      <option value="">Select</option>
                      {(field.options || []).map((opt, idx) => (
                        <option key={idx} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      value={formData[field.name] || ""}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      className="w-full p-1 border rounded"
                    />
                  ) : field.type === "time" ? (
                    <input
                      type="time"
                      step="1"
                      min="00:00:00"
                      max="23:59:59"
                      value={formatToHHMMSS(formData[field.name])}
                      onChange={(e) =>
                        handleChange(field.name, normalizeTime(e.target.value))
                      }
                      className="w-full p-1 border rounded"
                      style={{fontWeight: "bold", color: "cyan"}}
                    />
                  ) : (
                    <input
                      type={field.type || "text"}
                      value={formData[field.name] || ""}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      className="w-full p-1 border rounded"
                      style={{fontWeight: "bold", color: field.type === "number" ? "orange" : "black"}}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        
      </div>
      <div className="mt-4 flex gap-3">
        <button onClick={handleSave} disabled={saving} className="pm-manage-btn">
          {saving ? "Saving..." : "Save Data"}
        </button>
      </div>
    </div>
  );
};

export default CreateBigDHR;
