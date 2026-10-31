/** @jest-environment node */
import { enableDeviceNotifications, disableDeviceNotifications } from './deviceNotifications';
import { getMessaging, getToken, onMessage, deleteToken, isSupported } from 'firebase/messaging';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth } from '../firebase';

jest.mock('../firebase', () => ({db: {}, auth: {currentUser: {uid: 'user'}}}));
jest.mock('firebase/messaging', () => ({getMessaging: jest.fn(() => ({})), getToken: jest.fn(), onMessage: jest.fn(), deleteToken: jest.fn(), isSupported: jest.fn()}));
jest.mock('firebase/firestore', () => ({doc: jest.fn((_db, ...path) => path.join('/')), setDoc: jest.fn(), deleteDoc: jest.fn(), serverTimestamp: jest.fn(() => 'now')}));
const registration = {showNotification: jest.fn()};
const publicKey = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString('base64url');
beforeEach(() => {
  jest.clearAllMocks();
  global.window = global;
  Object.defineProperty(global, 'navigator', {configurable: true, value: {}});
  process.env.REACT_APP_FIREBASE_VAPID_KEY = publicKey;
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
  expect(getToken).toHaveBeenCalledWith(expect.anything(), {vapidKey: publicKey, serviceWorkerRegistration: registration});
  expect(setDoc).toHaveBeenCalledWith('notificationDevices/device-token', expect.objectContaining({uid: 'user'}));
  const receive = onMessage.mock.calls[0][1];
  await receive({data: {uid: 'user', title: 'Power', body: 'DG', notificationId: 'id'}});
  expect(registration.showNotification).toHaveBeenCalledWith('Power', expect.objectContaining({body: 'DG', tag: 'id'}));
  auth.currentUser = null;
  await receive({data: {uid: 'user'}});
  expect(registration.showNotification).toHaveBeenCalledTimes(1);
});
test('denied permission does not register token', async () => {
  window.Notification.permission = 'default';
  window.Notification.requestPermission.mockResolvedValue('denied');
  await expect(enableDeviceNotifications('user')).rejects.toThrow('Allow notifications');
  expect(getToken).not.toHaveBeenCalled();
});

test('missing or invalid public key explains setup before requesting permission', async () => {
  delete process.env.REACT_APP_FIREBASE_VAPID_KEY;
  await expect(enableDeviceNotifications('user')).rejects.toThrow('REACT_APP_FIREBASE_VAPID_KEY in .env.local');
  process.env.REACT_APP_FIREBASE_VAPID_KEY = 'wrong-key';
  await expect(enableDeviceNotifications('user')).rejects.toThrow('Web Push key is invalid');
  expect(Notification.requestPermission).not.toHaveBeenCalled();
  expect(getToken).not.toHaveBeenCalled();
});

test('already blocked permission explains how to unblock without prompting again', async () => {
  Notification.permission = 'denied';
  await expect(enableDeviceNotifications('user')).rejects.toThrow("browser settings");
  expect(Notification.requestPermission).not.toHaveBeenCalled();
});

test('service worker startup times out instead of leaving enable pending forever', async () => {
  jest.useFakeTimers();
  try {
    navigator.serviceWorker.ready = new Promise(() => {});
    const result = enableDeviceNotifications('user').catch(error => error);
    // Flush registration promises before advancing its activation deadline.
    for (let i = 0; i < 12; i++) await Promise.resolve();
    jest.advanceTimersByTime(15000);
    const error = await result;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('service worker did not start');
    expect(getToken).not.toHaveBeenCalled();
  } finally { jest.useRealTimers(); }
});

test('Firestore permission failure identifies the deployment needed', async () => {
  setDoc.mockRejectedValueOnce({code: 'permission-denied'});
  await expect(enableDeviceNotifications('user')).rejects.toThrow('notificationDevices security rules');
});

test('Firebase subscription failure explains key and registration API checks', async () => {
  getToken.mockRejectedValueOnce({code: 'messaging/token-subscribe-failed'});
  await expect(enableDeviceNotifications('user')).rejects.toThrow('FCM Registration API');
});
test('sign-out cleanup removes the device registration and FCM token', async () => {
  await enableDeviceNotifications('user');
  await disableDeviceNotifications();
  expect(deleteDoc).toHaveBeenCalledWith('notificationDevices/device-token');
  expect(deleteToken).toHaveBeenCalled();
});
