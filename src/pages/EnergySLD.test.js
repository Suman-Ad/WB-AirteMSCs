import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { doc, onSnapshot, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import EnergySLD from "./EnergySLD";
import { storedSLD, validateSLD } from "./energySLDData";
import { sampleSLD } from "./energyReportData";
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({ doc: jest.fn(), onSnapshot: jest.fn(), setDoc: jest.fn(), deleteDoc: jest.fn(), serverTimestamp: jest.fn() }));
beforeEach(() => {
  localStorage.clear();
  doc.mockReturnValue("site-sld-doc");
  onSnapshot.mockImplementation((ref, options, next) => { next({ exists: () => false, metadata: { fromCache: false, hasPendingWrites: false } }); return jest.fn(); });
  jest.clearAllMocks(); setDoc.mockResolvedValue(undefined); deleteDoc.mockResolvedValue(undefined); serverTimestamp.mockReturnValue("server-time");
});
test("import renders graph and linked meter can be opened", async () => {
  const select = jest.fn();
  render(<EnergySLD canEdit siteId="site-a" meters={[{ id: "meter-1", status: "OK", powerUnits: "kilo", active_power: 3 }]} statusOf={() => "Live"} onSelect={select} />);
  fireEvent.change(screen.getByLabelText("Import .json"), { target: { files: [{ size: 100, text: async () => JSON.stringify(sampleSLD) }] } });
  expect(await screen.findByRole("img", { name: "Imported electrical single-line diagram" })).toBeInTheDocument();
  expect(screen.getByRole("complementary", { name: "SLD meter instruments" })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search SLD meters" }), { target: { value: "not-a-meter" } });
  expect(screen.queryByRole("button", { name: "Inspect Main incomer" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search SLD meters" }), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Inspect Main incomer" }));
  expect(screen.getByRole("button", { name: "Inspect Main incomer" })).toHaveAttribute("aria-pressed", "true");
  expect(document.querySelector(".energy-sld-connection.is-online .energy-sld-wire-halo")).toBeInTheDocument();
  expect(screen.queryByRole("img", { name: "Measured power flow forward" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Main incomer, Live" }));
  expect(screen.getByRole("region", { name: "Selected SLD meter details" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Harmonic distortion · THD %" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Phase vectors · Live" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open meter readings →" }));
  expect(select).toHaveBeenCalledWith("meter-1");
});
test("malformed import shows error", async () => {
  render(<EnergySLD canEdit meters={[]} statusOf={() => "Live"} onSelect={() => {}} />);
  fireEvent.change(screen.getByLabelText("Import .json"), { target: { files: [{ size: 100, text: async () => '{"nodes":[]}' }] } });
  expect(await screen.findByRole("alert")).toHaveTextContent("nodes and edges");
});

test("EnergyBook drawing export imports original shapes and links a point to a live meter", async () => {
  const select = jest.fn();
  const drawing = { format: "EnergyBook drawing", version: 1, site: "Drawing site", items: [
    { id: "a", kind: "Ellipse", title: "Generator", x: 20, y: 10, w: 200, h: 140, point: "point-a" },
    { id: "b", kind: "Busbar", title: "Main bus", x: 20, y: 300, w: 500, h: 50 },
    { id: "c", kind: "Connector", source: "a", target: "b", source_port: "Bottom", target_port: "Top", waypoints: [[120, 200]] },
  ] };
  render(<EnergySLD canEdit siteId="site-a" meters={[{ id: "meter-7", pointId: "point-a", status: "OK", powerUnits: "kilo", active_power: 7 }]} statusOf={() => "Live"} onSelect={select} />);
  fireEvent.change(screen.getByLabelText("Import .json"), { target: { files: [{ size: 200, text: async () => "\uFEFF" + JSON.stringify(drawing) }] } });
  expect(await screen.findByRole("heading", { name: "Drawing site" })).toBeInTheDocument();
  expect(screen.getByText(/2 shapes · 1 connections/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Generator, Live" }));
  fireEvent.click(screen.getByRole("button", { name: "Open meter readings →" }));
  expect(select).toHaveBeenCalledWith("meter-7");
});

test("unmatched EnergyBook point can be linked manually without guessing a meter", async () => {
  const select = jest.fn();
  const drawing = { format: "EnergyBook drawing", version: 1, site: "Sample", items: [{ id: "a", kind: "Breaker", title: "Unlinked breaker", x: 0, y: 0, w: 120, h: 90, point: "unmapped-point" }] };
  render(<EnergySLD canEdit meters={[{ id: "meter-9", name: "Incoming meter", status: "OK", powerUnits: "kilo", active_power: 2 }]} statusOf={() => "Live"} onSelect={select} />);
  fireEvent.change(screen.getByLabelText("Import .json"), { target: { files: [{ size: 200, text: async () => JSON.stringify(drawing) }] } });
  fireEvent.click(await screen.findByRole("button", { name: "Unlinked breaker" }));
  expect(screen.queryByRole("button", { name: "Open meter readings →" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Linked live meter"), { target: { value: "meter-9" } });
  fireEvent.click(screen.getByRole("button", { name: "Open meter readings →" }));
  expect(select).toHaveBeenCalledWith("meter-9");
});

test("drawing, node and connection mappings survive remount and save to the site", async () => {
  const meters = [{ id: "meter-9", name: "Branch meter", status: "OK", powerUnits: "kilo", active_power: 2 }];
  const props = { siteId: "persistent-site", meters, statusOf: () => "Live", onSelect: jest.fn() };
  const view = render(<EnergySLD canEdit {...props} />);
  fireEvent.change(screen.getByLabelText("Import .json"), { target: { files: [{ size: 100, text: async () => JSON.stringify(sampleSLD) }] } });
  fireEvent.click(await screen.findByRole("button", { name: "Main incomer" }));
  fireEvent.change(screen.getByLabelText("Linked live meter"), { target: { value: "meter-9" } });
  fireEvent.click(screen.getByRole("button", { name: "Map connection Utility supply to Main incomer" }));
  fireEvent.change(screen.getByLabelText("Connection meter"), { target: { value: "meter-9" } });
  fireEvent.change(screen.getByLabelText("Meter positive power direction"), { target: { value: "-1" } });
  expect(screen.getByRole("img", { name: "Measured power flow reverse" })).toBeInTheDocument();
  view.unmount(); render(<EnergySLD canEdit {...props} />);
  expect(await screen.findByRole("heading", { name: "Sample power distribution" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Measured power flow reverse" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Main incomer, Live" }));
  expect(screen.getByLabelText("Linked live meter")).toHaveValue("meter-9");
  fireEvent.click(screen.getByRole("button", { name: "Save site SLD" }));
  expect(await screen.findByText("Saved to site and this device")).toBeInTheDocument();
  expect(doc).toHaveBeenCalledWith({}, "energyMonitor", "persistent-site", "config", "sld");
  const saved = JSON.parse(setDoc.mock.calls[setDoc.mock.calls.length - 1][1].payloadJson);
  expect(saved.meterLinks.main).toBe("meter-9");
  expect(saved.edgeLinks["edge-0"]).toEqual({ meterId: "meter-9", polarity: -1 });
});
test("cloud save failure keeps device drawing and reports the failure", async () => {
  setDoc.mockRejectedValue(new Error("permission-denied"));
  render(<EnergySLD canEdit siteId="site-denied" meters={[]} statusOf={() => "Live"} onSelect={() => {}} />);
  fireEvent.change(screen.getByLabelText("Import .json"), { target: { files: [{ size: 100, text: async () => JSON.stringify(sampleSLD) }] } });
  await screen.findByRole("heading", { name: "Sample power distribution" });
  fireEvent.click(screen.getByRole("button", { name: "Save site SLD" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Site save failed");
  expect(JSON.parse(localStorage.getItem("energy-monitor:sld:v1:site-denied")).drawing.nodes).toHaveLength(4);
});
test("saved drawings are isolated by site and stale data stops animated flow", async () => {
  const props = { siteId: "site-one", meters: [{ id: "meter-1", status: "OK", powerUnits: "kilo", active_power: 3 }], statusOf: () => "Live", onSelect: () => {} };
  const view = render(<EnergySLD canEdit {...props} />);
  fireEvent.change(screen.getByLabelText("Import .json"), { target: { files: [{ size: 100, text: async () => JSON.stringify(sampleSLD) }] } });
  fireEvent.click(await screen.findByRole("button", { name: "Map connection Utility supply to Main incomer" }));
  fireEvent.change(screen.getByLabelText("Connection meter"), { target: { value: "meter-1" } });
  expect(screen.getByRole("img", { name: "Measured power flow forward" })).toBeInTheDocument();
  expect(view.container.querySelector(".energy-sld-connection.is-online")).toBeInTheDocument();
  view.rerender(<EnergySLD canEdit {...props} statusOf={() => "Stale / offline"} />);
  expect(screen.queryByRole("img", { name: "Measured power flow forward" })).not.toBeInTheDocument();
  expect(view.container.querySelector(".energy-sld-connection.is-online")).not.toBeInTheDocument();
  view.rerender(<EnergySLD canEdit {...props} siteId="site-two" />);
  expect(screen.queryByRole("heading", { name: "Sample power distribution" })).not.toBeInTheDocument();
});

test("a saved shared site drawing restores on a device without a local copy", async () => {
  const payload = { version: 1, drawing: storedSLD(validateSLD(sampleSLD)), meterLinks: { main: "meter-5" }, edgeLinks: {} };
  onSnapshot.mockImplementation((ref, options, next) => { next({ exists: () => true, data: () => ({ payloadJson: JSON.stringify(payload) }), metadata: { fromCache: false, hasPendingWrites: false } }); return jest.fn(); });
  render(<EnergySLD canEdit siteId="shared-site" meters={[{ id: "meter-5", status: "OK", powerUnits: "kilo", active_power: 5 }]} statusOf={() => "Live"} onSelect={() => {}} />);
  expect(await screen.findByText("Loaded saved site SLD")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Main incomer, Live" }));
  expect(screen.getByLabelText("Linked live meter")).toHaveValue("meter-5");
});
test("an incoming cloud snapshot does not overwrite unsaved local edits", async () => {
  let receive;
  onSnapshot.mockImplementation((ref, options, next) => { receive = next; return jest.fn(); });
  render(<EnergySLD canEdit siteId="draft-site" meters={[]} statusOf={() => "Live"} onSelect={() => {}} />);
  fireEvent.change(screen.getByLabelText("Import .json"), { target: { files: [{ size: 100, text: async () => JSON.stringify({ ...sampleSLD, title: "Local draft" }) }] } });
  await screen.findByRole("heading", { name: "Local draft" });
  await screen.findByText("Saved to site and this device");
  fireEvent.click(screen.getByRole("button", { name: "Main incomer" }));
  fireEvent.change(screen.getByLabelText("Linked live meter"), { target: { value: "" } });
  const remote = { version: 1, drawing: storedSLD(validateSLD({ ...sampleSLD, title: "Older cloud drawing" })), meterLinks: {}, edgeLinks: {} };
  act(() => receive({ exists: () => true, data: () => ({ payloadJson: JSON.stringify(remote) }), metadata: { fromCache: false, hasPendingWrites: false } }));
  expect(screen.getByRole("heading", { name: "Local draft" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Older cloud drawing" })).not.toBeInTheDocument();
});

test("site users load the published drawing without uploading and cannot edit or delete it", async () => {
  const payload = { version: 1, drawing: storedSLD(validateSLD(sampleSLD)), meterLinks: { main: "meter-1" }, edgeLinks: {} };
  onSnapshot.mockImplementation((ref, options, next) => { next({ exists: () => true, data: () => ({ payloadJson: JSON.stringify(payload) }), metadata: { fromCache: false } }); return jest.fn(); });
  render(<EnergySLD siteId="shared-site" meters={[{ id: "meter-1", status: "ERROR" }]} statusOf={() => "Meter error"} onSelect={() => {}} />);
  expect(await screen.findByRole("img", { name: "Imported electrical single-line diagram" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Import .json")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Delete site SLD" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Main incomer, Meter error" }));
  expect(screen.getByLabelText("Linked live meter")).toBeDisabled();
  expect(setDoc).not.toHaveBeenCalled();
});

test("Admin delete propagates to viewers and removes an old device drawing", async () => {
  let receive;
  const payload = { version: 1, drawing: storedSLD(validateSLD(sampleSLD)), meterLinks: {}, edgeLinks: {} };
  localStorage.setItem("energy-monitor:sld:v1:deleted-site", JSON.stringify(payload));
  onSnapshot.mockImplementation((ref, options, next) => { receive = next; next({ exists: () => true, data: () => ({ payloadJson: JSON.stringify(payload) }), metadata: { fromCache: false } }); return jest.fn(); });
  render(<EnergySLD siteId="deleted-site" meters={[]} statusOf={() => "Live"} onSelect={() => {}} />);
  expect(await screen.findByRole("heading", { name: "Sample power distribution" })).toBeInTheDocument();
  act(() => receive({ exists: () => false, metadata: { fromCache: false } }));
  expect(screen.queryByRole("heading", { name: "Sample power distribution" })).not.toBeInTheDocument();
  expect(localStorage.getItem("energy-monitor:sld:v1:deleted-site")).toBeNull();
});
