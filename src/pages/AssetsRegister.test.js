/** @jest-environment node */
import React, { useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AssetsRegister from './AssetsRegister';

jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return { ...actual, useState: jest.fn(actual.useState) };
});
jest.mock('../firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({}));
jest.mock('xlsx', () => ({}));
jest.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });

const actualUseState = jest.requireActual('react').useState;
afterEach(() => useState.mockImplementation(actualUseState));

function renderRegister(userData, rows = []) {
  useState.mockImplementation(actualUseState);
  useState.mockImplementationOnce(actualUseState); // Column definitions.
  useState.mockImplementationOnce(() => actualUseState(rows));
  useState.mockImplementationOnce(() => actualUseState(false)); // Loaded feed.
  return renderToStaticMarkup(<AssetsRegister userData={userData} />);
}

test('admin register retains import and column tools, accessible edit actions, and zero values', () => {
  const view = renderRegister({ role: 'Admin', siteId: '' }, [{ id: 'asset-1', UniqueID: 'WB/SITE/DG1', Qty: 0 }]);
  expect(view).toContain('href="/assets-dashboard"');
  expect(view).toContain('Import asset records');
  expect(view).toContain('aria-label="Move Unique ID earlier" disabled');
  expect(view).toContain('aria-label="Edit asset WB/SITE/DG1"');
  expect(view).toMatch(/<td[^>]*>0<\/td>/);
  expect(view).toContain('1 item');
  expect(view).toContain('aria-label="Asset records"');
  expect(view).toContain('Download Asset Data');
});

test('empty admin register displays guidance and does not offer export', () => {
  const view = renderRegister({ role: 'Admin', siteId: '' });
  expect(view).toContain('No assets match these filters.');
  expect(view).not.toContain('Download Asset Data');
});

test('missing user data renders safely without administrative controls', () => {
  const view = renderRegister(undefined);
  expect(view).toContain('Filter assets');
  expect(view).not.toContain('Import asset records');
  expect(view).not.toContain('Register columns');
  expect(view).not.toContain('Add New Asset');
  expect(view).not.toContain('Rename master data');
});
