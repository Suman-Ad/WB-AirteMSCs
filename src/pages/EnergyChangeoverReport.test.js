import React from "react";
import { render, screen } from "@testing-library/react";
import { onSnapshot } from "firebase/firestore";
import EnergyChangeoverReport from "./EnergyChangeoverReport";
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({ collection: jest.fn((db, ...path) => path), query: jest.fn((ref) => ref), where: jest.fn(), onSnapshot: jest.fn() }));
test("completed meter run keeps opening and closing readings visible after restoration", () => {
  onSnapshot.mockImplementation((ref, options, next) => {
    next({ docs: [{ id: "run1", data: () => ({ dgNumber: "DG-1", meterId: "meter-2", status: "Completed", startAtMs: 100000, endAtMs: 160000, runSeconds: 60, opening: { kwh: 1000 }, closing: { kwh: 1005, quality: "Last valid reading before restoration", observedAtMs: 150000 }, generationKwh: 5 }) }], metadata: { fromCache: false } }); return jest.fn();
  });
  render(<EnergyChangeoverReport siteId="ASL" date="2026-10-22" />);
  expect(screen.getByRole("cell", { name: "1,000" })).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "1,005" })).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "5" })).toBeInTheDocument();
  expect(screen.getAllByText("Last valid reading before restoration", { exact: false }).length).toBeGreaterThan(0);
});
