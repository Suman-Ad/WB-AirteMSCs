import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { onSnapshot } from "firebase/firestore";
import useAutoPowerSource from "./useAutoPowerSource";
import EnergyPowerMapping from "../pages/EnergyPowerMapping";
function ExistingSwitch(props) {
  const { status } = useAutoPowerSource(props);
  return <div role="switch" aria-label="Existing EB/DG slider" aria-checked={props.powerSource === "DG"} title={status} />;
}
jest.mock("firebase/firestore", () => ({ collection: jest.fn(), onSnapshot: jest.fn() }));
jest.mock("../firebase", () => ({ db: {} }));
const meter = (id, voltage, time) => ({ id, data: () => ({ status: "OK", voltage_ll: voltage, observedAt: { toMillis: () => time } }) });
let publish, stop;
beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(100000); localStorage.clear();
  localStorage.setItem("energy-monitor:asansol-trigger:v1:ASL", JSON.stringify({ enabled: false, mainMeterId: "main", dg2MeterId: "dg2" }));
  stop = jest.fn(); onSnapshot.mockImplementation((ref, options, callback) => { publish = callback; return stop; });
});
afterEach(() => jest.useRealTimers());
const reading = (time) => act(() => publish({ docs: [meter("main", 0, time), meter("dg2", 415, time)], metadata: { fromCache: false, hasPendingWrites: false } }));
test("header works outside Energy Monitor, imports mappings, triggers DG-2 once and cleans up", async () => {
  const onTrigger = jest.fn().mockResolvedValue(true);
  const view = render(<ExistingSwitch siteId="ASL" siteName="Asansol" canToggle powerSource="EB" onTrigger={onTrigger} />);
  expect(screen.getByRole("switch")).toBeInTheDocument();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  reading(100000); expect(onTrigger).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(10000));
  await act(async () => { publish({ docs: [meter("main", 0, 110000), meter("dg2", 415, 110000)], metadata: { fromCache: false } }); });
  expect(onTrigger).toHaveBeenCalledTimes(1); expect(onTrigger).toHaveBeenCalledWith("DG-2");
  reading(120000); expect(onTrigger).toHaveBeenCalledTimes(1);
  view.unmount(); expect(stop).toHaveBeenCalledTimes(1);
});
test("users without existing toggle permission cannot auto-change the source", async () => {
  const onTrigger = jest.fn();
  render(<ExistingSwitch siteId="ASL" canToggle={false} powerSource="EB" onTrigger={onTrigger} />);
  reading(100000); act(() => jest.advanceTimersByTime(10000)); reading(110000);
  await act(async () => {}); expect(onTrigger).not.toHaveBeenCalled();
});

test("mapping edits in Energy Monitor reach the original slider without remounting Layout", async () => {
  localStorage.clear();
  const onTrigger = jest.fn().mockResolvedValue(true);
  render(<><ExistingSwitch siteId="ASL" canToggle powerSource="EB" onTrigger={onTrigger} /><EnergyPowerMapping siteId="ASL" meters={[{ id: "main", name: "Incoming meter" }, { id: "dg2", name: "Generator meter" }]} /></>);
  reading(100000);
  fireEvent.change(screen.getByLabelText("Power switch Main Incomer meter"), { target: { value: "main" } });
  fireEvent.change(screen.getByLabelText("Power switch DG-2 (optional) meter"), { target: { value: "dg2" } });
  expect(onTrigger).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(10000));
  await act(async () => { publish({ docs: [meter("main", 0, 110000), meter("dg2", 415, 110000)], metadata: { fromCache: false } }); });
  expect(onTrigger).toHaveBeenCalledWith("DG-2");
});
