import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { collection, onSnapshot } from "firebase/firestore";
import SiteEnergySettings from "./SiteEnergySettings";
import { siteIdMap } from "../config/siteConfigs";
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({ collection: jest.fn(), onSnapshot: jest.fn() }));
jest.mock("./EnergyPowerMapping", () => ({siteId, meters, fixedSite}) => <div data-testid="mapping">{siteId}:{meters.length}:{String(fixedSite)}</div>);
jest.mock("./EnergyAsansolBridge", () => ({siteId, siteName, fromCache}) => <div data-testid="simulator">{siteName}:{siteId}:{String(fromCache)}</div>);
jest.mock("./SiteMeterCleanup", () => ({meters}) => <div data-testid="cleanup">{meters.length}</div>);
beforeEach(() => {
  jest.clearAllMocks();
  onSnapshot.mockImplementation((ref, options, next) => {
    next({ docs: [{ id:"meter-24", data: () => ({name:"LT Panel", status:"OK"}) }], metadata:{fromCache:false} });
    return jest.fn();
  });
});
test("admin site selection moves both editors and replaces the live meter subscription", () => {
  const view = render(<SiteEnergySettings userData={{role:"Admin",site:"Asansol"}} siteId={siteIdMap.Asansol} />);
  expect(screen.getByTestId("mapping")).toHaveTextContent(`${siteIdMap.Asansol}:1:true`);
  expect(screen.getByTestId("simulator")).toHaveTextContent(`Asansol:${siteIdMap.Asansol}:false`);
  const stop=onSnapshot.mock.results[0].value;
  const other=Object.values(siteIdMap).find((id) => id !== siteIdMap.Asansol);
  fireEvent.change(screen.getByLabelText("Automatic switch settings site"), {target:{value:other}});
  expect(stop).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("mapping")).toHaveTextContent(`${other}:1:true`);
  expect(collection).toHaveBeenLastCalledWith({},"energyMonitor",other,"meters");
  view.unmount();
  expect(onSnapshot.mock.results[1].value).toHaveBeenCalledTimes(1);
});
test("site users remain scoped to their assigned site", () => {
  render(<SiteEnergySettings userData={{role:"User",site:"Asansol"}} siteId={siteIdMap.Asansol} />);
  expect(screen.queryByLabelText("Automatic switch settings site")).not.toBeInTheDocument();
  expect(collection).toHaveBeenCalledWith({},"energyMonitor",siteIdMap.Asansol,"meters");
});
