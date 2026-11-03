import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {doc,onSnapshot,setDoc} from 'firebase/firestore';
import EnergyNotificationSettings from './EnergyNotificationSettings';
import {siteFunctionControls} from './siteFunctionControls';
jest.mock('../firebase',()=>({db:{}}));
jest.mock('firebase/firestore',()=>({doc:jest.fn((...args)=>args),onSnapshot:jest.fn(),setDoc:jest.fn(),serverTimestamp:()=> 'server-time'}));
beforeEach(()=>{
  jest.clearAllMocks();setDoc.mockResolvedValue();
  doc.mockImplementation((...args)=>args);
  onSnapshot.mockImplementation((ref,options,next)=>{next({data:()=>({healthAlertsEnabled:false,telegramIncidentEnabled:false}),metadata:{fromCache:false}});return jest.fn();});
});
test('admins load and save every site function flag with merged settings',async()=>{
  render(<EnergyNotificationSettings siteId="ASL" userData={{uid:'admin',role:'Admin',isActive:true}}/>);
  expect(screen.getByLabelText('Meter readings unavailable alerts')).not.toBeChecked();
  expect(screen.getByLabelText('Telegram /incident')).not.toBeChecked();
  fireEvent.click(screen.getByLabelText('Telegram /incident'));
  fireEvent.click(screen.getByText('Save notification settings'));
  await waitFor(()=>expect(setDoc).toHaveBeenCalled());
  const [ref,value,options]=setDoc.mock.calls[0];
  expect(ref).toEqual([{},'energyMonitor','ASL','config','notifications']);
  for(const [field] of siteFunctionControls) expect(typeof value[field]).toBe('boolean');
  expect(value).toMatchObject({updatedBy:'admin',updatedAt:'server-time',telegramIncidentEnabled:true,healthAlertsEnabled:false});
  expect(options).toEqual({merge:true});
});
test.each(['User','Super User'])('%s can view but cannot change admin controls',role=>{
  render(<EnergyNotificationSettings siteId="ASL" userData={{uid:'u',role,siteId:'ASL'}}/>);
  expect(screen.getByLabelText('Telegram /incident')).toBeDisabled();
  expect(screen.queryByText('Save notification settings')).not.toBeInTheDocument();
});
test('cached settings cannot be saved',()=>{
  onSnapshot.mockImplementation((ref,options,next)=>{next({data:()=>({}),metadata:{fromCache:true}});return jest.fn();});
  render(<EnergyNotificationSettings siteId="ASL" userData={{uid:'admin',role:'Admin'}}/>);
  expect(screen.getByText('Save notification settings')).toBeDisabled();
});
