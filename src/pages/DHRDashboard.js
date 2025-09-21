// src/pages/DHRDashboard.js
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { format, parseJSON } from "date-fns";
import "../assets/DHRStyle.css";
import { oemDieselCphData } from "../config/oemDieselCphData"; // Import the data

// Import Recharts components
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { buildQueries } from "@testing-library/dom";
import { DeploymentUnitOutlined } from "@ant-design/icons";

export default function DHRDashboard({ userData }) {
  const userName = userData?.name;
  const userRole = userData?.role;
  const userSite = userData?.site;
  const userDesignation = userData?.designation;

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const today = new Date().toISOString().split("T")[0];
  const [filterDate, setFilterDate] = useState(today);
  const [filterSite, setFilterSite] = useState("");
  const [selectedTxt, setSelectedTxt] = useState("");
  const [showModal, setShowModal] = useState(false);


  // Add these state declarations with your other useState declarations at the top of your component
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [dgCapacity, setDgCapacity] = useState("");
  const [dgKw, setDgKw] = useState("");
  const [dgHmr, setDgHmr] = useState("");
  const [calculationResult, setCalculationResult] = useState("");
  const [selectedCapacity, setSelectedCapacity] = useState("");


  const navigate = useNavigate();

  // Define this with your other constants (before the component)
  const dgCapacityOptions = [
    "82.5 kVA", "125.0 kVA", "160.0 kVA", "180.0 kVA", "200.0 kVA", 
    "250.0 kVA", "320.0 kVA", "380.0 kVA", "400.0 kVA", "500.0 kVA", 
    "600.0 kVA", "625.0 kVA", "650.0 kVA", "750.0 kVA", "1010.0 kVA", 
    "1250.0 kVA", "1500.0 kVA", "2000.0 kVA", "2250.0 kVA", "2500.0 kVA"
  ];

  useEffect(() => {
    const fetchInstruction = async () => {
      const docRef = doc(db, "config", "dhr_dashboard_instruction");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setInstructionText(docSnap.data().text || "");
        setEditText(docSnap.data().text || "");
      }
    };
    fetchInstruction();
  }, []);

  useEffect(() => {
    const dhrRef = collection(db, "dhr_reports");
    const q = query(dhrRef, orderBy("isoDate", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let data = [];
        snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
        setReports(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching DHR reports:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const formatFilterDate = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return "";
    return `${parts[2]}.${parts[1]}.${parts[0]}`; // dd.MM.yyyy
  };

  const filteredReports = reports.filter((r) => {
    const formattedFilterDate = formatFilterDate(filterDate);
    return (
      (filterDate ? r.date === formattedFilterDate : true) &&
      (filterSite
        ? r.siteName?.toLowerCase().includes(filterSite.toLowerCase())
        : true)
    );
  });

  // --- Summary Stats Calculations ---

  // Sum dieselAvailable (convert to number safely)
  const totalDieselAvailable = filteredReports.reduce((acc, r) => {
    const val = parseFloat(r.dieselAvailable);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  // Total Fault count (assuming faultDetails !=== 'No' or similar)
  const totalFault = filteredReports.reduce((acc, r) => {
    return acc + (r.faultDetails?.toLowerCase() === "Fault" ? 1 : 0);
  }, 0);

  // Total DG run hours sum
  const totalDgRunHrs = filteredReports.reduce((acc, r) => {
    const val = parseFloat(r.dgRunHrsYesterday);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  // Total EB run hours sum
  const totalEbRunHrs = filteredReports.reduce((acc, r) => {
    const val = parseFloat(r.ebRunHrsYesterday);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  // Prepare chart data grouped by siteName (sum dieselAvailable & dgRunHrs)
  // Could limit to top N or all sites
  const siteDataMap = {};
  filteredReports.forEach((r) => {
    if (!r.siteName) return;
    if (!siteDataMap[r.siteName]) {
      siteDataMap[r.siteName] = {
        siteName: r.siteName,
        dieselAvailable: 0,
        dgRunHrsYesterday: 0,
        ebRunHrsYesterday: 0,
        faultDetails: "",
      };
    }
    const dieselVal = parseFloat(r.dieselAvailable);
    const dgVal = parseFloat(r.dgRunHrsYesterday);
    const ebVal = parseFloat(r.ebRunHrsYesterday);
    const fault = r.faultDetails;
    siteDataMap[r.siteName].dieselAvailable += isNaN(dieselVal) ? 0 : dieselVal;
    siteDataMap[r.siteName].dgRunHrsYesterday += isNaN(dgVal) ? 0 : dgVal;
    siteDataMap[r.siteName].ebRunHrsYesterday += isNaN(ebVal) ? 0 : ebVal;
    siteDataMap[r.siteName].faultDetails += isNaN(fault) ? r.faultDetails : fault;
  });

  const chartData = Object.values(siteDataMap);

  const generateTXT = (r) => {
    return `Date: ${r.date}
Region: ${r.region}
Circle: ${r.circle}
Site Name: ${r.siteName}
Diesel Available (Ltr's): ${r.dieselAvailable}
DG run hrs yesterday: ${r.dgRunHrsYesterday}
EB run hrs yesterday: ${r.ebRunHrsYesterday}
EB Status: ${r.ebStatus}
DG Status: ${r.dgStatus}
SMPS Status: ${r.smpsStatus}
UPS Status: ${r.upsStatus}
PAC Status: ${r.pacStatus}
CRV Status: ${r.crvStatus}
Major Activity Planned for the day: ${r.majorActivity}
Inhouse PM: ${r.inhousePM}
Fault details if any: ${r.faultDetails}
`;
  };

  const shareWhatsApp = (txt) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  const shareTelegram = (txt) => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(txt)}`, "_blank");
  };

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredReports);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DHR Data");
    XLSX.writeFile(wb, `DHR_Data_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const downloadTXT = () => {
    const txt = filteredReports.map(generateTXT).join("\n\n----------------\n\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `DHR_Data_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
  };

  if (loading) {
    return <p className="loading">Loading DHR data...</p>;
  }

  

  // Then in your component, add these functions:
  const findRowDgCapacity = (dgRating) => {
    const capacities = oemDieselCphData["DG Capacity"];
    for (let i = 0; i < capacities.length; i++) {
      if (capacities[i] === dgRating) {
        return i;
      }
    }
    return -1;
  };

  const calculateFuel = () => {
    if (!dgCapacity || !dgKw || !dgHmr) {
      setCalculationResult("Please fill all fields");
      return;
    }

    const capacity = parseFloat(dgCapacity);
    const kw = parseFloat(dgKw);
    const hmr = parseFloat(dgHmr);

    // Calculating kWh
    const dgKwh = kw / hmr;

    // Calculating percentage of DG running
    const runPercent = (dgKwh / (capacity * 0.8)) * 100;
    const roundedPercent = Math.round(runPercent);

    // List of missing percentage columns
    const missingColumnList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 18, 20, 21, 23, 24, 25, 26, 29, 36];

    let result = `\n*********This Is For You*********\n\n`;
    result += `🖋 DG Run Percentage: ${roundedPercent}%....\n`;

    if (missingColumnList.includes(roundedPercent)) {
      const adjustableCPH = hmr * 80;
      const segr = kw / adjustableCPH;
      const reqSegr = 3;

      if (segr < reqSegr) {
        let x;
        for (x = 1; x < adjustableCPH; x++) {
          const adjusFuel = 3 * x;
          if (adjusFuel >= kw) {
            break;
          }
        }
        const finalSegr = kw / x;
        
        result += `🖋 As per Load % OEM Diesel CPH: OEM CPH Data Not Available for ${roundedPercent}% Load....\n`;
        result += `🖋 Achieve CPH as per Physical Inspection: 80.00 ltrs/Hour....\n`;
        result += `🖋 Total Fuel Consumption for ${hmr * 60} Minutes DG Running: ${adjustableCPH.toFixed(2)} Ltrs....\n`;
        result += `🖋 On Load/Off Load Consumption Details: On Load ${x} ltrs / Off Load ${(adjustableCPH - x).toFixed(2)} ltrs\n`;
        result += `🖋 SEGR Value: ${finalSegr.toFixed(2)} kW/Ltrs.... as per On Load Consumption\n`;
      } else {
        result += `🖋 As per Load % OEM Diesel CPH: OEM CPH Data Not Available for ${roundedPercent}% Load....\n`;
        result += `🖋 Achieve CPH as per Physical Inspection: 80.00 ltrs/Hour....\n`;
        result += `🖋 Total Fuel Consumption for ${hmr * 60} Minutes DG Running: ${adjustableCPH.toFixed(2)} Ltrs....\n`;
        result += `🖋 SEGR Value: ${segr.toFixed(2)} kW/Ltrs....\n`;
      }
    } else {
      const rowIndex = findRowDgCapacity(capacity);
      const oDCPH = oemDieselCphData[`${roundedPercent}%`][rowIndex];
      const totalFuelConsumption = (oDCPH * 1.05) * hmr;
      const segr = kw / totalFuelConsumption;
      const cph = totalFuelConsumption / hmr;

      result += `🖋 As per Load % OEM Diesel CPH: ${oDCPH.toFixed(2)} ltrs/Hour....\n`;
      result += `🖋 Achieve CPH as per Physical Inspection: ${cph.toFixed(2)} ltrs/Hour....\n`;
      result += `🖋 Total Fuel Consumption for ${hmr * 60} Minutes DG Running: ${totalFuelConsumption.toFixed(2)} Ltrs....\n`;
      result += `🖋 SEGR Value: ${segr.toFixed(2)} kW/Ltrs....\n`;
    }

    setCalculationResult(result);
  };

  return (
    <div className="dhr-dashboard-container">
      <h1 className="dashboard-header">
        <strong>⚡WB DHR Dashboard</strong>
      </h1>

      {/* Summary Stats Panel */}
      <h2 style={{ color: "#030303ff", fontSize: 15 }}>📌 Date: {filterDate}</h2>
      <div className="summary-stats child-container">
        <div className="stat-card">
          <h3>Total Diesel Available (Ltrs)</h3>
          <p>{totalDieselAvailable.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <h3>Total Yesterday DG Run Hours</h3>
          <p>{totalDgRunHrs.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <h3>Total Yesterday EB Run Hours</h3>
          <p>{totalEbRunHrs.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <h3>Total Fault Count</h3>
          <p>{totalFault}</p>
        </div>
      </div>
      <div style={{ color: "#000000ff", fontSize: 12 }}>"<strong>Click</strong>'' The Below 👇<strong>"CPH/SEGR Manager"</strong> Button <strong>||</strong> You can calculate DG <strong>load %, SEGR, CPH</strong> as per <strong>"Cummins Disign CHP"</strong> by giving only Three Inputs <strong>(Select DG Capacity - Generate kW - DG Run Hrs)</strong> </div>
      <button 
        className="segr-manage-btn" 
        onClick={() => setShowFuelModal(true)}
      >
        💥 CPH/SEGR Manager
      </button>
      
      {showFuelModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '600px'}}>
            <h2>Cummins DG CPH/SEGR Monitor</h2>
            <h3>WB-AirtelMSCs</h3>
            
            <div className="form-group">
              <label>Select DG Capacity:</label>
              <select 
                value={selectedCapacity}
                onChange={(e) => {
                  setSelectedCapacity(e.target.value);
                  setDgCapacity(parseFloat(e.target.value));
                }}
                className="form-control"
              >
                <option value="">Select Capacity</option>
                {dgCapacityOptions.map((option, index) => (
                  <option key={index} value={parseFloat(option)}>{option}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Enter DG Generated kW:</label>
              <input
                type="number"
                value={dgKw}
                onChange={(e) => setDgKw(e.target.value)}
                className="form-control"
                placeholder="Enter kW"
              />
            </div>
            
            <div className="form-group">
              <label>Enter DG Hour Meter Reading:</label>
              <input
                type="number"
                value={dgHmr}
                onChange={(e) => setDgHmr(e.target.value)}
                className="form-control"
                placeholder="Enter hours"
                step="0.1"
              />
            </div>
            
            <div className="button-group">
              <button 
                onClick={calculateFuel}
                className="btn-primary"
              >
                Calculate
              </button>
              <button 
                onClick={() => {
                  setShowFuelModal(false);
                  setCalculationResult("");
                }}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
            
            {calculationResult && (
              <div className="result-container">
                <h4>Calculation Results:</h4>
                <pre>{calculationResult}</pre>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Manage Site Wise LT Panel Auto/Manual Operation */}
      { userData?.site === "Asansol" ? (
        // <div style={{ color: "#6b7280", fontSize: 12 }}>📌 Note: For Asansol Site, Please Click Below Button to Manage LT Panel Auto/Manual Operation </div>
        <button className="segr-manage-btn" onClick={() => navigate("/asansol-operation")}>
          📟 LT Panel Auto/Manual Operation Asansol
        </button>
      ) : null

      }

      { userData?.site === "Berhampore" ? (
        // <div style={{ color: "#6b7280", fontSize: 12 }}>📌 Note: For Asansol Site, Please Click Below Button to Manage LT Panel Auto/Manual Operation </div>
        <button className="segr-manage-btn" onClick={() => navigate("/Berhampore-operation")}>
          📟 LT Panel Auto/Manual Operation Berhampore
        </button>
      ) : null

      }
      {/* <button className="segr-manage-btn" onClick={() => navigate("/asansol-operation")}>
          📟 LT Panel Auto/Manual Operation Asansol
        </button>
      <button className="segr-manage-btn" onClick={() => navigate("/Berhampore-operation")}>
          📟 LT Panel Auto/Manual Operation Berhampore
        </button> */}

      {/* Filters */}
      <div className="dhr-filters">
        <div style={{ color: "#000000ff", fontSize: 12 }}>Filter By Date</div>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
        />
        <div style={{ color: "#000000ff", fontSize: 12 }}>Filter By Site</div>
        <input
          type="text"
          placeholder="Search by site"
          value={filterSite}
          onChange={(e) => setFilterSite(e.target.value)}
        />
        <button className="btn-secondary pm-manage-btn" onClick={() => navigate("/create-dhr")}>
          ➕ Create / Edit {userData?.site} DHR(S)
        </button>
        <span className="separator">|</span>
        <button className="pm-manage-btn" onClick={() => navigate("/create-big-dhr")}>
          ➕ Create / Edit {userData?.site} DHR(B)
        </button>
        <span className="separator">|</span>
        <button className="download-btn" onClick={downloadExcel}>
          ⬇️ Download Excel
        </button>
        <span className="separator">|</span>
        <button className="download-btn" onClick={downloadTXT}>
          ⬇️ Download TXT
        </button>
      </div>


      {/* Chart */}
      <div className="chart-container">
        <h3>Diesel Available & DG / EB Run Hours by Site</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 40, left: 20, bottom: 20 }}>
            <CartesianGrid stroke="#f5f5f5" />
            <XAxis dataKey="siteName" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="dieselAvailable" barSize={40} fill="#413ea0" name="Diesel Available (L)" />
            <Line type="monotone" dataKey="dgRunHrsYesterday" stroke="#ff7300" name="DG Run Yesterday (Hrs)" />
            <Line type="monotone" dataKey="ebRunHrsYesterday" stroke="#387908" name="EB Run Yesterday (Hrs)" />
            <Line type="monotone" dataKey="faultDetails" stroke="#f1592aff" name="Fault Details" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Notice Board */}
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
                  const docRef = doc(db, "config", "dhr_dashboard_instruction");
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
            {["Admin", "Super Admin"].includes(userRole) && (
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

      {/* Data Table */}
      {filteredReports.length === 0 ? (
        <p>No DHR records found.</p>
      ) : (
        <table className="dhr-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Region</th>
              <th>Circle</th>
              <th>Site Name</th>
              <th>Diesel Available</th>
              <th>DG Run Hrs Yesterday</th>
              <th>EB Run Hrs Yesterday</th>
              <th>EB Status</th>
              <th>DG Status</th>
              <th>SMPS</th>
              <th>UPS</th>
              <th>PAC</th>
              <th>CRV</th>
              <th>Major Activity</th>
              <th>Inhouse PM</th>
              <th>Fault Details</th>
              <th>Last Edited By</th>
              <th>Last Edit Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.map((r, i) => (
              <tr key={i}>
                <td>{r.date}</td>
                <td>{r.region}</td>
                <td>{r.circle}</td>
                <td>{r.siteName}</td>
                <td>{r.dieselAvailable}</td>
                <td>{r.dgRunHrsYesterday}</td>
                <td>{r.ebRunHrsYesterday}</td>
                <td>{r.ebStatus}</td>
                <td>{r.dgStatus}</td>
                <td>{r.smpsStatus}</td>
                <td>{r.upsStatus}</td>
                <td>{r.pacStatus}</td>
                <td>{r.crvStatus}</td>
                <td>{r.majorActivity}</td>
                <td>{r.inhousePM}</td>
                <td>{r.faultDetails}</td>
                <td>{r.lastEditor || "Unknown"}</td>
                <td>
                  {r.lastEditTime
                    ? format(new Date(r.lastEditTime), "dd.MM.yyyy HH:mm")
                    : "N/A"}
                </td>
                <td>
                  <button
                    className="view-btn"
                    onClick={() => {
                      setSelectedTxt(generateTXT(r));
                      setShowModal(true);
                    }}
                  >
                    👁 View
                  </button>
                  <button
                    className="share-btn"
                    onClick={() => shareWhatsApp(generateTXT(r))}
                    title="Share WhatsApp"
                  >
                    ➤What'sApp
                  </button>
                  <button
                    className="share-btn"
                    onClick={() => shareTelegram(generateTXT(r))}
                    title="Share Telegram"
                  >
                    ➤Telegram
                  </button>
                  {showModal && (
                    <div className="modal-overlay">
                      <div className="modal-content">
                        <pre>{selectedTxt}</pre>
                        <button
                          onClick={() => setShowModal(false)}
                          className="close-btn"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      
    </div>
  );
}

