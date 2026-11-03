import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import IncidentEditorPage from './IncidentEditorPage';
jest.mock('firebase/storage',()=>({getStorage:jest.fn(),ref:jest.fn(),uploadBytes:jest.fn(),getDownloadURL:jest.fn()}));

const sample={siteName:'Asansol',status:'Open',rcaStatus:'N',incidentDescription:'Initial details'};
test('grouped fields preserve edit callbacks and incident submission',()=>{
  const change=jest.fn(),submit=jest.fn();
  render(<IncidentEditorPage formData={sample} onFormChange={change} onSubmit={submit} userData={{site:'Asansol'}}/>);
  expect(screen.getAllByRole('group')).toHaveLength(4);
  expect(screen.getByLabelText('Site Name')).toHaveValue('Asansol');
  expect(screen.getByLabelText('Incident Description')).toHaveValue('Initial details');
  fireEvent.change(screen.getByLabelText('Incident Description'),{target:{value:'Updated details'}});
  expect(change).toHaveBeenCalledWith('incidentDescription','Updated details');
  fireEvent.change(screen.getByLabelText('Equipment Category'),{target:{value:'UPS'}});
  expect(change).toHaveBeenCalledWith('equipmentCategory','UPS');
  fireEvent.click(screen.getByRole('button',{name:'Submit Incident'}));
  expect(submit).toHaveBeenCalledTimes(1);
});
test('edit mode retains resolution fields, RCA upload and existing file link',()=>{
  render(<IncidentEditorPage incidentId="i1" formData={{...sample,rcaStatus:'Y',rcaFileUrl:'https://example.com/rca.pdf',closureRemarks:'Resolved'}} onFormChange={jest.fn()} onSubmit={jest.fn()}/>);
  expect(screen.getByLabelText('Upload RCA File (PDF/Excel)')).toHaveAttribute('accept','.pdf,.xls,.xlsx');
  expect(screen.getByRole('link',{name:/View uploaded RCA/})).toHaveAttribute('href','https://example.com/rca.pdf');
  expect(screen.getByLabelText('Closure Remarks')).toHaveValue('Resolved');
  expect(screen.getByRole('button',{name:'Update Incident'})).toBeEnabled();
});
test('submitting state prevents duplicate saves and field edits',()=>{
  const submit=jest.fn();
  render(<IncidentEditorPage isSubmitting formData={sample} onFormChange={jest.fn()} onSubmit={submit}/>);
  expect(screen.getByLabelText('Incident Title')).toBeDisabled();
  const button=screen.getByRole('button',{name:'Submitting…'});
  expect(button).toBeDisabled();fireEvent.click(button);expect(submit).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('Saving your incident');
});
