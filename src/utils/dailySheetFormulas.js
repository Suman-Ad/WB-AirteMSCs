import { Parser } from "hot-formula-parser";
import { formulasConfig } from "../config/formulasConfig";

export const evaluateFormulasForRows = (rows = [], sheetKey = "") => {
  const cfg = formulasConfig[sheetKey] || {};
  // Normal sheets
  let cfgMap = {};
  if (!Array.isArray(cfg)) {
    cfgMap = cfg;
  }

  return (rows || []).map((row) => {
    const parser = new Parser();
    const evaluated = { ...row };

    // set numeric variables
    Object.entries(row).forEach(([k, v]) => {
      if (typeof v === "string" && v.trim().startsWith("=")) return;
      const n = parseFloat(v);
      if (!isNaN(n)) parser.setVariable(k, n);
    });

    const formulaKeys = Object.keys(row).filter(k => typeof row[k] === "string" && row[k].trim().startsWith("="));
    Object.keys(cfgMap).forEach(k => {
      if (typeof cfgMap[k] === "string" && cfgMap[k].trim().startsWith("=") && !formulaKeys.includes(k)) {
        formulaKeys.push(k);
      }
    });

    const maxIter = Math.max(3, formulaKeys.length);
    for (let iter = 0; iter < maxIter; iter++) {
      let changed = false;
      for (const k of formulaKeys) {
        let formulaSource = null;
        if (typeof row[k] === "string" && row[k].trim().startsWith("=")) {
          formulaSource = row[k].trim().substring(1);
        } else if (typeof cfgMap[k] === "string" && cfgMap[k].trim().startsWith("=")) {
          formulaSource = cfgMap[k].trim().substring(1);
        }
        if (!formulaSource) continue;

        const res = parser.parse(formulaSource);
        if (!res.error) {
          if (evaluated[k] !== res.result) {
            evaluated[k] = res.result;
            parser.setVariable(k, res.result);
            changed = true;
          }
        } else {
          evaluated[k] = "#ERROR";
        }
      }
      if (!changed) break;
    }

    return evaluated;
  });
};

