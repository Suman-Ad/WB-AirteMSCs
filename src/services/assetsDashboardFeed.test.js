import {collection,onSnapshot} from 'firebase/firestore';
import {subscribeAssets} from './assetsDashboardFeed';
jest.mock('firebase/firestore',()=>({collection:jest.fn(),onSnapshot:jest.fn()}));

test('incremental asset updates retain unchanged records and handle removal without rebuilding search data',()=>{
  let next,fail;
  const unsubscribe=jest.fn(),rows=jest.fn(),ready=jest.fn(),errors=jest.fn();
  collection.mockImplementation((db,path)=>path);
  onSnapshot.mockImplementation((ref,n,e)=>{next=n;fail=e;return unsubscribe;});
  const stop=subscribeAssets({},rows,ready,errors);
  const first={id:'one',data:jest.fn(()=>({EquipmentNameAndNo:'DG-1'}))};
  const second={id:'two',data:()=>({EquipmentNameAndNo:'UPS-1'})};
  const snapshot=changes=>({docChanges:()=>changes});
  next(snapshot([{type:'added',doc:first},{type:'added',doc:second}]));
  const original=rows.mock.calls[0][0][0];
  next(snapshot([{type:'modified',doc:{id:'two',data:()=>({EquipmentNameAndNo:'UPS-2'})}}]));
  expect(first.data).toHaveBeenCalledTimes(1);
  expect(rows.mock.calls[1][0][0]).toBe(original);
  expect(rows.mock.calls[1][0][1].searchText).toContain('ups-2');
  next(snapshot([{type:'removed',doc:first}]));
  expect(rows.mock.calls[2][0].map(r=>r.id)).toEqual(['two']);
  next(snapshot([]));
  expect(rows).toHaveBeenCalledTimes(3);
  expect(ready).toHaveBeenCalledTimes(4);
  fail(new Error('offline'));expect(errors).toHaveBeenCalledTimes(1);
  stop();next(snapshot([{type:'added',doc:first}]));fail(new Error('late'));
  expect(rows).toHaveBeenCalledTimes(3);expect(errors).toHaveBeenCalledTimes(1);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});
