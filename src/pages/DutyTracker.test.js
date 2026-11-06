/** @jest-environment node */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DutyTrackerPage from './DutyTracker';

jest.mock('../firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({}));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock('framer-motion', () => ({ motion: { div: ({ children, initial, animate, ...props }) => <div {...props}>{children}</div> } }));

beforeAll(() => {
  jest.useFakeTimers('modern');
  jest.setSystemTime(new Date(2026, 10, 5, 12));
});
afterAll(() => jest.useRealTimers());

test('calendar renders every day of the month and marks the selected day', () => {
  const view = renderToStaticMarkup(<DutyTrackerPage currentUser={{ role: 'User', site: 'Example site' }} />);
  expect(view).toContain('November 2026');
  expect((view.match(/aria-label="Select (Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),/g) || [])).toHaveLength(30);
  expect(view).toMatch(/aria-label="Select Thursday, 5 November 2026" aria-pressed="true"/);
  expect(view).toContain('aria-label="Monthly duty calendar"');
  expect(view).toContain('aria-label="Shift key"');
  expect(view).not.toContain('DAILY ROSTER');
  expect(view).not.toContain('Save &amp; Notify');
});

test('admin sees named filters and disabled editor until a site is selected', () => {
  const view = renderToStaticMarkup(<DutyTrackerPage currentUser={{ role: 'Admin' }} />);
  expect(view).toContain('aria-label="Region"');
  expect(view).toContain('aria-label="Circle"');
  expect(view).toContain('aria-label="Site"');
  expect(view).toContain('aria-label="Roster month"');
  expect(view).toContain('class="duty-editor-fields" disabled');
  expect(view).toContain('class="duty-template" disabled');
  expect(view).toContain('class="duty-disclosure" aria-expanded="false"');
  expect(view).toContain('Choose a region, circle, and site');
  expect(view).not.toContain('undefined');
});

test('site engineer retains editor access without administrative site filters', () => {
  const view = renderToStaticMarkup(<DutyTrackerPage currentUser={{ designation: 'Vertiv Site Infra Engineer', site: 'Example site' }} />);
  expect(view).toContain('DAILY ROSTER');
  expect(view).toContain('Weekday template');
  expect(view).not.toContain('aria-label="Region"');
});

test('missing profile renders site guidance without exposing editing tools', () => {
  const view = renderToStaticMarkup(<DutyTrackerPage />);
  expect(view).toContain('A site must be assigned to your profile');
  expect(view).not.toContain('DAILY ROSTER');
});
