// src/pages/SiteConfigEdit.js
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import "../assets/SiteConfigEdit.css"

const SiteConfigEdit = ({ userData }) => {
  const siteKey = userData?.site?.toUpperCase();
  const [config, setConfig] = useState({
    securityTeam: []  // NEW
  });
  const storage = getStorage();
  const [activeSection, setActiveSection] = useState("ccms");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      if (!siteKey) return;
      const snap = await getDoc(doc(db, "siteConfigs", siteKey));
      if (snap.exists()) {
        setConfig(snap.data());
      }
    };

    if (userData?.site) {
      setConfig((prev) => ({
        ...prev,
        siteName: userData.site.toUpperCase()
      }));
    }
    fetchConfig();
  }, [siteKey, userData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig((prev) => ({ ...prev, [name]: value }));
  };

  // 🔹 Handle Signature Upload
  const handleFileUpload = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const storageRef = ref(storage, `signatures/${siteKey}/${fieldName}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      setConfig((prev) => ({ ...prev, [fieldName]: url }));

      alert(`${fieldName} uploaded successfully!`);
    } catch (err) {
      console.error("Error uploading file:", err);
    }
  };

  const saveConfig = async () => {
    setSaving(true);

    // Auto-insert siteName into config before saving
    const updatedConfig = {
      ...config,
      siteName: config.siteName || userData?.site?.toUpperCase()
    };

    await setDoc(doc(db, "siteConfigs", siteKey), updatedConfig, { merge: true });
    alert("Config updated!");
    setSaving(false);
    window.location.reload(); // Reload to reflect changes
  };

  const sections = [
    { key: "overview", label: "Overview" },
    { key: "ccms", label: "CCMS / HSD Details" },
    { key: "equipment", label: "Site Equipment Details" },
    { key: "dhr", label: "DHR Status" },
    { key: "oem", label: "Quarterly OEM CPH" },
  ];

  // ADD NEW SECURITY ENTRY
  const addSecurity = () => {
    setConfig(prev => ({
      ...prev,
      securityTeam: [
        ...(prev.securityTeam || []),
        { id: Date.now(), name: "", role: "", signUrl: "" }
      ]
    }));
  };

  // UPDATE SECURITY FIELD
  const updateSecurity = (id, field, value) => {
    setConfig(prev => ({
      ...prev,
      securityTeam: prev.securityTeam.map(sec =>
        sec.id === id ? { ...sec, [field]: value } : sec
      )
    }));
  };

  // DELETE SECURITY ENTRY
  const deleteSecurity = (id) => {
    setConfig(prev => ({
      ...prev,
      securityTeam: prev.securityTeam.filter(sec => sec.id !== id)
    }));
  };

  // SIGNATURE UPLOAD FOR SECURITY
  const uploadSecuritySign = async (e, id) => {
    const file = e.target.files[0];
    if (!file) return;

    const storageRef = ref(storage, `signatures/${siteKey}/security/${id}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    updateSecurity(id, "signUrl", url);

    alert("Security Signature Uploaded!");
  };



  return (
    <div className="daily-log-container">
      <div style={{ display: "flex" }}>
        <h2 style={{ textAlign: "center" }}>⚙️ Site Settlings – {siteKey}</h2>
        <button onClick={saveConfig} className="config-btn">{saving ? "Saving...." : "Save Config"}</button>
      </div>
      <div className="config-layout">

        {/* LEFT SIDE MENU */}
        <div className="side-menu">
          {sections.map((s) => (
            <button
              key={s.key}
              className={`menu-item ${activeSection === s.key ? "active" : ""}`}
              onClick={() => setActiveSection(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* RIGHT SIDE CONTENT */}
        <div className="config-content">
          {activeSection === "overview" && (
            <div className="chart-container">
              <h1>Site Details</h1>
              <label>Site Address</label>
              <input
                type="text"
                name="address"
                value={config.address || "Address not set"}
                onChange={handleChange}
              />
              <label>Ownership</label>
              <select name="ownership" value={config.ownership || ""} onChange={handleChange}>
                <option value="">Select Ownership</option>
                <option value="Owned">Owned</option>
                <option value="Leased">Leased</option>
                <option value="Rental">Rental</option>
              </select>
              <label>Factory</label>  
              <select name="factory" value={config.factory || ""} onChange={handleChange}>
                <option value="">Select Factory</option>
                <option value="MNG">MNG</option>
                <option value="TNG">TNG</option>
              </select>
              <label>Running PF</label>
              <input
                type="number"
                step="0.01"
                name="pf"
                value={config.pf || ""}
                onChange={handleChange}
              />
            </div>
          )}
          {activeSection === "ccms" && (
            <div className="chart-container">
              <h1>CCMS/HSD Details</h1>
              <label>Circle Name</label>
              <input
                name="circleName"
                value={config.circleName || ""}
                onChange={handleChange}
              />

              <label>Site Name</label>
              <input
                name="siteName"
                value={config.siteName || userData?.site?.toUpperCase()}
                disabled
              />

              <label>Location</label>
              <input
                name="location"
                value={config.location || ""}
                onChange={handleChange}
              />

              <label>Supplier Code</label>
              <input
                name="supplierCode"
                value={config.supplierCode || ""}
                onChange={handleChange}
              />

              <label>Supplier Name</label>
              <input
                name="supplierName"
                value={config.supplierName || ""}
                onChange={handleChange}
              />

              <label>Supplier Site Name</label>
              <input
                name="supplierSiteName"
                value={config.supplierSiteName || ""}
                onChange={handleChange}
              />

              <label>Site ID</label>
              <input
                name="siteId"
                value={config.siteId || ""}
                onChange={handleChange}
              />

              <label>Department Name</label>
              <input
                name="department"
                value={config.department || ""}
                onChange={handleChange}
              />

              <label>Vendor Name</label>
              <input
                name="vendorShortName"
                value={config.vendorShortName || ""}
                onChange={handleChange}
              />

              <label>Budget Code</label>
              <input
                name="budgetCode"
                value={config.budgetCode || ""}
                onChange={handleChange}
              />

              <label>GPN</label>
              <input
                name="gpn"
                value={config.gpn || ""}
                onChange={handleChange}
              />

              <label>GPR Sharing</label>
              <input
                name="gprSharing"
                value={config.gprSharing || ""}
                onChange={handleChange}
              />

              <label>Site Infra Manager Name</label>
              <input
                type="text"
                name="sim"
                value={config.sim || ""}
                onChange={handleChange}
              />

              <label>Upload SIM Sign</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, "managerSign")}
              />
              {config.managerSign && (
                <img
                  src={config.managerSign}
                  alt="Prepared By Sign"
                  style={{ width: "150px", marginTop: "5px" }}
                />
              )}

              <label>Prepared By</label>
              <input
                name="preparedBy"
                value={config.preparedBy || ""}
                onChange={handleChange}
              />

              <label>Role</label>
              <input
                name="preparedByRole"
                value={config.preparedByRole || ""}
                onChange={handleChange}
              />

              <label>Upload Sign</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, "preparedBySign")}
              />
              {config.preparedBySign && (
                <img
                  src={config.preparedBySign}
                  alt="Prepared By Sign"
                  style={{ width: "150px", marginTop: "5px" }}
                />
              )}

              <label>Authorized By</label>
              <input
                name="authorizedBy"
                value={config.authorizedBy || ""}
                onChange={handleChange}
              />

              <label>Authorized By Role</label>
              <input
                name="authorizedByRole"
                value={config.authorizedByRole || ""}
                onChange={handleChange}
              />

              <label>Uplad Sign</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, "authorizedBySign")}
              />
              {config.authorizedBySign && (
                <img
                  src={config.authorizedBySign}
                  alt="Authorized By Sign"
                  style={{ width: "150px", marginTop: "5px" }}
                />
              )}

              <label>Last TXN Number</label>
              <input
                name="txnNumber"
                value={config.txnNumber || ""}
                onChange={handleChange}
              />

              <label>O&M Name</label>
              <input
                type="text"
                name="omName"
                value={config.omName || ""}
                onChange={handleChange}
              />

              <label>Upload O&M Sign</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, "omSign")}
              />
              {config.omSign && (
                <img
                  src={config.omSign}
                  alt="Prepared By Sign"
                  style={{ width: "150px", marginTop: "5px" }}
                />
              )}

              <h2 style={{ marginTop: "30px" }}>Security Team Details</h2>

              {/* Add Button */}
              <button
                onClick={addSecurity}
                style={{
                  marginBottom: "15px",
                  background: "#1abc9c",
                  color: "white",
                  padding: "8px 14px",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer"
                }}
              >
                + Add Security Person
              </button>

              {/* List of Security Rows */}
              {(config.securityTeam || []).map((sec) => (
                <div
                  key={sec.id}
                  style={{
                    border: "1px solid #ddd",
                    padding: "15px",
                    borderRadius: "8px",
                    marginBottom: "15px",
                    background: "#fafafa"
                  }}
                >
                  <label>Security Name</label>
                  <input
                    value={sec.name}
                    onChange={(e) => updateSecurity(sec.id, "name", e.target.value)}
                    placeholder="Enter Security Name"
                  />

                  <label>Security Role</label>
                  <input
                    value={sec.role}
                    onChange={(e) => updateSecurity(sec.id, "role", e.target.value)}
                    placeholder="Security Role / Guard / Supervisor"
                  />

                  <label>Upload Signature</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => uploadSecuritySign(e, sec.id)}
                  />

                  {sec.signUrl && (
                    <img
                      src={sec.signUrl}
                      alt="Security Sign"
                      style={{ width: "150px", marginTop: "8px" }}
                    />
                  )}

                  {/* Edit & Delete Buttons */}
                  <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>

                    <button
                      onClick={() => deleteSecurity(sec.id)}
                      style={{
                        background: "#e74c3c",
                        color: "#fff",
                        padding: "6px 12px",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer"
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSection === "equipment" && (
            <div className="chart-container">
              <h1>Site Equipment Details</h1>
              <label>DG Count</label>
              <input
                type="number"
                name="dgCount"
                value={config.dgCount || 0}
                onChange={handleChange}
              />

              <lable>DG Manufacturing Date</lable>
              <input
                type="date"
                name="dgMfgDate"
                value={config.dgMfgDate || ""}
                onChange={handleChange}
              />

              <label>SMPS Count</label>
              <input
                type="number"
                name="smpsCount"
                value={config.smpsCount || 0}
                onChange={handleChange}
              />

              <label>PAC Count</label>
              <input
                type="number"
                name="pacCount"
                value={config.pacCount || 0}
                onChange={handleChange}
              />

              <label>UPS Count</label>
              <input
                type="number"
                name="upsCount"
                value={config.upsCount || 0}
                onChange={handleChange}
              />

              <label>CRV Count</label>
              <input
                type="number"
                name="crvCount"
                value={config.crvCount || 0}
                onChange={handleChange}
              />

              <label>EB Count</label>
              <input
                type="number"
                name="ebCount"
                value={config.ebCount || 0}
                onChange={handleChange}
              />

              <label>Solar Unit Count</label>
              <input
                type="number"
                name="solarCount"
                value={config.solarCount || 0}
                onChange={handleChange}
              />

              <label>DG Capacity(kVA)</label>
              <input
                type="number"
                name="dgCapacity"
                value={config.dgCapacity || 0}
                onChange={handleChange}
              />

              <label>DG Day Tank Capacity(Ltrs)</label>
              <input
                type="number"
                name="dgDayTankCapacity"
                value={config.dgDayTankCapacity || 0}
                onChange={handleChange}
              />

              <label>DG External Tank Capacity(Ltrs)</label>
              <input
                type="number"
                name="dgExtrnlTankCapacity"
                value={config.dgExtrnlTankCapacity || 0}
                onChange={handleChange}
              />
            </div>
          )}

          {activeSection === "dhr" && (
            <div className="chart-container">
              <h1>DHR Status</h1>
              <label>EB Status</label>
              <input
                type="text"
                name="ebStatus"
                value={config.ebStatus || ""}
                onChange={handleChange}
              />
              <label>DG Status</label>
              <input
                type="text"
                name="dgStatus"
                value={config.dgStatus || ""}
                onChange={handleChange}
              />
              <label>SMPS Status</label>
              <input
                type="text"
                name="smpsStatus"
                value={config.smpsStatus || ""}
                onChange={handleChange}
              />

              <label>UPS Status</label>
              <input
                type="text"
                name="upsStatus"
                value={config.upsStatus || ""}
                onChange={handleChange}
              />
              <label>PAC Status</label>
              <input
                type="text"
                name="pacStatus"
                value={config.pacStatus || ""}
                onChange={handleChange}
              />
              <label>CRV Status</label>
              <input
                type="text"
                name="crvStatus"
                value={config.crvStatus || ""}
                onChange={handleChange}
              />
              <label>Major Status</label>
              <input
                type="text"
                name="majorActivity"
                value={config.majorActivity || ""}
                onChange={handleChange}
              />
              <label>In-House PM</label>
              <input
                type="text"
                name="inHousePm"
                value={config.inHousePm || ""}
                onChange={handleChange}
              />
              <label>Fault Details</label>
              <input
                type="text"
                name="faultDetails"
                value={config.faultDetails || ""}
                onChange={handleChange}
              />
            </div>
          )}

          {activeSection === "oem" && (
            <div className="chart-container">
              <h1>Quarterly OEM CPH</h1>
              <label>DG-1 CPH</label>
              <input
                type="number"
                name="DG-1"
                value={config.designCph?.["DG-1"] || ""}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    designCph: { ...prev.designCph, "DG-1": parseFloat(e.target.value) },
                  }))
                }
              />

              <label>DG-2 CPH</label>
              <input
                type="number"
                name="DG-2"
                value={config.designCph?.["DG-2"] || ""}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    designCph: { ...prev.designCph, "DG-2": parseFloat(e.target.value) },
                  }))
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SiteConfigEdit;
