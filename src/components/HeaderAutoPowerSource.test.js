import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import useAutoPowerSource from "./useAutoPowerSource";
import EnergyPowerMapping from "../pages/EnergyPowerMapping";
function ExistingSwitch(props) {
  const { status, manualDisabled } = useAutoPowerSource(props);
  return <div role="switch" aria-label="Existing EB/DG slider" aria-disabled={manualDisabled} aria-checked={props.powerSource === "DG"} title={status} />;
}
jest.mock("firebase/firestore", () => ({ collection: jest.fn(), doc:jest.fn(), onSnapshot: jest.fn(),setDoc:jest.fn(),serverTimestamp:jest.fn() }));
jest.mock("../firebase", () => ({ db: {} }));
const meter = (id, voltage, time) => ({ id, data: () => ({ status: "OK", voltage_ll: voltage, current: voltage > 300 ? 100 : 0, observedAt: { toMillis: () => time } }) });
let publish, stop, sharedConfig, configListeners;
beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(100000); localStorage.clear();
  localStorage.setItem("energy-monitor:asansol-trigger:v1:ASL", JSON.stringify({ enabled: false, mainMeterId: "main", dg2MeterId: "dg2" }));
  sharedConfig={enabled:true,mainMeterId:'main',dg1MeterId:'',dg2MeterId:'dg2'};configListeners=[];
  doc.mockImplementation((db,...path)=>path.join('/'));collection.mockImplementation((db,...path)=>path.join('/'));
  setDoc.mockImplementation(async (ref,value)=>{sharedConfig=value;configListeners.forEach(next=>next({exists:()=>true,data:()=>sharedConfig,metadata:{fromCache:false,hasPendingWrites:false}}));});
  stop = jest.fn(); onSnapshot.mockImplementation((ref, options, callback) => {
    const next=typeof options === 'function' ? options : callback;
    if (ref.endsWith('/config/powerSwitch')) {configListeners.push(next);next({exists:()=>true,data:()=>sharedConfig,metadata:{fromCache:false,hasPendingWrites:false}});return jest.fn();}
    publish = next; return stop;
  });
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
  localStorage.clear();sharedConfig={enabled:true,mainMeterId:'',htMeterId:'',dg1MeterId:'',dg2MeterId:''};
  const onTrigger = jest.fn().mockResolvedValue(true);
  render(<><ExistingSwitch siteId="ASL" canToggle powerSource="EB" onTrigger={onTrigger} /><EnergyPowerMapping userData={{uid:"admin",siteId:"ASL",role:"Admin"}} siteId="ASL" meters={[{ id: "main", name: "Incoming meter" }, { id: "dg2", name: "Generator meter" }]} /></>);
  reading(100000);
  fireEvent.change(screen.getByLabelText("Power switch Main Incomer meter"), { target: { value: "main" } });
  fireEvent.change(screen.getByLabelText("Power switch DG-2 (optional) meter"), { target: { value: "dg2" } });
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Save site switch settings'})));
  expect(setDoc).toHaveBeenCalledWith('energyMonitor/ASL/config/powerSwitch',expect.objectContaining({mainMeterId:'main',dg2MeterId:'dg2'}));
  reading(100000);expect(onTrigger).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(10000));
  await act(async () => { publish({ docs: [meter("main", 0, 110000), meter("dg2", 415, 110000)], metadata: { fromCache: false } }); });
  expect(onTrigger).toHaveBeenCalledWith("DG-2");
});

test.each(['User','Viewer',undefined])('mapping settings are hidden from role %s',role=>{
 render(<EnergyPowerMapping siteId="ASL" userData={{uid:'u',siteId:'ASL',role}} meters={[]}/>);
 expect(screen.queryByText('Existing header EB/DG switch · automatic meter mapping')).not.toBeInTheDocument();
});
test.each(['Admin','Super Admin','Super User'])('site role %s can edit shared mapping',role=>{
 render(<EnergyPowerMapping siteId="ASL" userData={{uid:'u',siteId:'ASL',role}} meters={[]}/>);
 expect(screen.getByRole('button',{name:'Save site switch settings'})).toBeEnabled();
});
test('cross-site Super User cannot view mapping controls',()=>{
 render(<EnergyPowerMapping siteId="OTHER" userData={{uid:'u',siteId:'ASL',role:'Super User'}} meters={[]}/>);
 expect(screen.queryByText('Existing header EB/DG switch · automatic meter mapping')).not.toBeInTheDocument();
});
test('cached shared settings cannot trigger a switch',async()=>{
 const onTrigger=jest.fn();render(<ExistingSwitch siteId="ASL" canToggle powerSource="EB" onTrigger={onTrigger}/>);
 act(()=>configListeners.forEach(next=>next({exists:()=>true,data:()=>sharedConfig,metadata:{fromCache:true}})));
 reading(100000);act(()=>jest.advanceTimersByTime(10000));reading(110000);await act(async()=>{});
 expect(onTrigger).not.toHaveBeenCalled();
});

test('missing shared configuration does not switch from private device settings',async()=>{
 const onTrigger=jest.fn();render(<ExistingSwitch siteId="ASL" canToggle powerSource="EB" onTrigger={onTrigger}/>);
 act(()=>configListeners.forEach(next=>next({exists:()=>false,metadata:{fromCache:false}})));
 reading(100000);act(()=>jest.advanceTimersByTime(10000));reading(110000);await act(async()=>{});
 expect(onTrigger).not.toHaveBeenCalled();
});
test('a site-wide disable reaches the active header without remounting',async()=>{
 const onTrigger=jest.fn();render(<ExistingSwitch siteId="ASL" canToggle powerSource="EB" onTrigger={onTrigger}/>);
 reading(100000);
 expect(screen.getByRole('switch')).toHaveAttribute('aria-disabled','true');
 act(()=>{sharedConfig={...sharedConfig,enabled:false};configListeners.forEach(next=>next({exists:()=>true,data:()=>sharedConfig,metadata:{fromCache:false}}));});
 act(()=>jest.advanceTimersByTime(10000));reading(110000);await act(async()=>{});
 expect(onTrigger).not.toHaveBeenCalled();
 expect(screen.getByRole('switch')).toHaveAttribute('aria-disabled','false');
});

test.each(['Admin','Super Admin'])('%s can select and save another site without changing the header site',async role=>{
 render(<EnergyPowerMapping siteId="ASL" userData={{uid:'admin',siteId:'ASL',role}} meters={[]}/>);
 fireEvent.change(screen.getByRole('combobox',{name:'Automatic switch settings site'}),{target:{value:'N19104A'}});
 expect(collection).toHaveBeenCalledWith({},'energyMonitor','N19104A','meters');
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Save site switch settings'})));
 expect(setDoc).toHaveBeenCalledWith('energyMonitor/N19104A/config/powerSwitch',expect.objectContaining({updatedBy:'admin'}));
});
test('Super User has no cross-site selector',()=>{
 render(<EnergyPowerMapping siteId="ASL" userData={{uid:'u',siteId:'ASL',role:'Super User'}} meters={[]}/>);
 expect(screen.queryByRole('combobox',{name:'Automatic switch settings site'})).not.toBeInTheDocument();
});

 test("automatic restoration confirms two loaded incomer / unloaded DG readings", async () => {
  const onTrigger=jest.fn().mockResolvedValue(true);
  render(<ExistingSwitch siteId="ASL" canToggle powerSource="DG" onTrigger={onTrigger} />);
  const restored=(time)=>({docs:[meter("main",415,time),{id:"dg2",data:()=>({status:"OK",voltage_ll:415,current:49,observedAt:{toMillis:()=>time}})}],metadata:{fromCache:false}});
  act(()=>publish(restored(100000)));expect(onTrigger).not.toHaveBeenCalled();
  await act(async()=>{jest.advanceTimersByTime(10000);publish(restored(110000));});
  expect(onTrigger).toHaveBeenCalledWith("EB");
 });
