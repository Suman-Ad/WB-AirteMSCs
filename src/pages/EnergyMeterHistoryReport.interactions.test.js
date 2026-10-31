import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {doc,setDoc,serverTimestamp} from 'firebase/firestore';
import EnergyMeterHistoryReport from './EnergyMeterHistoryReport';
import {useMeterDailyHistory,useMeterHistorySettings,useMeterSamples} from '../hooks/useMeterHistory';
jest.mock('../firebase',()=>({db:{}}));
jest.mock('firebase/firestore',()=>({doc:jest.fn(()=> 'history-config'),setDoc:jest.fn(),serverTimestamp:jest.fn(()=> 'server-time')}));
jest.mock('../hooks/useMeterHistory',()=>({useMeterDailyHistory:jest.fn(),useMeterHistorySettings:jest.fn(),useMeterSamples:jest.fn()}));
const admin={role:'Admin',uid:'admin'};
const renderReport=(userData=admin)=>render(<EnergyMeterHistoryReport siteId="site-a" date="2026-10-31" userData={userData} meters={[{id:'m1',name:'Main'}]}/>);
beforeEach(()=>{
 jest.clearAllMocks(); doc.mockReturnValue('history-config'); serverTimestamp.mockReturnValue('server-time');
 useMeterDailyHistory.mockReturnValue({records:[],loading:false,cached:false,error:''});useMeterSamples.mockReturnValue({records:[],loading:false,cached:false,error:''});
 useMeterHistorySettings.mockReturnValue({settings:{enabled:true,retentionDays:7},loading:false,cached:false,error:''});setDoc.mockResolvedValue(undefined);
});
test('admin saves shared retention and pause controls with authenticated provenance',async()=>{
 renderReport();fireEvent.change(screen.getByLabelText('Backup days to retain'),{target:{value:'30'}});fireEvent.click(screen.getByLabelText('Automatically back up meter readings'));fireEvent.click(screen.getByRole('button',{name:'Save backup settings'}));
 await waitFor(()=>expect(setDoc).toHaveBeenCalledWith('history-config',{enabled:false,retentionDays:30,updatedBy:'admin',updatedAt:'server-time'}));
 expect(doc).toHaveBeenCalledWith({},'energyMonitor','site-a','config','meterHistory');expect(serverTimestamp).toHaveBeenCalled();expect(await screen.findByText('Backup settings saved: 30 days.')).toBeInTheDocument();
});
test('invalid retention is rejected without writing and failed saves remain visible',async()=>{
 const view=renderReport();const input=screen.getByLabelText('Backup days to retain');fireEvent.change(input,{target:{value:'6'}});fireEvent.submit(input.closest('form'));
 expect(screen.getByRole('alert')).toHaveTextContent('between 7 and 365');expect(setDoc).not.toHaveBeenCalled();
 setDoc.mockRejectedValue(new Error('denied'));fireEvent.change(input,{target:{value:'14'}});fireEvent.submit(input.closest('form'));
 expect(await screen.findByText(/Backup settings could not be saved/)).toBeInTheDocument();view.unmount();
});
test('ordinary viewers cannot edit controls and cached settings disable saving',()=>{
 const view=renderReport({role:'User',uid:'u'});expect(screen.queryByLabelText('Backup days to retain')).not.toBeInTheDocument();view.unmount();
 useMeterHistorySettings.mockReturnValue({settings:{enabled:true,retentionDays:7},loading:false,cached:true,error:''});renderReport();expect(screen.getByRole('button',{name:'Save backup settings'})).toBeDisabled();expect(setDoc).not.toHaveBeenCalled();
});

