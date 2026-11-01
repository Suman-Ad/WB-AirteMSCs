/** @jest-environment node */
import { sendEnergyTestNotification } from './energyTestNotification';
import { auth } from '../firebase';
import { collection, doc, getDocFromServer, getDocsFromServer, writeBatch } from 'firebase/firestore';
jest.mock('../firebase', () => ({auth: {currentUser: {uid: 'me'}}, db: {}}));
jest.mock('firebase/firestore', () => ({collection: jest.fn((_db,...path)=>path.join('/')), doc: jest.fn((...args)=>args.length===1?`${args[0]}/new`:args.slice(1).join('/')), getDocFromServer: jest.fn(), getDocsFromServer: jest.fn(), serverTimestamp: ()=>'now', writeBatch: jest.fn()}));
const batch={set:jest.fn(),commit:jest.fn()};
beforeEach(()=>{
 jest.clearAllMocks();auth.currentUser={uid:'me'};
 collection.mockImplementation((_db,...path)=>path.join('/'));
 doc.mockImplementation((...args)=>args.length===1?`${args[0]}/new`:args.slice(1).join('/'));
 getDocFromServer.mockResolvedValue({data:()=>({siteId:'A',site:'Site A',isActive:true,role:'Admin'})});
 getDocsFromServer.mockResolvedValue({docs:[{id:'m1',data:()=>({name:'Main',status:'OK',fwd_Wh:12000,active_power:5000,powerUnits:'base',observedAt:{toMillis:()=>Date.now()}})},{id:'m2',data:()=>({name:'DG',status:'ERROR'})}]});
 writeBatch.mockReturnValue(batch);batch.commit.mockResolvedValue();
});
test('sends current meter conditions only to signed-in user with normalized units and explicit test labels',async()=>{
 expect(await sendEnergyTestNotification('A')).toBe(2);
 expect(batch.set).toHaveBeenCalledTimes(2);
 expect(batch.set.mock.calls[0][0]).toBe('notifications/me/items/new');
 expect(batch.set.mock.calls[0][1]).toEqual(expect.objectContaining({isTest:true,read:false,siteId:'A',actionType:'energy_meter_update',url:'/energy-monitor'}));
 expect(batch.set.mock.calls[0][1].message).toMatch(/12 kWh.*5 kW/);
 expect(batch.set.mock.calls[1][1].message).toMatch(/Energy: Unavailable/);
 expect(batch.commit).toHaveBeenCalledTimes(1);
});
test('rejects inactive or unrelated site accounts before reading meters',async()=>{
 for(const data of [{siteId:'B',isActive:true},{siteId:'A',isActive:false}]){
  getDocFromServer.mockResolvedValue({data:()=>data});
  await expect(sendEnergyTestNotification('A')).rejects.toThrow(/active account assigned/);
 }
 expect(getDocsFromServer).not.toHaveBeenCalled();expect(batch.commit).not.toHaveBeenCalled();
});
test('does not report success when no meters exist or the write fails',async()=>{
 getDocsFromServer.mockResolvedValueOnce({docs:[]});
 await expect(sendEnergyTestNotification('A')).rejects.toThrow(/No meter readings/);
 batch.commit.mockRejectedValueOnce(new Error('offline'));
 await expect(sendEnergyTestNotification('A')).rejects.toThrow('offline');
});

test('ordinary users cannot send tests even if called without the UI',async()=>{
 for(const role of ['User','Super User',undefined]){
  getDocFromServer.mockResolvedValue({data:()=>({siteId:'A',isActive:true,role})});
  await expect(sendEnergyTestNotification('A')).rejects.toThrow(/Only Admin and Super Admin/);
 }
 expect(getDocsFromServer).not.toHaveBeenCalled();expect(batch.commit).not.toHaveBeenCalled();
});
