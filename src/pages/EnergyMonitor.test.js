import React from "react";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import EnergyMonitor from "./EnergyMonitor";
import { doc, onSnapshot, query } from "firebase/firestore";

jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({ collection: jest.fn(), query: jest.fn(), where: jest.fn(), orderBy: jest.fn(), limit: jest.fn(), doc: jest.fn(), onSnapshot: jest.fn(), setDoc: jest.fn(), serverTimestamp: jest.fn() }));
jest.mock("recharts", () => {
  const React = require("react");
  const Box = ({ children }) => React.createElement("div", null, children);
  return Object.fromEntries(["LineChart", "Line", "XAxis", "YAxis", "Tooltip", "ResponsiveContainer", "CartesianGrid", "BarChart", "Bar"].map((key) => [key, Box]));
});

const capturedAt = Date.now();
const reading = (id, overrides = {}) => ({ id, data: () => ({ name: id, status: "OK", active_power: 2500, powerUnits: "base", observedAt: { toMillis: () => capturedAt }, ...overrides }) });
beforeEach(() => {
  localStorage.clear();
  doc.mockReturnValue({ isSLD: true });
  query.mockImplementation((reference) => reference);
  onSnapshot.mockImplementation((ref, options, next) => {
    if (ref?.isSLD) { next({ exists: () => false, metadata: { fromCache: false, hasPendingWrites: false } }); return jest.fn(); }
    next({ docs: [reading("meter-1", { name: "Main Incomer", voltage_ll: 415 }), reading("meter-2", { powerUnits: "unknown" }), reading("meter-3", { observedAt: { toMillis: () => capturedAt - 120000 } })], metadata: { fromCache: false } });
    return jest.fn();
  });
});

test("five requested tabs preserve meter selection and compact phase readings", () => {
  render(<EnergyMonitor userData={{ siteId: "site-a" }} />);
  expect(screen.getAllByRole("tab")).toHaveLength(5);
  expect(screen.queryByLabelText("Automatic switch settings site")).not.toBeInTheDocument();
  expect(screen.queryByText("Existing header EB/DG switch · automatic meter mapping")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Site Overview" }));
  expect(screen.getByText("Monitored active power")).toBeInTheDocument();
  const load = screen.getAllByRole("article")[0];
  expect(load).toHaveTextContent("2.5");
  expect(screen.getAllByText("Voltage L-N (V)")).toHaveLength(3);
  const meterCard = screen.getAllByRole("article")[3];
  fireEvent.click(within(meterCard).getByRole("button", { name: "Open readings & vector →" }));
  expect(screen.getByRole("combobox", { name: "Selected meter" })).toHaveValue("meter-1");
  fireEvent.change(screen.getByRole("combobox", { name: "Selected meter" }), { target: { value: "meter-2" } });
  expect(screen.getByRole("combobox", { name: "Selected meter" })).toHaveValue("meter-2");
});

test("SLD import controls and meter alarms are reachable", () => {
  render(<EnergyMonitor userData={{ siteId: "site-a", role: "Admin" }} />);
  fireEvent.click(screen.getByRole("tab", { name: "Electrical SLD" }));
  expect(screen.getByText("Import .json")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Alarms (1)" }));
  expect(screen.getByRole("cell", { name: "meter-3" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Inspect meter" }));
  expect(screen.getByRole("combobox", { name: "Selected meter" })).toHaveValue("meter-3");
});

test("unassigned site shows actionable empty state without subscribing", () => {
  onSnapshot.mockClear();
  render(<EnergyMonitor userData={{}} />);
  expect(screen.getByRole("alert")).toHaveTextContent("needs a site ID");
  expect(onSnapshot).not.toHaveBeenCalled();
});

test("switching SLD tabs reuses the existing Firestore listener until page unmount", () => {
  const view = render(<EnergyMonitor userData={{ siteId: "site-a" }} />);
  const initialListeners = onSnapshot.mock.calls.length;
  fireEvent.click(screen.getByRole("tab", { name: "Electrical SLD" }));
  expect(onSnapshot.mock.calls.length).toBe(initialListeners + 1);
  for (let i = 0; i < 3; i += 1) {
    fireEvent.click(screen.getByRole("tab", { name: "Energy Dashboard" }));
    fireEvent.click(screen.getByRole("tab", { name: "Electrical SLD" }));
  }
  expect(onSnapshot.mock.calls.length).toBe(initialListeners + 1);
  const stops = onSnapshot.mock.results.map((result) => result.value).filter((value) => typeof value === "function");
  stops.forEach((stop) => expect(stop).not.toHaveBeenCalled());
  view.unmount();
  stops.forEach((stop) => expect(stop).toHaveBeenCalledTimes(1));
});

test("report listeners are kept while switching tabs and removed when the page exits", () => {
  const view = render(<EnergyMonitor userData={{ siteId: "site-a", site: "DLF" }} />);
  const initialListeners = onSnapshot.mock.calls.length;
  fireEvent.click(screen.getByRole("tab", { name: "Analysis Report" }));
  expect(onSnapshot.mock.calls.length).toBe(initialListeners + 6);
  fireEvent.click(screen.getByRole("tab", { name: "Energy Dashboard" }));
  fireEvent.click(screen.getByRole("tab", { name: "Analysis Report" }));
  expect(onSnapshot.mock.calls.length).toBe(initialListeners + 6);
  const stops = onSnapshot.mock.results.map((result) => result.value).filter((value) => typeof value === "function");
  view.unmount();
  stops.forEach((stop) => expect(stop).toHaveBeenCalledTimes(1));
});

test("default follows Main Incomer / running DG and site totals exclude branch meters", () => {
  let receive;
  onSnapshot.mockImplementation((ref, options, next) => { receive = next; return jest.fn(); });
  const view = render(<EnergyMonitor userData={{ siteId: "site-a" }} />);
  const sample = (mainVolts, dgVolts) => ({ docs: [reading("meter-1", { name: "Branch load", active_power: 90000, voltage_ll: 415 }), reading("meter-2", { name: "Main Incomer", active_power: mainVolts ? 20000 : 0, voltage_ll: mainVolts }), reading("meter-3", { name: "DG-1 Meter", active_power: 30000, voltage_ll: dgVolts })], metadata: { fromCache: false } });
  act(() => receive(sample(415, 0)));
  expect(screen.getByRole("combobox", { name: "Selected meter" })).toHaveValue("meter-2");
  fireEvent.click(screen.getByRole("tab", { name: "Site Overview" }));
  expect(screen.getAllByRole("article")[0]).toHaveTextContent("20 kW");
  act(() => receive(sample(0, 415)));
  expect(screen.getAllByRole("article")[0]).toHaveTextContent("30 kW");
  fireEvent.click(screen.getByRole("tab", { name: "Energy Dashboard" }));
  expect(screen.getByRole("combobox", { name: "Selected meter" })).toHaveValue("meter-3");
  fireEvent.change(screen.getByRole("combobox", { name: "Selected meter" }), { target: { value: "meter-1" } });
  act(() => receive(sample(415, 0)));
  expect(screen.getByRole("combobox", { name: "Selected meter" })).toHaveValue("meter-1");
  view.unmount();
});

test("changing a collector meter ID replaces its Site Overview card and selected meter", () => {
  let receive;
  onSnapshot.mockImplementation((ref, options, next) => { receive = next; return jest.fn(); });
  render(<EnergyMonitor userData={{siteId: "site-a"}} />);
  const old = reading("meter-24", {name:"LT Panel - 01", observedAt:{toMillis:()=>capturedAt - 60000}});
  act(() => receive({docs:[old],metadata:{fromCache:false}}));
  fireEvent.change(screen.getByRole("combobox", {name:"Selected meter"}), {target:{value:"meter-24"}});
  act(() => receive({docs:[old, reading("meter-40",{name:"LT Panel - 01"})],metadata:{fromCache:false}}));
  expect(screen.getByRole("combobox",{name:"Selected meter"})).toHaveValue("meter-40");
  expect(screen.queryByRole("option",{name:"meter-24"})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab",{name:"Site Overview"}));
  expect(screen.getAllByRole("heading",{name:"LT Panel - 01"})).toHaveLength(1);
  expect(screen.getByText(/1 monitored meters/)).toBeInTheDocument();
});
