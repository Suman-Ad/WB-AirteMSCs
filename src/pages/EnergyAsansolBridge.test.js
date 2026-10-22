import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import EnergyAsansolBridge from "./EnergyAsansolBridge";
import Simulator from "../components/SOP/AsansolOperationSimulator";
jest.mock("../components/SOP/AsansolOperationSimulator", () => ({ __esModule: true, default: jest.fn() }));
const meter = (id, voltage, time) => ({ id, name: id, status: "OK", voltage_ll: voltage, observedAt: { toMillis: () => time } });
beforeEach(() => { localStorage.clear(); Simulator.mockImplementation(({ triggeredBy, selectedDG }) => <div data-testid="unchanged-simulator">{selectedDG}:{triggeredBy || "prepared"}</div>); jest.useFakeTimers(); });
afterEach(() => jest.useRealTimers());
test("stages the correct DG before triggering the unchanged simulator and does not retrigger an outage", () => {
  const props = { siteName: "Asansol", siteId: "ASL", meters: [meter("main", 0, 100000), meter("dg2", 415, 100000)], now: 100000, fromCache: false };
  const view = render(<EnergyAsansolBridge {...props} />);
  fireEvent.change(screen.getByLabelText("Main Incomer meter"), { target: { value: "main" } });
  fireEvent.change(screen.getByLabelText("DG-2 meter (optional)"), { target: { value: "dg2" } });
  fireEvent.click(screen.getByLabelText("Enable automatic simulation"));
  expect(Simulator).not.toHaveBeenCalled();
  view.rerender(<EnergyAsansolBridge {...props} now={110000} meters={[meter("main", 0, 110000), meter("dg2", 415, 110000)]} />);
  expect(screen.getByTestId("unchanged-simulator")).toHaveTextContent("DG-2:prepared");
  act(() => jest.advanceTimersByTime(0));
  expect(screen.getByTestId("unchanged-simulator")).toHaveTextContent("DG-2:DG");
  view.rerender(<EnergyAsansolBridge {...props} now={120000} meters={[meter("main", 0, 120000), meter("dg2", 415, 120000)]} />);
  expect(screen.getAllByText(/Simulation triggered for DG-2/)).toHaveLength(1);
  expect(JSON.parse(localStorage.getItem("energy-monitor:asansol-trigger:v1:ASL")).dg2MeterId).toBe("dg2");
});
test("other sites do not mount the Asansol simulator integration", () => {
  render(<EnergyAsansolBridge siteName="DLF" siteId="DLF" meters={[]} now={100000} fromCache={false} />);
  expect(screen.queryByText("Asansol live-triggered operation simulator")).not.toBeInTheDocument();
  expect(Simulator).not.toHaveBeenCalled();
});
