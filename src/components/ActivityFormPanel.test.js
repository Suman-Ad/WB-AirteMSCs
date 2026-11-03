import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {ActivityFormPanel} from './ActivityFormPanel';
test('groups conditional activity fields while preserving values, changes and actions',()=>{
  const change=jest.fn(),add=jest.fn();
  render(<ActivityFormPanel><h2>Add an activity</h2><label>Date</label><input type="date" value="2026-11-03" onChange={change}/><><label>Equipment</label><select value="UPS" onChange={change}><option>UPS</option><option>DG</option></select></><button onClick={add}>Add</button></ActivityFormPanel>);
  expect(screen.getByLabelText('Date')).toHaveValue('2026-11-03');
  fireEvent.change(screen.getByLabelText('Equipment'),{target:{value:'DG'}});
  expect(change).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button',{name:'Add'}));expect(add).toHaveBeenCalledTimes(1);
});
