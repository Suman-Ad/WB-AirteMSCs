// src/pages/SiteConfigEdit.js
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const SiteConfigEdit = ({ userData }) => {
  const siteKey = userData?.site?.toUpperCase();
  const [config, setConfig] = useState({});
  const storage = getStorage();

  useEffect(() => {
    const fetchConfig = async () => {
      if (!siteKey) return;
      const snap = await getDoc(doc(db, "siteConfigs", siteKey));
      if (snap.exists()) {
        setConfig(snap.data());
      }
    };
    fetchConfig();
  }, [siteKey]);

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
    await setDoc(doc(db, "siteConfigs", siteKey), config, { merge: true });
    alert("Config updated!");
  };

  return (
    <div style={{ maxWidth: "600px", margin: "20px auto" }} className="daily-log-container">
      <h2>Edit Site Config – {siteKey}</h2>

      <div>
        <h1>CCMS Details</h1>
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
          onChange={handleChange}
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
      </div>

      <div >
        <h1>Site Equipment Details</h1>
        <label>DG Count</label>
        <input
          type="number"
          name="dgCount"
          value={config.dgCount || 0}
          onChange={handleChange}
        />

        <label>EB Count</label>
        <input
          type="number"
          name="ebCount"
          value={config.ebCount || 0}
          onChange={handleChange}
        />

        <label>DG Capacity(kVA)</label>
        <input
          type="number"
          name="dgCapacity"
          value={config.dgCapacity || 0}
          onChange={handleChange}
        />
      </div>

      <div>
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

      <div>
        <h1>Quarterly OEM CPH</h1>
        {/* Example: Nested designCPH */}
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

      <button onClick={saveConfig} style={{ marginTop: "15px" }}>
        Save Config
      </button>
    </div>
  );
};

export default SiteConfigEdit;
