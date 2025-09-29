// src/pages/CCMSCopy.js
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../assets/CCMSCopy.css';

const CCMSCopy = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { logData, siteConfig, fuelRate } = location.state || {};

    if (!logData) {
        return (
            <div>
                <h2>Error: No data provided.</h2>
                <button onClick={() => navigate(-1)}>Go Back</button>
            </div>
        );
    }

    const totalAmount = (logData['Total Fuel Filling'] * fuelRate).toFixed(2);
    const invoiceDate = new Date(logData.Date);
    // Extract parts
    const day = invoiceDate.toLocaleDateString("en-GB", { day: "2-digit" }); // 02
    const month = invoiceDate.toLocaleDateString("en-GB", { month: "short" }).toUpperCase(); // SEP
    const year = invoiceDate.getFullYear(); // 2025
    const formattedDate = invoiceDate
        .toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        })
        .replace(/ /g, '-')
        .toUpperCase(); // e.g., 28-SEP-2025
    // Format as SEP-25-2025 (drop leading zero from day)
    const formattedDay = parseInt(day, 10);

    // Generate Invoice Number
    const invoiceNumber = `WB-${siteConfig.siteName}-${siteConfig.vendorShortName}-${month}-${formattedDay}-${year}`;

    return (
        <div className="ccms-container">
            <div className="ccms-controls">
                <button onClick={() => navigate(-1)}>⬅️ Back</button>
                <button onClick={() => window.print()}>🖨️ Print / Save as PDF</button>
            </div>

            <div className="ccms-sheet">
                <h2 className="ccms-header">BILL FORWARDING SHEET</h2>
                <p style={{ textAlign: "center", padding: "6px" }}>EXPENSE OF (PLEASE TICK AS APPLICABLE)</p>
                <p style={{ textAlign: "center", padding: "7px" }}>FOR EXPENSE TO BE DEBITED TO OTHER CIRCLE/BUSINESS, PLEASE ATTACH A MAIL CONFIRMATION FROM YOUR FUNCTIONAL COUNTER PART ACCEPTING THE DEBIT TO AVOID INTER UNIT RECO ISSUE ON THE MONTH END.</p>
                <p><strong>Please find attached bill with details.</strong></p>

                <table className="ccms-table">
                    <tbody>
                        <tr><td><strong>Date</strong></td><td>{formattedDate}</td></tr>
                        <tr><td><strong>Party’s name</strong></td><td>{siteConfig.supplierName}</td></tr>
                        <tr><td><strong>Description</strong></td><td>Diesel Bill</td></tr>
                        <tr><td><strong>Total Amount</strong></td><td>{totalAmount}</td></tr>
                        <tr><td><strong>Location</strong></td><td>{siteConfig.location}</td></tr>
                        <tr><td><strong>Invoice Number</strong></td><td>{invoiceNumber}</td></tr>
                        <tr><td><strong>Period</strong></td><td>{formattedDate} to {formattedDate}</td></tr>
                    </tbody>
                </table>

                <h3>Cost Break up for the bill is as following:</h3>
                <div className="ccms-table-container">
                    <table className="ccms-table">
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
                                <td>{totalAmount}</td>
                            </tr>
                            <tr>
                                <td><strong>NCR Amount</strong></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td>{totalAmount}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h3 style={{ padding: "8px", textAlign: "right" }}>Total Payable Amount: <strong style={{ fontSize: "30px" }}>{totalAmount}</strong></h3>
                <p>**Please book the amount against each user department.</p>

                <div className="ccms-signatures">
                    <div className="signature-block">
                        <p><strong>Prepared By</strong></p>
                        <div className="signature-space">
                            <img
                                src={siteConfig.preparedBySign}
                                alt="Prepared By Signature"
                                className="signature-img"
                            />
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

                <h3>Detailed Information</h3>
                <table className="ccms-table detailed-table">
                    <tbody>
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
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CCMSCopy;
