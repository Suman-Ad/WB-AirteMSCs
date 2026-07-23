// import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import XLSX from "xlsx-js-style";

export const generateMopPDF = (mop) => {
  const doc = new jsPDF("l", "mm", "a4");

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 8;
  let startY = 8;

  const BORDER_COLOR = [0, 0, 0];
  const ORANGE = [255, 192, 0];
  const YELLOW = [255, 242, 204];
  const GREY = [217, 217, 217];
  const GREEN = [0, 176, 80];
  const BLUE = [0, 176, 240];
  const WHITE = [255, 255, 255];

  const safeArray = (value) => (
    Array.isArray(value) ? value : []
  );

  const cleanText = (value) => (
    value === null || value === undefined
      ? ""
      : String(value)
  );

  const tableStyles = {
    fontSize: 7,
    cellPadding: 1.5,
    lineColor: BORDER_COLOR,
    lineWidth: 0.25,
    valign: "middle",
    overflow: "linebreak",
  };

  const getFinalY = () => (
    doc.lastAutoTable?.finalY || startY
  );

  // ================= TITLE =================
  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    body: [[
      {
        content: cleanText(
          mop.header?.title || "Method of Procedure"
        ).toUpperCase(),
        colSpan: 5,
        styles: {
          fillColor: ORANGE,
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 14,
          halign: "center",
          valign: "middle",
          cellPadding: 4,
        },
      },
    ]],
    theme: "grid",
    styles: tableStyles,
    columnStyles: {
      0: { cellWidth: 56 },
      1: { cellWidth: 54 },
      2: { cellWidth: 54 },
      3: { cellWidth: 62 },
      4: { cellWidth: 55 },
    },
  });

  startY = getFinalY();

  // ================= DOCUMENT DETAILS =================
  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    body: [[
      {
        content:
          `DOC NO - ${cleanText(mop.header?.docNo)}` +
          `                         ` +
          `Release Date : ${cleanText(mop.header?.releaseDate)}`,
        colSpan: 5,
        styles: {
          fontStyle: "bold",
          halign: "center",
          cellPadding: 2,
        },
      },
    ]],
    theme: "grid",
    styles: tableStyles,
    columnStyles: {
      0: { cellWidth: 56 },
      1: { cellWidth: 54 },
      2: { cellWidth: 54 },
      3: { cellWidth: 62 },
      4: { cellWidth: 55 },
    },
  });

  startY = getFinalY();

  // ================= SITE INFO =================
  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    body: [[
      `City : ${cleanText(mop.siteInfo?.city)}`,
      `Location : ${cleanText(mop.siteInfo?.location)}`,
      `Floor : ${cleanText(mop.siteInfo?.floor)}`,
      "Tier Category-Core/TX :",
      cleanText(mop.siteInfo?.tier),
    ]],
    theme: "grid",
    styles: tableStyles,
    columnStyles: {
      0: { cellWidth: 56 },
      1: { cellWidth: 54 },
      2: { cellWidth: 54 },
      3: { cellWidth: 62 },
      4: { cellWidth: 55 },
    },
  });

  startY = getFinalY();

  // ================= ACTIVITY INFORMATION =================
  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    body: [
      [
        {
          content: "Nature of Activity / Work :",
          styles: {
            fontStyle: "bold",
            fillColor: YELLOW,
          },
        },
        {
          content: cleanText(mop.activityInfo?.nature),
          colSpan: 4,
          styles: {
            fillColor: YELLOW,
          },
        },
      ],
      [
        {
          content: "Activity Start :",
          rowSpan: 2,
          styles: {
            fontStyle: "bold",
            fillColor: YELLOW,
          },
        },
        {
          content:
            `Activity Start Date :\n` +
            cleanText(mop.activityInfo?.startDate),
          styles: {
            fillColor: YELLOW,
          },
        },
        {
          content:
            `Activity End Date :\n` +
            cleanText(mop.activityInfo?.endDate),
          styles: {
            fillColor: YELLOW,
          },
        },
        {
          content: "Duration of Activity :",
          rowSpan: 2,
          styles: {
            fontStyle: "bold",
            fillColor: YELLOW,
          },
        },
        {
          content: cleanText(mop.activityInfo?.duration),
          rowSpan: 2,
          styles: {
            fillColor: YELLOW,
            halign: "center",
          },
        },
      ],
      [
        {
          content:
            `Activity Start Time :\n` +
            `${cleanText(mop.activityInfo?.startTime)} Hrs`,
          styles: {
            fillColor: YELLOW,
          },
        },
        {
          content:
            `Activity End Time :\n` +
            `${cleanText(mop.activityInfo?.endTime)} Hrs`,
          styles: {
            fillColor: YELLOW,
          },
        },
      ],
      [
        {
          content: "Activity Owner :",
          styles: {
            fontStyle: "bold",
            fillColor: YELLOW,
          },
        },
        {
          content: cleanText(mop.activityInfo?.owner),
          styles: {
            fillColor: YELLOW,
          },
        },
        {
          content:
            `${cleanText(
              mop.activityInfo?.node || "Equipment"
            )} OEM :\n` +
            cleanText(mop.activityInfo?.oem),
          styles: {
            fillColor: YELLOW,
          },
        },
        {
          content: "Other Stake Holders :",
          styles: {
            fontStyle: "bold",
            fillColor: YELLOW,
          },
        },
        {
          content: cleanText(mop.activityInfo?.stakeholders),
          styles: {
            fillColor: YELLOW,
          },
        },
      ],
      [
        {
          content: "Service Impact :",
          styles: {
            fontStyle: "bold",
            fillColor: YELLOW,
          },
        },
        {
          content: cleanText(mop.activityInfo?.serviceImpact),
          colSpan: 4,
          styles: {
            fillColor: YELLOW,
          },
        },
      ],
    ],
    theme: "grid",
    styles: tableStyles,
    columnStyles: {
      0: { cellWidth: 56 },
      1: { cellWidth: 54 },
      2: { cellWidth: 54 },
      3: { cellWidth: 62 },
      4: { cellWidth: 55 },
    },
  });

  startY = getFinalY();

  // ================= PRE-ACTIVITY CHECKS =================
  const preChecks = safeArray(mop.preChecks);

  const preCheckBody = preChecks.length
    ? preChecks.map((row, index) => [
        index === 0
          ? {
              content: "Pre Activity Check Points :",
              rowSpan: preChecks.length,
              styles: {
                fontStyle: "bold",
                fillColor: GREEN,
                textColor: WHITE,
              },
            }
          : undefined,
        {
          content: cleanText(row?.[0]),
          colSpan: 2,
        },
        cleanText(row?.[1]),
        cleanText(row?.[2]),
      ].filter((cell) => cell !== undefined))
    : [[
        {
          content: "Pre Activity Check Points :",
          styles: {
            fontStyle: "bold",
            fillColor: GREEN,
            textColor: WHITE,
          },
        },
        {
          content: "",
          colSpan: 2,
        },
        "",
        "",
      ]];

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    head: [[
      {
        content: "Pre Activity Check Points :",
        styles: {
          fillColor: GREEN,
          textColor: WHITE,
          fontStyle: "bold",
        },
      },
      {
        content: "Checkpoints",
        colSpan: 2,
        styles: {
          fillColor: GREEN,
          textColor: WHITE,
          fontStyle: "bold",
          halign: "center",
        },
      },
      {
        content: "Status",
        styles: {
          fillColor: GREEN,
          textColor: WHITE,
          fontStyle: "bold",
          halign: "center",
        },
      },
      {
        content: "Parameters",
        styles: {
          fillColor: GREEN,
          textColor: WHITE,
          fontStyle: "bold",
          halign: "center",
        },
      },
    ]],
    body: preCheckBody,
    theme: "grid",
    styles: tableStyles,
    headStyles: {
      fillColor: GREEN,
      textColor: WHITE,
    },
    columnStyles: {
      0: { cellWidth: 56 },
      1: { cellWidth: 54 },
      2: { cellWidth: 54 },
      3: { cellWidth: 62 },
      4: { cellWidth: 55 },
    },
    showHead: "firstPage",
  });

  startY = getFinalY();

  // ================= LOAD / FLOOR DETAILS =================
  const loadDetails = safeArray(mop.loadDetails);

  const loadBody = loadDetails.length
    ? loadDetails.map((row, index) => [
        index === 0
          ? {
              content: "Load / Floor Details :",
              rowSpan: loadDetails.length,
              styles: {
                fontStyle: "bold",
                fillColor: BLUE,
                textColor: WHITE,
              },
            }
          : undefined,
        cleanText(row?.[0]),
        cleanText(row?.[1]),
        cleanText(row?.[2]),
        cleanText(row?.[3]),
      ].filter((cell) => cell !== undefined))
    : [[
        {
          content: "Load / Floor Details :",
          styles: {
            fontStyle: "bold",
            fillColor: BLUE,
            textColor: WHITE,
          },
        },
        "",
        "",
        "",
        "",
      ]];

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    head: [[
      {
        content: "Load / Floor Details :",
        styles: {
          fillColor: BLUE,
          textColor: WHITE,
          fontStyle: "bold",
        },
      },
      {
        content:
          `${cleanText(
            mop.activityInfo?.node || "Equipment"
          )} No`,
        styles: {
          fillColor: BLUE,
          textColor: WHITE,
          fontStyle: "bold",
          halign: "center",
        },
      },
      {
        content: "Rating",
        styles: {
          fillColor: BLUE,
          textColor: WHITE,
          fontStyle: "bold",
          halign: "center",
        },
      },
      {
        content: "Serving Floor",
        styles: {
          fillColor: BLUE,
          textColor: WHITE,
          fontStyle: "bold",
          halign: "center",
        },
      },
      {
        content: "Loading Percentage",
        styles: {
          fillColor: BLUE,
          textColor: WHITE,
          fontStyle: "bold",
          halign: "center",
        },
      },
    ]],
    body: loadBody,
    theme: "grid",
    styles: tableStyles,
    columnStyles: {
      0: { cellWidth: 56 },
      1: { cellWidth: 54 },
      2: { cellWidth: 54 },
      3: { cellWidth: 62 },
      4: { cellWidth: 55 },
    },
    showHead: "firstPage",
  });

  startY = getFinalY();

  const addFiveColumnListSection = (
    title,
    items,
    options = {}
  ) => {
    const rows = safeArray(items);
    const safeRows = rows.length ? rows : [""];

    const body = safeRows.map((item, index) => [
      index === 0
        ? {
            content: title,
            rowSpan: safeRows.length,
            styles: {
              fontStyle: "bold",
              fillColor: options.fillColor || GREY,
              textColor: options.textColor || [0, 0, 0],
            },
          }
        : undefined,
      {
        content:
          options.numbered === false
            ? cleanText(item)
            : `${index + 1}. ${cleanText(item)}`,
        colSpan: 4,
      },
    ].filter((cell) => cell !== undefined));

    autoTable(doc, {
      startY,
      margin: { left: margin, right: margin },
      body,
      theme: "grid",
      styles: tableStyles,
      columnStyles: {
        0: { cellWidth: 56 },
        1: { cellWidth: 54 },
        2: { cellWidth: 54 },
        3: { cellWidth: 62 },
        4: { cellWidth: 55 },
      },
    });

    startY = getFinalY();
  };

  // ================= RISK =================
  addFiveColumnListSection(
    "Risk Analysis :",
    mop.risk
  );

  // ================= MITIGATION =================
  addFiveColumnListSection(
    "Mitigation / Back up Plan :",
    mop.mitigation
  );

  // ================= CUSTOMER NOTIFICATION =================
  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    body: [[
      {
        content: "Customer Notification requires :",
        styles: {
          fontStyle: "bold",
          fillColor: GREY,
        },
      },
      {
        content: cleanText(
          mop.customerNotificationRequired || "Yes"
        ),
        colSpan: 4,
      },
    ]],
    theme: "grid",
    styles: tableStyles,
    columnStyles: {
      0: { cellWidth: 56 },
      1: { cellWidth: 54 },
      2: { cellWidth: 54 },
      3: { cellWidth: 62 },
      4: { cellWidth: 55 },
    },
  });

  startY = getFinalY();

  // ================= ACTIVITY =================
  const activitySteps = safeArray(mop.activitySteps);

  const activitySummary =
    `Activity - ${cleanText(mop.activityInfo?.startDate)} ` +
    `${cleanText(mop.activityInfo?.startTime)} hrs to ` +
    `${cleanText(mop.activityInfo?.endDate)} ` +
    `${cleanText(mop.activityInfo?.endTime)} hrs ` +
    `(Considered ${cleanText(
      mop.activityInfo?.nature
    )} work activity case)`;

  const activityRows = [
    activitySummary,
    ...activitySteps.map(
      (step, index) => `${index + 1}. ${cleanText(step)}`
    ),
  ];

  const activityBody = activityRows.map((item, index) => [
    index === 0
      ? {
          content: "Activity :",
          rowSpan: activityRows.length,
          styles: {
            fontStyle: "bold",
            fillColor: GREY,
          },
        }
      : undefined,
    {
      content: item,
      colSpan: 4,
      styles: index === 0
        ? {
            fontStyle: "bold",
            fillColor: GREY,
          }
        : {},
    },
  ].filter((cell) => cell !== undefined));

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    body: activityBody,
    theme: "grid",
    styles: tableStyles,
    columnStyles: {
      0: { cellWidth: 56 },
      1: { cellWidth: 54 },
      2: { cellWidth: 54 },
      3: { cellWidth: 62 },
      4: { cellWidth: 55 },
    },
  });

  startY = getFinalY();

  // ================= ROLLBACK =================
  addFiveColumnListSection(
    "Fall back / Roll Back Plan :",
    mop.rollback
  );

  const addResourceSection = (title, rows) => {
    const resources = safeArray(rows);
    const safeRows = resources.length
      ? resources
      : [["", ""]];

    const body = safeRows.map((row, index) => [
      index === 0
        ? {
            content: title,
            rowSpan: safeRows.length,
            styles: {
              fontStyle: "bold",
              fillColor: GREY,
            },
          }
        : undefined,
      {
        content: cleanText(row?.[0]),
        colSpan: 2,
      },
      {
        content: cleanText(row?.[1]),
        colSpan: 2,
      },
    ].filter((cell) => cell !== undefined));

    autoTable(doc, {
      startY,
      margin: { left: margin, right: margin },
      head: [[
        {
          content: title,
          styles: {
            fillColor: GREY,
            fontStyle: "bold",
          },
        },
        {
          content: "Role",
          colSpan: 2,
          styles: {
            fillColor: GREY,
            fontStyle: "bold",
            halign: "center",
          },
        },
        {
          content: "Name",
          colSpan: 2,
          styles: {
            fillColor: GREY,
            fontStyle: "bold",
            halign: "center",
          },
        },
      ]],
      body,
      theme: "grid",
      styles: tableStyles,
      columnStyles: {
        0: { cellWidth: 56 },
        1: { cellWidth: 54 },
        2: { cellWidth: 54 },
        3: { cellWidth: 62 },
        4: { cellWidth: 55 },
      },
      showHead: "firstPage",
    });

    startY = getFinalY();
  };

  // ================= INFRA =================
  addResourceSection("Infra Resources :", mop.infra);

  // ================= NETWORK =================
  if (safeArray(mop.network).length) {
    addResourceSection(
      "Network Resources :",
      mop.network
    );
  }

  // ================= SPARES =================
  const spares = safeArray(mop.spares);

  const sparesBody = spares.length
    ? spares.map((row, index) => [
        index === 0
          ? {
              content:
                "Additional Spares required for the Activity :",
              rowSpan: spares.length,
              styles: {
                fontStyle: "bold",
                fillColor: GREEN,
                textColor: WHITE,
              },
            }
          : undefined,
        cleanText(row?.[0]),
        cleanText(row?.[1]),
        cleanText(row?.[2]),
        cleanText(row?.[3]),
      ].filter((cell) => cell !== undefined))
    : [[
        {
          content:
            "Additional Spares required for the Activity :",
          styles: {
            fontStyle: "bold",
            fillColor: GREEN,
            textColor: WHITE,
          },
        },
        "",
        "",
        "",
        "",
      ]];

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    head: [[
      {
        content:
          "Additional Spares required for the Activity :",
        styles: {
          fillColor: GREEN,
          textColor: WHITE,
          fontStyle: "bold",
        },
      },
      {
        content: "Spares Description",
        styles: {
          fillColor: GREEN,
          textColor: WHITE,
          fontStyle: "bold",
          halign: "center",
        },
      },
      {
        content: "Specifications",
        styles: {
          fillColor: GREEN,
          textColor: WHITE,
          fontStyle: "bold",
          halign: "center",
        },
      },
      {
        content: "Quantity",
        styles: {
          fillColor: GREEN,
          textColor: WHITE,
          fontStyle: "bold",
          halign: "center",
        },
      },
      {
        content:
          "Availability Ensured at site (Yes/No)",
        styles: {
          fillColor: GREEN,
          textColor: WHITE,
          fontStyle: "bold",
          halign: "center",
        },
      },
    ]],
    body: sparesBody,
    theme: "grid",
    styles: tableStyles,
    columnStyles: {
      0: { cellWidth: 56 },
      1: { cellWidth: 54 },
      2: { cellWidth: 54 },
      3: { cellWidth: 62 },
      4: { cellWidth: 55 },
    },
    showHead: "firstPage",
  });

  startY = getFinalY();

  // ================= APPROVAL =================
  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    body: [[
      {
        content:
          `Created By :\n` +
          cleanText(mop.approval?.createdBy),
      },
      {
        content:
          `Reviewer :\n` +
          cleanText(mop.approval?.reviewer),
      },
      {
        content:
          `Approver :\n` +
          cleanText(mop.approval?.approver),
      },
      {
        content:
          `CR Number :\n` +
          cleanText(mop.approval?.crNumber),
        colSpan: 2,
      },
    ]],
    theme: "grid",
    styles: {
      ...tableStyles,
      fontStyle: "bold",
      minCellHeight: 14,
    },
    columnStyles: {
      0: { cellWidth: 56 },
      1: { cellWidth: 54 },
      2: { cellWidth: 54 },
      3: { cellWidth: 62 },
      4: { cellWidth: 55 },
    },
  });

  // ================= PAGE NUMBERS =================
  const totalPages = doc.getNumberOfPages();

  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setTextColor(80);

    doc.text(
      `Page ${page} of ${totalPages}`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 4,
      { align: "right" }
    );
  }

  const safeTitle = cleanText(
    mop.header?.title || "MOP"
  )
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();

  doc.save(`${safeTitle || "MOP"}.pdf`);
};
// For Excel generation, we will use the xlsx-js-style library to create a styled workbook based on the MOP data structure. The code will create a new workbook, add a worksheet, and populate it with the MOP data while applying styles for better readability.
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

  const thinBorder = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  const thickBorder = { top: { style: "thick" }, bottom: { style: "thick" }, left: { style: "thick" }, right: { style: "thick" } };

  const applyOuterBorderToSheet = (ws, totalRows, totalCols) => {
  for (let r = 0; r < totalRows; r++) {
    for (let c = 0; c < totalCols; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });

      // Ensure cell exists
      if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
      ws[cellRef].s = ws[cellRef].s || {};
      ws[cellRef].s.border = ws[cellRef].s.border || {};

      // Apply thin border by default
      ws[cellRef].s.border.top = { style: "thin" };
      ws[cellRef].s.border.bottom = { style: "thin" };
      ws[cellRef].s.border.left = { style: "thin" };
      ws[cellRef].s.border.right = { style: "thin" };

      // Override with thick border on outer edges
      if (r === 0) ws[cellRef].s.border.top = { style: "thick", color: { rgb: "000000" } };
      if (r === totalRows - 1) ws[cellRef].s.border.bottom = { style: "thick", color: { rgb: "000000" } };
      if (c === 0) ws[cellRef].s.border.left = { style: "thick", color: { rgb: "000000" } };
      if (c === totalCols - 1) ws[cellRef].s.border.right = { style: "thick", color: { rgb: "000000" } };
    }
  }
};



  const applyBorderToMerge = (ws, mergeRange, border) => {
    const startRow = mergeRange.s.r;
    const endRow = mergeRange.e.r;
    const startCol = mergeRange.s.c;
    const endCol = mergeRange.e.c;

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
        ws[cellRef].s = ws[cellRef].s || {};
        ws[cellRef].s.border = border; // default thin border for all cells in the merge
      }
    }
  };


  const borderAll = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" }
  };

  const outLineborder = {
    top: { style: "thick", color: { rgb: "000000" } },
    bottom: { style: "thick", color: { rgb: "000000" } },
    left: { style: "thick", color: { rgb: "000000" } },
    right: { style: "thick", color: { rgb: "000000" } },
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

  // ws["!merges"] = [{
  //   s: { r: 0, c: 0 },
  //   e: { r: 0, c: 4 },
  // }];
  const titleMerge = { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } };
  ws["!merges"] = [titleMerge];
  applyBorderToMerge(ws, titleMerge, borderAll);


  addRow([
    `DOC NO - ${mop.header.docNo}    Release Date : ${mop.header.releaseDate}`
  ], normalCell);

  const docRow = rowIndex - 1;

  if (!ws["!merges"]) ws["!merges"] = [];

  ws["!merges"].push({
    s: { r: docRow, c: 0 },
    e: { r: docRow, c: 4 }
  });
  applyBorderToMerge(ws, {
    s: { r: docRow, c: 0 },
    e: { r: docRow, c: 4 }
  }, borderAll);

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
  applyBorderToMerge(ws, {
    s: { r: naturRow, c: 1 },
    e: { r: naturRow, c: 4 }
  }, borderAll);
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
    `${mop.activityInfo.node} OEM : ${mop.activityInfo.oem}`, "Other Stake Holders :", mop.activityInfo.stakeholders], yellowBlock);
  addRow(["Service Impact :", mop.activityInfo.serviceImpact], yellowBlock);
  const nsaRow = rowIndex - 1;

  if (!ws["!merges"]) ws["!merges"] = [];

  ws["!merges"].push({
    s: { r: nsaRow, c: 1 },
    e: { r: nsaRow, c: 4 }
  });
  applyBorderToMerge(ws, {
    s: { r: nsaRow, c: 1 },
    e: { r: nsaRow, c: 4 }
  }, borderAll);

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
  addRow(["Load / Floor Details :", `${mop.activityInfo.node} No`, "Rating", "Serving Floor", "Loading Percentage"], blueHeader);

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
  applyBorderToMerge(ws, {
    s: { r: rowIndex - 1, c: 1 },
    e: { r: rowIndex - 1, c: 4 }
  }, borderAll);

  // ================= ACTIVITY =================
  addRow([
    "Activity :",
    `Activity - ${mop.activityInfo.startDate} ${mop.activityInfo.startTime} hrs to  ${mop.activityInfo.endDate} ${mop.activityInfo.endTime} hrs ( Considered ${mop.activityInfo.nature}- PM work activity case )`,
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

  // ================= NETWORK =================

  // Header row
  addRow(["Network Resources :", "Role", "", "Name", ""], greyHeader);

  const networkStartRow = rowIndex - 1;

  // Add network rows
  mop.network.forEach((row) => {
    addRow([
      "",           // left vertical label column
      row[0],       // Role
      "",           // merge with col1
      row[1],       // Name
      ""            // merge with col3
    ], normalCell);
  });

  const networkEndRow = rowIndex - 1;

  if (!ws["!merges"]) ws["!merges"] = [];

  // ✅ Merge left vertical label
  ws["!merges"].push({
    s: { r: networkStartRow, c: 0 },
    e: { r: networkEndRow, c: 0 }
  });

  // ✅ Merge Role header (col 1–2)
  ws["!merges"].push({
    s: { r: networkStartRow, c: 1 },
    e: { r: networkStartRow, c: 2 }
  });

  // ✅ Merge Name header (col 3–4)
  ws["!merges"].push({
    s: { r: networkStartRow, c: 3 },
    e: { r: networkStartRow, c: 4 }
  });

  // ✅ Merge Role cells horizontally (each row)
  for (let r = networkStartRow + 1; r <= networkEndRow; r++) {
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
    e: { r: rowIndex - 1, c: 4 }
  });

  // ws["!ref"] already calculated
  // const range = XLSX.utils.decode_range(ws["!ref"]);
  // const totalRows = range.e.r + 1;
  // const totalCols = range.e.c + 1;

  // applyOuterBorderToSheet(ws, totalRows, totalCols);


  XLSX.utils.book_append_sheet(wb, ws, "MOP");
  XLSX.writeFile(wb, `${mop.header.title}.xlsx`);
};