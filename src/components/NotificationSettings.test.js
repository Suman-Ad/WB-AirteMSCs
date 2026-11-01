import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotificationSettings from './NotificationSettings';
import { onSnapshot } from 'firebase/firestore';
import { enableDeviceNotifications, disableDeviceNotifications } from '../services/deviceNotifications';
jest.mock('../firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), onSnapshot: jest.fn() }));
jest.mock('firebase/functions', () => ({ getFunctions: jest.fn(), httpsCallable: jest.fn() }));
jest.mock('../services/deviceNotifications', () => ({ enableDeviceNotifications: jest.fn(), disableDeviceNotifications: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  jest.spyOn(window, "confirm").mockReturnValue(true);
  Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'granted' } });
  enableDeviceNotifications.mockResolvedValue(jest.fn());
  disableDeviceNotifications.mockResolvedValue(true);
  onSnapshot.mockImplementation((ref, callback) => {
    callback({ exists: () => true, data: () => ({ telegramEnabled: true }), metadata: {} });
    return jest.fn();
  });
});
test('connected channels show status and controls without setup prompts', async () => {
  render(<NotificationSettings uid="user" />);
  expect(await screen.findByRole('button', { name: 'Device: Enabled. Disable' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Telegram: Connected. Disconnect' })).toHaveClass('is-on');
  expect(screen.getByRole('button', { name: 'Telegram: Connected. Disconnect' })).toBeInTheDocument();
  expect(screen.queryByText(/On iPhone/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Telegram: Disconnected. Connect' })).not.toBeInTheDocument();
});
test('disable removes device registration and remains disabled after remount', async () => {
  const view = render(<NotificationSettings uid="user" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Device: Enabled. Disable' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Device: Disabled. Enable' })).toBeEnabled());
  expect(disableDeviceNotifications).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem('deviceNotificationsDisabled:user')).toBe('1');
  view.unmount();
  enableDeviceNotifications.mockClear();
  render(<NotificationSettings uid="user" />);
  expect(screen.getByRole('button', { name: 'Device: Disabled. Enable' })).toHaveClass('is-off');
  expect(enableDeviceNotifications).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Device: Disabled. Enable' }));
  await screen.findByRole('button', { name: 'Device: Enabled. Disable' });
  expect(localStorage.getItem('deviceNotificationsDisabled:user')).toBeNull();
});
test('failed device disable keeps enabled status and displays failure', async () => {
  disableDeviceNotifications.mockResolvedValue(false);
  render(<NotificationSettings uid="user" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Device: Enabled. Disable' }));
  expect(await screen.findByText(/Unable to disable/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Device: Enabled. Disable' })).toHaveClass('is-on');
  expect(localStorage.getItem('deviceNotificationsDisabled:user')).toBeNull();
});

test('canceling confirmation leaves delivery channel unchanged', async () => {
  window.confirm.mockReturnValue(false);
  render(<NotificationSettings uid="user" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Device: Enabled. Disable' }));
  expect(window.confirm).toHaveBeenCalledWith('Disable device notifications on this browser?');
  expect(disableDeviceNotifications).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Device: Enabled. Disable' })).toHaveClass('is-on');
});
