// import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import XLSX from "xlsx-js-style";

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
      ["Start Date", mop.activityInfo.startDate],
      ["Start Time", mop.activityInfo.startTime],
      ["End Date", mop.activityInfo.endDate],
      ["End Time", mop.activityInfo.endTime],
      ["Duration", mop.activityInfo.duration],
      ["Activity Owner", mop.activityInfo.owner],
      ["OEM", mop.activityInfo.oem],
      ["Stake Holders", mop.activityInfo.stakeholders],
      ["Service Impact", mop.activityInfo.serviceImpact]
    ],
    theme: "grid",
    styles: { fontSize: 8 }
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 3,
    head: [["Pre Activity Checkpoints", "Status", "Parameters"]],
    body: mop.preChecks,
    theme: "grid",
    styles: { fontSize: 8 }
  });

  autoTable(doc, {
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

// export const generateMopExcel = (mop) => {
//   const wb = XLSX.utils.book_new();
//   const ws = {};

//   let rowIndex = 0;

//   const addRow = (data, style = {}) => {
//     data.forEach((cell, colIndex) => {
//       const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
//       ws[cellRef] = {
//         v: cell,
//         t: "s",
//         s: style
//       };
//     });
//     rowIndex++;
//   };

//   const sectionHeaderStyle = {
//     font: { bold: true },
//     fill: { fgColor: { rgb: "D9D9D9" } },
//     border: {
//       top: { style: "thin" },
//       bottom: { style: "thin" },
//       left: { style: "thin" },
//       right: { style: "thin" }
//     }
//   };

//   const tableHeaderStyle = {
//     font: { bold: true },
//     fill: { fgColor: { rgb: "FFFF00" } },
//     alignment: { horizontal: "center" },
//     border: {
//       top: { style: "thin" },
//       bottom: { style: "thin" },
//       left: { style: "thin" },
//       right: { style: "thin" }
//     }
//   };

//   const normalBorderStyle = {
//     border: {
//       top: { style: "thin" },
//       bottom: { style: "thin" },
//       left: { style: "thin" },
//       right: { style: "thin" }
//     },
//     alignment: { wrapText: true }
//   };

//   // =========================
//   // TITLE
//   // =========================
//   addRow([mop.header.title], {
//     font: { bold: true, sz: 16 },
//     alignment: { horizontal: "center" }
//   });

//   ws["!merges"] = [
//     {
//       s: { r: 0, c: 0 },
//       e: { r: 0, c: 4 }
//     }
//   ];

//   addRow([
//     `DOC NO - ${mop.header.docNo}     Release Date : ${mop.header.releaseDate}`
//   ]);
//   rowIndex++;

//   // =========================
//   // SITE INFO
//   // =========================
//   addRow(["City", mop.siteInfo.city, "Location", mop.siteInfo.location], sectionHeaderStyle);
//   addRow(["Floor", mop.siteInfo.floor, "Tier Category- Core/TX", mop.siteInfo.tier]);
//   rowIndex++;

//   // =========================
//   // ACTIVITY INFO
//   // =========================
//   addRow(["Nature of Activity", mop.activityInfo.nature], sectionHeaderStyle);
//   addRow(["Start Date", mop.activityInfo.startDate, "End Date", mop.activityInfo.endDate]);
//   addRow(["Start Time", mop.activityInfo.startTime, "End Time", mop.activityInfo.endTime]);
//   addRow(["Duration", mop.activityInfo.duration]);
//   addRow(["Owner", mop.activityInfo.owner, "OEM", mop.activityInfo.oem]);
//   addRow(["Stakeholders", mop.activityInfo.stakeholders]);
//   addRow(["Service Impact", mop.activityInfo.serviceImpact]);
//   rowIndex++;

//   // =========================
//   // PRE CHECKS
//   // =========================
//   addRow(["Pre Activity Check Points"], sectionHeaderStyle);
//   addRow(["Checkpoints", "Status", "Parameters"], tableHeaderStyle);

//   mop.preChecks.forEach((row) => {
//     addRow(row, normalBorderStyle);
//   });

//   rowIndex++;

//   // =========================
//   // LOAD DETAILS
//   // =========================
//   addRow(["Load / Floor Details"], sectionHeaderStyle);
//   addRow(["UPS No", "Rating", "Serving Floor", "Loading %"], tableHeaderStyle);

//   mop.loadDetails.forEach((row) => {
//     addRow(row, normalBorderStyle);
//   });

//   rowIndex++;

//   // =========================
//   // RISK
//   // =========================
//   addRow(["Risk Analysis"], sectionHeaderStyle);
//   mop.risk.forEach((r) => addRow([r], normalBorderStyle));
//   rowIndex++;

//   // =========================
//   // MITIGATION
//   // =========================
//   addRow(["Mitigation / Backup Plan"], sectionHeaderStyle);
//   mop.mitigation.forEach((m) => addRow([m], normalBorderStyle));
//   rowIndex++;

//   // =========================
//   // ACTIVITY
//   // =========================
//   addRow(["Activity Steps"], sectionHeaderStyle);
//   mop.activitySteps.forEach((a) => addRow([a], normalBorderStyle));
//   rowIndex++;

//   // =========================
//   // ROLLBACK
//   // =========================
//   addRow(["Fallback / Rollback Plan"], sectionHeaderStyle);
//   mop.rollback.forEach((r) => addRow([r], normalBorderStyle));
//   rowIndex++;

//   // =========================
//   // INFRA
//   // =========================
//   addRow(["Infra Resources"], sectionHeaderStyle);
//   addRow(["Role", "Name"], tableHeaderStyle);
//   mop.infra.forEach((row) => addRow(row, normalBorderStyle));
//   rowIndex++;

//   // =========================
//   // SPARES
//   // =========================
//   addRow(["Additional Spares Required"], sectionHeaderStyle);
//   addRow(["Description", "Specification", "Qty", "Availability"], tableHeaderStyle);
//   mop.spares.forEach((row) => addRow(row, normalBorderStyle));
//   rowIndex++;

//   // =========================
//   // APPROVAL
//   // =========================
//   addRow(["Created By", mop.approval.createdBy], normalBorderStyle);
//   addRow(["Reviewer", mop.approval.reviewer], normalBorderStyle);
//   addRow(["Approver", mop.approval.approver], normalBorderStyle);
//   addRow(["CR Number", mop.approval.crNumber], normalBorderStyle);

//   // Column Width
//   ws["!cols"] = [
//     { wch: 40 },
//     { wch: 25 },
//     { wch: 20 },
//     { wch: 25 },
//     { wch: 20 }
//   ];

//   ws["!ref"] = XLSX.utils.encode_range({
//     s: { r: 0, c: 0 },
//     e: { r: rowIndex, c: 4 }
//   });

//   XLSX.utils.book_append_sheet(wb, ws, "MOP");
//   XLSX.writeFile(wb, `${mop.header.title}.xlsx`);
// };

export const generateMopExcel = (mop) => {
  const wb = XLSX.utils.book_new();
  const ws = {};
  let rowIndex = 0;

  const addRow = (data, style = {}) => {
    data.forEach((cell, colIndex) => {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      ws[cellRef] = {
        v: cell,
        t: "s",
        s: style
      };
    });
    rowIndex++;
  };

  const borderAll = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" }
  };

  const titleStyle = {
    font: { bold: true, sz: 16, color: { rgb: "000000" } },
    fill: { fgColor: { rgb: "FFC000" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: borderAll
  };

  const yellowBlock = {
    fill: { fgColor: { rgb: "FFF2CC" } },
    border: borderAll,
    alignment: { wrapText: true }
  };

  const greyHeader = {
    font: { bold: true },
    fill: { fgColor: { rgb: "D9D9D9" } },
    border: borderAll
  };

  const greenHeader = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "00B050" } },
    alignment: { horizontal: "center" },
    border: borderAll
  };

  const blueHeader = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "00B0F0" } },
    alignment: { horizontal: "center" },
    border: borderAll
  };

  const normalCell = {
    border: borderAll,
    alignment: { wrapText: true }
  };

  // ================= TITLE =================
  addRow([mop.header.title.toUpperCase()], titleStyle);

  ws["!merges"] = [{
    s: { r: 0, c: 0 },
    e: { r: 0, c: 4 },
  }];

  addRow([
    `DOC NO - ${mop.header.docNo}    Release Date : ${mop.header.releaseDate}`
  ], normalCell);

  const docRow = rowIndex - 1;

  if (!ws["!merges"]) ws["!merges"] = [];

  ws["!merges"].push({
    s: { r: docRow, c: 0 },
    e: { r: docRow, c: 4 }
  });

  // rowIndex++;

  // ================= SITE INFO =================
  addRow([`City : ${mop.siteInfo.city}`, `Location : ${mop.siteInfo.location}`, `Floor : ${mop.siteInfo.floor}`, "Tier Category-Core/TX :", mop.siteInfo.tier], normalCell);
  // rowIndex++;

  // ================= ACTIVITY BLOCK (YELLOW) =================
  addRow(["Nature of Activity / Work :", mop.activityInfo.nature], yellowBlock);
  const naturRow = rowIndex - 1;

  if (!ws["!merges"]) ws["!merges"] = [];

  ws["!merges"].push({
    s: { r: naturRow, c: 1 },
    e: { r: naturRow, c: 4 }
  });
  addRow(["Activity Start :", `Activity Start Date : ${mop.activityInfo.startDate}`, `Activity End Date : ${mop.activityInfo.endDate}`, "Duration of Activity : ", mop.activityInfo.duration], yellowBlock);
  addRow(["Activity Start :", `Activity Start Time : ${mop.activityInfo.startTime}Hrs`, `Activity End Time : ${mop.activityInfo.endTime}Hrs`, "Duration of Activity : ", mop.activityInfo.duration], yellowBlock);
  const startRow = rowIndex - 2; // first of the two rows
  const endRow = rowIndex - 1;   // second row

  if (!ws["!merges"]) ws["!merges"] = [];

  // 🔹 Merge first column vertically (col 0)
  ws["!merges"].push({
    s: { r: startRow, c: 0 },
    e: { r: endRow, c: 0 }
  });

  // 🔹 Merge "Duration of Activity :" column vertically (col 3)
  ws["!merges"].push({
    s: { r: startRow, c: 3 },
    e: { r: endRow, c: 3 }
  });

  // 🔹 Merge duration value column vertically (col 4)
  ws["!merges"].push({
    s: { r: startRow, c: 4 },
    e: { r: endRow, c: 4 }
  });

  addRow(["Activity Owner :", mop.activityInfo.owner,
    `UPS OEM : ${mop.activityInfo.oem}`, "Other Stake Holders :", mop.activityInfo.stakeholders], yellowBlock);
  addRow(["Service Impact :", mop.activityInfo.serviceImpact], yellowBlock);
  const nsaRow = rowIndex - 1;

  if (!ws["!merges"]) ws["!merges"] = [];

  ws["!merges"].push({
    s: { r: nsaRow, c: 1 },
    e: { r: nsaRow, c: 4 }
  });

  // rowIndex++;

  // ================= PRE CHECK =================
  addRow([
    "Pre Activity Check Points :",
    "Checkpoints",
    "",
    "Status",
    "Parameters",
  ], greenHeader);

  // Add checklist rows
  mop.preChecks.forEach((row) => {
    addRow([
      "",           // First column empty (will merge later)
      row[0],
      "",
      row[1],
      row[2],
    ], normalCell);
  });

  const preCheckStartRow = rowIndex - mop.preChecks.length - 1;
  const preCheckEndRow = rowIndex - 1;

  if (!ws["!merges"]) ws["!merges"] = [];

  // ✅ Merge left vertical label
  ws["!merges"].push({
    s: { r: preCheckStartRow, c: 0 },
    e: { r: preCheckEndRow, c: 0 }
  });

  // ✅ Merge "Parameters" header horizontally (col 3–4)
  ws["!merges"].push({
    s: { r: preCheckStartRow, c: 1 },
    e: { r: preCheckStartRow, c: 2 }
  });

  // ✅ Merge each Parameters row horizontally
  for (let r = preCheckStartRow + 1; r <= preCheckEndRow; r++) {
    ws["!merges"].push({
      s: { r: r, c: 1 },
      e: { r: r, c: 2 }
    });
  }

  // rowIndex++;

  // ================= LOAD DETAILS =================
  // addRow(["Load / Floor Details"], greyHeader);
  addRow(["Load / Floor Details :", "UPS No", "Rating", "Serving Floor", "Loading Percentage"], blueHeader);

  mop.loadDetails.forEach(row => addRow(["", row[0], row[1], row[2], row[3]], normalCell));
  const loadFloorStartRow = rowIndex - mop.loadDetails.length - 1;
  const loadFloorEndRow = rowIndex - 1;

  if (!ws["!merges"]) ws["!merges"] = [];

  // ✅ Merge left vertical label
  ws["!merges"].push({
    s: { r: loadFloorStartRow, c: 0 },
    e: { r: loadFloorEndRow, c: 0 }
  });

  // rowIndex++;

  // ================= RISK =================

  // Add first row (with label + first risk)
  addRow([
    "Risk Analysis :",
    // "1",
    mop.risk[0],
    "",
    "",
    ""
  ], greyHeader);

  const riskStartRow = rowIndex - 1;

  // Add remaining risk rows
  for (let i = 1; i < mop.risk.length; i++) {
    addRow([
      "",                     // keep blank for vertical merge
      // (i + 1).toString(),     // serial number
      mop.risk[i],
      "",
      "",
      ""
    ], normalCell);
  }

  const riskEndRow = rowIndex - 1;

  if (!ws["!merges"]) ws["!merges"] = [];

  // ✅ Merge left label vertically
  ws["!merges"].push({
    s: { r: riskStartRow, c: 0 },
    e: { r: riskEndRow, c: 0 }
  });

  // ✅ Merge risk description horizontally (col 2–4)
  for (let r = riskStartRow; r <= riskEndRow; r++) {
    ws["!merges"].push({
      s: { r: r, c: 1 },
      e: { r: r, c: 4 }
    });
  }

  // rowIndex++;

  // ================= MITIGATION =================
  addRow([
    "Mitigation / Back up Plan :",
    // "1",
    mop.mitigation[0],
    "",
    "",
    ""
  ], greyHeader);

  const mitigationStartRow = rowIndex - 1;

  // Add remaining mitigation rows
  for (let i = 1; i < mop.mitigation.length; i++) {
    addRow([
      "",                     // keep blank for vertical merge
      // (i + 1).toString(),     // serial number
      mop.mitigation[i],
      "",
      "",
      ""
    ], normalCell);
  }

  const mitigationEndRow = rowIndex - 1;

  if (!ws["!merges"]) ws["!merges"] = [];

  // ✅ Merge left label vertically
  ws["!merges"].push({
    s: { r: mitigationStartRow, c: 0 },
    e: { r: mitigationEndRow, c: 0 }
  });

  // ✅ Merge mitigation description horizontally (col 2–4)
  for (let r = mitigationStartRow; r <= mitigationEndRow; r++) {
    ws["!merges"].push({
      s: { r: r, c: 1 },
      e: { r: r, c: 4 }
    });
  }

  // rowIndex++;

  // =================Customer Notification requires=================
  addRow(["Customer Notification requires :", "Yes"], greyHeader);
  if (!ws["!merges"]) ws["!merges"] = [];

  // ✅ Merge left vertical label
  ws["!merges"].push({
    s: { r: rowIndex - 1, c: 1 },
    e: { r: rowIndex - 1, c: 4 }
  });

  // ================= ACTIVITY =================
  addRow([
    "Activity :",
    `Activity - ${mop.activityInfo.startDate} ${mop.activityInfo.startTime} hrs to  ${mop.activityInfo.endDate} ${mop.activityInfo.endTime} hrs ( Considered UPS1- PM work activity case )`,
    // mop.activitySteps[0],
    "",
    "",
    ""
  ], greyHeader);

  const activityStartRow = rowIndex - 1;

  // Add remaining activity rows
  for (let i = 1; i < mop.activitySteps.length; i++) {
    addRow([
      "",                     // keep blank for vertical merge
      // (i + 1).toString(),     // serial number
      mop.activitySteps[i],
      "",
      "",
      ""
    ], normalCell);
  }

  const activityEndRow = rowIndex - 1;

  if (!ws["!merges"]) ws["!merges"] = [];

  // ✅ Merge left label vertically
  ws["!merges"].push({
    s: { r: activityStartRow, c: 0 },
    e: { r: activityEndRow, c: 0 }
  });

  // ✅ Merge activity description horizontally (col 2–4)
  for (let r = activityStartRow; r <= activityEndRow; r++) {
    ws["!merges"].push({
      s: { r: r, c: 1 },
      e: { r: r, c: 4 }
    });
  }

  // rowIndex++;

  // ================= ROLLBACK =================
  addRow([
    "Fall back / Roll Back Plan :",
    // "1",
    mop.rollback[0],
    "",
    "",
    ""
  ], greyHeader);

  const rollbackStartRow = rowIndex - 1;

  // Add remaining rollback rows
  for (let i = 1; i < mop.rollback.length; i++) {
    addRow([
      "",                     // keep blank for vertical merge
      // (i + 1).toString(),     // serial number
      mop.rollback[i],
      "",
      "",
      ""
    ], normalCell);
  }

  const rollbackEndRow = rowIndex - 1;

  if (!ws["!merges"]) ws["!merges"] = [];

  // ✅ Merge left label vertically
  ws["!merges"].push({
    s: { r: rollbackStartRow, c: 0 },
    e: { r: rollbackEndRow, c: 0 }
  });

  // ✅ Merge rollback description horizontally (col 2–4)
  for (let r = rollbackStartRow; r <= rollbackEndRow; r++) {
    ws["!merges"].push({
      s: { r: r, c: 1 },
      e: { r: r, c: 4 }
    });
  }

  // rowIndex++;

  // ================= INFRA =================

  // Header row
  addRow(["Infra Resources :", "Role", "", "Name", ""], greyHeader);

  const infraStartRow = rowIndex - 1;

  // Add infra rows
  mop.infra.forEach((row) => {
    addRow([
      "",           // left vertical label column
      row[0],       // Role
      "",           // merge with col1
      row[1],       // Name
      ""            // merge with col3
    ], normalCell);
  });

  const infraEndRow = rowIndex - 1;

  if (!ws["!merges"]) ws["!merges"] = [];

  // ✅ Merge left vertical label
  ws["!merges"].push({
    s: { r: infraStartRow, c: 0 },
    e: { r: infraEndRow, c: 0 }
  });

  // ✅ Merge Role header (col 1–2)
  ws["!merges"].push({
    s: { r: infraStartRow, c: 1 },
    e: { r: infraStartRow, c: 2 }
  });

  // ✅ Merge Name header (col 3–4)
  ws["!merges"].push({
    s: { r: infraStartRow, c: 3 },
    e: { r: infraStartRow, c: 4 }
  });

  // ✅ Merge Role cells horizontally (each row)
  for (let r = infraStartRow + 1; r <= infraEndRow; r++) {
    ws["!merges"].push({
      s: { r: r, c: 1 },
      e: { r: r, c: 2 }
    });

    ws["!merges"].push({
      s: { r: r, c: 3 },
      e: { r: r, c: 4 }
    });
  }

  // rowIndex++;

  // ================= SPARES =================

  // Header row
  addRow([
    "Additional Spares required for the Activity :",
    "Spares Description",
    "Specifications",
    "Quantity",
    "Availability Ensured at site (Yes/No)"
  ], greenHeader);

  const sparesStartRow = rowIndex - 1;

  // Add spares rows
  mop.spares.forEach((row) => {
    addRow([
      "",         // left vertical label column
      row[0],     // Description
      row[1],     // Specification
      row[2],     // Quantity
      row[3]      // Availability
    ], normalCell);
  });

  const sparesEndRow = rowIndex - 1;

  if (!ws["!merges"]) ws["!merges"] = [];

  // ✅ Merge left vertical label
  ws["!merges"].push({
    s: { r: sparesStartRow, c: 0 },
    e: { r: sparesEndRow, c: 0 }
  });

  // rowIndex++;

  // ================= APPROVAL =================
  addRow(["Created By :", mop.approval.createdBy, `Reviewer : ${mop.approval.reviewer}`, `Approver : ${mop.approval.approver}`, `CR Number : ${mop.approval.crNumber}`], normalCell);

  // Column width
  ws["!cols"] = [
    { wch: 40 },
    { wch: 25 },
    { wch: 25 },
    { wch: 30 },
    { wch: 20 },
    { wch: 20 }
  ];

  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: rowIndex, c: 5 }
  });

  XLSX.utils.book_append_sheet(wb, ws, "MOP");
  XLSX.writeFile(wb, `${mop.header.title}.xlsx`);
};