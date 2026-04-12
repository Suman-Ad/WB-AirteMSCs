import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { Link } from "react-router-dom";

const LoadDashboard = ({ userData }) => {
  const [data, setData] = useState([]);
  const [totalLoad, setTotalLoad] = useState(0);

  const siteKey = userData?.siteId;

  useEffect(() => {
    if (siteKey) fetchData();
  }, [siteKey]);

  const calculateLoad = (d) => {
    const voltage = Number(d.voltagePP || 0);

    const currentR = Number(d.currentR || 0);
    const currentY = Number(d.currentY || 0);
    const currentB = Number(d.currentB || 0);

    const avgCurrent = (currentR + currentY + currentB) / 3;

    const pf = Number(d.powerFactor || 0.9);

    // 3-phase load formula
    const loadKW = (1.732 * voltage * avgCurrent * pf) / 1000;

    return loadKW || 0;
  };

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];

      const snapshot = await getDocs(
        collection(db, "loadData", siteKey, "dailyData", today, "entries")
      );

      let total = 0;
      let list = [];

      snapshot.forEach((doc) => {
        const d = doc.data();

        let loadKW = 0;

        // 🔥 Equipment-wise logic
        if (d.equipmentType === "SMPS") {
          // DC Load (approx)
          const dcV = Number(d.dcVoltage || 0);
          const dcI = Number(d.dcCurrent || 0);
          loadKW = (dcV * dcI) / 1000;
        } else if (d.equipmentType === "UPS") {
          loadKW = Number(d.runningKW || 0);
        } else {
          // LT / DG → use 3-phase formula
          loadKW = calculateLoad(d);
        }

        total += loadKW;

        list.push({
          ...d,
          loadKW,
        });
      });

      setData(list);
      setTotalLoad(total);
    } catch (err) {
      console.error("Error fetching load data:", err);
    }
  };

  return (
    <div className="daily-log-container">
      <h2>Site Load Dashboard</h2>

      <Link to="/load-entry" className="manage-btn">
        ➕ Add Load Entry
      </Link>

      <h3>Total Load: {totalLoad.toFixed(2)} kW</h3>

      <table>
        <thead>
          <tr>
            <th>Equipment</th>
            <th>Type</th>
            <th>Voltage (P-P)</th>
            <th>R</th>
            <th>Y</th>
            <th>B</th>
            <th>PF</th>
            <th>Load (kW)</th>
          </tr>
        </thead>

        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <td>{row.equipmentId}</td>
              <td>{row.equipmentType}</td>
              <td>{row.voltagePP || "-"}</td>
              <td>{row.currentR || "-"}</td>
              <td>{row.currentY || "-"}</td>
              <td>{row.currentB || "-"}</td>
              <td>{row.powerFactor || "-"}</td>
              <td>{row.loadKW.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LoadDashboard;