import React from "react";
import Nxtra from "../assets/nxtra.png"; // ✅ adjust path to your Nxtra logo image
import "../assets/HSDPrintTemplate.css";


const HSDPrintTemplate = ({ form, hsdForm, siteConfig, setPreviewOpen }) => {
    return (
        <div
            id="printArea"
            style={{
                background: "#fff",
                padding: "25px",
                borderRadius: "12px",
                width: "85%",
                maxHeight: "90%",
                overflowY: "auto",
                fontFamily: "Arial, sans-serif",
                lineHeight: "1.5",
            }}
        >
            {/* ===== HEADER ===== */}
            <img
                src={Nxtra}
                alt="Nxtra Logo"
                width={100}
                style={{ border: "1px solid #000" }}
            />
            <h2
                style={{
                    textAlign: "center",
                    textDecoration: "underline",
                    color: "black",
                }}
            >
                HSD RECEIVING FORMAT
            </h2>

            {/* ===== DOCUMENT DETAILS ===== */}
            <div
                style={{
                    marginBottom: "10px",
                    display: "flex",
                    justifyContent: "space-between",
                    border: "2px solid #000",
                    paddingBottom: "5px",
                    borderRadius: "5px",
                }}
            >
                <p><strong>Document:</strong> HSD Receiving SOP</p>
                <p><strong>Version No:</strong> Nxtra/Sec/V1.0</p>
                <p><strong>Date of Release:</strong> 26th October 2022</p>
            </div>

            <div
                style={{
                    marginBottom: "10px",
                    display: "flex",
                    justifyContent: "space-between",
                    border: "2px solid #000",
                    paddingBottom: "5px",
                    borderRadius: "5px",
                }}
            >
                <p><strong>Site Name:</strong></p>
                <p>{siteConfig?.siteName || "—"}</p>
                <p><strong>Date:</strong></p>
                <p>{new Date(form.date).toLocaleDateString("en-GB")}</p>
            </div>

            {/* ===== TABLE 1 ===== */}
            <table
                style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginBottom: "15px",
                }}
            >
                <thead>
                    <tr>
                        <th><strong>Diesel Tanker (In time HH:MM):</strong></th>
                        <th><strong>Informed to O&M team of arrival of HSD tanker by Security Team (HH:MM):</strong></th>
                        <th><strong>Availability of Calibrated Dipstick brought by Tanker driver (Yes/No)</strong></th>
                        <th><strong>HSD parking and ignition off time at HSD yard (HH:MM):</strong></th>
                        <th><strong>HSD Tanker settling time (HH:MM):</strong></th>
                        <th>HSD Water availability check (Yes/No)</th>
                        <th>Water quantity if available</th>
                        <th>O&M Team Name and Sign</th>
                        <th>Security Name and Sign</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>{hsdForm.inTime || "00:00"} Hrs</td>
                        <td>{hsdForm.informTime || "00:00"} Hrs</td>
                        <td>Yes</td>
                        <td>{hsdForm.parkingTime || "00:00"} Hrs</td>
                        <td>{hsdForm.fillingStartTime || "00:00"} Hrs</td>
                        <td>Yes</td>
                        <td>Nil</td>
                        <td>Mr. {siteConfig?.omName || "O&M Team"}</td>
                        <td>Mr. {hsdForm.securityName || "X"}</td>
                    </tr>
                </tbody>
            </table>

            {/* ===== QUALITY / QUANTITY ===== */}
            <div
                style={{
                    marginBottom: "10px",
                    display: "flex",
                    justifyContent: "space-between",
                    border: "2px solid #000",
                    paddingBottom: "5px",
                    borderRadius: "5px",
                }}
            >
                <p>Diesel Quality Check</p>
                <p>HSD Quantity check</p>
            </div>

            <table
                style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginBottom: "15px",
                }}
            >
                <thead>
                    <tr>
                        <th><strong>Density</strong></th>
                        <th><strong>Temperature</strong></th>
                        <th><strong>Flow meter/Dip stick reading before unloading in HSD tank</strong></th>
                        <th><strong>Dip stick reading of all HSD tankers compartments (Total of all compartments)</strong></th>
                        <th><strong>Flow meter/Dip stick reading after unloading in HSD tank</strong></th>
                        <th><strong>Actual HSD received (Difference)</strong></th>
                        <th><strong>Tallying of Actual HSD against the Delivery challan (Difference if any)</strong></th>
                        <th><strong>Accepted Invoice/Delivery challan number</strong></th>
                        <th><strong>HSD Tanker (Out time HH:MM):</strong></th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>{hsdForm.density || "—"}</td>
                        <td>{hsdForm.temperature || 0} °C</td>
                        <td>—</td>
                        <td>{hsdForm.ltrs || 0} Ltrs</td>
                        <td>—</td>
                        <td>{form.fuelFill ? `${form.fuelFill} Ltr` : "—"}</td>
                        <td>Nil</td>
                        <td>#{hsdForm.dillerInvoice || "N/A"}</td>
                        <td>{hsdForm.outTime || "00:00"} Hrs</td>
                    </tr>
                </tbody>
            </table>

            {/* ===== SIGNATURES ===== */}
            <h3 style={{ textDecoration: "underline" }}>Signatures</h3>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-around",
                    marginTop: "10px",
                }}
            >
                <div>
                    <table>
                        <thead>
                            <tr>
                                <th><strong>Rejected: (Yes/No)</strong></th>
                                <th><strong>Reason for Rejection if any</strong></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>No</td>
                                <td>Nil</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Security */}
                <div style={{ textAlign: "center" }}>
                    <p><strong>Security</strong></p>
                    <p>Name: {hsdForm.securityName || "Security"}</p>
                    {hsdForm.securitySign ? (
                        <img
                            src={hsdForm.securitySign}
                            alt="Security Sign"
                            width={100}
                            style={{ border: "1px solid #000" }}
                        />
                    ) : (
                        <div style={{ width: 100, height: 50, border: "1px solid #000" }}></div>
                    )}
                    <p>Sign:</p>
                </div>

                {/* O&M */}
                <div style={{ textAlign: "center" }}>
                    <p><strong>O&M Person</strong></p>
                    <p>Name: {siteConfig?.omName || "O&M Team"}</p>
                    {siteConfig.omSign ? (
                        <img
                            src={siteConfig.omSign}
                            alt="OM Sign"
                            width={100}
                            style={{ border: "1px solid #000" }}
                        />
                    ) : (
                        <div style={{ width: 100, height: 50, border: "1px solid #000" }}></div>
                    )}
                    <p>Sign:</p>
                </div>

                {/* Manager */}
                <div style={{ textAlign: "center" }}>
                    <p><strong>Checked by MSC Manager</strong></p>
                    <p>Name: {siteConfig?.sim || "SIM"}</p>
                    {siteConfig.managerSign ? (
                        <img
                            src={siteConfig.managerSign}
                            alt="Manager Sign"
                            width={100}
                            style={{ border: "1px solid #000" }}
                        />
                    ) : (
                        <div style={{ width: 100, height: 50, border: "1px solid #000" }}></div>
                    )}
                    <p>Sign:</p>
                </div>
            </div>

            {/* ===== BUTTONS ===== */}
            <div style={{ textAlign: "center", marginTop: "30px" }}>
                <button
                    onClick={() => setPreviewOpen(false)}
                    style={{
                        padding: "8px 20px",
                        backgroundColor: "#333",
                        color: "#fff",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer",
                    }}
                >
                    Close Preview
                </button>
                <button
                    onClick={() => window.print()}
                    style={{
                        padding: "8px 20px",
                        backgroundColor: "#007bff",
                        color: "#fff",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer",
                        marginLeft: "10px",
                    }}
                >
                    🖨️ Print / Save as PDF
                </button>
            </div>
        </div>
    );
};

export default HSDPrintTemplate;
