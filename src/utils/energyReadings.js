export const POWER_READINGS = [
  { key: "active_power", label: "Active power", unit: "kW" },
  { key: "apparent_power", label: "Apparent power", unit: "kVA" },
  { key: "reactive_power", label: "Reactive power", unit: "kvar" },
];
// All display values use kilo units. Unknown source scales are not relabeled.
export const powerReading = (meter, key = "active_power") => {
  const value = meter?.[key];
  if (!finite(value)) return null;
  if (meter.powerUnits === "base") return value / 1000;
  if (meter.powerUnits === "kilo") return value;
  return null;
};
// Counter units are independent of instantaneous power units.
export const finite = (value) => typeof value === "number" && Number.isFinite(value);
export const energyCounter = (meter) => {
  if (finite(meter?.import_kwh)) return { value: meter.import_kwh, unit: "kWh" };
  if (!finite(meter?.fwd_Wh)) return null;
  const unit = meter.energyUnits;
  return { value: meter.fwd_Wh / (unit === "Wh" ? 1000 : 1), unit: ["Wh", "kWh"].includes(unit) ? "kWh" : "raw" };
};
export const updateRegisters = (previous, meters) => {
  const next = { ...previous };
  meters.forEach((meter) => {
    const counter = energyCounter(meter);
    const time = meter.observedAt?.toMillis?.();
    if (meter.status !== "OK" || !counter || !finite(time)) return;
    const old = next[meter.id];
    if (old && counter.unit === old.unit && time <= old.closedAt) return;
    if (!old || old.unit !== counter.unit) {
      next[meter.id] = { opening: counter.value, closing: counter.value, openedAt: time, closedAt: time, unit: counter.unit, reset: false, samples: 1 };
    } else {
      next[meter.id] = { ...old, closing: counter.value, closedAt: time, samples: old.samples + 1, reset: old.reset || counter.value < old.closing };
    }
  });
  return next;
};
export const registerUsage = (register) => register && !register.reset && register.samples > 1 ? register.closing - register.opening : null;
export const flattenReadings = (data, prefix = "") => Object.entries(data || {}).flatMap(([key, value]) => {
  const path = prefix ? `${prefix}.${key}` : key;
  if (typeof value?.toMillis === "function") return [[path, new Date(value.toMillis()).toLocaleString()]];
  if (value !== null && typeof value === "object") return flattenReadings(value, path);
  return [[path, value === null || value === undefined ? "—" : String(value)]];
});
// Match collector naming variants without interpreting an unspecified unit or angle.
const fieldKey = (key) => key.toLowerCase().replace(/[^a-z0-9]/g, "");
export const findReading = (meter, aliases) => {
  const fields = flattenReadings(meter);
  for (const alias of aliases) {
    const entry = fields.find(([key]) => fieldKey(key) === fieldKey(alias));
    if (!entry) continue;
    const value = entry[1].trim();
    if (value !== "" && value !== "—" && Number.isFinite(Number(value))) return { key: entry[0], value: Number(value) };
  }
  return null;
};
const phaseAliases = { r: ["r", "l1"], y: ["y", "l2"], b: ["b", "l3"] };
export const phaseMagnitude = (meter, phase, kind) => findReading(meter, phaseAliases[phase].flatMap((p) => [
  `phases.${p}.${kind}`, `phases.${p}.${kind}_rms`, `${kind}_${p}`, `${kind}_${p}_rms`,
  `${kind}_rms_${p}`, `rms_${kind}_${p}`, `rms.${kind}_${p}`, `rms.${p}.${kind}`, `${kind === "voltage" ? "v" : "i"}rms_${p}`,
  ...(kind === "voltage" ? [`voltage_${p}n`, `voltage_${p}_n`, `v_${p}n`, `rms_voltage_${p}n`, `vrms_${p}n`] : [`i_${p}`]),
]));
// Only explicitly named absolute voltage/current angles are used as measured vectors.
export const phaseVectors = (meter) => ["r", "y", "b"].flatMap((phase) => ["voltage", "current"].map((kind) => {
  const magnitude = phaseMagnitude(meter, phase, kind);
  const angle = findReading(meter, phaseAliases[phase].flatMap((p) => [
    `phases.${p}.${kind}_angle`, `phases.${p}.${kind}_angle_deg`, `${kind}_angle_${p}`,
    `${kind}_${p}_angle`, `${kind}_angle_${p}_deg`, `${kind === "voltage" ? "v" : "i"}_angle_${p}`,
  ]));
  return magnitude && magnitude.value >= 0 && angle ? { phase, kind, magnitude: magnitude.value, angle: angle.value } : null;
}).filter(Boolean));
export const phaseDisplacements = (meter) => ["r", "y", "b"].map((phase) => ({
  phase,
  reading: findReading(meter, phaseAliases[phase].flatMap((p) => [`phases.${p}.phase_angle`, `phase_angle_${p}`, `phase_angle_${p}_deg`, `phase_${p}_angle`])),
}));
export const rmsReadings = (meter) => {
  const rows = [];
  const add = (label, unit, reading) => rows.push({ label, unit, value: reading?.value ?? null, key: reading?.key });
  ["r", "y", "b"].forEach((p) => add(`Voltage ${p.toUpperCase()}-N RMS`, "V", phaseMagnitude(meter, p, "voltage")));
  [["RY", "12"], ["YB", "23"], ["BR", "31"]].forEach(([pair, line]) => add(`Voltage ${pair} RMS`, "V", findReading(meter, [`voltage_${pair}`, `voltage_l${line}`, `voltage_${pair}_rms`, `rms_voltage_${pair}`, `vrms_${pair}`])));
  add("Average voltage L-L RMS", "V", findReading(meter, ["voltage_ll", "voltage_ll_rms", "rms_voltage_ll", "rms.voltage_ll"]));
  add("Average voltage L-N RMS", "V", findReading(meter, ["voltage_ln", "voltage_ln_rms", "rms_voltage_ln", "rms.voltage_ln"]));
  ["r", "y", "b"].forEach((p) => add(`Current ${p.toUpperCase()} RMS`, "A", phaseMagnitude(meter, p, "current")));
  add("Neutral current RMS", "A", findReading(meter, ["current_n", "neutral_current", "current_neutral", "irms_n"]));
  add("Average current RMS", "A", findReading(meter, ["current", "current_avg", "current_rms", "rms.current"]));
  add("Frequency", "Hz", findReading(meter, ["frequency", "frequency_hz"]));
  const used = new Set(rows.map((r) => r.key));
  flattenReadings(meter).filter(([key]) => /rms/i.test(key) && !used.has(key)).forEach(([key, value]) => rows.push({ label: key, key, value, unit: "as received" }));
  return rows;
};
export const forwardReadings = (meter) => {
  const definitions = [
    ["FWD active energy", ["import_kwh", "fwd_kWh", "fwd_Wh", "forward_active_energy", "forward.wh"], "kWh", "Wh"],
    ["FWD apparent energy", ["fwd_kVAh", "fwd_VAh", "forward_apparent_energy", "forward.vah"], "kVAh", "VAh"],
    ["FWD reactive energy", ["fwd_kvarh", "fwd_varh", "forward_reactive_energy", "forward.varh"], "kvarh", "varh"],
  ];
  const used = new Set();
  const rows = definitions.map(([label, aliases, kiloUnit, baseUnit]) => {
    const reading = findReading(meter, aliases);
    if (!reading) return { label, value: null, unit: kiloUnit };
    used.add(reading.key);
    const declared = typeof meter?.energyUnits === "string" ? meter.energyUnits.toLowerCase() : "";
    const explicitKilo = /kwh|kvah|kvarh/i.test(reading.key);
    const divisor = explicitKilo || declared === kiloUnit.toLowerCase() || declared === "kilo" ? 1 : declared === baseUnit.toLowerCase() || declared === "base" ? 1000 : null;
    return { label, key: reading.key, value: divisor ? reading.value / divisor : reading.value, unit: divisor ? kiloUnit : "raw · units unverified" };
  });
  flattenReadings(meter).filter(([key]) => /fwd|forward/i.test(key) && !used.has(key)).forEach(([key, value]) => rows.push({ label: key, key, value, unit: "as received" }));
  return rows;
};
