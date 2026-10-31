/** @jest-environment node */
import { enableDeviceNotifications, disableDeviceNotifications } from './deviceNotifications';
import { getMessaging, getToken, onMessage, deleteToken, isSupported } from 'firebase/messaging';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth } from '../firebase';

jest.mock('../firebase', () => ({db: {}, auth: {currentUser: {uid: 'user'}}}));
jest.mock('firebase/messaging', () => ({getMessaging: jest.fn(() => ({})), getToken: jest.fn(), onMessage: jest.fn(), deleteToken: jest.fn(), isSupported: jest.fn()}));
jest.mock('firebase/firestore', () => ({doc: jest.fn((_db, ...path) => path.join('/')), setDoc: jest.fn(), deleteDoc: jest.fn(), serverTimestamp: jest.fn(() => 'now')}));
const registration = {showNotification: jest.fn()};
beforeEach(() => {
  jest.clearAllMocks();
  global.window = global;
  Object.defineProperty(global, 'navigator', {configurable: true, value: {}});
  process.env.REACT_APP_FIREBASE_VAPID_KEY = 'public-key';
  Object.defineProperty(window, 'isSecureContext', {configurable: true, value: true});
  Object.defineProperty(window, 'Notification', {configurable: true, value: {permission: 'granted', requestPermission: jest.fn(async () => 'granted')}});
  Object.defineProperty(navigator, 'serviceWorker', {configurable: true, value: {register: jest.fn(async () => registration), ready: Promise.resolve(registration)}});
  auth.currentUser = {uid: 'user'};
  getMessaging.mockReturnValue({});
  doc.mockImplementation((_db, ...path) => path.join('/'));
  isSupported.mockResolvedValue(true);
  getToken.mockResolvedValue('device-token');
  onMessage.mockReturnValue(jest.fn());
});
test('registers explicit service worker and delivers foreground OS notification', async () => {
  await enableDeviceNotifications('user');
  expect(getToken).toHaveBeenCalledWith(expect.anything(), {vapidKey: 'public-key', serviceWorkerRegistration: registration});
  expect(setDoc).toHaveBeenCalledWith('notificationDevices/device-token', expect.objectContaining({uid: 'user'}));
  const receive = onMessage.mock.calls[0][1];
  await receive({data: {uid: 'user', title: 'Power', body: 'DG', notificationId: 'id'}});
  expect(registration.showNotification).toHaveBeenCalledWith('Power', expect.objectContaining({body: 'DG', tag: 'id'}));
  auth.currentUser = null;
  await receive({data: {uid: 'user'}});
  expect(registration.showNotification).toHaveBeenCalledTimes(1);
});
test('denied permission does not register token', async () => {
  window.Notification.requestPermission.mockResolvedValue('denied');
  await expect(enableDeviceNotifications('user')).rejects.toThrow('Allow notifications');
  expect(getToken).not.toHaveBeenCalled();
});
test('sign-out cleanup removes the device registration and FCM token', async () => {
  await enableDeviceNotifications('user');
  await disableDeviceNotifications();
  expect(deleteDoc).toHaveBeenCalledWith('notificationDevices/device-token');
  expect(deleteToken).toHaveBeenCalled();
});
