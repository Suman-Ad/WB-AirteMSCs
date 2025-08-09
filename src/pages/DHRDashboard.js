import React, { useEffect, useState } from "react";
import "./../assets/DHRDashboard.css";

const formatToDisplay = (isoDate) => {
  if (!isoDate) return "";
  // isoDate is "YYYY-MM-DD"
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}.${m}.${y}`;
};

const todayISO = () => {
  const t = new Date();
  const yyyy = t.getFullYear();
  const mm = String(t.getMonth() + 1).padStart(2, "0");
  const dd = String(t.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const DHRDashboard = ({ userData = {} }) => {
  // auto-fill values
  const [form, setForm] = useState({
    dateISO: todayISO(),
    region: userData.region || userData.Region || "",
    circle: userData.circle || userData.Circle || "",
    siteName: userData.site || userData.siteName || userData.Site || "",
    dieselAvailable: "",
    dgRun: "00:00",
    ebRun: "24:00",
    ebStatus: "Ok",
    dgStatus: "Ok",
    smpsStatus: "",
    upsStatus: "",
    pacStatus: "",
    crvStatus: "No",
    majorActivity: "No",
    inhousePM: "",
    faultDetails: "No",
  });

  // if userData changes later, update the auto-filled fields (but keep any manual edits)
  useEffect(() => {
    setForm(prev => ({
      ...prev,
      region: userData.region || userData.Region || prev.region,
      circle: userData.circle || userData.Circle || prev.circle,
      siteName: userData.site || userData.siteName || userData.Site || prev.siteName,
    }));
  }, [userData]);

  const handleChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const generateTXT = () => {
    const lines = [
      `Date- ${formatToDisplay(form.dateISO)}`,
      `Region- ${form.region || "N/A"}`,
      `Circle- ${form.circle || "N/A"}`,
      `Site Name- ${form.siteName || "N/A"} MSC`,
      `Diesel Available(Ltr's)-: ${form.dieselAvailable || "N/A"} ltr's`,
      `DG run hrs yesterday-: ${form.dgRun || "00:00"} hrs`,
      `EB run hrs yesterday-: ${form.ebRun || "24:00"} hrs`,
      `EB Status- ${form.ebStatus || "N/A"}`,
      `DG Status- ${form.dgStatus || "N/A"}`,
      `SMPS Status- ${form.smpsStatus || "N/A"}`,
      `UPS Status- ${form.upsStatus || "N/A"}`,
      `PAC Status- ${form.pacStatus || "N/A"}`,
      `CRV Status- ${form.crvStatus || "No"}`,
      `Major Activity Planned for the day- ${form.majorActivity || "No"}`,
      `inhouse PM- ${form.inhousePM || "N/A"}`,
      `Fault details if any- ${form.faultDetails || "NO"}`,
    ];
    return lines.join("\n");
  };

  const handleCopy = async () => {
    const txt = generateTXT();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(txt);
      alert("DHR text copied to clipboard.");
    } else {
      alert("Clipboard not available in this browser.");
    }
  };

  const handleDownload = () => {
    const txt = generateTXT();
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fileName = `DHR_${form.siteName || "site"}_${form.dateISO || todayISO()}.txt`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setForm(prev => ({
      ...prev,
      dieselAvailable: "",
      dgRun: "00:00",
      ebRun: "24:00",
      ebStatus: "Ok",
      dgStatus: "Ok",
      smpsStatus: "",
      upsStatus: "",
      pacStatus: "",
      crvStatus: "No",
      majorActivity: "No",
      inhousePM: "",
      faultDetails: "No",
    }));
  };

  return (
    <div className="dhr-page">
      <h2>Small DHR — Daily Health Report</h2>

      <div className="dhr-grid">
        <label>
          Date
          <input
            type="date"
            value={form.dateISO}
            onChange={(e) => handleChange("dateISO", e.target.value)}
          />
        </label>

        <label>
          Region
          <input
            type="text"
            value={form.region}
            onChange={(e) => handleChange("region", e.target.value)}
            placeholder="Region"
          />
        </label>

        <label>
          Circle
          <input
            type="text"
            value={form.circle}
            onChange={(e) => handleChange("circle", e.target.value)}
            placeholder="Circle"
          />
        </label>

        <label>
          Site Name
          <input
            type="text"
            value={form.siteName}
            onChange={(e) => handleChange("siteName", e.target.value)}
            placeholder="Site Name"
          />
        </label>

        <label>
          Diesel Available (Ltrs)
          <input
            type="text"
            value={form.dieselAvailable}
            onChange={(e) => handleChange("dieselAvailable", e.target.value)}
            placeholder="e.g. 1687.0"
          />
        </label>

        <label>
          DG run hrs yesterday
          <input
            type="text"
            value={form.dgRun}
            onChange={(e) => handleChange("dgRun", e.target.value)}
            placeholder="HH:MM"
          />
        </label>

        <label>
          EB run hrs yesterday
          <input
            type="text"
            value={form.ebRun}
            onChange={(e) => handleChange("ebRun", e.target.value)}
            placeholder="HH:MM"
          />
        </label>

        <label>
          EB Status
          <input type="text" value={form.ebStatus} onChange={(e) => handleChange("ebStatus", e.target.value)} />
        </label>

        <label>
          DG Status
          <input type="text" value={form.dgStatus} onChange={(e) => handleChange("dgStatus", e.target.value)} />
        </label>

        <label>
          SMPS Status
          <input type="text" value={form.smpsStatus} onChange={(e) => handleChange("smpsStatus", e.target.value)} placeholder="e.g. 6/6" />
        </label>

        <label>
          UPS Status
          <input type="text" value={form.upsStatus} onChange={(e) => handleChange("upsStatus", e.target.value)} placeholder="e.g. 2/2"/>
        </label>

        <label>
          PAC Status
          <input type="text" value={form.pacStatus} onChange={(e) => handleChange("pacStatus", e.target.value)} placeholder="e.g. 22/22" />
        </label>

        <label>
          CRV Status
          <input type="text" value={form.crvStatus} onChange={(e) => handleChange("crvStatus", e.target.value)} />
        </label>

        <label>
          Major Activity Planned
          <input type="text" value={form.majorActivity} onChange={(e) => handleChange("majorActivity", e.target.value)} />
        </label>

        <label>
          Inhouse PM
          <input type="text" value={form.inhousePM} onChange={(e) => handleChange("inhousePM", e.target.value)} placeholder="e.g. earth pits" />
        </label>

        <label className="full">
          Fault details if any
          <textarea value={form.faultDetails} onChange={(e) => handleChange("faultDetails", e.target.value)} rows={3} />
        </label>
      </div>

      <div className="dhr-actions">
        <button onClick={() => alert(generateTXT())}>Preview (alert)</button>
        <button onClick={handleCopy}>Copy TXT</button>
        <button onClick={handleDownload}>Download TXT</button>
        <button onClick={handleClear}>Clear</button>
      </div>

      <div className="dhr-preview">
        <h3>Generated TXT</h3>
        <pre>{generateTXT()}</pre>
      </div>
    </div>
  );
};

export default DHRDashboard;
