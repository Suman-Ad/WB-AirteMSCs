import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
    collection,
    getDocs,
    query,
    where,
    doc,
    updateDoc,
    addDoc,
    orderBy,
    serverTimestamp,
    runTransaction
} from "firebase/firestore";
import { set } from "date-fns";
import * as XLSX from "xlsx";


export default function CLApprovalPage({ currentUser }) {
    const [requests, setRequests] = useState([]);
    const [siteUsers, setSiteUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState("pending");
    const [clApproving, setCLApproving] = useState(false);
    const [clRejecting, setCLRejecting] = useState(false);
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);

    const [summary, setSummary] = useState([]);
    const [summaryLoading, setSummaryLoading] = useState(true);



    // Load all site users (needed for backup selection)
    useEffect(() => {
        if (!currentUser?.site) return;

        async function loadUsers() {
            const q = query(
                collection(db, "users"),
                where("site", "==", currentUser.site)
            );

            const snap = await getDocs(q);
            const arr = [];
            snap.forEach((d) => arr.push({ uid: d.id, ...d.data() }));
            setSiteUsers(arr);
        }

        async function loadSummary() {
            setSummaryLoading(true);

            const usersSnap = await getDocs(
                query(collection(db, "users"), where("site", "==", currentUser.site))
            );

            const summaryMap = {};

            // init users
            usersSnap.forEach(u => {
                summaryMap[u.id] = {
                    uid: u.id,
                    name: u.data().name || u.data().fullName || "Unknown",
                    empId: u.data().empId || "",
                    clUsed: 0,
                    clPending: 0,
                    otCount: 0,
                    monthlyCL: Array(12).fill(0),
                    monthlyOT: Array(12).fill(0)
                };
            });

            // ---- CL COUNT (YEAR FILTER) ----
            for (const uid of Object.keys(summaryMap)) {
                const lrSnap = await getDocs(
                    collection(db, "leaveRequests", uid, "items")
                );

                lrSnap.forEach(d => {
                    const data = d.data();
                    // if (data.reason !== "CL") return;

                    const year = d.id.split("-")[0];
                    if (Number(year) !== Number(selectedYear)) return;

                    const monthIdx = Number(d.id.split("-")[1]) - 1;

                    if (data.status === "approved") {
                        summaryMap[uid].clUsed++;
                        summaryMap[uid].monthlyCL[monthIdx]++;
                    }

                    if (data.status === "pending") {
                        summaryMap[uid].clPending++;
                    }
                });
            }

            // ---- OT COUNT (MONTHLY + YEAR) ----
            const dutySnap = await getDocs(
                query(collection(db, "dutyRoster"), where("site", "==", currentUser.site))
            );

            dutySnap.forEach(d => {
                const date = d.id.split("_")[1]; // site_YYYY-MM-DD
                if (!date) return;

                const [yr, mo] = date.split("-");
                if (Number(yr) !== Number(selectedYear)) return;

                const monthIdx = Number(mo) - 1;

                const ot = d.data().ot || {};
                Object.values(ot).forEach(arr => {
                    (arr || []).forEach(uid => {
                        if (summaryMap[uid]) {
                            summaryMap[uid].otCount++;
                            summaryMap[uid].monthlyOT[monthIdx]++;
                        }
                    });
                });
            });

            setSummary(Object.values(summaryMap));
            setSummaryLoading(false);
        }

        loadSummary();

        loadUsers();
    }, [currentUser, selectedYear]);

    // Load CL requests for this site
    useEffect(() => {
        if (!currentUser?.site) return;
        async function loadRequests() {
            setLoading(true);
            let arr = [];

            // Step 1: get all users of this site
            const userSnap = await getDocs(
                query(collection(db, "users"), where("site", "==", currentUser.site))
            );

            for (const userDoc of userSnap.docs) {
                const uid = userDoc.id;

                // Step 2: load leaveRequests/{uid}/*
                const LR = collection(db, "leaveRequests", uid, "items");
                const lrSnap = await getDocs(LR);

                lrSnap.forEach((d) => {
                    arr.push({ id: d.id, userId: uid, ...d.data() });
                });
            }

            setRequests(arr);
            setLoading(false);
        }

        loadRequests();
    }, [currentUser]);

    async function approveCL(req) {
        // require backup accepted
        if (req.backupStatus && req.backupStatus !== "accepted") {
            alert("Cannot approve: backup user has not accepted. Backup status: " + req.backupStatus);
            return;
        }

        setCLApproving(true);

        const ref = doc(db, "leaveRequests", req.userId, "items", req.id);

        await updateDoc(ref, {
            status: "approved",
            approvedBy: currentUser.uid,
            approvedAt: serverTimestamp()
        });

        // add these imports at top of file if not present:
        // import { doc, runTransaction } from "firebase/firestore";

        try {
            // duty doc id used across your app:
            const dutyDocId = `${currentUser.site}_${req.id}`; // req.id is YYYY-MM-DD
            const dutyRef = doc(db, "dutyRoster", dutyDocId);

            await runTransaction(db, async (tx) => {
                const dutySnap = await tx.get(dutyRef);

                if (!dutySnap.exists()) {
                    // nothing to update (no roster for that date)
                    console.warn("No dutyRoster doc for", dutyDocId);
                    return;
                }

                const duty = dutySnap.data();

                // find which shift the requester currently holds
                const shifts = duty.shifts || {};
                let foundShift = null;

                for (const s of Object.keys(shifts)) {
                    const arr = shifts[s] || [];
                    if (arr.includes(req.userId)) {
                        foundShift = s;
                        break;
                    }
                }

                if (!foundShift) {
                    console.warn("Requester not found in any shift on", dutyDocId);
                    return;
                }

                // remove original user from the shift
                const updatedShiftArr = (shifts[foundShift] || []).filter((u) => u !== req.userId);

                // add backup user (if provided) — avoid duplicate
                const backupUid = req.backupUserId || null;
                if (backupUid) {
                    if (!updatedShiftArr.includes(backupUid)) {
                        updatedShiftArr.push(backupUid);
                    }
                }

                // prepare OT map (structure: { M: [uids], E: [...], N: [...] })
                const otMap = duty.ot ? { ...duty.ot } : {};
                if (backupUid) {
                    if (!otMap[foundShift]) otMap[foundShift] = [];
                    if (!otMap[foundShift].includes(backupUid)) {
                        otMap[foundShift].push(backupUid);
                    }
                }

                // update transaction: set shifts.<foundShift> and ot
                const shiftUpdates = {
                    [`shifts.${foundShift}`]: updatedShiftArr,
                };
                const updates = {
                    // [`shifts.${foundShift}`]: updatedShiftArr,
                    ot: otMap,
                    updatedAt: serverTimestamp(),
                    replacements: {
                        ...(duty.replacements || {}),
                        [req.userId]: {
                            replacedBy: backupUid || null,
                            replacedAt: serverTimestamp(),
                            type: "CL"
                        }
                    }
                };

                // Merge everything safely
                tx.update(dutyRef, shiftUpdates);
                tx.set(dutyRef, updates, { merge: true });
            });

            // Notify backup user (if any)
            if (req.backupUserId) {
                await addDoc(collection(db, "notifications", req.backupUserId, "items"), {
                    title: "OT Duty Assigned",
                    message: `You have been assigned as backup (OT) for ${req.userName || req.userId} on ${req.id}.`,
                    date: req.id,
                    site: currentUser.site,
                    read: false,
                    createdAt: serverTimestamp(),
                    actionType: "ot_assignment",
                    originalUserId: req.userId,
                    shiftAssigned: null // you can set this if you want; UI can infer by reading duty doc
                });
            }

            console.log("Duty roster updated: backup assigned as OT for", req.id);
        } catch (err) {
            console.error("Error auto-updating duty roster after CL approval:", err);
        }



        // Notify Applicant
        await addDoc(collection(db, "notifications", req.userId, "items"), {
            title: "CL Request Approved",
            message: `Your CL for ${req.id} has been approved.`,
            date: req.id,
            site: currentUser.site,
            read: false,
            createdAt: serverTimestamp(),
        });

        setCLApproving(false);
        alert("CL Approved & Notifications sent!");
        window.location.reload();
    }


    async function rejectCL(req) {
        setCLRejecting(true);
        const ref = doc(db, "leaveRequests", req.userId, "items", req.id);

        await updateDoc(ref, {
            status: "rejected",
            approvedBy: currentUser.uid,
            approvedAt: new Date(),
        });

        // Notify Applicant
        await addDoc(collection(db, "notifications", req.userId, "items"), {
            title: "CL Request Rejected",
            message: `Your CL for ${req.id} has been rejected.`,
            date: req.id,
            site: currentUser.site,
            read: false,
            createdAt: new Date(),
        });
        setCLRejecting(false);
        alert("CL Rejected & Applicant Notified!");
        window.location.reload();
    }

    async function updateBackup(req, newBackupUid) {
        const ref = doc(db, "leaveRequests", req.userId, req.id);

        const backupUser = siteUsers.find((u) => u.uid === newBackupUid);

        await updateDoc(ref, {
            backupUserId: newBackupUid,
            backupUserName: backupUser?.fullName || "",
        });

        alert("Backup person updated!");
    }

    const filtered = requests.filter((r) => r.status === filterStatus);

    function exportSummaryToExcel() {
        const data = summary.map(u => ({
            Name: u.name,
            EmpID: u.empId,
            CL_Used: u.clUsed,
            CL_Pending: u.clPending,
            OT_Count: u.otCount
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "CL_OT_Summary");

        XLSX.writeFile(wb, `CL_OT_Summary_${selectedYear}.xlsx`);
    }


    return (
        <div className="daily-log-container">
            <div style={{ marginBottom: "12px" }}>
                <label style={{ marginRight: "8px" }}>Year:</label>
                <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(Number(e.target.value))}
                >
                    {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            </div>

            <h2 className="text-xl font-semibold mb-2">CL / OT Summary</h2>

            <button
                onClick={() => exportSummaryToExcel()}
                style={{
                    background: "#16a34a",
                    color: "white",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    marginBottom: "10px",
                }}
            >
                Export Excel
            </button>
            {summaryLoading ? (
                <div>Loading summary...</div>
            ) : (
                <div style={{ overflowX: "auto", marginBottom: "20px", maxHeight: "300px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead style={{ background: "#f3f4f6" }}>
                            <tr>
                                <th style={th}>Name</th>
                                <th style={th}>Emp ID</th>
                                <th style={th}>CL Used</th>
                                <th style={th}>CL Pending</th>
                                <th style={th}>OT Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summary.map(u => (
                                <tr
                                    key={u.uid}
                                    style={{
                                        background:
                                            u.clUsed >= 10 ? "#fee2e2" :
                                                u.clUsed >= 8 ? "#fef9c3" :
                                                    "white"
                                    }}
                                >
                                    <td style={td}>{u.name}</td>
                                    <td style={td}>{u.empId}</td>
                                    <td style={td}>{u.clUsed}</td>
                                    <td style={td}>{u.clPending}</td>
                                    <td style={td}>{u.otCount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <h3 className="font-semibold mt-4">Monthly Breakdown</h3>

                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                            <thead>
                                <tr>
                                    <th style={th}>Name</th>
                                    {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(m => (
                                        <th key={m} style={th}>{m}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {summary.map(u => (
                                    <tr key={u.uid}>
                                        <td style={td}>{u.name}</td>
                                        {u.monthlyCL.map((v, i) => (
                                            <td key={i} style={td}>
                                                CL:{v}<br />OT:{u.monthlyOT[i]}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <h2 className="text-2xl font-semibold mb-4">CL Approval Panel</h2>

            {/* Status Filter */}
            <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '16px'
            }}>
                {["pending", "approved", "rejected"].map((st) => (
                    <button
                        key={st}
                        onClick={() => setFilterStatus(st)}
                        style={{
                            paddingLeft: '0.75rem',
                            paddingRight: '0.75rem',
                            paddingTop: '0.25rem',
                            paddingBottom: '0.25rem',
                            borderRadius: '0.375rem',
                            backgroundColor: st === filterStatus ? '#2563eb' : '#e5e7eb',
                            color: st === filterStatus ? 'white' : 'inherit'
                        }}
                    >
                        {st.toUpperCase()}
                    </button>
                ))}
            </div>

            {loading ? (
                <div>Loading...</div>
            ) : filtered.length === 0 ? (
                <div>No CL Requests for this category.</div>
            ) : (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                }}>
                    {filtered.map((req) => (
                        <div
                            key={req.id}
                            style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '0.375rem',
                                padding: '0.75rem',
                                backgroundColor: 'white',
                                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                                display: 'flex',
                                justifyContent: 'space-between'
                            }}
                        >
                            <div>
                                <div style={{
                                    fontWeight: '600',
                                    fontSize: '1.125rem'
                                }}>
                                    {req.userName} ({req.empId})
                                </div>
                                <div style={{
                                    fontSize: '0.875rem'
                                }}>Date: {req.id}</div>
                                <div style={{
                                    fontSize: '0.875rem'
                                }}>Reason: {req.reason}</div>

                                <div style={{
                                    marginTop: '8px',
                                    fontSize: '14px'
                                }}>
                                    <span style={{
                                        fontWeight: '500'
                                    }}>Backup Team Member:</span>
                                    <select
                                        style={{
                                            marginLeft: '0.5rem',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '0.375rem',
                                            paddingLeft: '0.5rem',
                                            paddingRight: '0.5rem',
                                            paddingTop: '0.25rem',
                                            paddingBottom: '0.25rem'
                                        }}
                                        value={req.backupUserId}
                                        onChange={(e) => updateBackup(req, e.target.value)}
                                    >
                                        <option value="">Select</option>
                                        {siteUsers
                                            .filter((u) => u.uid !== req.userId)
                                            .map((u) => (
                                                <option key={u.uid} value={u.uid}>
                                                    {u.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                            }}>
                                {req.status === "pending" && (
                                    <>
                                        <button
                                            style={{
                                                paddingLeft: '0.75rem',
                                                paddingRight: '0.75rem',
                                                paddingTop: '0.25rem',
                                                paddingBottom: '0.25rem',
                                                backgroundColor: '#16a34a',
                                                color: 'white',
                                                borderRadius: '0.375rem'
                                            }}
                                            onClick={() => approveCL(req)}
                                        >
                                            {clApproving ? "Approving..." : "Approve"}
                                        </button>

                                        <button
                                            style={{
                                                paddingLeft: '0.75rem',
                                                paddingRight: '0.75rem',
                                                paddingTop: '0.25rem',
                                                paddingBottom: '0.25rem',
                                                backgroundColor: '#dc2626',
                                                color: 'white',
                                                borderRadius: '0.375rem'
                                            }}
                                            onClick={() => rejectCL(req)}
                                        >
                                            {clRejecting ? "Rejecting..." : "Reject"}
                                        </button>
                                    </>
                                )}

                                {req.status === "approved" && (
                                    <span style={{
                                        color: '#15803d',
                                        fontWeight: '600'
                                    }}>APPROVED</span>
                                )}

                                {req.status === "rejected" && (
                                    <span style={{
                                        color: '#dc2626',
                                        fontWeight: '600'
                                    }}>REJECTED</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const th = {
    padding: "6px",
    borderBottom: "1px solid #e5e7eb",
    textAlign: "left"
};

const td = {
    padding: "6px",
    borderBottom: "1px solid #e5e7eb"
};


