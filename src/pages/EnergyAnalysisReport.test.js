import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import EnergyAnalysisReport from "./EnergyAnalysisReport";
jest.mock("./EnergyChangeoverReport", () => () => <div>Meter changeovers</div>);
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({ collection: jest.fn((db, ...path) => path), query: jest.fn((ref) => ref), where: jest.fn(), onSnapshot: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks();
  collection.mockImplementation((db, ...path) => path);
  query.mockImplementation((ref) => ref);
  onSnapshot.mockImplementation((ref, options, callback) => {
    const record = ref[0] === "dailyDGLogs" ? { "EB-1 KWH Opening": 100, "EB-1 KWH Closing": 125 } : { dgNumber: "DG-1", startTime: "10:00", stopTime: "11:00", totalRunHours: 1, kwhMeterStart: 20, kwhMeterEnd: 30 };
    callback({ docs: [{ id: "r1", data: () => record }], metadata: { fromCache: false } });
    return jest.fn();
  });
});
test("saved daily energy and DG runs are read and date changes retarget both sources", () => {
  render(<EnergyAnalysisReport siteName="DLF" />);
  expect(screen.getByRole("cell", { name: "EB-1" })).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "25" })).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "DG-1" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Report date"), { target: { value: "2026-09-15" } });
  expect(collection).toHaveBeenCalledWith({}, "dailyDGLogs", "DLF", "2026-09");
  expect(collection).toHaveBeenCalledWith({}, "dgLogs", "DLF", "Sep-2026", "2026-09-15", "runs");
  expect(where).toHaveBeenCalledWith("Date", "==", "2026-09-15");
});
test("missing site does not read records", () => {
  render(<EnergyAnalysisReport />);
  expect(screen.getByRole("alert")).toHaveTextContent("Assign a site name");
  expect(onSnapshot).not.toHaveBeenCalled();
});
