import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import {collection,doc,onSnapshot} from 'firebase/firestore';
import {subscribeSiteData,siteDataPaths} from '../services/allSitesDGSubscriptions';
import AllSitesDGLogs from './AllSitesDGLogs';
jest.mock('../firebase',()=>({db:{}}));
jest.mock('react-router-dom',()=>({useNavigate:()=>jest.fn()}),{virtual:true});
jest.mock('xlsx',()=>({}));
jest.mock('firebase/firestore',()=>({collection:jest.fn((db,...parts)=>parts.join('/')),doc:jest.fn((db,...parts)=>parts.join('/')),onSnapshot:jest.fn()}));
jest.mock('../services/allSitesDGSubscriptions',()=>({configuredDGSitePaths:()=>['Asansol'],siteDataPaths:jest.fn(()=>[]),subscribeSiteData:jest.fn(()=>jest.fn())}));
test('live meter section remains usable while monthly logs are still loading',()=>{
 doc.mockImplementation((db,...parts)=>parts.join('/'));
 collection.mockImplementation((db,...parts)=>parts.join('/'));
 onSnapshot.mockImplementation((ref,options,next)=>{
  const receive=typeof options==='function' ? options : next;
  if(ref.includes('/config/')||ref.endsWith('/runtime/serverPowerSource')) receive({exists:()=>false,metadata:{fromCache:false,hasPendingWrites:false}});
  else if(ref==='siteConfigs') receive({forEach:fn=>fn({id:'ASANSOL',data:()=>({siteName:'Asansol',siteId:'N19106A'})})});
  else if(ref==='energyMonitor/N19106A/meters') receive({docs:[{id:'meter-24',data:()=>({name:'LT Panel - 01',status:'OK',powerUnits:'base',active_power:12500,observedAt:{toMillis:()=>Date.now()}})}],metadata:{fromCache:false}});
  else receive({forEach:()=>{}});
  return jest.fn();
 });
 render(<AllSitesDGLogs userData={{siteId:'N19106A',site:'Asansol',role:'User'}}/>);
 expect(screen.getByRole('heading',{name:'Live Meter Readings · All Sites'})).toBeInTheDocument();
 expect(screen.getByRole('table',{name:'Asansol live meter readings'})).toBeInTheDocument();
 expect(screen.getByText('12.50')).toBeInTheDocument();
 expect(screen.getByText('⏳Loading all site logs…')).toBeInTheDocument();
});


test('server DG and restoration update card colors, DG filter and count despite conflicting manual status',()=>{
 doc.mockImplementation((db,...parts)=>parts.join('/'));
 collection.mockImplementation((db,...parts)=>parts.join('/'));
 siteDataPaths.mockImplementation(kind=>[{kind}]);
 subscribeSiteData.mockImplementation((db,paths,onRows,onErrors,onReady)=>{
  onRows(paths[0]?.kind==='daily'?[{site:'ASANSOL',Date:'2026-11-04'}]:[]);
  onReady?.();return jest.fn();
 });
 let runtime;
 const snapshot=data=>({exists:()=>true,data:()=>data,metadata:{fromCache:false,hasPendingWrites:false}});
 onSnapshot.mockImplementation((ref,options,next)=>{
  const receive=typeof options==='function'?options:next;
  if(ref==='siteConfigs')receive({forEach:fn=>fn({id:'ASANSOL',data:()=>({siteName:'Asansol',siteId:'N19106A',dgCount:2})})});
  else if(ref==='sitePowerStatus')receive({forEach:fn=>fn({id:'Asansol',data:()=>({powerSource:'EB'})})});
  else if(ref.endsWith('/config/serverPowerSwitch')||ref.endsWith('/config/powerSwitch'))receive(snapshot({enabled:true}));
  else if(ref.endsWith('/runtime/serverPowerSource')){runtime=receive;receive(snapshot({enabled:true,powerSource:'DG',selectedDG:'DG-1',evaluatedAtMs:Date.now(),sourceObservedAtMs:Date.now(),startAtMs:Date.now()-60000}));}
  else if(ref.endsWith('/meters'))receive({docs:[],metadata:{fromCache:false}});
  else receive({forEach:()=>{}});
  return jest.fn();
 });
 const view=render(<AllSitesDGLogs userData={{siteId:'N19106A',site:'Asansol',role:'Admin'}}/>);
 expect(view.container.querySelector('.all-sites-dg-card')).toHaveAttribute('data-power-source','DG');
 expect(view.container.querySelector('.all-sites-dg-card')).toHaveStyle({border:'2px solid #dc2626'});
 expect(screen.getByText('⚡ DG Sites:').parentElement).toHaveTextContent('1');
 fireEvent.click(screen.getByLabelText('Show only DG sites'));
 expect(view.container.querySelector('.all-sites-dg-card')).toBeInTheDocument();
 act(()=>runtime(snapshot({enabled:true,powerSource:'EB',evaluatedAtMs:Date.now(),sourceObservedAtMs:Date.now()})));
 expect(view.container.querySelector('.all-sites-dg-card')).not.toBeInTheDocument();
 expect(screen.getByText('⚡ DG Sites:').parentElement).toHaveTextContent('0');
 fireEvent.click(screen.getByLabelText('Show only DG sites'));
 expect(view.container.querySelector('.all-sites-dg-card')).toHaveAttribute('data-power-source','EB');
});
