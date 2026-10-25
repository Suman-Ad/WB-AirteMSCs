/** @jest-environment node */
import React from 'react';
import {renderToString} from 'react-dom/server';
jest.mock('react-router-dom', () => ({useNavigate:()=>jest.fn(),useSearchParams:()=>[new URLSearchParams('date=2026-10-22'),jest.fn()],Link:({children})=>children}), {virtual:true});
import LoadDashboard from './LoadDashboard';
import {useLoadBookDay} from '../hooks/useLoadBookDay';
jest.mock('../components/LTAutoFillSettings',()=>()=>null);
jest.mock('../hooks/useLoadBookDay',()=>({...jest.requireActual('../hooks/useLoadBookDay'),useLoadBookDay:jest.fn()}));
jest.mock('../firebase',()=>({db:{}}));
jest.mock('firebase/firestore',()=>({collection:jest.fn(),onSnapshot:jest.fn(),deleteDoc:jest.fn(),doc:jest.fn(),getDocs:jest.fn()}));
const render = () => renderToString(<LoadDashboard userData={{siteId:'N19106A',role:'User'}}/>);
test('historical URL selects Asansol saved date and renders entries',()=>{
 useLoadBookDay.mockReturnValue({data:[{id:'saved-entry',equipmentType:'LT',equipmentId:'LT Panel-1',date:'2026-10-22',time:'08:00',loadKW:10,kwh:'12345'}],loading:false,error:'',cached:false});
 const html=render();expect(useLoadBookDay).toHaveBeenCalledWith('N19106A','2026-10-22');
 expect(html).toContain('LT Panel-1');expect(html).toContain('12345');expect(html).toContain('1 entries');expect(html).not.toContain('No saved entries');
});
test('failed read displays the error without claiming no saved entries',()=>{
 useLoadBookDay.mockReturnValue({data:[],loading:false,error:'Unable to load 2026-10-22: Permission denied',cached:false});
 const html=render();expect(html).toContain('Permission denied');expect(html).not.toContain('No saved entries');
});

test('LT register formats long decimals and numeric zero to two places',()=>{
 useLoadBookDay.mockReturnValue({data:[{id:'automatic',source:'meter-auto',equipmentType:'LT',equipmentId:'LT Panel-1',date:'2026-10-22',time:'08:00',voltageRY:415.126789,currentR:0,powerFactor:'0.987654',kwh:'12345.6789',loadKW:10,tempR:''}],loading:false,error:'',cached:false});
 const html=render();
 expect(html).toContain('<td>415.13</td>');
 expect(html).toContain('<td>0.00</td>');
 expect(html).toContain('<td>0.99</td>');
 expect(html).toContain('<td>12345.68</td>');
 expect(html).not.toContain('415.126789');
 expect(html).not.toContain('12345.6789');
});
