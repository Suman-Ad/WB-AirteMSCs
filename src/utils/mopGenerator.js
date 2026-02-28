import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const generateMopPDF = (mop) => {
  const doc = new jsPDF("p", "mm", "a4");

  doc.setFontSize(14);
  doc.text(`${mop.header.title}`, 105, 12, { align: "center" });

  doc.setFontSize(9);
  doc.text(
    `DOC NO - ${mop.header.docNo}     Release Date : ${mop.header.releaseDate}`,
    14,
    18
  );

  autoTable(doc, {
    startY: 22,
    body: [
      [
        "City", mop.siteInfo.city,
        "Location", mop.siteInfo.location,
        "Floor", mop.siteInfo.floor,
        "Tier", mop.siteInfo.tier,
        "T2", mop.siteInfo.t2
      ]
    ],
    theme: "grid",
    styles: { fontSize: 8 }
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 2,
    body: [
      ["Nature of Activity", mop.activityInfo.nature],
      ["Start Date", mop.activityInfo.startDate, "End Date", mop.activityInfo.endDate, "Duration", mop.activityInfo.duration],
      ["Start Time", mop.activityInfo.startTime, "End Time", mop.activityInfo.endTime],
      ["Activity Owner", mop.activityInfo.owner, "OEM", mop.activityInfo.oem],
      ["Stake Holders", mop.activityInfo.stakeholders],
      ["Service Impact", mop.activityInfo.serviceImpact]
    ],
    theme: "grid",
    styles: { fontSize: 8 }
  });

  autoTable(doc,{
    startY: doc.lastAutoTable.finalY + 3,
    head: [["Pre Activity Checkpoints", "Status", "Parameters"]],
    body: mop.preChecks,
    theme: "grid",
    styles: { fontSize: 8 }
  });

  autoTable(doc,{
    startY: doc.lastAutoTable.finalY + 3,
    head: [["UPS No", "Rating", "Floor", "Loading %"]],
    body: mop.loadDetails,
    theme: "grid",
    styles: { fontSize: 8 }
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 3,
    head: [["Risk Analysis"]],
    body: mop.risk.map(r => [r]),
    theme: "grid",
    styles: { fontSize: 8 }
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 3,
    head: [["Mitigation / Backup Plan"]],
    body: mop.mitigation.map(m => [m]),
    theme: "grid",
    styles: { fontSize: 8 }
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 3,
    head: [["Activity Steps"]],
    body: mop.activitySteps.map(a => [a]),
    theme: "grid",
    styles: { fontSize: 8 }
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 3,
    head: [["Fallback / Rollback Plan"]],
    body: mop.rollback.map(r => [r]),
    theme: "grid",
    styles: { fontSize: 8 }
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 3,
    head: [["Role", "Name"]],
    body: mop.infra,
    theme: "grid",
    styles: { fontSize: 8 }
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 3,
    head: [["Additional Proactive Measures"]],
    body: mop.proactive.map(p => [p]),
    theme: "grid",
    styles: { fontSize: 8 }
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 3,
    head: [["Spares Description", "Specification", "Qty", "Availability"]],
    body: mop.spares,
    theme: "grid",
    styles: { fontSize: 8 }
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 3,
    body: [
      ["Created By", mop.approval.createdBy],
      ["Reviewer", mop.approval.reviewer],
      ["Approver", mop.approval.approver],
      ["CR Number", mop.approval.crNumber]
    ],
    theme: "grid",
    styles: { fontSize: 8 }
  });

  doc.save(`${mop.header.title}.pdf`);
};


export const generateMopExcel = (mop) => {
  const wsData = [];

  const pushRow = (row) => wsData.push(row);
  const blank = () => wsData.push([""]);

  // ===== HEADER =====
  pushRow([mop.header.title]);
  pushRow([
    `DOC NO - ${mop.header.docNo}     Release Date : ${mop.header.releaseDate}`
  ]);
  blank();

  // ===== SITE INFO =====
  pushRow(["City", mop.siteInfo.city, "Location", mop.siteInfo.location, "Floor", mop.siteInfo.floor]);
  pushRow(["Tier", mop.siteInfo.tier, "T2", mop.siteInfo.t2]);
  blank();

  // ===== ACTIVITY INFO =====
  pushRow(["Nature of Activity", mop.activityInfo.nature]);
  pushRow(["Start Date", mop.activityInfo.startDate, "End Date", mop.activityInfo.endDate, "Duration", mop.activityInfo.duration]);
  pushRow(["Start Time", mop.activityInfo.startTime, "End Time", mop.activityInfo.endTime]);
  pushRow(["Activity Owner", mop.activityInfo.owner, "OEM", mop.activityInfo.oem]);
  pushRow(["Other Stake Holders", mop.activityInfo.stakeholders]);
  pushRow(["Service Impact", mop.activityInfo.serviceImpact]);
  blank();

  // ===== PRE CHECKS =====
  pushRow(["Pre Activity Check Points"]);
  pushRow(["Checkpoints", "Status", "Parameters"]);
  mop.preChecks.forEach(row => pushRow(row));
  blank();

  // ===== LOAD DETAILS =====
  pushRow(["Load / Floor Details"]);
  pushRow(["UPS No", "Rating", "Serving Floor", "Loading %"]);
  mop.loadDetails.forEach(row => pushRow(row));
  blank();

  // ===== RISK =====
  pushRow(["Risk Analysis"]);
  mop.risk.forEach(r => pushRow([r]));
  blank();

  // ===== MITIGATION =====
  pushRow(["Mitigation / Back up Plan"]);
  mop.mitigation.forEach(m => pushRow([m]));
  blank();

  // ===== ACTIVITY STEPS =====
  pushRow(["Activity"]);
  mop.activitySteps.forEach(a => pushRow([a]));
  blank();

  // ===== ROLLBACK =====
  pushRow(["Fall back / Roll Back Plan"]);
  mop.rollback.forEach(r => pushRow([r]));
  blank();

  // ===== INFRA =====
  pushRow(["Infra Resources"]);
  mop.infra.forEach(row => pushRow(row));
  blank();

  // ===== PROACTIVE =====
  pushRow(["Additional Proactive Measures"]);
  mop.proactive.forEach(p => pushRow([p]));
  blank();

  // ===== SPARES =====
  pushRow(["Additional Spares required for the Activity"]);
  pushRow(["Spares Description", "Specifications", "Quantity", "Availability"]);
  mop.spares.forEach(row => pushRow(row));
  blank();

  // ===== APPROVAL =====
  pushRow(["Created By", mop.approval.createdBy]);
  pushRow(["Reviewer", mop.approval.reviewer]);
  pushRow(["Approver", mop.approval.approver]);
  pushRow(["CR Number", mop.approval.crNumber]);

  // ===== CREATE WORKBOOK =====
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws["!cols"] = [
    { wch: 35 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
    { wch: 15 }, { wch: 15 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "MOP");

  XLSX.writeFile(wb, `${mop.header.title}.xlsx`);
};