// src/utils/EquipmentAudit.js

function toNumber(v) {
  // strict numeric parse: remove commas and spaces, handle empty
  if (v === null || v === undefined) return 0;
  const s = String(v).trim().replace(/,/g, '');
  if (s === '') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * form: object with keys:
 *   runningLoadA, cableSizeA, cableRunA, dbMcbRatingA, rackRunningLoadA, rackMcbRatingA
 *   runningLoadB, cableSizeB, cableRunB, dbMcbRatingB, rackRunningLoadB, rackMcbRatingB
 *
 * Returns an object with computed entries and safe zero-fallbacks.
 */
export function computeCapacityAnalysis(form) {
  // parse Source A
  const A = toNumber(form.runningLoadA);
  const A1 = toNumber(form.cableSizeA);    // cable size (sq mm)
  const A2 = toNumber(form.cableRunA);     // number of runs
  const AA1 = toNumber(form.dbMcbRatingA); // MCB rating (A)
  const X = toNumber(form.rackRunningLoadA);   // rack running load
  const XX1 = toNumber(form.rackMcbRatingA);   // rack MCB rating

  // parse Source B
  const B = toNumber(form.runningLoadB);
  const B1 = toNumber(form.cableSizeB);
  const B2 = toNumber(form.cableRunB);
  const BB1 = toNumber(form.dbMcbRatingB);
  const Y = toNumber(form.rackRunningLoadB);
  const YY1 = toNumber(form.rackMcbRatingB);

  // compute capacities
  // NOTE: spreadsheet showed formula A1 * A2 * 2 (keeps same semantics)
  const cableCapacityA = A1 * A2 * 2;
  const cableCapacityB = B1 * B2 * 2;

  // avoid divide-by-zero by checking capacity > 0
  const pctLoadOnCableA = cableCapacityA > 0 ? (A / cableCapacityA) * 100 : null;
  const pctLoadOnMcbA = AA1 > 0 ? (A / AA1) * 100 : null;

  const pctLoadOnCableB = cableCapacityB > 0 ? (B / cableCapacityB) * 100 : null;
  const pctLoadOnMcbB = BB1 > 0 ? (B / BB1) * 100 : null;

  // combined metrics
  const totalLoadBoth = A + B;
  const bothCableCapacity = Math.min(cableCapacityA || Infinity, cableCapacityB || Infinity);
  const bothMcbCapacity = Math.min(AA1 || Infinity, BB1 || Infinity);

  const pctLoadBothOnCable = bothCableCapacity > 0 ? (totalLoadBoth / bothCableCapacity) * 100 : null;
  const pctLoadBothOnMcb = bothMcbCapacity > 0 ? (totalLoadBoth / bothMcbCapacity) * 100 : null;

  const isBothMcbSame = AA1 === BB1 && AA1 > 0;

  // Rack-end combined (if using X and Y)
  const rackTotal = X + Y;
  const rackCableCapacity = bothCableCapacity; // or separate logic if needed
  const rackPctOnCable = rackCableCapacity > 0 ? (rackTotal / rackCableCapacity) * 100 : null;

  return {
    // Source A
    A, A1, A2, cableCapacityA, pctLoadOnCableA, AA1, pctLoadOnMcbA, X, XX1,
    // Source B
    B, B1, B2, cableCapacityB, pctLoadOnCableB, BB1, pctLoadOnMcbB, Y, YY1,
    // Combined
    totalLoadBoth, bothCableCapacity, pctLoadBothOnCable, bothMcbCapacity, pctLoadBothOnMcb, isBothMcbSame,
    // Rack-end
    rackTotal, rackPctOnCable
  };
}