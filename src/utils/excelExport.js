import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const toNumber = (value, decimals = null) => {
    if (value === "" || value === null || value === undefined || value === "-") {
        return "";
    }

    const num = Number(value);

    if (isNaN(num)) return value;

    return decimals !== null ? Number(num.toFixed(decimals)) : num;
};


const applyRackSheetStyles = (ws) => {
    const range = XLSX.utils.decode_range(ws["!ref"]);

    for (let C = range.s.c; C <= range.e.c; ++C) {
        const headerCell = XLSX.utils.encode_cell({ r: 0, c: C });
        const cell = ws[headerCell];
        if (!cell || !cell.v) continue;

        const headerText = String(cell.v);

        // 🎨 Header color logic
        let fillColor = "FFD9D9D9"; // default grey

        if (headerText.trim().endsWith("A")) {
            fillColor = "FFDBEAFE"; // blue
        } else if (headerText.trim().endsWith("B")) {
            fillColor = "FFFFEDD5"; // orange
        }

        cell.s = {
            ...(cell.s || {}),
            font: {
                ...(cell.s?.font || {}),
                bold: true,
            },
            alignment: {
                ...(cell.s?.alignment || {}),
                wrapText: true,
                horizontal: "center",
                vertical: "center",
            },
            fill: {
                ...(cell.s?.fill || {}),
                fgColor: { rgb: fillColor },
            },
            border: {
                ...(cell.s?.border || {}),
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" },
            },
        };
    }

    // 📐 Auto column width
    ws["!cols"] = Array.from(
        { length: range.e.c + 1 },
        () => ({ wch: 22 })
    );
};

const applyAllBorders = (ws) => {
    const range = XLSX.utils.decode_range(ws["!ref"]);

    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            let cell = ws[cellRef];

            if (!cell) {
                cell = {
                    t: "s",
                    v: ""
                };
                ws[cellRef] = cell;
            }

            cell.s = {
                ...(cell.s || {}),
                border: {
                    ...(cell.s?.border || {}),
                    top: { style: "thin" },
                    bottom: { style: "thin" },
                    left: { style: "thin" },
                    right: { style: "thin" },
                },
            };
        }
    }
};


export const exportRackExcel = (filteredData) => {
    if (filteredData.length === 0) {
        alert("No data to export!");
        return;
    }

    // Map Firestore data to a flat table
    const exportData = filteredData.map((item) => ({
        "Sl. No": filteredData.indexOf(item) + 1,
        "Id": item.id,
        "Region": item.region,
        "Circle": item.circle,
        "Site Name": item.siteName,
        "Equipment Location": item.equipmentLocation,
        "Rack/Equipment No": item.equipmentRackNo,
        "Rack Name": item.rackName,
        "RFAI No.": item.rfaiNo,
        "Rack Power On Date": item.rackPowerOnDate,
        "Rack Type (Active/Passive)": item.rackType,
        "Power Type (AC/DC/AC+DC)": item.powerType,
        "Rack Status": item.rackStatus,
        "Rack Switch Off Date": item.switchedOffDate,
        "Source Type": item.sourceType,
        "Rack Size (H x W x D)": item.rackSize,
        "Temp Front Top": item.frontTopTemp,
        "Temp Front Mid": item.frontMiddleTemp,
        "Temp Front Bottom": item.frontBottomTemp,
        "Temp Back Top": item.backTopTemp,
        "Temp Back Mid": item.backMiddleTemp,
        "Temp Back Bottom": item.backBottomTemp,
        "Rack Description": item.rackDescription,
        "Total Rack U": item.totalRackUSpace,
        "Total Used U": item.usedRackUSpace,
        "Total Free U": item.freeRackUSpace,
        "% of Rack Occupied": item.pctRackOccupied,
        "Domain Type": item.rackDomainType,
        "DR Test Status": item.drTestStatus,
        "DR Test Date": item.drTestDate,
        "Rack Owner Details": item.rackOwnerName,
        "SMPS Rating A (Amps)": item.smpsRatingA,
        "SMPS Name A": item.smpsNameA,
        "DB Number A": item.dbNumberA,
        "DB Voltage A (V)": toNumber(item.dbVoltageA),
        "Incomer Rating A (Amps)": toNumber(item.incomerRatingA),
        "Incomer DB Cable Size A (Sq mm)": toNumber(item.cableSizeA),
        "Incomer DB Cable Length A (Mtr)": toNumber(item.cableLengthA),
        "Cable Runs A (Nos)": toNumber(item.cableRunA),
        "Equipment Rack No A": item.equipmentRackNoA,
        "Rack Name A": item.rackNameA,
        "Rack Incoming Power Cable Size A (Sq mm)": toNumber(item.rackIncomingCableSizeA),
        "Rack Cable Length A (Mtr)": toNumber(item.rackCableLengthA),
        "Rack Cable Run A (Nos)": toNumber(item.rackCableRunA),
        "DB MCB Number A": item.dbMcbNumberA,
        "Rack End Voltage A (V)": toNumber(item.rackEndVoltageA),
        "DB MCB Rating A (Amps)": toNumber(item.dbMcbRatingA),
        "Temp On Mcb/Fuse A (°C)": toNumber(item.tempOnMcbA),
        "Source Running Load A (Amps)": toNumber(item.runningLoadA),
        "Cable Load Capacity A": toNumber(item.cableCapacityA),
        "% Load Cable A": toNumber(item.pctLoadCableA),
        "% PCT Load MCB A (Amps)": toNumber(item.pctLoadMcbA),
        "Rack End No of DB / Power Strip A (nos.)": item.rackEndNoDbA,
        "Rack End DCDB / Power Strip Name A": item.rackEndDcdbNameA,
        "Rack End DB Running Load A (Amps)": toNumber(item.rackEndRunningLoadA),
        "Rack End DB MCB Rating A (Amps)": toNumber(item.rackEndMcbRatingA),
        "Rack End % Load MCB A": toNumber(item.rackEndPctLoadMcbA),
        "Remarks A": item.remarksA,
        "SMPS Rating B (Amps)": toNumber(item.smpsRatingB),
        "SMPS Name B": item.smpsNameB,
        "DB Number B": item.dbNumberB,
        "DB Voltage B (V)": toNumber(item.dbVoltageB),
        "Incomer Rating B (Amps)": toNumber(item.incomerRatingB),
        "Incomer DB Cable Size B (Sq mm)": toNumber(item.cableSizeB),
        "Cable Length B (Mtr)": toNumber(item.cableLengthB),
        "Cable Runs B (Nos)": toNumber(item.cableRunB),
        "Equipment Rack No B": item.equipmentRackNoB,
        "Rack Name B": item.rackNameB,
        "Rack Incoming Power Cable Size B (Sq mm)": toNumber(item.rackIncomingCableSizeB),
        "Rack Cable Length B (Mtr)": toNumber(item.rackCableLengthB),
        "Rack Cable Run B (Nos)": toNumber(item.rackCableRunB),
        "DB MCB Number B": item.dbMcbNumberB,
        "Rack End Voltage B (V)": toNumber(item.rackEndVoltageB),
        "DB MCB Rating B (Amps)": toNumber(item.dbMcbRatingB),
        "Temp On Mcb/Fuse B (°C)": toNumber(item.tempOnMcbB),
        "Running Load B (Amps)": toNumber(item.runningLoadB),
        "Cable Load Capacity B": toNumber(item.cableCapacityB),
        "% Load Cable B": toNumber(item.pctLoadCableB),
        "% PCT Load MCB B (Amps)": toNumber(item.pctLoadMcbB),
        "Rack End No of DB / Power Strip B (nos.)": item.rackEndNoDbB,
        "Rack End DCDB / Power Strip Name B": item.rackEndDcdbNameB,
        "Rack End DB Running Load B (Amps)": toNumber(item.rackEndRunningLoadB),
        "Rack End DB MCB Rating B (Amps)": toNumber(item.rackEndMcbRatingB),
        "Rack End % Load MCB B": toNumber(item.rackEndPctLoadMcbB),
        "Remarks B": item.remarksB,
        "Total Load Both Sources": toNumber(item.totalLoadBoth),
        "Both Cable Capacity": toNumber(item.bothCableCapacity),
        "% Load on Cable": toNumber(item.bothPctLoadCable),
        "% Load on MCB": toNumber(item.bothPctLoadMcb),
        "Both MCB Same": item.bothMcbSame,
        "Last Updated": item.updatedBy?.name
            ? `${item.updatedBy.name}(${item.updatedBy.empId}) - ${item.updatedAt}`
            : item.updatedAt,
    }));

    const exportEquipment = filteredData.flatMap((eqItem, rackIndex) => {
        // If no rack equipments, still export one empty row
        if (!Array.isArray(eqItem.rackEquipments) || eqItem.rackEquipments.length === 0) {
            return [{
                "Sl. No": rackIndex + 1,
                "Site Name": eqItem.siteName || "-",
                "Equipment Location": eqItem.equipmentLocation || "-",
                "Equipment Rack No": eqItem.equipmentRackNo || "-",
                "Equipment Name": "-",
                "Start U": "-",
                "End U": "-",
                "Remarks": "-",
            }];
        }

        // One row per equipment
        return eqItem.rackEquipments.map((eq, eqIndex) => ({
            "Sl. No": `${rackIndex + 1}.${eqIndex + 1}`,   // keeps grouping
            "Site Name": eqItem.siteName || "-",
            "Equipment Location": eqItem.equipmentLocation || "-",
            "Equipment Rack No": eqItem.equipmentRackNo || "-",
            "Equipment Name": eq.name || "-",
            "Start U": eq.startU ?? "-",
            "End U": eq.endU ?? "-",
            "Remarks": eq.remarks || "-",
        }));
    });


    const ws = XLSX.utils.json_to_sheet(exportData);
    const ws1 = XLSX.utils.json_to_sheet(exportEquipment)
    applyRackSheetStyles(ws);
    applyAllBorders(ws);

    applyRackSheetStyles(ws1);
    applyAllBorders(ws1);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rack Data");
    XLSX.utils.book_append_sheet(wb, ws1, "Rack Equipments");

    const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx", cellStyles: true });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    saveAs(blob, `ACDC_RackData_${new Date().toISOString().split("T")[0]}.xlsx`);
    // XLSX.writeFile(wb, `ACDC_RackData_${new Date().toISOString().split("T")[0]}.xlsx`);
};
