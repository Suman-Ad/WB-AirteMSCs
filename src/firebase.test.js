jest.mock("firebase/app", () => ({ initializeApp: jest.fn(), getApp: jest.fn(), getApps: jest.fn() }));
jest.mock("firebase/auth", () => ({ getAuth: jest.fn() }));
jest.mock("firebase/firestore", () => ({ getFirestore: jest.fn() }));
jest.mock("firebase/storage", () => ({ getStorage: jest.fn() }));
beforeEach(() => jest.resetModules());
test("initializes the default Firebase app once when no default exists", () => {
  const api = require("firebase/app");
  const app = { name: "[DEFAULT]" };
  api.getApps.mockReturnValue([]); api.initializeApp.mockReturnValue(app);
  require("./firebase");
  expect(api.initializeApp).toHaveBeenCalledTimes(1);
  expect(require("firebase/firestore").getFirestore).toHaveBeenCalledWith(app);
});
test("reuses the default app when a development module reload finds it", () => {
  const api = require("firebase/app");
  const app = { name: "[DEFAULT]" };
  api.getApps.mockReturnValue([app]); api.getApp.mockReturnValue(app);
  require("./firebase");
  expect(api.initializeApp).not.toHaveBeenCalled();
  expect(api.getApp).toHaveBeenCalledTimes(1);
  expect(require("firebase/firestore").getFirestore).toHaveBeenCalledWith(app);
});
