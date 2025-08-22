// src/pages/ThermalReportGenerator.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Chart } from "chart.js/auto";
import { Link } from "react-router-dom";

// Use your existing Firestore export
import { db } from "../firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

/**
 * ThermalReportGenerator:
 * - Fetches list of saved analyses from Firestore collection 'thermalReports'
 * - Allows loading saved analysis (select list) OR upload/paste JSON
 * - Uses composedThermalImage from saved JSON (composedThermalImage) if present
 * - Places images once at top of measurement section; uses composed thermal image (with markers)
 * - Does not repeat images per-spot
 *
 * Props:
 * - userData (optional) to prefill header fields
 */

const THRESHOLDS = { normalMax: 5.0, attentionMax: 10.0, criticalMax: 20.0 };

const styles = {
  page: { maxWidth: 1000, margin: "0 auto", padding: 20 },
  card: { background: "#77bbc79d", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", padding: 16, marginBottom: 16 },
  h1: { fontSize: 24, margin: "0 0 8px", color: "#1f2937" },
  h2: { fontSize: 18, margin: "0 0 8px", color: "#111827" },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  label: { fontWeight: 600, fontSize: 14 },
  input: { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb" },
  textarea: { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", minHeight: 80 },
  btnBar: { display: "flex", gap: 10, flexWrap: "wrap" },
  primaryBtn: { padding: "10px 14px", borderRadius: 10, background: "#2563eb", color: "#fff", border: "none", cursor: "pointer" },
  secondaryBtn: { padding: "10px 14px", borderRadius: 10, background: "#eef2ff", color: "#1f2937", border: "1px solid #c7d2fe", cursor: "pointer" },
  subtle: { color: "#6b7280", fontSize: 12 },
};

function classifyStatus(value, minTemp) {
  const v = typeof value === "string" ? parseFloat(value) : value;
  const delta = v - minTemp;
  if (delta < 0 || isNaN(delta)) return "Normal";
  if (delta < THRESHOLDS.normalMax) return "Normal";
  if (delta <= THRESHOLDS.attentionMax) return "Needs Attention";
  if (delta <= THRESHOLDS.criticalMax) return "Critical";
  return "More Critical";
}
function countBuckets(spots, minTemp) {
  const counters = { Normal: 0, "Needs Attention": 0, Critical: 0, "More Critical": 0 };
  (spots || []).forEach((s) => { const st = classifyStatus(s.value, minTemp); counters[st] += 1; });
  return counters;
}

export default function ThermalReportGenerator({ userData }) {
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  const [reportMonth, setReportMonth] = useState("");
  const [companyName, setCompanyName] = useState("M/s Vertiv Energy Private Limited");
  const [siteName, setSiteName] = useState(userData?.site || "Nxtra Data Ltd, Asansol MSC, Asansol (WB), India");
  const [auditorName, setAuditorName] = useState("Mr. Amit Kumar Mondal");
  const [auditorEmail, setAuditorEmail] = useState("Amitkumar.Mondal@vertiv.com");
  const [auditorPhone, setAuditorPhone] = useState("+91 9800313110");
  const [preparedBy, setPreparedBy] = useState(userData?.preparedBy || userData?.name || "Mr. Suman Adhikari");
  const [preparedEmail, setPreparedEmail] = useState(userData?.preparedEmail || "asansol.airtelmsc@geniusconsultants.in");
  const [preparedPhone, setPreparedPhone] = useState(userData?.preparedPhone || "+91 9647255367");
  const [reviewedBy, setReviewedBy] = useState(userData?.reviewedBy || "Mr. Indranil Ganguly");
  const [reviewedEmail, setReviewedEmail] = useState(userData?.reviewedEmail || "Indranil.Ganguly@Vertivco.com");
  const [reviewedPhone, setReviewedPhone] = useState(userData?.reviewedPhone || "+91 9136917492");

  const [ackText, setAckText] = useState("We are thankful to the site technical team and officials for their cooperation during the scanning. We hope the recommendations in this report help improve reliability and minimize breakdowns.");
  const [introText, setIntroText] = useState("Infrared (IR) scanning was carried out as part of safety, proactive, predictive, and preventive maintenance on electrical distribution systems and critical terminations.");
  const [objectiveText, setObjectiveText] = useState("Identify thermal anomalies at electrical distribution systems and terminations to prevent failures and improve uptime.");
  const [generalObs, setGeneralObs] = useState("Overall temperature distribution appears consistent with operating conditions. Items highlighted in the summary warrant verification of terminations, load balancing, and cleaning as needed.");
  const [generalRec, setGeneralRec] = useState("Tighten/torque-check suspect terminations as per OEM guidelines, re-crimp if needed, balance loads, and re-scan after corrective actions.");

  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const [jsonText, setJsonText] = useState("");
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // fetch saved analyses list from Firestore collection 'thermalReports'
  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoadingReports(true);
        const qSnap = await getDocs(collection(db, 'thermalReports'));
        const list = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setReports(list);
      } catch (err) {
        console.error('fetchReports failed', err);
      } finally {
        setLoadingReports(false);
      }
    };
    fetchReports();
  }, []);

  // load JSON file (upload/paste)
  const handleJSONFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        setAnalysis(data);
        if (data.timestamp) { const d = new Date(data.timestamp); setReportMonth(d.toLocaleString("en-GB", { month: "long", year: "numeric" })); }
      } catch (err) { alert("Invalid JSON file."); }
    };
    reader.readAsText(f);
  };
  const loadFromText = () => {
    try {
      const data = JSON.parse(jsonText);
      setAnalysis(data);
      if (data.timestamp) { const d = new Date(data.timestamp); setReportMonth(d.toLocaleString("en-GB", { month: "long", year: "numeric" })); }
      alert("Analysis loaded from pasted JSON.");
    } catch (e) { alert("Invalid JSON pasted."); }
  };
  const handleLogoFile = (e) => { const f = e.target.files?.[0]; if (!f) return; const reader = new FileReader(); reader.onload = () => setLogoDataUrl(reader.result); reader.readAsDataURL(f); };

  // chart preview
  useEffect(() => {
    if (!analysis?.spots?.length || !chartRef.current) { if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; } return; }
    if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }
    const ctx = chartRef.current.getContext('2d');
    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: analysis.spots.map(s => s.name),
        datasets: [{
          label: 'Temperature (°C)',
          data: analysis.spots.map(s => parseFloat(s.value)),
          backgroundColor: analysis.spots.map(s => {
            const st = classifyStatus(s.value, analysis.minTemp);
            if (st === 'More Critical') return 'rgba(220,38,38,0.7)';
            if (st === 'Critical') return 'rgba(249,115,22,0.7)';
            if (st === 'Needs Attention') return 'rgba(234,179,8,0.7)';
            return 'rgba(59,130,246,0.7)';
          }),
          borderColor: 'rgba(0,0,0,0.2)',
          borderWidth: 1
        }]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { title: { display: true, text: 'Temperature (°C)' }, suggestedMin: Math.floor(analysis.minTemp) - 5, suggestedMax: Math.ceil(analysis.maxTemp) + 5 } } }
    });
    return () => { if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; } };
  }, [analysis]);

  const summary = useMemo(() => { if (!analysis?.spots?.length) return null; const buckets = countBuckets(analysis.spots, analysis.minTemp); return { total: analysis.spots.length, ...buckets }; }, [analysis]);

  const getChartDataUrl = () => { try { if (!chartRef.current) return null; return chartRef.current.toDataURL('image/png', 1.0); } catch { return null; } };

  // helper functions to extract images from analysis data (supports multiple keys)
  const getThermalImageFromAnalysis = (a) => { if (!a) return null; return a.composedThermalImage || a.composed_thermal_image || a.thermalImage || a.image || a.thermal_image || null; };
  const getReferenceImageFromAnalysis = (a) => { if (!a) return null; return a.referenceImage || a.reference_image || a.refImage || null; };

  // load saved report doc from Firestore by doc id
  const loadSavedReport = async (docMeta) => {
    try {
      if (!docMeta?.id) return;
      const docRef = doc(db, 'thermalReports', docMeta.id);
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) { alert('Saved report not found'); return; }
      const docData = snapshot.data();
      // docData.data is the payload we stored earlier (payload includes composedThermalImage)
      if (docData?.data) {
        setAnalysis(docData.data);
        if (docData.data.timestamp) {
          const d = new Date(docData.data.timestamp);
          setReportMonth(d.toLocaleString("en-GB", { month: "long", year: "numeric" }));
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        alert('Saved report is missing payload (data).');
      }
    } catch (err) {
      console.error('loadSavedReport failed', err);
      alert('Failed to load saved report (check console).');
    }
  };

  // PDF generation (images once on top; thermal uses composedThermalImage with markers)
  const generatePDF = () => {
    if (!analysis) { alert('Please load an analysis first.'); return; }
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 40;
    let y = 40;

    const thermalImg = getThermalImageFromAnalysis(analysis);
    const referenceImg = getReferenceImageFromAnalysis(analysis);

    const putImage = (imgDataUrl, x, yPos, w, h) => {
      if (!imgDataUrl) return;
      try {
        const type = imgDataUrl.startsWith('data:image/jpeg') || imgDataUrl.startsWith('data:image/jpg') ? 'JPEG' : 'PNG';
        doc.addImage(imgDataUrl, type, x, yPos, w, h);
      } catch (err) { console.warn('addImage failed', err); }
    };

    // COVER
    if (logoDataUrl) putImage(logoDataUrl, marginX, y, 90, 40);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('Infrared Thermography Inspection Report', pageWidth/2, y+24, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.text(companyName, pageWidth/2, y+42, { align: 'center' });
    y += 80;

    // Meta & Contacts (similar to your layout)
    doc.setFont('helvetica', 'bold'); doc.text('Report Month:', marginX, y); doc.setFont('helvetica', 'normal'); doc.text(reportMonth || '-', marginX + 100, y);
    doc.setFont('helvetica', 'bold'); doc.text('Site:', pageWidth/2, y); doc.setFont('helvetica', 'normal'); doc.text(siteName || '-', pageWidth/2 + 30, y);
    y += 28;

    doc.setFont('helvetica', 'bold'); doc.text('Auditor', marginX, y); doc.text('Prepared By', pageWidth/2, y); y += 14;
    doc.setFont('helvetica','normal'); doc.text(`${auditorName}`, marginX, y); doc.text(`${preparedBy}`, pageWidth/2, y); y += 14;
    doc.text(`${auditorEmail}`, marginX, y); doc.text(`${preparedEmail}`, pageWidth/2, y); y += 14;
    doc.text(`${auditorPhone}`, marginX, y); doc.text(`${preparedPhone}`, pageWidth/2, y); y += 22;

    doc.setFont('helvetica','bold'); doc.text('Reviewed & Approved By', marginX, y); y += 14;
    doc.setFont('helvetica','normal'); doc.text(`${reviewedBy}`, marginX, y); y += 14; doc.text(`${reviewedEmail}`, marginX, y); y += 14; doc.text(`${reviewedPhone}`, marginX, y); y += 20;

    // Acknowledgement
    doc.setFont('helvetica','bold'); doc.text('Acknowledgement', marginX, y); y += 14;
    const ackLines = doc.splitTextToSize(ackText, pageWidth - marginX*2); doc.setFont('helvetica','normal'); doc.text(ackLines, marginX, y); y += ackLines.length * 12 + 12;

    // Executive Summary
    const sum = summary || { total: 0, Normal: 0, 'Needs Attention': 0, Critical: 0, 'More Critical': 0 };
    doc.setFont('helvetica','bold'); doc.text('Executive Summary', marginX, y); y += 14;
    doc.setFont('helvetica','normal'); const sumText = `Total locations: ${sum.total}. Normal ${sum.Normal} • Needs Attention ${sum['Needs Attention']} • Critical ${sum.Critical} • More Critical ${sum['More Critical']}`;
    const sumLines = doc.splitTextToSize(sumText, pageWidth - marginX*2); doc.text(sumLines, marginX, y); y += sumLines.length*12 + 8;

    const chartUrl = getChartDataUrl();
    if (chartUrl) { const chartW = pageWidth - marginX*2, chartH = 160; if (y + chartH > pageHeight - 80) { doc.addPage(); y = 40; } putImage(chartUrl, marginX, y, chartW, chartH); y += chartH + 10; }

    // Intro & Objective
    const secs = [['Introduction', introText], ['Objective', objectiveText]];
    secs.forEach(([title, text]) => { if (y > pageHeight - 120) { doc.addPage(); y = 40; } doc.setFont('helvetica','bold'); doc.text(title, marginX, y); y += 14; doc.setFont('helvetica','normal'); const lines = doc.splitTextToSize(text, pageWidth - marginX*2); doc.text(lines, marginX, y); y += lines.length*12 + 10; });

    // --- IMAGES ONCE BEFORE MEASUREMENT TABLE (user requirement) ---
    if (referenceImg || thermalImg) {
      if (y > pageHeight - 240) { doc.addPage(); y = 40; }
      doc.setFont('helvetica','bold'); doc.text('Visual & Thermal Images', marginX, y); y += 12;
      const w = (pageWidth - marginX*2 - 12)/2; const h = 160;
      if (referenceImg) putImage(referenceImg, marginX, y, w, h);
      if (thermalImg) putImage(thermalImg, marginX + w + 12, y, w, h);
      y += h + 12;
    }

    // Measurement Points Table
    if (analysis.spots?.length) {
      if (y > pageHeight - 160) { doc.addPage(); y = 40; }
      doc.setFont('helvetica','bold'); doc.text('Measurement Points', marginX, y); y += 12;
      const tableBody = analysis.spots.map((s, i) => ([i+1, s.name, `(${s.x}, ${s.y})`, `${parseFloat(s.value).toFixed(1)} ${s.unit || '°C'}`, classifyStatus(s.value, analysis.minTemp)]));
      autoTable(doc, { startY: y+6, head: [['Sr. No','Point','Coordinates','Temperature','Status']], body: tableBody, styles:{fontSize:9}, headStyles:{fillColor:[63,81,181]}, margin:{left:marginX,right:marginX}, theme:'grid' });
      y = doc.lastAutoTable.finalY + 12;
    }

    // Observations per spot (no images repeated)
    const spotsArr = analysis.spots || [];
    for (let i=0;i<spotsArr.length;i++) {
      const s = spotsArr[i];
      if (y > pageHeight - 180) { doc.addPage(); y = 40; }
      doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text(`${i+1}. ${s.name}`, marginX, y); y += 16;
      doc.setFont('helvetica','normal'); const details = [`Coordinates: (${s.x}, ${s.y})`, `Temperature: ${parseFloat(s.value).toFixed(1)} ${s.unit || '°C'}`, `Status: ${classifyStatus(s.value, analysis.minTemp)}`];
      details.forEach(d => { if (y > pageHeight - 120) { doc.addPage(); y = 40; } doc.text(d, marginX, y); y += 14; });
      if (y > pageHeight - 120) { doc.addPage(); y = 40; }
      doc.text('Observations:', marginX, y); y += 14; doc.text(' ', marginX, y); y += 28; doc.text('Recommendation:', marginX, y); y += 28;
    }

    // Final general observations & recommendations
    if (y > pageHeight - 140) { doc.addPage(); y = 40; }
    doc.setFont('helvetica','bold'); doc.text('General Observations', marginX, y); y += 14; doc.setFont('helvetica','normal'); const goLines = doc.splitTextToSize(generalObs, pageWidth - marginX*2); doc.text(goLines, marginX, y); y += goLines.length*12 + 10;
    if (y > pageHeight - 140) { doc.addPage(); y = 40; }
    doc.setFont('helvetica','bold'); doc.text('Recommendations', marginX, y); y += 14; doc.setFont('helvetica','normal'); const recLines = doc.splitTextToSize(generalRec, pageWidth - marginX*2); doc.text(recLines, marginX, y); y += recLines.length*12 + 10;

    // Footer with page numbers
    const totalPages = doc.getNumberOfPages();
    for (let p=1;p<=totalPages;p++) { doc.setPage(p); doc.setFontSize(9); doc.text(`Page ${p} of ${totalPages}`, pageWidth - marginX, pageHeight - 10, { align: 'right' }); doc.text('M/s Vertiv Energy Pvt Ltd — Infrared Scan', marginX, pageHeight - 10); }

    const filenameSafe = (reportMonth || 'Report').replace(/[^a-z0-9\- ]/gi,'_');
    doc.save(`IR_Scan_Report_${filenameSafe}.pdf`);
  };

  return (
    <div className="dhr-dashboard-container">
      <h1 className="dashboard-header">
        <strong>🔬🌡️ IR Thermography Analysis & Generate Report</strong>
      </h1>
      <div style={styles.card}>
        <h1 style={styles.h1}>IR Scan – Report Generator</h1>
        <div style={styles.subtle}>Load analysis JSON (from Thermal Image Analysis export) or pick a saved analysis from Firestore, fill header fields, preview, and click Generate PDF.</div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.h2}>📈Saved Analyses Files History</h2>
        <div style={styles.subtle}>{loadingReports ? 'Loading...' : (reports.length === 0 ? 'No saved analyses found.' : `${reports.length} saved analyses`)}</div>
        {reports.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {reports.map(r => (
              <div key={r.id} style={{ display:'flex', justifyContent:'space-between', padding:8, borderBottom:'1px solid #eee' }}>
                <div>
                  <div style={{ fontWeight:600 }}>{r.siteName || r.filename || r.id}</div>
                  <div style={{ fontSize:12, color:'#666' }}>{r.spotsCount} points • {r.minTemp}°C–{r.maxTemp}°C</div>
                </div>
                <div><button style={styles.secondaryBtn} onClick={() => loadSavedReport(r)}>Load</button></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.card}>
        <h2 style={styles.h2}>Load Analysis</h2>
        <div className="grid" style={styles.row}>
          <div>
            <div style={styles.label}>Upload analysis JSON</div>
            <input type="file" accept="application/json" onChange={handleJSONFile} style={styles.input} />
            <div style={{ marginTop: 8, ...styles.subtle }}>Tip: Use the Export Analysis button on the analysis page to generate JSON and save to Firestore.</div>
          </div>
          <div>
            <div style={styles.label}>Paste analysis JSON</div>
            <textarea style={styles.textarea} value={jsonText} onChange={e => setJsonText(e.target.value)} placeholder="Paste JSON here..." />
            <div style={{ marginTop: 8 }}><button style={styles.secondaryBtn} onClick={loadFromText}>Load from Pasted JSON</button></div>
          </div>
        </div>
        {analysis && <div style={{ marginTop: 10, ...styles.subtle }}>Loaded {analysis.spots?.length || 0} points | Range: {analysis.minTemp?.toFixed?.(1)}°C – {analysis.maxTemp?.toFixed?.(1)}°C | Timestamp: {analysis.timestamp}</div>}
      </div>

      <div style={styles.card}>
        <h2 style={styles.h2}>Header & Contacts</h2>
        <div style={styles.row}>
          <div>
            <div style={styles.label}>Report Month</div>
            <input style={styles.input} value={reportMonth} onChange={e => setReportMonth(e.target.value)} placeholder="April 2024" />
          </div>
          <div>
            <div style={styles.label}>Company Name</div>
            <input style={styles.input} value={companyName} onChange={e => setCompanyName(e.target.value)} />
          </div>
          <div>
            <div style={styles.label}>Site</div>
            <input style={styles.input} value={siteName} onChange={e => setSiteName(e.target.value)} />
          </div>
          <div>
            <div style={styles.label}>Logo (PNG/JPG)</div>
            <input type="file" accept="image/*" onChange={e => handleLogoFile(e)} style={styles.input} />
          </div>
        </div>

        <h3 style={{ ...styles.h2, marginTop: 16 }}>Contacts</h3>
        <div style={styles.row}>
          <div>
            <div style={styles.label}>Auditor Name</div>
            <input style={styles.input} value={auditorName} onChange={e => setAuditorName(e.target.value)} />
            <div style={styles.label}>Auditor Email</div>
            <input style={styles.input} value={auditorEmail} onChange={e => setAuditorEmail(e.target.value)} />
            <div style={styles.label}>Auditor Phone</div>
            <input style={styles.input} value={auditorPhone} onChange={e => setAuditorPhone(e.target.value)} />
          </div>
          <div>
            <div style={styles.label}>Prepared By</div>
            <input style={styles.input} value={preparedBy} onChange={e => setPreparedBy(e.target.value)} />
            <div style={styles.label}>Prepared Email</div>
            <input style={styles.input} value={preparedEmail} onChange={e => setPreparedEmail(e.target.value)} />
            <div style={styles.label}>Prepared Phone</div>
            <input style={styles.input} value={preparedPhone} onChange={e => setPreparedPhone(e.target.value)} />
          </div>
          <div>
            <div style={styles.label}>Reviewed By</div>
            <input style={styles.input} value={reviewedBy} onChange={e => setReviewedBy(e.target.value)} />
            <div style={styles.label}>Reviewed Email</div>
            <input style={styles.input} value={reviewedEmail} onChange={e => setReviewedEmail(e.target.value)} />
            <div style={styles.label}>Reviewed Phone</div>
            <input style={styles.input} value={reviewedPhone} onChange={e => setReviewedPhone(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.h2}>Narratives</h2>
        <div style={styles.label}>Acknowledgement</div>
        <textarea style={styles.textarea} value={ackText} onChange={e => setAckText(e.target.value)} />
        <div style={styles.label}>Introduction</div>
        <textarea style={styles.textarea} value={introText} onChange={e => setIntroText(e.target.value)} />
        <div style={styles.label}>Objective</div>
        <textarea style={styles.textarea} value={objectiveText} onChange={e => setObjectiveText(e.target.value)} />
        <div style={styles.label}>General Observations</div>
        <textarea style={styles.textarea} value={generalObs} onChange={e => setGeneralObs(e.target.value)} />
        <div style={styles.label}>Recommendations</div>
        <textarea style={styles.textarea} value={generalRec} onChange={e => setGeneralRec(e.target.value)} />
      </div>

      <div style={styles.card}>
        <h2 style={styles.h2}>Executive Summary Preview</h2>

        {!analysis?.spots?.length ? (
            <div style={styles.subtle}>Load analysis to preview summary & chart.</div>
        ) : (
            <div style={{ padding: "10px 0" }}>
            {/* Header with Logo & Title */}
            <div style={{ textAlign: "center", marginBottom: 16 }}>
                {logoDataUrl && (
                <img
                    src={logoDataUrl}
                    alt="Company Logo"
                    style={{ height: 60, objectFit: "contain", marginBottom: 8 }}
                />
                )}
                <h3 style={{ fontSize: 20, margin: "0", fontWeight: "bold" }}>
                IR SCAN REPORT
                </h3>
                <div style={{ fontSize: 14, color: "#374151" }}>{companyName}</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                {reportMonth} | {siteName}
                </div>
            </div>

            {/* Thermal Image with Caption */}
            {analysis.image && (
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                <img
                    src={analysis.image}
                    alt="Thermal Analysis"
                    style={{
                    width: "100%",
                    maxWidth: 500,
                    borderRadius: 8,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    }}
                />
                <div
                    style={{
                    fontSize: 12,
                    color: "#6b7280",
                    marginTop: 4,
                    fontStyle: "italic",
                    }}
                >
                    Thermal Analysis Image with Spots Overlay
                </div>
                </div>
            )}

            {/* Executive Summary Text */}
            <div style={{ marginBottom: 16 }}>
                <h4 style={{ margin: "8px 0", fontSize: 16 }}>Executive Summary</h4>
                <div style={{ fontSize: 14, color: "#111827" }}>
                Total locations covered: <b>{summary.total}</b>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: 6 }}>
                <div style={{ color: "#2563eb" }}>Normal: <b>{summary.Normal}</b></div>
                <div style={{ color: "#ca8a04" }}>Needs Attention: <b>{summary["Needs Attention"]}</b></div>
                <div style={{ color: "#ea580c" }}>Critical: <b>{summary.Critical}</b></div>
                <div style={{ color: "#dc2626" }}>More Critical: <b>{summary["More Critical"]}</b></div>
                </div>
            </div>

            {/* Bar Chart */}
            <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                Temperature Chart
                </div>
                <canvas
                ref={chartRef}
                style={{
                    width: "100%",
                    height: 280,
                    background: "#fff",
                    borderRadius: 8,
                    padding: 8,
                }}
                />
            </div>
            </div>
        )}
        </div>


      <div style={{ ...styles.card, ...styles.btnBar }}>
        <button style={styles.primaryBtn} onClick={generatePDF}>Generate PDF Report</button>
        {(userData?.role === 'Super User' || userData?.role === 'Admin' || userData?.role === 'Super Admin' || userData?.role === 'User') && (
          <Link to="/thermal-analysis"><span style={{ marginLeft: 8 }}>🔙 Back to Analysis</span></Link>
        )}
      </div>
    </div>
  );
}
