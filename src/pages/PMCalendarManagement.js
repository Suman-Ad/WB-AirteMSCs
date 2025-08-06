// src/pages/PMCalendar.js
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import "../assets/PMCalendar.css";

// Dynamic Year Generation (current year + next year)
const currentYear = new Date().getFullYear();
const years = [currentYear, currentYear + 1];

// Region-Circle Structure
const regions = {
  East: ["BR & JH", "NESA", "OR", "WB"],
  West: ["GUJ", "MPCG", "ROM"],
  North: ["DEL", "HR", "PJ", "RJ", "UP", "UK"],
  South: ["AP", "KA", "KL", "TN", "TS"]
};

// Site List Structure
const siteList = {
  "East": {
    "BR & JH": ["Patna", "Jharkhand"],
    "WB": ["Andaman", "Asansol", "Berhampore", "DLF", "Globsyn", "Infinity-I", "Infinity-II", "Kharagpur", "Mira Tower", "New Alipore", "SDF", "Siliguri"],
  },
  "West": {
    "GUJ": ["Ahmedabad"],
    "MPCG": ["Indore"]
  },
  "North": {
    "DEL": ["DLF", "Mira Tower"],
    "HR": ["GLOBSYN"]
  },
  "South": {
    "KA": ["Infinity-I", "Infinity-II"],
    "TS": ["Siliguri"]
  }
};

// Equipment Categories
const equipmentCategories = ["Power", "HVAC", "UPS", "Fire Safety"];

// PM Frequencies
const pmFrequencies = ["Monthly", "Quarterly", "Half-Yearly", "Yearly"];

// Helper function to generate months for a year
const generateMonths = (year) => {
  return Array.from({ length: 12 }, (_, i) => 
    `${year}-${String(i + 1).padStart(2, '0')}`
  );
};

// Helper function to generate quarters for a year
const generateQuarters = (year) => {
  return {
    [`Q1 ${year}`]: [`${year}-04`, `${year}-05`, `${year}-06`],
    [`Q2 ${year}`]: [`${year}-07`, `${year}-08`, `${year}-09`],
    [`Q3 ${year}`]: [`${year}-10`, `${year}-11`, `${year}-12`],
    [`Q4 ${year}`]: [`${year + 1}-01`, `${year + 1}-02`, `${year + 1}-03`]
  };
};

const PMCalendarManagement = ({ userData }) => {
  const [selectedSite, setSelectedSite] = useState(
    userData.role === "Super User" ? userData.site : ""
  );
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [calendarData, setCalendarData] = useState({ inhouse: {}, vendor: {} });
  const [filteredSites, setFilteredSites] = useState([]);
  
  // Generate months and quarters for selected year
  const months = generateMonths(selectedYear);
  const quarters = generateQuarters(selectedYear);

  // Form states
  const [newInHouse, setNewInHouse] = useState({
    region: "",
    circle: "",
    equipment_category: "",
    equipment: "",
    frequency: "Monthly",
    make: "",
    capacity: "",
    qty: 1,
    plan_date: ""
  });

  const [newVendor, setNewVendor] = useState({
    region: "",
    circle: "",
    equipment_category: "",
    equipment: "",
    make: "",
    capacity: "",
    qty: 1,
    amc_partner: "",
    frequency: "Quarterly",
    plan_date: ""
  });

  const isAdmin = ["Admin", "Super Admin", "Super User"].includes(userData.role);
  const canEdit = isAdmin || (userData.role === "Super User" && userData.site === selectedSite);

  // Update filtered sites when region/circle changes
  useEffect(() => {
    if (newInHouse.region && newInHouse.circle) {
      setFilteredSites(siteList[newInHouse.region]?.[newInHouse.circle] || []);
    } else {
      setFilteredSites([]);
    }
  }, [newInHouse.region, newInHouse.circle]);

  // Fetch calendar data
  useEffect(() => {
    if (!selectedSite) return;

    const fetchData = async () => {
      try {
        const docRef = doc(db, "pm_calendar", `${selectedSite}_${selectedYear}`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCalendarData(docSnap.data());
        } else {
          setCalendarData({ inhouse: {}, vendor: {} });
        }
      } catch (err) {
        console.error("Failed to load calendar data:", err);
      }
    };

    fetchData();
  }, [selectedSite, selectedYear]);

  // Update circle options when region changes
  useEffect(() => {
    if (newInHouse.region && !regions[newInHouse.region].includes(newInHouse.circle)) {
      setNewInHouse(prev => ({ ...prev, circle: "" }));
    }
    if (newVendor.region && !regions[newVendor.region].includes(newVendor.circle)) {
      setNewVendor(prev => ({ ...prev, circle: "" }));
    }
  }, [newInHouse.region, newVendor.region]);

  // Add In-House PM
  const handleAddInHouse = async (month) => {
    if (!newInHouse.equipment || !newInHouse.equipment_category) return;

    const updated = { ...calendarData };
    if (!updated.inhouse[month]) updated.inhouse[month] = [];

    updated.inhouse[month].push({
      ...newInHouse,
      site: selectedSite,
      year: selectedYear,
      plan_date: newInHouse.plan_date || ""
    });

    setCalendarData(updated);
    setNewInHouse({
      ...newInHouse,
      equipment: "",
      plan_date: ""
    });

    await setDoc(doc(db, "pm_calendar", `${selectedSite}_${selectedYear}`), updated);
  };

  // Add Vendor PM
  const handleAddVendor = async (qtr) => {
    if (!newVendor.equipment || !newVendor.amc_partner) return;

    const updated = { ...calendarData };
    if (!updated.vendor[qtr]) updated.vendor[qtr] = [];

    updated.vendor[qtr].push({
      ...newVendor,
      site: selectedSite,
      year: selectedYear,
      plan_date: newVendor.plan_date || ""
    });

    setCalendarData(updated);
    setNewVendor({
      ...newVendor,
      equipment: "",
      plan_date: ""
    });

    await setDoc(doc(db, "pm_calendar", `${selectedSite}_${selectedYear}`), updated);
  };

  return (
    <div className="pm-calendar-container">
      <h2>🗓 PM Calendar – {selectedSite || "Select Site"}</h2>

      {/* Year and Site Selection */}
      <div className="pm-controls">
        {isAdmin && (
          <>
            <select
              value={newInHouse.region}
              onChange={(e) => setNewInHouse({...newInHouse, region: e.target.value})}
            >
              <option value="">Select Region</option>
              {Object.keys(regions).map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>

            <select
              value={newInHouse.circle}
              onChange={(e) => setNewInHouse({...newInHouse, circle: e.target.value})}
              disabled={!newInHouse.region}
            >
              <option value="">Select Circle</option>
              {newInHouse.region && regions[newInHouse.region].map(circle => (
                <option key={circle} value={circle}>{circle}</option>
              ))}
            </select>

            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              disabled={!newInHouse.circle}
            >
              <option value="">Select Site</option>
              {filteredSites.map(site => (
                <option key={site} value={site}>{site}</option>
              ))}
            </select>
          </>
        )}

        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
        >
          {years.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* In-House PM Section */}
      <h3 className="section-title">In-House PM Schedule</h3>
      {months.map((month) => (
        <div key={month} className="pm-section">
          <h4>{month}</h4>
          
          {canEdit && (
            <div className="pm-add-form">
              {/* Equipment Details */}
              <select
                value={newInHouse.equipment_category}
                onChange={(e) => setNewInHouse({...newInHouse, equipment_category: e.target.value})}
              >
                <option value="">Select Category</option>
                {equipmentCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Equipment Name"
                value={newInHouse.equipment}
                onChange={(e) => setNewInHouse({...newInHouse, equipment: e.target.value})}
              />

              <select
                value={newInHouse.frequency}
                onChange={(e) => setNewInHouse({...newInHouse, frequency: e.target.value})}
              >
                {pmFrequencies.map(freq => (
                  <option key={freq} value={freq}>{freq}</option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Make"
                value={newInHouse.make}
                onChange={(e) => setNewInHouse({...newInHouse, make: e.target.value})}
              />

              <input
                type="text"
                placeholder="Capacity"
                value={newInHouse.capacity}
                onChange={(e) => setNewInHouse({...newInHouse, capacity: e.target.value})}
              />

              <input
                type="number"
                placeholder="Qty"
                value={newInHouse.qty}
                onChange={(e) => setNewInHouse({...newInHouse, qty: parseInt(e.target.value) || 1})}
                min="1"
              />

              <input
                type="date"
                placeholder="Plan Date"
                value={newInHouse.plan_date}
                onChange={(e) => setNewInHouse({...newInHouse, plan_date: e.target.value})}
              />

              <button onClick={() => handleAddInHouse(month)}>➕ Add</button>
            </div>
          )}

          {/* In-House PM List */}
          <table className="pm-table">
            <thead>
              <tr>
                <th>Region</th>
                <th>Circle</th>
                <th>Category</th>
                <th>Equipment</th>
                <th>Frequency</th>
                <th>Make</th>
                <th>Capacity</th>
                <th>Qty</th>
                <th>Plan Date</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {(calendarData?.inhouse?.[month] || []).map((item, index) => (
                <tr key={`inhouse-${month}-${index}`}>
                  <td>{item.region}</td>
                  <td>{item.circle}</td>
                  <td>{item.equipment_category}</td>
                  <td>{item.equipment}</td>
                  <td>{item.frequency}</td>
                  <td>{item.make}</td>
                  <td>{item.capacity}</td>
                  <td>{item.qty}</td>
                  <td>
                    {canEdit ? (
                      <input
                        type="date"
                        value={item.plan_date}
                        onChange={(e) => {
                          const updated = { ...calendarData };
                          updated.inhouse[month][index].plan_date = e.target.value;
                          setCalendarData(updated);
                          setDoc(doc(db, "pm_calendar", `${selectedSite}_${selectedYear}`), updated);
                        }}
                      />
                    ) : (
                      item.plan_date || "Not Set"
                    )}
                  </td>
                  {canEdit && (
                    <td>
                      <button
                        onClick={() => {
                          const updated = { ...calendarData };
                          updated.inhouse[month].splice(index, 1);
                          setCalendarData(updated);
                          setDoc(doc(db, "pm_calendar", `${selectedSite}_${selectedYear}`), updated);
                        }}
                      >
                        ❌
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Vendor PM Section */}
      <h3 className="section-title">Vendor PM Schedule</h3>
      {Object.entries(quarters).map(([qtr, months]) => (
        <div key={qtr} className="pm-section">
          <h4>{qtr} ({months.join(", ")})</h4>

          {canEdit && (
            <div className="pm-add-form">
              {/* Vendor Details */}
              <input
                type="text"
                placeholder="AMC Partner"
                value={newVendor.amc_partner}
                onChange={(e) => setNewVendor({...newVendor, amc_partner: e.target.value})}
              />

              <select
                value={newVendor.equipment_category}
                onChange={(e) => setNewVendor({...newVendor, equipment_category: e.target.value})}
              >
                <option value="">Select Category</option>
                {equipmentCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Equipment Name"
                value={newVendor.equipment}
                onChange={(e) => setNewVendor({...newVendor, equipment: e.target.value})}
              />

              <input
                type="text"
                placeholder="Make"
                value={newVendor.make}
                onChange={(e) => setNewVendor({...newVendor, make: e.target.value})}
              />

              <input
                type="text"
                placeholder="Capacity"
                value={newVendor.capacity}
                onChange={(e) => setNewVendor({...newVendor, capacity: e.target.value})}
              />

              <input
                type="number"
                placeholder="Qty"
                value={newVendor.qty}
                onChange={(e) => setNewVendor({...newVendor, qty: parseInt(e.target.value) || 1})}
                min="1"
              />

              <select
                value={newVendor.frequency}
                onChange={(e) => setNewVendor({...newVendor, frequency: e.target.value})}
              >
                {pmFrequencies.map(freq => (
                  <option key={freq} value={freq}>{freq}</option>
                ))}
              </select>

              <input
                type="date"
                placeholder="Plan Date"
                value={newVendor.plan_date}
                onChange={(e) => setNewVendor({...newVendor, plan_date: e.target.value})}
              />

              <button onClick={() => handleAddVendor(qtr)}>➕ Add</button>
            </div>
          )}

          {/* Vendor PM List */}
          <table className="pm-table">
            <thead>
              <tr>
                <th>Region</th>
                <th>Circle</th>
                <th>AMC Partner</th>
                <th>Category</th>
                <th>Equipment</th>
                <th>Make</th>
                <th>Capacity</th>
                <th>Qty</th>
                <th>Frequency</th>
                <th>Plan Date</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {(calendarData?.vendor?.[qtr] || []).map((item, index) => (
                <tr key={`vendor-${qtr}-${index}`}>
                  <td>{item.region}</td>
                  <td>{item.circle}</td>
                  <td>{item.amc_partner}</td>
                  <td>{item.equipment_category}</td>
                  <td>{item.equipment}</td>
                  <td>{item.make}</td>
                  <td>{item.capacity}</td>
                  <td>{item.qty}</td>
                  <td>{item.frequency}</td>
                  <td>
                    {canEdit ? (
                      <input
                        type="date"
                        value={item.plan_date}
                        onChange={(e) => {
                          const updated = { ...calendarData };
                          updated.vendor[qtr][index].plan_date = e.target.value;
                          setCalendarData(updated);
                          setDoc(doc(db, "pm_calendar", `${selectedSite}_${selectedYear}`), updated);
                        }}
                      />
                    ) : (
                      item.plan_date || "Not Set"
                    )}
                  </td>
                  {canEdit && (
                    <td>
                      <button
                        onClick={() => {
                          const updated = { ...calendarData };
                          updated.vendor[qtr].splice(index, 1);
                          setCalendarData(updated);
                          setDoc(doc(db, "pm_calendar", `${selectedSite}_${selectedYear}`), updated);
                        }}
                      >
                        ❌
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

export default PMCalendarManagement;