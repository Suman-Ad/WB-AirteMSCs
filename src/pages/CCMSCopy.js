// src/pages/CCMSCopy.js
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../assets/CCMSCopy.css';


const CCMSCopy = () => {
    const location = useLocation();
    const navigate = useNavigate();
    // ✅ Hooks must come before any conditional return
    const [billImages, setBillImages] = useState([]);
    const { logData, siteConfig, fuelRate } = location.state || {};

    if (!logData) {
        return (
            <div>
                <h2>Error: No data provided.</h2>
                <button onClick={() => navigate(-1)}>Go Back</button>
            </div>
        );
    }

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const previews = files.map(file => ({
            id: Date.now() + Math.random(), // unique id
            url: URL.createObjectURL(file)
        }));

        setBillImages((prev) => [...prev, ...previews]);

        // reset input so user can re-upload same file if needed
        e.target.value = "";
    };

    const handleRemoveImage = (id) => {
        setBillImages((prev) => prev.filter(img => img.id !== id));
    };


    const totalAmount = (logData['Total Fuel Filling'] * fuelRate).toFixed(2);
    const invoiceDate = new Date(logData.Date);
    // Extract parts
    const day = invoiceDate.toLocaleDateString("en-GB", { day: "2-digit" }); // "02"
    const monthNames = [
        "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
        "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
    ];
    const month = monthNames[invoiceDate.getMonth()]; // Always 3-letter CCMS style
    const year = invoiceDate.getFullYear(); // 2025
    const formattedDate = `${day}-${month}-${year}`;

    // Generate Invoice Number
    const invoiceNumber = `WB-${siteConfig.siteName}-${siteConfig.vendorShortName}-${month}-${day}-${year}`;

    return (
        <div className="daily-log-container ccms-container">
            <div className="ccms-controls">
                {/* <button onClick={() => navigate(-1)}>⬅️ Back</button> */}
                <button onClick={() => window.print()}>🖨️ Print / Save as PDF</button>
            </div>

            <div id="ccmsSheet" className="ccms-sheet">
                <h2 className="ccms-header" style={{ fontSize: "20px" }}>BILL FORWARDING SHEET</h2>
                <p style={{ textAlign: "center", padding: "6px", fontSize: "13px" }}>EXPENSE OF (PLEASE TICK AS APPLICABLE)</p>
                <p style={{ textAlign: "center", padding: "7px", fontSize: "13px" }}>FOR EXPENSE TO BE DEBITED TO OTHER CIRCLE/BUSINESS, PLEASE ATTACH A MAIL CONFIRMATION FROM YOUR FUNCTIONAL COUNTER PART ACCEPTING THE DEBIT TO AVOID INTER UNIT RECO ISSUE ON THE MONTH END.</p>
                <p style={{ paddingTop: "20px", textAlign: "center" }}><strong>Please find attached bill with details.</strong></p>

                <table className="ccms-table" style={{ fontSize: "13px" }}>
                    <tbody>
                        <tr><td><strong>Date</strong></td><td>{formattedDate}</td></tr>
                        <tr><td><strong>Party’s name</strong></td><td>{siteConfig.supplierName}</td></tr>
                        <tr><td><strong>Description</strong></td><td>Diesel Bill</td></tr>
                        <tr><td><strong>Total Amount</strong></td><td><strong>{totalAmount}</strong></td></tr>
                        <tr><td><strong>Location</strong></td><td>{siteConfig.location}</td></tr>
                        <tr><td><strong>Invoice Number</strong></td><td>{invoiceNumber}</td></tr>
                        <tr><td><strong>Period</strong></td><td>{formattedDate} to {formattedDate}</td></tr>
                    </tbody>
                </table>

                <p style={{ fontSize: "13px", textAlign: "center" }}><strong>Cost Break up for the bill is as following:</strong></p>
                <div className="ccms-table-container">
                    <table className="ccms-table" style={{ fontSize: "13px" }}>
                        <thead>
                            <tr>
                                <th>Department</th>
                                <th>Budget tracking Code</th>
                                <th>GPN</th>
                                <th>GPR Sharing</th>
                                <th>Sites/Hub</th>
                                <th>Total Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>{siteConfig.department}</td>
                                <td>{siteConfig.budgetCode || ""}</td>
                                <td>{siteConfig.gpn || ""}</td>
                                <td>{siteConfig.gprSharing || ""}</td>
                                <td>{siteConfig.siteName}</td>
                                <td><strong>{totalAmount}</strong></td>
                            </tr>
                            <tr>
                                <td><strong>NCR Amount</strong></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td><strong>{totalAmount}</strong></td>
                            </tr>
                        </tbody>
                    </table>

                    <h3 style={{ paddingBottom: "8px", textAlign: "right" }}>Total Payable Amount: <strong style={{ fontSize: "25px" }}>{totalAmount}</strong></h3>
                    <p style={{ fontStyle: "italic" }}>**Please book the amount against each user department.</p>

                    <div className="ccms-signatures">
                        <div className="signature-block">
                            <p><strong>Prepared By</strong></p>
                            <div className="signature-space">
                                {siteConfig.preparedBySign && (
                                    <img
                                        src={siteConfig.preparedBySign}
                                        alt="Prepared By Signature"
                                        className="signature-img"
                                    />)}
                            </div>
                            <p>{siteConfig.preparedBy}</p>
                            <p>{siteConfig.preparedByRole}</p>
                        </div>
                        <div className="signature-block">
                            <p><strong>Authorized By</strong></p>
                            <div className="signature-space"></div>
                            <p>{siteConfig.authorizedBy}</p>
                            <p>{siteConfig.authorizedByRole}</p>
                        </div>
                    </div>
                </div>

                <h3 style={{ paddingTop: "20px" }}>Detailed Information:</h3>
                <div className='ccms-table-container'>
                    <table className="ccms-table detailed-table" style={{ fontSize: "13px" }}>
                        <thead>
                            <tr>
                                <td>Circle Name</td>
                                <td>Site Name</td>
                                <td>Supplier Code</td>
                                <td>Supplier Name</td>
                                <td>Supplier Site Name</td>
                                <td>Site ID/ Location ID</td>
                                <td>Invoice Date</td>
                                <td>Invoice nos.</td>
                                <td>Invoice Value(Actual Value)</td>
                                <td>Billing Period Start Date</td>
                                <td>Billing Period End Date</td>
                                <td>Invoice Type</td>
                                <td>DC/MSC</td>
                                <td>TXN Number</td>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>{siteConfig.circleName}</td>
                                <td>{siteConfig.siteName}</td>
                                <td>{siteConfig.supplierCode}</td>
                                <td>{siteConfig.supplierName}</td>
                                <td>{siteConfig.supplierSiteName}</td>
                                <td>{siteConfig.siteId}</td>
                                <td>{formattedDate}</td>
                                <td>{invoiceNumber}</td>
                                <td>{totalAmount}</td>
                                <td>{formattedDate}</td>
                                <td>{formattedDate}</td>
                                <td>Diesel</td>
                                <td>{siteConfig.department}</td>
                                <td>{siteConfig.txnNumber}</td>
                            </tr>
                        </tbody>
                        {/* <tbody>
                            <tr><td>Circle Name</td><td>{siteConfig.circleName}</td></tr>
                            <tr><td>Site Name</td><td>{siteConfig.siteName}</td></tr>
                            <tr><td>Supplier Code</td><td>{siteConfig.supplierCode}</td></tr>
                            <tr><td>Supplier Name</td><td>{siteConfig.supplierName}</td></tr>
                            <tr><td>Supplier Site Name</td><td>{siteConfig.supplierSiteName}</td></tr>
                            <tr><td>Site ID/ Location ID</td><td>{siteConfig.siteId}</td></tr>
                            <tr><td>Invoice Date</td><td>{formattedDate}</td></tr>
                            <tr><td>Invoice nos.</td><td>{invoiceNumber}</td></tr>
                            <tr><td>Invoice Value(Actual Value)</td><td>{totalAmount}</td></tr>
                            <tr><td>Billing Period Start Date</td><td>{formattedDate}</td></tr>
                            <tr><td>Billing Period End Date</td><td>{formattedDate}</td></tr>
                            <tr><td>Invoice Type</td><td>Diesel</td></tr>
                            <tr><td>DC/MSC</td><td>{siteConfig.department}</td></tr>
                            <tr><td>TXN Number</td><td>{siteConfig.txnNumber}</td></tr>
                        </tbody> */}
                    </table>
                </div>
                <h3>Fuel Bill Attachments</h3>
                <div className="ccms-upload">
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                    />
                    <div className="bill-images">
                        {billImages.map((img) => (
                            <div key={img.id} className="bill-img-wrapper">
                                <img src={img.url} alt="Fuel Bill" className="bill-img" />
                                <button
                                    type="button"
                                    className="remove-btn"
                                    onClick={() => handleRemoveImage(img.id)}
                                >
                                    🗑️
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

        </div>
    );
};

export default CCMSCopy;
