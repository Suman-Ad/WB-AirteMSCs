# EnergyMonitor reading contract

The UI subscribes to `energyMonitor/{siteId}/meters/{meterId}`. Existing aggregate meter fields remain supported. All received fields, including nested objects, appear in the All Readings tab. Power and session-counter values must be finite numbers. RMS, FWD display tables, and measured vectors also accept numeric strings from collectors.

## Energy registers

Supply either `import_kwh` (cumulative import energy in kWh), or `fwd_Wh` with `energyUnits` equal to `Wh` or `kWh`. Despite the legacy field name, no unit is inferred from `fwd_Wh`. Unknown units display as raw counter values. `powerUnits` applies only to instantaneous power.

Energy Registers records the first and latest valid, server-confirmed counters seen in the current page session for every meter. A valid reading has `status: "OK"` and a Firestore `observedAt` timestamp. Duplicate/out-of-order timestamps and cached snapshots do not advance registers. A counter decrease invalidates consumption for that session; an energy unit change restarts the window. One sample does not establish consumption. Reloading clears the session. Daily opening/closing and historical reports require collector-side persisted period readings; this UI does not write billing or daily log records.

## Measured vectors

Provide absolute phase angles in degrees, counterclockwise from the positive horizontal axis, using a shared reference for voltage and current:

```json
{
  "phases": {
    "r": { "voltage": 230, "voltage_angle": 0, "current": 12, "current_angle": -25 },
    "y": { "voltage": 231, "voltage_angle": -120, "current": 11, "current_angle": -145 },
    "b": { "voltage": 229, "voltage_angle": 120, "current": 13, "current_angle": 95 }
  }
}
```

Flat equivalents are supported: `voltage_r`, `voltage_angle_r`, `current_r`, `current_angle_r`, and corresponding `_y` / `_b` fields. Voltage magnitudes should be phase-to-neutral V; current magnitudes are A. Missing vectors are omitted rather than estimated. Voltage and current vector lengths are normalized separately. An aggregate power factor does not provide the phase sequence or measured phase displacement.

## Power display units

Supply `active_power`, `apparent_power`, and `reactive_power` as numeric readings. Set `powerUnits: "base"` when they are W, VA, and var; the UI divides each by 1,000. Set `powerUnits: "kilo"` when they are already kW, kVA, and kvar. Cards, meter tables, overview totals, details, and active-power charts use these kilo units consistently. Missing readings or unknown source scales display an em dash. Reactive power signs are preserved; apparent/reactive readings are not estimated from power factor.

## RMS / FWD panels and phase compatibility

The Live Meters view groups phase-to-neutral and line-to-line RMS voltage, phase/neutral/average RMS current, frequency, and FWD active/apparent/reactive energy. Additional received RMS and FWD fields are included as received. Unknown counter units stay labelled raw; Wh / VAh / varh convert only with matching energy metadata, while explicit kWh / kVAh / kvarh field names carry their unit.

Phase fields match case and separators flexibly. R/Y/B and L1/L2/L3 aliases are supported, including `RMS_Voltage_L1`, `voltage_L1_angle`, `RMS_Current_L1`, `current_angle_L1`, and nested phase fields. `phase_angle_R` / `phase_angle_L1` are displayed as V–I displacement, not treated as absolute phase angles. Other angle fields remain available in the expandable register list.

The vector axes stay visible even without measured data. Optional grey balanced-reference lines at 0 / -120 / +120 degrees are explicitly illustrative. Measured vectors require both phase magnitude and absolute angle; no phase sequence or lead/lag is inferred from aggregate PF. The PF-equivalent angle is calculated from acos(abs(PF)) and is labelled as calculated, not measured.

Site Overview and meter power summaries show a single active / apparent / reactive value tuple with the exact unit caption `kW / kVA / kvar`.
