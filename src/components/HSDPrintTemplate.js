import React from "react";
import Nxtra from "../assets/nxtra.png"; // ✅ adjust path to your Nxtra logo image
import "../assets/HSDPrintTemplate.css";
import html2pdf from "html2pdf.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";



const HSDPrintTemplate = ({ form, hsdForm, siteConfig, setPreviewOpen }) => {

    const pdfAlreadyUploaded = Boolean(hsdForm?.hsdPdfUrl);

    const handleSavePdfToFirestore = async () => {
        if (hsdForm?.hsdPdfUrl) {
            alert("🔒 HSD PDF already exists. Re-upload is not allowed.");
            return;
        }

        try {
            const element = document.getElementById("printArea");

            // 1️⃣ Generate PDF blob
            const pdfBlob = await html2pdf()
                .from(element)
                .set({
                    margin: 5,
                    filename: "HSD.pdf",
                    html2canvas: { scale: 2 },
                    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
                })
                .outputPdf("blob");

            // 2️⃣ Upload to Firebase Storage
            const storage = getStorage();
            const fileName = `HSD_${form.siteName}_${form.date}.pdf`;
            const storageRef = ref(
                storage,
                `hsd-pdfs/${form.siteName}/${form.date}/${fileName}`
            );

            await uploadBytes(storageRef, pdfBlob);
            const downloadURL = await getDownloadURL(storageRef);

            // 3️⃣ Update Firestore HSD entry
            if (!hsdForm?.id) {
                alert("HSD record ID missing");
                return;
            }

            const hsdDocRef = doc(
                db,
                "dgHsdLogs",
                form.siteName,
                "entries",
                hsdForm.id
            );

            await updateDoc(hsdDocRef, {
                hsdPdfUrl: downloadURL,
                hsdPdfUploadedAt: new Date(),
            });

            alert("✅ HSD PDF saved & attached successfully");
            setPreviewOpen(false);

        } catch (err) {
            console.error("PDF upload failed:", err);
            alert("❌ Failed to upload HSD PDF");
        }
    };

    return (
        <div
            id="printArea"
            style={{
                background: "#fff",
                padding: "25px",
                borderRadius: "12px",
                width: "100%",
                Height: "100%",
                overflowY: "auto",
                fontFamily: "Arial, sans-serif",
                lineHeight: "1.5",
            }}
        >
            {/* ===== BUTTONS ===== */}
            <div style={{ textAlign: "center" }}>
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
                    🖨️ Print
                </button>

                <button
                    onClick={handleSavePdfToFirestore}
                    disabled={pdfAlreadyUploaded}
                    style={{
                        marginLeft: "10px",
                        backgroundColor: pdfAlreadyUploaded ? "#6c757d" : "#28a745",
                        color: "#fff",
                        padding: "8px 20px",
                        borderRadius: "5px",
                        border: "none",
                        cursor: pdfAlreadyUploaded ? "not-allowed" : "pointer",
                        opacity: pdfAlreadyUploaded ? 0.7 : 1,
                    }}
                >
                    {pdfAlreadyUploaded ? "🔒 PDF Already Saved" : "☁️ Save PDF to System"}
                    {pdfAlreadyUploaded && (
                        <p style={{ marginTop: "10px", color: "#155724", fontSize: "13px" }}>
                            ✅ HSD PDF is already saved and locked for editing.
                        </p>
                    )}

                    {hsdForm?.hsdPdfUrl && (
                        <p style={{ marginTop: "8px" }}>
                            📄 <a href={hsdForm.hsdPdfUrl} target="_blank" rel="noreferrer">
                                View Attached PDF
                            </a>
                        </p>
                    )}
                </button>
            </div>

            {/* ===== TABLE 1 ===== */}
            <table
                style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginBottom: "15px",
                    border: "1px solid #000",
                }}
            >
                <thead>
                    <tr>
                        <th colSpan={9} style={{ fontSize: "18px", padding: "10px 0", textAlign: "center", border: "2px solid #000" }}>
                            {/* ===== HEADER ===== */}
                            <div style={{ display: "flex", alignItems: "center" }}>
                                <img
                                    src={Nxtra}
                                    alt="Nxtra Logo"
                                    width={100}
                                    style={{ marginLeft: "2px" }}
                                />
                                <h2
                                    style={{
                                        textAlign: "center",
                                        textDecoration: "underline",
                                        color: "black",
                                        width: "100%",
                                        textAlign: "center",
                                    }}
                                >
                                    HSD RECEIVING FORMAT
                                </h2>
                            </div>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {/* ===== DOCUMENT DETAILS ===== */}
                    <tr>
                        <td colSpan={2}>
                            <strong>Document:</strong> HSD Receiving SOP
                        </td>
                        <td colSpan={7}>
                            <strong>Version No:</strong> Nxtra/Sec/V1.0
                        </td>
                        {/* <td colSpan={2}>
                            <strong>Date of Release:</strong> 26th October 2022
                        </td> */}
                    </tr>
                </tbody>
                <tbody>
                    <tr>
                        <td colSpan={2}>
                            <strong>Site Name:- {form.siteName || siteConfig?.siteName || "—"}</strong>
                        </td>
                        <td colSpan={5}>
                            <strong>Nxtra DC:- {siteConfig?.siteName || "—"}</strong>
                        </td>
                        <td colSpan={2}>
                            <strong>Date:- {form?.date ? new Date(form.date).toLocaleDateString("en-GB") : "—"}</strong>
                        </td>
                    </tr>
                </tbody>
                <tbody>
                    <tr>
                        <td><strong>Diesel Tanker (In time HH:MM):</strong></td>
                        <td><strong>Informed to O&M team of arrival of HSD tanker by Security Team (HH:MM):</strong></td>
                        <td><strong>Availability of Calibrated Dipstick brought by Tanker driver (Yes/No)</strong></td>
                        <td><strong>HSD parking and ignition off time at HSD yard (HH:MM):</strong></td>
                        <td><strong>HSD Tanker settling time (HH:MM):</strong></td>
                        <td>HSD Water availability check (Yes/No)</td>
                        <td>Water quantity if available</td>
                        <td>O&M Team Name and Sign</td>
                        <td>Security Name and Sign</td>
                    </tr>
                </tbody>
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
                    <tr>
                        {/* ===== QUALITY / QUANTITY ===== */}
                        <td colSpan={2} style={{ height: "10px" }}>Diesel Quality Check</td>
                        <td colSpan={6} style={{ height: "10px" }}>HSD Quantity check</td>
                        <td></td>
                    </tr>
                </tbody>
                <tbody>
                    <tr>
                        <td><strong>Density</strong></td>
                        <td><strong>Temperature</strong></td>
                        <td><strong>Flow meter/Dip stick reading before unloading in HSD tank</strong></td>
                        <td><strong>Dip stick reading of all HSD tankers compartments (Total of all compartments)</strong></td>
                        <td><strong>Flow meter/Dip stick reading after unloading in HSD tank</strong></td>
                        <td><strong>Actual HSD received (Difference)</strong></td>
                        <td><strong>Tallying of Actual HSD against the Delivery challan (Difference if any)</strong></td>
                        <td><strong>Accepted Invoice/Delivery challan number</strong></td>
                        <td><strong>HSD Tanker (Out time HH:MM):</strong></td>
                    </tr>
                </tbody>
                <tbody>
                    <tr>
                        <td>{hsdForm.density || "—"}</td>
                        <td>{hsdForm.temperature || 0} °C</td>
                        <td>—</td>
                        <td>—</td>
                        <td>—</td>
                        <td>{hsdForm.ltrs ? `${hsdForm.ltrs}` : "—"}</td>
                        <td>Nil</td>
                        <td>{hsdForm.dillerInvoice || "N/A"}</td>
                        <td>{hsdForm.outTime || "00:00"} Hrs</td>
                    </tr>
                </tbody>
                <tbody>
                    <tr>
                        <td>Rejected: (Yes/No)</td>
                        <td colSpan={2}>Reason for Rejection if any</td>
                        <td colSpan={2}><strong>Security</strong></td>
                        <td colSpan={2}><strong>O&M Person</strong></td>
                        <td colSpan={2}><strong>Checked by MSC Manager</strong></td>
                    </tr>

                </tbody>
                <tbody>
                    <tr>
                        <td>No</td>
                        <td colSpan={2}>Nil</td>
                        {/* ===== SIGNATURES ===== */}

                        <td colSpan={2}><strong>Name: Mr. {hsdForm.securityName || "Security"}</strong>
                            {/* Security */}
                            <div style={{ textAlign: "center" }}>
                                {hsdForm.securitySign ? (
                                    <img
                                        src={hsdForm.securitySign}
                                        alt="Security Sign"
                                        width={100}
                                    />
                                ) : (
                                    <div style={{ width: 100, height: 50, border: "1px solid #000" }}></div>
                                )}
                                <p>Signature:</p>
                            </div>
                        </td>
                        <td colSpan={2}><strong>Name: Mr. {siteConfig?.omName || "O&M Team"}</strong>
                            {/* O&M */}
                            <div style={{ textAlign: "center" }}>
                                {siteConfig.omSign ? (
                                    <img
                                        src={siteConfig.omSign}
                                        alt="OM Sign"
                                        width={100}
                                    // style={{ border: "1px solid #000" }}
                                    />
                                ) : (
                                    <div style={{ width: 100, height: 50, border: "1px solid #000" }}></div>
                                )}
                                <p>Signature:</p>
                            </div>
                        </td>
                        <td colSpan={2}><strong>Name: Mr. {siteConfig?.sim || "SIM"}</strong>
                            {/* Manager */}
                            <div style={{ textAlign: "center" }}>
                                {siteConfig.managerSign ? (
                                    <img
                                        src={siteConfig.managerSign}
                                        alt="Manager Sign"
                                        width={100}
                                    // style={{ border: "1px solid #000" }}
                                    />
                                ) : (
                                    <div style={{ width: 100, height: 50, border: "1px solid #000" }}></div>
                                )}
                                <p>Signature:</p>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default HSDPrintTemplate;
