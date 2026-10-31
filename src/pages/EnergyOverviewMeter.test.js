import React from "react";
import { render, screen } from "@testing-library/react";
import EnergyOverviewMeter, { dialMaximum } from "./EnergyOverviewMeter";
const meter = { id: "meter-24", name: "LT Panel - 01", status: "OK", powerUnits: "base", active_power: 162786, observedAt: { toMillis: () => 10000 } };
test("live dial has explicit kW range and loses glow when stale", () => {
  const view = render(<EnergyOverviewMeter meter={meter} state="Live" now={12000} onOpen={() => {}} />);
  expect(screen.getByRole("img")).toHaveAccessibleName(/162.79 kW; auto scale 0 to 200 kW/);
  expect(view.container.querySelector("article")).toHaveClass("is-online");
  view.rerender(<EnergyOverviewMeter meter={meter} state="Stale / offline" now={90000} onOpen={() => {}} />);
  expect(view.container.querySelector("article")).not.toHaveClass("is-online");
  expect(screen.getByText("Last received · Stale / offline")).toBeInTheDocument();
});
test("reverse and unavailable readings do not masquerade as zero", () => {
  const view = render(<EnergyOverviewMeter meter={{...meter, active_power:-2500}} state="Live" now={12000} onOpen={() => {}} />);
  expect(screen.getByRole("img")).toHaveAccessibleName(/auto scale -5 to 0 kW/);
  view.rerender(<EnergyOverviewMeter meter={{...meter, powerUnits:"unknown"}} state="Live" now={12000} onOpen={() => {}} />);
  expect(view.container.querySelector(".energy-dial-needle")).toBeNull();
  expect(dialMaximum(0)).toBe(1);
});
