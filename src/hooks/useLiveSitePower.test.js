import React from 'react';
import {act,render,screen} from '@testing-library/react';
import {doc,onSnapshot} from 'firebase/firestore';
import useLiveSitePower,{liveSitePower} from './useLiveSitePower';
jest.mock('../firebase',()=>({db:{}}));
jest.mock('firebase/firestore',()=>({doc:jest.fn((db,...parts)=>parts.join('/')),onSnapshot:jest.fn()}));
const now=1793803200000;
const state={ready:true,sharedReady:true,activation:{enabled:true},shared:{enabled:true},cached:false,runtime:{enabled:true,powerSource:'DG',selectedDG:'DG-2',evaluatedAtMs:now,sourceObservedAtMs:now,startAtMs:now-60000}};
test('server overrides manual status and supplies generator and elapsed time',()=>{
 expect(liveSitePower({powerSource:'EB'},state,now)).toMatchObject({powerSource:'DG',selectedDG:'DG-2',seconds:60,stale:false});
 expect(liveSitePower({powerSource:'DG'},{...state,runtime:{...state.runtime,powerSource:'EB',selectedDG:null}},now).powerSource).toBe('EB');
});
test('stale, cached, future, failed or pending readings have neutral status',()=>{
 for(const patch of [{runtime:{...state.runtime,sourceObservedAtMs:now-31000}},{runtime:{...state.runtime,evaluatedAtMs:now+6000}},{cached:true},{ready:false},{error:'Denied'}]) expect(liveSitePower({powerSource:'EB'},{...state,...patch},now)).toMatchObject({powerSource:'Unknown',stale:true});
});
test('disabled and missing server activation preserve manual switching',()=>{
 expect(liveSitePower({powerSource:'DG'},{ready:true,activation:null},now)).toMatchObject({powerSource:'DG',authority:'manual'});
 expect(liveSitePower({powerSource:'EB'},{...state,shared:{enabled:false}},now)).toMatchObject({powerSource:'EB',authority:'manual'});
});
let listeners,stop;
function Probe({sites}){
 const statuses=useLiveSitePower(sites,{ASANSOL:{powerSource:'EB'},BERHAMPORE:{powerSource:'EB'}});
 return <div>{Object.entries(statuses).map(([site,status])=><output key={site} data-testid={site}>{status.powerSource}:{status.selectedDG}:{String(status.stale)}</output>)}</div>;
}
const publish=(id,path,data)=>act(()=>listeners.get(`energyMonitor/${id}/${path}`)({exists:()=>!!data,data:()=>data,metadata:{fromCache:false,hasPendingWrites:false}}));
beforeEach(()=>{doc.mockImplementation((db,...parts)=>parts.join('/'));jest.useFakeTimers();jest.setSystemTime(now);listeners=new Map();stop=jest.fn();onSnapshot.mockImplementation((ref,options,next)=>{listeners.set(ref,next);return stop;});});
afterEach(()=>jest.useRealTimers());
test('site subscriptions isolate source updates, expire and clean up',()=>{
 const view=render(<Probe sites={['Asansol','Berhampore']}/>);
 for(const id of ['N19106A','N19104A']){publish(id,'config/serverPowerSwitch',{enabled:true});publish(id,'config/powerSwitch',{enabled:true});}
 publish('N19106A','runtime/serverPowerSource',state.runtime);
 publish('N19104A','runtime/serverPowerSource',{...state.runtime,powerSource:'EB',selectedDG:null});
 expect(screen.getByTestId('ASANSOL')).toHaveTextContent('DG:DG-2:false');
 expect(screen.getByTestId('BERHAMPORE')).toHaveTextContent('EB::false');
 act(()=>jest.advanceTimersByTime(31000));expect(screen.getByTestId('ASANSOL')).toHaveTextContent('Unknown:DG-2:true');
 view.rerender(<Probe sites={['Berhampore']}/>);expect(stop).toHaveBeenCalledTimes(6);
 view.unmount();expect(stop).toHaveBeenCalledTimes(9);
});
