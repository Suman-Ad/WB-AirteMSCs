/** @jest-environment node */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import RackTable from './RackTable';

const render = data => renderToStaticMarkup(<RackTable data={data} currentPage={1} rowsPerPage={25} getHeaderStyle={() => ({})} getMissingFields={() => []} onPreview={() => {}} />);

test('rack register keeps all columns aligned without updater metadata', () => {
  const html = render([{ id: 'rack-1', equipmentRackNo: 'A01', rackName: 'Core rack' }]);
  const headers = (html.match(/<th\b/g) || []).length;
  expect(headers).toBe(86);
  expect((html.match(/<td\b/g) || []).length).toBe(headers);
  expect(html).toContain('View rack A01');
});

test('empty register message spans every column', () => {
  const html = render([]);
  const headers = (html.match(/<th\b/g) || []).length;
  expect(html).toContain(`colSpan="${headers}"`);
  expect(html).toContain('No data found');
});
