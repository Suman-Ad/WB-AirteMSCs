import React from 'react';
import {render,screen,fireEvent,waitFor,within} from '@testing-library/react';
import {getDocs,updateDoc} from 'firebase/firestore';
import AdminPanel from './AdminPanel';
jest.mock('../firebase',()=>({db:{}}));
jest.mock('firebase/firestore',()=>({collection:jest.fn(),getDocs:jest.fn(),query:jest.fn(),orderBy:jest.fn(),doc:jest.fn(),deleteDoc:jest.fn(),updateDoc:jest.fn(),onSnapshot:jest.fn()}));
let records;
beforeEach(()=>{
  jest.clearAllMocks();
  records=Array.from({length:25},(_,index)=>({id:`u${index}`,name:`Person ${index}`,email:`person${index}@example.com`,empId:`EMP${index}`,site:index%2?'Asansol':'Globsyn',role:'User',isActive:index>=5}));
  getDocs.mockImplementation(async()=>({docs:records.map(({id,...data})=>({id,data:()=>data}))}));
  updateDoc.mockResolvedValue();
});
test('directory pagination, cross-field search and clearing filters work together',async()=>{
  render(<AdminPanel userData={{uid:'admin',role:'Admin'}}/>);
  await screen.findByText('Person 0');
  expect(screen.queryByText('Person 24')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Next'}));
  expect(screen.getByText('Person 24')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search users'),{target:{value:'PERSON24@EXAMPLE.COM'}});
  expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
  expect(screen.getByText('1 matching users · 25 total')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Clear filters'}));
  expect(screen.getByText('25 matching users · 25 total')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Previous'})).toBeDisabled();
});
test('status and role cards filter the directory and empty states can be reset',async()=>{
  records[0].role='Super User';
  render(<AdminPanel userData={{uid:'admin',role:'Admin'}}/>);
  await screen.findByText('Person 0');
  fireEvent.click(screen.getByRole('button',{name:'Filter by Super User'}));
  expect(screen.getByRole('button',{name:'Filter by Super User'})).toHaveAttribute('aria-pressed','true');
  expect(screen.getByText('1 matching users · 25 total')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Account status'),{target:{value:'active'}});
  expect(screen.getByText('No matching users')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Reset filters'}));
  expect(screen.getByText('25 matching users · 25 total')).toBeInTheDocument();
});
test('existing Admin role restrictions and activation actions remain intact',async()=>{
  records=[{id:'chief',name:'Chief',role:'Super Admin',isActive:true},{id:'normal',name:'Normal',role:'User',isActive:true}];
  render(<AdminPanel userData={{uid:'admin',role:'Admin'}}/>);
  await screen.findByText('Chief');
  const chief=screen.getByText('Chief').closest('tr');
  expect(within(chief).queryByRole('button',{name:/Promote|Demote|Delete|Deactivate/})).not.toBeInTheDocument();
  const normal=screen.getByText('Normal').closest('tr');
  expect(within(normal).getByRole('button',{name:'Promote to Super User'})).toBeInTheDocument();
  fireEvent.click(within(normal).getByRole('button',{name:'Deactivate'}));
  await waitFor(()=>expect(updateDoc).toHaveBeenCalledWith(undefined,{isActive:false}));
});
test('unauthorized accounts see an access message without fetching user data',()=>{
  render(<AdminPanel userData={{uid:'plain',role:'User'}}/>);
  expect(screen.getByRole('alert')).toHaveTextContent('Administrator access is required');
  expect(getDocs).not.toHaveBeenCalled();
});
