import React from 'react';
import {act,fireEvent,render,screen,within} from '@testing-library/react';
import {collection,onSnapshot,setDoc} from 'firebase/firestore';
import AllSitesLiveMeters,{configuredMeterSites} from './AllSitesLiveMeters';
jest.mock('../firebase',()=>({db:{}}));
jest.mock('firebase/firestore',()=>({collection:jest.fn(),onSnapshot:jest.fn(),setDoc:jest.fn()}));
let listeners;
const configs={ASANSOL:{siteName:'Asansol',siteId:'WRONG-ASANSOL'},BERHAMPORE:{siteName:'Berhampore',siteId:'WRONG-BERHAMPORE'}};
const path=id=>`energyMonitor/${id}/meters`;
const sample=(id='meter-24',extra={})=>({id,data:()=>({name:'LT Panel - 01',status:'OK',powerUnits:'base',energyUnits:'Wh',active_power:12345.678,apparent_power:14000,reactive_power:2345.67,fwd_Wh:1234567,R_voltage_ll:415.1234,Y_voltage_ll:416,B_voltage_ll:414,R_voltage_ln:240,Y_voltage_ln:241,B_voltage_ln:239,R_current:12.3456,Y_current:10,B_current:0,power_factor:0.98765,frequency:50.0123,observedAt:{toMillis:()=>100000},...extra})});
const emit=(siteId,records=[sample()],cached=false)=>act(()=>listeners.get(path(siteId)).next({docs:records,metadata:{fromCache:cached,hasPendingWrites:false}}));
beforeEach(()=>{
 jest.clearAllMocks();jest.useFakeTimers();jest.setSystemTime(100000);listeners=new Map();
 collection.mockImplementation((db,...parts)=>parts.join('/'));
 onSnapshot.mockImplementation((ref,options,next,error)=>{const stop=jest.fn();listeners.set(ref,{next,error,stop});return stop;});
});
afterEach(()=>jest.useRealTimers());
test('IDs come only from siteIdMap even when config IDs are wrong; unknown names are skipped',()=>{
 expect(configuredMeterSites({...configs,ALIAS:{siteName:'Asansol'},UNKNOWN:{siteName:'Unmapped',siteId:'N19106A'}})).toEqual([{id:'N19106A',name:'Asansol'},{id:'N19104A',name:'Berhampore'}]);
});
test('opens foreign site readings read-only without needing monthly logs',()=>{
 render(<AllSitesLiveMeters siteConfigs={configs} userSiteId="N19106A"/>);
 expect(listeners.has(path('N19106A'))).toBe(true);expect(listeners.has(path('N19104A'))).toBe(true);
 emit('N19106A');
 fireEvent.click(screen.getByRole('button',{name:/Berhampore/}));emit('N19104A');
 const table=screen.getByRole('table',{name:'Berhampore live meter readings'});
 expect(within(table).getByText('12.35')).toBeInTheDocument();expect(within(table).getByText('1234.57')).toBeInTheDocument();
 expect(within(table).getByText('R: 415.12')).toBeInTheDocument();expect(within(table).getByText('B: 0.00')).toBeInTheDocument();
 expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();expect(screen.queryByRole('combobox')).not.toBeInTheDocument();expect(setDoc).not.toHaveBeenCalled();
});
test('collapsed headers stay subscribed and all listeners stop on unmount',()=>{
 const view=render(<AllSitesLiveMeters siteConfigs={configs} userSiteId="N19106A"/>);
 const ownStop=listeners.get(path('N19106A')).stop;
 const otherStop=listeners.get(path('N19104A')).stop;
 fireEvent.click(screen.getByRole('button',{name:/Asansol/}));
 expect(ownStop).not.toHaveBeenCalled();expect(otherStop).not.toHaveBeenCalled();
 view.unmount();expect(ownStop).toHaveBeenCalledTimes(1);expect(otherStop).toHaveBeenCalledTimes(1);
});

test('retained old meter IDs do not create duplicate rows',()=>{
 render(<AllSitesLiveMeters siteConfigs={configs} userSiteId="N19106A"/>);
 emit('N19106A',[sample('meter-24',{observedAt:{toMillis:()=>10000}}),sample('meter-40')]);
 expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
 expect(screen.getByText('meter-40')).toBeInTheDocument();expect(screen.queryByText('meter-24')).not.toBeInTheDocument();
});
test('cached and stale readings are labelled; permission errors are explicit',()=>{
 render(<AllSitesLiveMeters siteConfigs={configs} userSiteId="N19106A"/>);emit('N19106A',[sample()],true);
 expect(screen.getAllByText(/Cached \/ reconnecting/).length).toBeGreaterThan(0);
 emit('N19106A');act(()=>jest.advanceTimersByTime(31000));expect(screen.getByLabelText('Asansol meter status')).toHaveTextContent('Live: 0Offline: 1');
 expect(within(screen.getByRole('table',{name:'Asansol live meter readings'})).getByText('Offline')).toBeInTheDocument();
 act(()=>listeners.get(path('N19106A')).error({message:'Permission denied'}));expect(screen.getByRole('alert')).toHaveTextContent('Permission denied');
});
test('sites without meter records are hidden',()=>{
 render(<AllSitesLiveMeters siteConfigs={{ASANSOL:configs.ASANSOL}} userSiteId="N19106A"/>);emit('N19106A',[]);
 expect(screen.queryByRole('button',{name:/Asansol/})).not.toBeInTheDocument();
 expect(screen.getByText('No registered meter readings found for configured sites.')).toBeInTheDocument();
});
test('expanded table includes every registered meter and identifies offline records',()=>{
 render(<AllSitesLiveMeters siteConfigs={configs} userSiteId="N19106A"/>);
 emit('N19106A',[sample('live',{name:'Connected meter'}),sample('failed',{name:'Failed meter',status:'ERROR'}),sample('old',{name:'Old meter',observedAt:{toMillis:()=>10000}})]);
 const table=screen.getByRole('table',{name:'Asansol live meter readings'});
 expect(within(table).getByText('Connected meter')).toBeInTheDocument();
 expect(within(table).getByText('Failed meter')).toBeInTheDocument();expect(within(table).getByText('Old meter')).toBeInTheDocument();
 expect(within(table).getAllByText('Offline')).toHaveLength(2);
 expect(within(table).getAllByRole('row')).toHaveLength(4);
 expect(screen.getByLabelText('Asansol meter status')).toHaveTextContent('Live: 1Offline: 2');
});
test('collapsed site header updates Live/Offline as readings age and reconnect',()=>{
 render(<AllSitesLiveMeters siteConfigs={configs} userSiteId="N19106A"/>);emit('N19104A');
 expect(screen.getByRole('button',{name:/Berhampore/})).toHaveAttribute('aria-expanded','false');
 expect(screen.getByLabelText('Berhampore meter status')).toHaveTextContent('Live: 1Offline: 0');
 act(()=>jest.advanceTimersByTime(31000));expect(screen.getByLabelText('Berhampore meter status')).toHaveTextContent('Live: 0Offline: 1');
 emit('N19104A',[sample('reconnected',{observedAt:{toMillis:()=>Date.now()}})]);
 expect(screen.getByLabelText('Berhampore meter status')).toHaveTextContent('Live: 1Offline: 0');
 expect(screen.queryByRole('table',{name:'Berhampore live meter readings'})).not.toBeInTheDocument();
});
