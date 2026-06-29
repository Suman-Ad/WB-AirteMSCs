
// ✅ Helper function for safe numeric conversion
function toNumber(v) {
    if (v === null || v === undefined) return 0;
    const s = String(v).trim().replace(/,/g, "");
    if (s === "") return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
}

export function computeCapacityAnalysis(form) {
    const A = toNumber(form.runningLoadA);
    const A1 = toNumber(form.rackIncomingCableSizeA);
    const A2 = toNumber(form.rackCableRunA);
    const AA1 = toNumber(form.dbMcbRatingA);
    const x = toNumber(form.rackEndRunningLoadA);
    const xx1 = toNumber(form.rackEndMcbRatingA);

    const B = toNumber(form.runningLoadB);
    const B1 = toNumber(form.rackIncomingCableSizeB);
    const B2 = toNumber(form.rackCableRunB);
    const BB1 = toNumber(form.dbMcbRatingB);
    const y = toNumber(form.rackEndRunningLoadB);
    const yy1 = toNumber(form.rackEndMcbRatingB);

    const rackHeight = toNumber(form.rackHeight);
    const rackWidth = toNumber(form.rackWidth);
    const rackDepth = toNumber(form.rackDepth);

    const cableCapacityA = A1 * A2 * 2;
    const cableCapacityB = B1 * B2 * 2;

    const pctLoadOnCableA = cableCapacityA > 0 ? (A / cableCapacityA) * 100 : 0;
    const pctLoadOnMcbA = AA1 > 0 ? (A / AA1) * 100 : 0;

    const pctLoadOnCableB = cableCapacityB > 0 ? (B / cableCapacityB) * 100 : 0;
    const pctLoadOnMcbB = BB1 > 0 ? (B / BB1) * 100 : 0;

    const rackEndPctLoadMcbA = xx1 > 0 ? (x / xx1) * 100 : 0;
    const rackEndPctLoadMcbB = yy1 > 0 ? (y / yy1) * 100 : 0;

    const totalLoadBoth = A + B;
    const bothCableCapacity = Math.min(cableCapacityA || Infinity, cableCapacityB || Infinity);
    const bothMcbCapacity = Math.min(AA1 || Infinity, BB1 || Infinity);

    const pctLoadBothOnCable = bothCableCapacity > 0 ? (totalLoadBoth / bothCableCapacity) * 100 : 0;
    const pctLoadBothOnMcb = bothMcbCapacity > 0 ? (totalLoadBoth / bothMcbCapacity) * 100 : 0;

    const equipmentRackNoA = form.equipmentRackNo || "A0";
    const rackNameA = form.rackName || "UNKNOWN RACK";

    const equipmentRackNoB = form.equipmentRackNo || "A0";
    const rackNameB = form.rackName || "UNKNOWN RACK";

    const rackEndRunningLoadA = A;
    const rackEndRunningLoadB = B;

    const pctRackOccupied = (toNumber(form.usedRackUSpace) > 0 && toNumber(form.totalRackUSpace) > 0)
        ? (toNumber(form.usedRackUSpace) / toNumber(form.totalRackUSpace)) * 100
        : 0;

    const rackType = form.rackType;

    return {
        cableCapacityA,
        pctLoadCableA: pctLoadOnCableA.toFixed(1),
        pctLoadMcbA: pctLoadOnMcbA.toFixed(1),

        cableCapacityB,
        pctLoadCableB: pctLoadOnCableB.toFixed(1),
        pctLoadMcbB: pctLoadOnMcbB.toFixed(1),

        rackEndPctLoadMcbA: rackEndPctLoadMcbA.toFixed(1),
        rackEndPctLoadMcbB: rackEndPctLoadMcbB.toFixed(1),

        totalLoadBoth,
        bothCableCapacity,
        bothPctLoadCable: pctLoadBothOnCable.toFixed(1),
        bothPctLoadMcb: pctLoadBothOnMcb.toFixed(1),
        isBothMcbSame: AA1 > 0 && BB1 > 0 && AA1 === BB1 ? "Yes" : "No",

        equipmentRackNoA,
        rackNameA,
        equipmentRackNoB,
        rackNameB,

        rackEndRunningLoadA,
        rackEndRunningLoadB,

        rackSize: `${rackHeight}x${rackWidth}x${rackDepth}`,
        sourceType: rackType === "Passive" ? "None" : A > 0 && B > 0 ? "Dual Source" : "Single Source",
        freeRackUSpace: toNumber(form.totalRackUSpace) - toNumber(form.usedRackUSpace),
        pctRackOccupied: pctRackOccupied.toFixed(1),
    };
}

export const recomputeUSpaceFromEquipments = (equipments, totalRackUSpace) => {
    const used = equipments.reduce((sum, e) => sum + (Number(e.sizeU) || 0), 0);
    const total = Number(totalRackUSpace) || 0;
    const free = total - used;
    return {
      usedRackUSpace: used,
      freeRackUSpace: free,
      pctRackOccupied: total > 0 ? ((used / total) * 100).toFixed(1) : "0.0",
    };
  };

export function sanitizeRackEquipments(list) {
    return list
      .map(eq => {
        const start = Number(eq.startU) || 0;
        const end = Number(eq.endU) || 0;
        const sizeU = start >= end && end > 0 ? start - end + 1 : 0;

        return {
          id: eq.id,
          name: eq.name || "",
          startU: start,
          endU: end,
          sizeU,
          remarks: eq.remarks || "",
        };
      })
      .filter(eq => eq.sizeU > 0);     // remove invalid entries
  }