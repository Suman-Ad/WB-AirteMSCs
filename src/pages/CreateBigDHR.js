import React, { useEffect, useState } from "react";
import { db } from "../firebase"; // Ensure correct path
import { doc, setDoc, getDoc } from "firebase/firestore";
import fieldConfig from "../config/fieldConfig"; // Make sure this exports correctly
import "../assets/CreateBigDHR.css"; // Ensure you have the correct CSS file

const CreateBigDHR = ({ userData }) => {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    const fetchInstruction = async () => {
      const docRef = doc(db, "config", "create_bigdhr_instruction");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setInstructionText(docSnap.data().text || "");
        setEditText(docSnap.data().text || "");
      }
    };
    fetchInstruction();
  }, []);

  // Fetch existing data or initialize
  useEffect(() => {
    const fetchData = async () => {
      try {
        const docRef = doc(db, "BigDHR", userData.site);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setFormData(docSnap.data());
        } else {
          // Initialize formData from fieldConfig
          const initialData = {};
          fieldConfig.forEach((field) => {
            if (field.fixed) {
              initialData[field.name] = field.fixed[userData.site] || "";
            } else if (field.formula) {
              initialData[field.name] = ""; // Calculated later
            } else {
              initialData[field.name] = "";
            }
          });
          setFormData(initialData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userData.site]);

  // Handle input changes
  const handleChange = (fieldName, value) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  // Apply formula fields
  const applyFormulas = (data) => {
    const updatedData = { ...data };
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
  };

  // Save to Firestore
  const handleSave = async () => {
    setSaving(true);
    try {
      const finalData = applyFormulas(formData);
      await setDoc(doc(db, "BigDHR", userData.site), {
        ...finalData,
        site: userData.site,
        circle: userData.circle,
        region: userData.region,
        siteId: userData.siteId,
        updatedAt: new Date().toISOString(),
      });
      alert("Data saved successfully!");
    } catch (error) {
      console.error("Error saving data:", error);
      alert("Error saving data.");
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
                  const docRef = doc(db, "config", "create_bigdhr_instruction");
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
            <p className="dashboard-instruction-panel">
              {instructionText || "No instructions available."}
            </p>
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
      <p>
        <strong>Circle:</strong> {userData.circle}
      </p>
      <p>
        <strong>Site:</strong> {userData.site}
      </p>

      <div style={{ overflowX: "auto", width: "100%", overflowY: "auto", maxHeight: "calc(100vh - 200px)" }}>
        <table className="table-auto border-collapse border border-gray-300 w-full">
          <thead>
            <tr>
              <th className="border p-2">DESCRIPTIONS</th>
              <th className="border p-2">{userData.site}</th>
            </tr>
          </thead>
          <tbody>
            {fieldConfig.map((field, index) => (
              <tr key={index}>
                <td className="border p-2">{field.name}</td>
                <td className="border p-2">
                  {field.fixed && field.fixed[userData.site] ? (
                    <input
                      type="text"
                      value={field.fixed[userData.site]}
                      disabled
                      className="w-full p-1 bg-gray-100"
                    />
                  ) : field.formula ? (
                    <input
                      type="text"
                      value={formData[field.name] || ""}
                      disabled
                      className="w-full p-1 bg-gray-100"
                    />
                  ) : (
                    <input
                      type={field.type || "text"}
                      value={formData[field.name] || ""}
                      onChange={(e) =>
                        handleChange(field.name, e.target.value)
                      }
                      className="w-full p-1 border rounded"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
};

export default CreateBigDHR;
