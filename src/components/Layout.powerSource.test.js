import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp } from "firebase/firestore";
import { commitEnergyChangeover, checkpointEnergyRun } from "../services/energyChangeoverHistory";
import Layout from "./Layout";
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({ collection: jest.fn(), doc: jest.fn(), getDoc: jest.fn(), getDocs: jest.fn(), onSnapshot: jest.fn(), query: jest.fn(), where: jest.fn(), serverTimestamp: jest.fn(), setDoc: jest.fn(), addDoc: jest.fn() }));
jest.mock("../services/energyChangeoverHistory", () => ({ ...jest.requireActual("../services/energyChangeoverHistory"), commitEnergyChangeover: jest.fn(), checkpointEnergyRun: jest.fn() }));
jest.mock("./Sidebar", () => () => null);
jest.mock("./NotificationBell", () => () => null);
jest.mock("./LiveClockWeather", () => () => null);
jest.mock("./Modal", () => () => null);
jest.mock("./SOP/AsansolOperationSimulator", () => () => null);
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }), { virtual: true });
let publish, source;
const start = 1792663200000;
const user = { uid: "human", siteId: "ASL", site: "Asansol", role: "Admin", name: "Operator", empId: "E1", designation: "Engineer" };
const status = () => ({ powerSource: source, selectedDG: "DG-1", ...(source === "DG" ? { dgStartTime: { toDate: () => new Date(start), toMillis: () => start } } : {}) });
const meters = (time) => ({ docs: [["main", "Main Incomer", 0], ["dg1", "DG-1 Meter", 415]].map(([id, name, volts]) => ({ id, data: () => ({ name, status: "OK", voltage_ll: volts, fwd_Wh: 100000, observedAt: { toMillis: () => time } }) })), metadata: { fromCache: false, hasPendingWrites: false } });
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); jest.useFakeTimers(); jest.setSystemTime(start); source = "EB";
  doc.mockImplementation((db, ...path) => path.join("/")); collection.mockImplementation((db, ...path) => path.join("/")); query.mockImplementation((ref) => ref);
  getDoc.mockImplementation(async (ref) => ref.startsWith("sitePowerStatus/") ? { exists: () => true, data: status } : ref.startsWith("siteConfigs/") ? { exists: () => true, data: () => ({ dgCount: 2 }) } : { exists: () => false });
  getDocs.mockResolvedValue({ docs: [] }); addDoc.mockResolvedValue({ id: "legacy-run" }); serverTimestamp.mockReturnValue("server-time"); checkpointEnergyRun.mockResolvedValue();
  onSnapshot.mockImplementation((ref, options, next) => {
    const callback = typeof options === "function" ? options : next;
    if (ref.startsWith("energyMonitor/")) { publish = callback; callback(meters(start)); }
    else if (ref.startsWith("sitePowerStatus/")) callback({ exists: () => true, data: status });
    else callback({ size: 0, docs: [] });
    return jest.fn();
  });
  commitEnergyChangeover.mockImplementation(async (db, ref, data) => { source = data.powerSource; return true; });
  jest.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
async function trigger() {
  await act(async () => { jest.advanceTimersByTime(10000); publish(meters(start + 10000)); });
}
test.each([1024, 375])("live readings switch the existing slider at width %i and manual restoration keeps run logging", async (width) => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  await act(async () => { render(<Layout userData={user}><div>Page</div></Layout>); });
  const slider = screen.getByRole("switch", { name: "EB/DG power source" });
  expect(slider).toHaveAttribute("aria-checked", "false");
  expect(screen.queryByText("Automatic EB → DG")).not.toBeInTheDocument();
  await trigger();
  expect(commitEnergyChangeover).toHaveBeenCalledWith({}, "sitePowerStatus/Asansol", expect.objectContaining({ powerSource: "DG" }), expect.objectContaining({ automatic: true, dg: "DG-1" }));
  expect(slider).toHaveAttribute("aria-checked", "true");
  expect(window.confirm).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(slider));
  expect(window.confirm).toHaveBeenCalledTimes(1);
  expect(addDoc).toHaveBeenCalledWith("dgRunLogs/Asansol/entries", expect.objectContaining({ dgNumber: "DG-1", dgLogAdded: false }));
  expect(mockNavigate).toHaveBeenCalledWith("/dg-log-entry", expect.objectContaining({ state: expect.objectContaining({ autoFromDgStop: true }) }));
  expect(slider).toHaveAttribute("aria-checked", "false");
});
test("a denied transaction reports the blocker on the existing slider without falsely switching", async () => {
  commitEnergyChangeover.mockRejectedValue({ code: "permission-denied" });
  await act(async () => { render(<Layout userData={user} />); });
  await trigger();
  const slider = screen.getByRole("switch", { name: "EB/DG power source" });
  expect(slider).toHaveAttribute("aria-checked", "false");
  expect(slider).toHaveAttribute("title", expect.stringContaining("publish the updated Firestore rules"));
});
