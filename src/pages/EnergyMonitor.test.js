import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import EnergyMonitor from "./EnergyMonitor";
import { onSnapshot } from "firebase/firestore";

jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({ collection: jest.fn(), onSnapshot: jest.fn() }));
jest.mock("recharts", () => {
  const React = require("react");
  const Box = ({ children }) => React.createElement("div", null, children);
  return Object.fromEntries(["LineChart", "Line", "XAxis", "YAxis", "Tooltip", "ResponsiveContainer", "CartesianGrid", "BarChart", "Bar"].map((key) => [key, Box]));
});

const capturedAt = Date.now();
const reading = (id, overrides = {}) => ({ id, data: () => ({ name: id, status: "OK", active_power: 2500, powerUnits: "base", observedAt: { toMillis: () => capturedAt }, ...overrides }) });
beforeEach(() => {
  onSnapshot.mockImplementation((ref, options, next) => {
    next({ docs: [reading("meter-1"), reading("meter-2", { powerUnits: "unknown" }), reading("meter-3", { observedAt: { toMillis: () => capturedAt - 120000 } })], metadata: { fromCache: false } });
    return jest.fn();
  });
});

test("overview aggregates only fresh readings with verified units and opens meter details", () => {
  render(<EnergyMonitor userData={{ siteId: "site-a" }} />);
  const load = screen.getAllByRole("article")[0];
  expect(load).toHaveTextContent("2.5");
  expect(load).toHaveTextContent("1 active-power meters");
  fireEvent.click(screen.getByText("View all readings →"));
  expect(screen.getByRole("combobox")).toHaveValue("meter-1");
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "meter-2" } });
  expect(screen.getByRole("combobox")).toHaveValue("meter-2");
});

test("analysis and alerts expose session limits and stale meter health", () => {
  render(<EnergyMonitor userData={{ siteId: "site-a" }} />);
  fireEvent.click(screen.getByRole("tab", { name: "Analysis" }));
  expect(screen.getByText(/Analysis covers updates received/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Alerts (1)" }));
  expect(screen.getByRole("heading", { name: "meter-3" })).toBeInTheDocument();
  fireEvent.click(screen.getByText("Inspect meter →"));
  expect(screen.getByRole("combobox")).toHaveValue("meter-3");
});

test("unassigned site shows actionable empty state without subscribing", () => {
  onSnapshot.mockClear();
  render(<EnergyMonitor userData={{}} />);
  expect(screen.getByRole("alert")).toHaveTextContent("needs a site ID");
  expect(onSnapshot).not.toHaveBeenCalled();
});
