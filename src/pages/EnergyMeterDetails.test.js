import React from "react";
import { render, screen } from "@testing-library/react";
import EnergyMeterDetails from "./EnergyMeterDetails";
import { displayReading, vectors } from "./energyMeterData";

const meter = { id: "meter-24", name: "LT Panel - 01", status: "OK", powerUnits: "base",
  profileName: "Conzerv EM6400 THD · Full map", communicationState: "ONLINE", failedScans: 5,
  consecutiveFailures: 0, voltageAnglesNominal: true, R_voltage_ln: 244.75, R_current: 212.98,
  R_voltage_phase_angle: 0, R_current_phase_angle: -7.22, custom_r_voltage_thd: 1.84,
  custom_neutral_current: 45.54, custom_average_load_percent: 13.43, custom_rpm: 1482.78,
  fieldDefinitions: { custom_average_load_percent: { label: "Average load", unit: "%" } } };

test("full-map meter shows quality, labeled units and collector diagnostics", () => {
  render(<EnergyMeterDetails meter={meter} state="Live" />);
  expect(screen.getByRole("heading", { name: "Power quality & phase loading" })).toBeInTheDocument();
  expect(screen.getByText("1.84 %")).toBeInTheDocument();
  expect(screen.getByText("45.54 A")).toBeInTheDocument();
  expect(screen.getByText("Average load")).toBeInTheDocument();
  expect(screen.getByText("13.43 %")).toBeInTheDocument();
  expect(screen.getByText("ONLINE")).toBeInTheDocument();
  expect(screen.getByText(/Voltage angles are fixed nominal references/)).toBeInTheDocument();
  expect(vectors(meter)[0].source).toMatch(/Nominal/);
});

test("failed scans withhold custom values and missing readings remain unavailable", () => {
  expect(displayReading({ ...meter, status: "ERROR" }, "custom_neutral_current")).toEqual({ value: null, unit: "A" });
  expect(displayReading(meter, "custom_y_voltage_thd")).toEqual({ value: null, unit: "%" });
  expect(displayReading({ ...meter, custom_interruptions: 0 }, "custom_interruptions")).toEqual({ value: 0, unit: "count" });
});
