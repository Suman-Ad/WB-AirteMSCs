// src/pages/ThermalImageAnalysis.js
import React, { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Chart } from 'chart.js/auto';
import { saveAs } from 'file-saver';

// Firestore imports (you requested these)
import { db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

/**
 * ThermalImageAnalysis
 * - Two images: thermal (analyzed) + reference
 * - Add/Edit/Delete spots
 * - Compose thermal canvas + overlay into composedThermalImage (base64)
 * - Export JSON locally AND save to Firestore collection 'thermalReports'
 *
 * Props:
 * - userData (optional): { name, email, siteName, role, ... } used to populate uploadedBy metadata
 *
 * Keep existing logic; minimal changes only where required to support composed image + Firestore save.
 */

const ThermalImageAnalysis = ({ userData }) => {
  const [thermalImage, setThermalImage] = useState(null);
  const [referenceImage, setReferenceImage] = useState(null);
  const [spots, setSpots] = useState([]);
  const [imageData, setImageData] = useState(null);
  const [minTemp, setMinTemp] = useState(0);
  const [maxTemp, setMaxTemp] = useState(100);
  const [colorBarData, setColorBarData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');

  // Refs
  const canvasRef = useRef(null);   // visible thermal base canvas
  const overlayRef = useRef(null);  // overlay canvas for markers
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  // ---- simple demo colorbar extraction (kept as original) ----
  const extractColorBarTemperatures = (_imageData) => ({ min: 30.1, max: 44.6 });

  const getTemperatureFromColor = (r, g, b) => {
    if (!colorBarData) return 0;
    const intensity = (r + g + b) / 3;
    const normalized = intensity / 255;
    return colorBarData.min + (normalized * (colorBarData.max - colorBarData.min));
  };

  // ---- dropzones ----
  const { getRootProps: getThermalRootProps, getInputProps: getThermalInputProps } = useDropzone({
    accept: 'image/*',
    onDrop: (acceptedFiles) => {
      if (!acceptedFiles || acceptedFiles.length === 0) return;
      setIsAnalyzing(true);
      const file = acceptedFiles[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        setThermalImage(dataUrl);
        setSpots([]);

        const img = new Image();
        img.onload = () => {
          // analyze offscreen
          const off = document.createElement('canvas');
          off.width = img.width;
          off.height = img.height;
          const ctx = off.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const id = ctx.getImageData(0, 0, img.width, img.height);
          setImageData(id);

          const temps = extractColorBarTemperatures(id);
          setColorBarData(temps);
          setMinTemp(temps.min);
          setMaxTemp(temps.max);

          // Draw to visible canvas
          if (canvasRef.current) {
            canvasRef.current.width = img.width;
            canvasRef.current.height = img.height;
            const dctx = canvasRef.current.getContext('2d');
            dctx.drawImage(img, 0, 0);
          }

          // clear overlay
          if (overlayRef.current) {
            overlayRef.current.width = img.width;
            overlayRef.current.height = img.height;
            overlayRef.current.getContext('2d').clearRect(0, 0, img.width, img.height);
          }

          setIsAnalyzing(false);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    }
  });

  const { getRootProps: getReferenceRootProps, getInputProps: getReferenceInputProps } = useDropzone({
    accept: 'image/*',
    onDrop: (acceptedFiles) => {
      if (!acceptedFiles || acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];
      const reader = new FileReader();
      reader.onload = (e) => setReferenceImage(e.target.result);
      reader.readAsDataURL(file);
    }
  });

  // ---- click to add spot ----
  const handleImageClick = (e) => {
    if (!imageData || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    // clamp
    const cx = Math.max(0, Math.min(imageData.width - 1, x));
    const cy = Math.max(0, Math.min(imageData.height - 1, y));
    const idx = (cy * imageData.width + cx) * 4;
    const r = imageData.data[idx], g = imageData.data[idx+1], b = imageData.data[idx+2];

    const temp = getTemperatureFromColor(r, g, b);

    const newSpot = { id: Date.now().toString(), name: `SP${spots.length + 1}`, x: cx, y: cy, value: temp.toFixed(1), unit: '°C' };
    setSpots(prev => [...prev, newSpot]);
  };

  // ---- edit/delete ----
  const handleDeleteSpot = (id) => {
    setSpots(prev => prev.filter(s => s.id !== id));
    if (editId === id) { setEditId(null); setEditName(''); }
  };
  const handleEditSpot = (id, currentName) => { setEditId(id); setEditName(currentName); };
  const handleSaveEdit = (id) => { setSpots(prev => prev.map(s => s.id === id ? { ...s, name: editName.trim() || s.name } : s)); setEditId(null); setEditName(''); };
  const handleCancelEdit = () => { setEditId(null); setEditName(''); };

  // ---- render overlay markers ----
  const renderMeasurementMarkers = () => {
    if (!overlayRef.current || !canvasRef.current) return;
    const canvas = overlayRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = canvasRef.current.width;
    canvas.height = canvasRef.current.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    spots.forEach(spot => {
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(spot.x - 10, spot.y);
      ctx.lineTo(spot.x + 10, spot.y);
      ctx.moveTo(spot.x, spot.y - 10);
      ctx.lineTo(spot.x, spot.y + 10);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(spot.x + 15, spot.y - 20, 110, 20);
      ctx.fillStyle = '#000';
      ctx.font = '12px Arial';
      ctx.fillText(`${spot.name}: ${spot.value}°C`, spot.x + 20, spot.y - 5);
    });
  };

  // ---- chart rendering ----
  const renderTemperatureChart = () => {
    if (!chartRef.current || spots.length === 0) {
      if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }
      return;
    }
    if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }

    const ctx = chartRef.current.getContext('2d');
    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: spots.map(s => s.name),
        datasets: [{
          label: 'Temperature (°C)',
          data: spots.map(s => parseFloat(s.value)),
          backgroundColor: spots.map(s => s.value > (minTemp + (maxTemp - minTemp)*0.8) ? 'rgba(255,99,71,0.7)' : 'rgba(54,162,235,0.7)'),
          borderColor: spots.map(s => s.value > (minTemp + (maxTemp - minTemp)*0.8) ? 'rgb(255,99,71)' : 'rgb(54,162,235)'),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw}°C` } } },
        scales: { y: { min: minTemp - 5, max: maxTemp + 5, title: { display: true, text: 'Temperature (°C)' } } }
      }
    });
  };

  useEffect(() => { renderMeasurementMarkers(); renderTemperatureChart(); }, [spots, imageData, minTemp, maxTemp]);

  // ---- compose thermal base + overlay into one PNG dataURL ----
  const getComposedThermalDataUrl = () => {
    if (!canvasRef.current) return null;
    const base = canvasRef.current;
    const overlay = overlayRef.current;
    const off = document.createElement('canvas');
    off.width = base.width;
    off.height = base.height;
    const ctx = off.getContext('2d');
    ctx.drawImage(base, 0, 0);
    if (overlay && overlay.width && overlay.height) ctx.drawImage(overlay, 0, 0);
    try { return off.toDataURL('image/png', 1.0); } catch (err) { console.warn('compose failed', err); return null; }
  };

  // ---- export JSON locally and save to Firestore collection 'thermalReports' ----
  const exportAndSave = async () => {
    const composed = getComposedThermalDataUrl();
    const payload = {
      // include original thermal and reference for compatibility
      thermalImage,
      referenceImage,
      composedThermalImage: composed,
      minTemp,
      maxTemp,
      spots,
      timestamp: new Date().toISOString(),
      uploadedBy: userData || null
    };

    // local download
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      saveAs(blob, 'thermal-analysis.json');
    } catch (err) {
      console.warn('local save failed', err);
    }

    // save to Firestore (collection: thermalReports)
    try {
      const id = `report_${new Date().toISOString().replace(/[:.]/g, '-')}`;
      const reportDocRef = doc(db, 'thermalReports', id);
      // We'll store metadata + full payload under 'data'
      await setDoc(reportDocRef, {
        siteName: userData?.siteName || userData?.site || 'Unknown site',
        minTemp,
        maxTemp,
        spotsCount: (spots || []).length,
        timestamp: new Date().toISOString(),
        uploadedBy: userData || null,
        data: payload,
        createdAt: serverTimestamp ? serverTimestamp() : new Date().toISOString()
      });
      alert('Analysis saved to Firestore (collection: thermalReports).');
    } catch (err) {
      console.error('Failed to save analysis to Firestore:', err);
      alert('Local export succeeded — saving to Firestore failed (check console).');
    }
  };

  // ---- styles (kept very similar to your original) ----
  const styles = {
    container: { maxWidth: '1100px', margin: '0 auto', padding: '20px' },
    header: { color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: '10px' },
    dropzone: { border: '2px dashed #7f8c8d', borderRadius: '8px', padding: '20px', textAlign: 'center', cursor: 'pointer', backgroundColor: '#f8f9fa', margin: '20px 0' },
    imageContainer: { position: 'relative', margin: '20px 0' },
    imageCanvas: { maxWidth: '100%', maxHeight: '500px', display: 'block', cursor: 'crosshair' },
    overlayCanvas: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none' },
    section: { margin: '20px 0', padding: '15px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
    table: { width: '100%', borderCollapse: 'collapse', margin: '10px 0' },
    tableHeader: { fontWeight: 'bold', backgroundColor: '#f2f2f2' },
    button: { backgroundColor: '#3498db', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' },
    imagePreview: { maxWidth: '300px', margin: '10px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' },
    actionBtn: { backgroundColor: '#3498db', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', marginRight: '6px' },
    dangerBtn: { backgroundColor: '#e11d48', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' },
    inlineInput: { padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd', width: 120 }
  };

  return (
    <div className="dhr-dashboard-container">
      <h1 className="dashboard-header">Thermal Image Analysis</h1>

      <div {...getThermalRootProps({ style: styles.dropzone })}>
        <input {...getThermalInputProps()} />
        <p>Drag & drop a <strong>Thermal Image</strong> here, or click to select</p>
      </div>

      <div {...getReferenceRootProps({ style: styles.dropzone })}>
        <input {...getReferenceInputProps()} />
        <p>Drag & drop a <strong>Reference Image</strong> here, or click to select</p>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {thermalImage && <img src={thermalImage} alt="Thermal" style={styles.imagePreview} />}
        {referenceImage && <img src={referenceImage} alt="Reference" style={styles.imagePreview} />}
      </div>

      {isAnalyzing && <div style={{ padding: 20, color: '#3498db' }}>Analyzing thermal image and extracting temperature range...</div>}

      {thermalImage && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '15px 0', padding: 10, backgroundColor: '#f0f0f0', borderRadius: 4 }}>
            <div>
              <span>Detected Temperature Range: </span>
              <span style={{ fontWeight: 'bold' }}>{minTemp.toFixed(1)}°C to {maxTemp.toFixed(1)}°C</span>
            </div>
          </div>

          <div style={styles.imageContainer}>
            <canvas ref={canvasRef} style={styles.imageCanvas} onClick={handleImageClick} />
            <canvas ref={overlayRef} style={styles.overlayCanvas} />
          </div>

          <div style={styles.section}>
            <h2>Measurement Points</h2>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.tableHeader}>Point</th>
                  <th style={styles.tableHeader}>Coordinates</th>
                  <th style={styles.tableHeader}>Temperature</th>
                  <th style={styles.tableHeader}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {spots.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center' }}>Click on the thermal image to add measurement points</td></tr>
                ) : spots.map(spot => (
                  <tr key={spot.id}>
                    <td>{editId === spot.id ? <input style={styles.inlineInput} value={editName} onChange={e => setEditName(e.target.value)} /> : spot.name}</td>
                    <td>({spot.x}, {spot.y})</td>
                    <td>{spot.value} {spot.unit}</td>
                    <td>
                      {editId === spot.id ? (
                        <>
                          <button style={styles.actionBtn} onClick={() => handleSaveEdit(spot.id)}>Save</button>
                          <button style={styles.dangerBtn} onClick={handleCancelEdit}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button style={styles.actionBtn} onClick={() => handleEditSpot(spot.id, spot.name)}>Edit</button>
                          <button style={styles.dangerBtn} onClick={() => handleDeleteSpot(spot.id)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {spots.length > 0 && (
            <div style={styles.section}>
              <h2>Temperature Visualization</h2>
              <div style={{ height: 300, margin: '20px 0' }}>
                <canvas ref={chartRef} />
              </div>
            </div>
          )}

          <div>
            <button style={styles.button} onClick={exportAndSave}>Export Analysis (JSON) & Save to Firestore</button>
          </div>
        </>
      )}
    </div>
  );
};

export default ThermalImageAnalysis;
