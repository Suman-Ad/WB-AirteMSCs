import React, { useEffect, useState } from "react";
import { collectionGroup, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import "../assets/DailyDGLog.css"; // reuse your log CSS
import { useNavigate, useLocation } from "react-router-dom";
import { calculateFields } from '../utils/calculatedDGLogs';


// Optional: Assume userData comes as prop/context for security
const AllSitesDGLogs = ({ userData }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const navigate = useNavigate();
    const location = useLocation();
    const { monthKey, totalKwh, siteConfig } = location.state; // default month
    // You need to provide correct siteConfig for each site (dgCount, ebCount, solarCount)
    const calculatedLogs = logs.map(log => calculateFields(log, siteConfig));


    useEffect(() => {
        // Only let Admin/Super Admin access this page!
        if (!userData || (userData.role !== "Admin" && userData.role !== "Super Admin")) {
            navigate("/"); // redirect unauthorized users
            return;
        }

        const fetchAllLogs = async () => {
            setLoading(true);
            setError("");
            try {
                const snapshot = await getDocs(collectionGroup(db, monthKey)); // get all site logs
                console.log("Fetched logs snapshot:", snapshot);
                const logsArr = [];
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    // Try to get the parent (site) ID from the document path
                    const pathParts = docSnap.ref.path.split('/');
                    const siteId = pathParts.length > 1 ? pathParts[1] : "Unknown Site";
                    logsArr.push({
                        id: docSnap.id,
                        site: data.site || siteId, // fallback logic for site name/id
                        ...data,
                    });
                });
                setLogs(logsArr);
                console.log("Fetched all site logs:", logsArr);
            } catch (err) {
                setError("Error fetching logs: " + err.message);
            }
            setLoading(false);
        };

        fetchAllLogs();
    }, [userData, navigate]);

    if (loading) return <div>Loading all site logs…</div>;
    if (error) return <div style={{ color: "red" }}>{error}</div>;

    return (
        <div className="dglog-container">
            <h2>All Sites DG Logs</h2>
            <table className="dglog-table">
                <thead>
                    <tr>
                        <th>Site</th>
                        <th>Date</th>
                        <th>Total Power Fail Hrs</th>
                        <th>Total DG Run Hours</th>
                        <th>Office kW Consumption</th>
                        <th>Cooling Load</th>
                        <th>IT Load</th>
                        <th>Total Site Runing Load(kW)</th>
                        <th>PUE</th>
                        <th>DG1 Fuel Filling</th>
                        <th>DG2 Fuel Filling</th>
                        <th>Total DG KWH</th>
                        <th>Total EB KWH</th>
                        <th>Total Unit Consumption</th>
                        <th>Total DG Fuel Con</th>
                        <th>Entered By</th>
                    </tr>
                </thead>
                <tbody>
                    {logs.length === 0 ? (
                        <tr><td colSpan={6}>No logs found</td></tr>
                    ) : (
                        logs.map((log, idx) => (
                            <tr key={log.id}>
                                <td>{log.site}</td>
                                <td>{log.Date}</td>
                                <td>{(calculatedLogs[idx]["Total DG Onload Hours"]).toFixed(1)}</td>
                                <td>{(calculatedLogs[idx]["Total DG Onload Hours"] + calculatedLogs[idx]["Total DG Offload Hours"]).toFixed(1)}</td>
                                <td>{(calculatedLogs[idx]["Office kW Consumption"] / 24).toFixed(2)}</td>
                                <td>{(calculatedLogs[idx]["Cooling kW Consumption"]).toFixed(2)}</td>
                                <td>{((calculatedLogs[idx]["Total IT Load KWH"])).toFixed(2)}</td>
                                <td>{((calculatedLogs[idx]["Site Running kW"])).toFixed(2)}</td>
                                <td>{calculatedLogs[idx]["PUE"]}</td>
                                <td>{log["DG-1 Fuel Filling"] || ""}</td>
                                <td>{log["DG-2 Fuel Filling"] || ""}</td>
                                <td>{calculatedLogs[idx]["Total DG KWH"]}</td>
                                <td>{calculatedLogs[idx]["Total EB KWH"]}</td>
                                <td>{calculatedLogs[idx]["Total Unit Consumption"]}</td>
                                <td>{calculatedLogs[idx]["Total DG Fuel"]}</td>
                                <td>{log["updatedBy"]}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default AllSitesDGLogs;
