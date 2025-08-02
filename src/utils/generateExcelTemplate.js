// src/utils/generateExcelTemplate.js
import * as XLSX from "xlsx";

export const generateExcelTemplate = (siteName = "Unknown Site") => {
  const wb = XLSX.utils.book_new();

  const today = new Date().toISOString().split("T")[0];

  const sheetNames = [
    "A_MR Tracking",
    "B_AC PM",
    "C_Electrical PM",
    "D_Power EB/DG",
    "E_Cleanliness",
    "F_Site Issue"
  ];

  sheetNames.forEach((sheet) => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Site Name", siteName],
      ["Date", today],
      [],
      ["Sl No", "Parameter", "Status", "Remark"], // sample header
    ]);
    XLSX.utils.book_append_sheet(wb, ws, sheet);
  });

  const fileName = `Template_${siteName.replace(/\s/g, "_")}_${today}.xlsx`;
  XLSX.writeFile(wb, fileName);
};
