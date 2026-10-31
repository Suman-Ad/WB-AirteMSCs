import React from "react";
import { render, screen } from "@testing-library/react";
import EnergySLDMeterDetails from "./EnergySLDMeterDetails";
jest.mock("recharts", () => {
  const React = require("react");
  const Box = ({children}) => <div>{children}</div>;
  return { ...Object.fromEntries(["ResponsiveContainer", "Line", "XAxis", "YAxis", "Tooltip", "CartesianGrid", "Bar", "Legend"].map((key) => [key, Box])),
    LineChart: ({data, children}) => <div data-testid="trend" data-points={JSON.stringify(data)}>{children}</div>,
    BarChart: ({data, children}) => <div data-testid="thd" data-points={JSON.stringify(data)}>{children}</div> };
});
const meter = (time, power = 1000) => ({ id: "meter-24", status: "OK", powerUnits: "base", active_power: power,
  observedAt: { toMillis: () => time }, custom_r_voltage_thd: 1.8, custom_r_current_thd: 9.4 });
test("inspector charts use live timestamps and actual THD without inventing missing phases", () => {
  const view = render(<EnergySLDMeterDetails meter={meter(1000)} state="Live" onOpen={() => {}} />);
  expect(screen.getByText("Waiting for two live readings.")).toBeInTheDocument();
  expect(JSON.parse(screen.getByTestId("thd").dataset.points)).toEqual([
    {phase:"R",voltage:1.8,current:9.4}, {phase:"Y",voltage:null,current:null}, {phase:"B",voltage:null,current:null} ]);
  view.rerender(<EnergySLDMeterDetails meter={meter(2000, 2000)} state="Live" onOpen={() => {}} />);
  expect(JSON.parse(screen.getByTestId("trend").dataset.points)).toHaveLength(2);
  view.rerender(<EnergySLDMeterDetails meter={meter(3000)} state="Stale / offline" onOpen={() => {}} />);
  expect(JSON.parse(screen.getByTestId("trend").dataset.points)).toHaveLength(2);
});
