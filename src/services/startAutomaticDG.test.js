import { runTransaction } from "firebase/firestore";
import { startAutomaticDG } from "./startAutomaticDG";
jest.mock("firebase/firestore", () => ({ runTransaction: jest.fn() }));
test("only the transaction claiming EB starts a DG; subsequent sessions do no writes", async () => {
  let data = { powerSource: "EB" };
  const transaction = { get: jest.fn(async () => ({ exists: () => true, data: () => data })), set: jest.fn((ref, next) => { data = next; }) };
  runTransaction.mockImplementation((db, update) => update(transaction));
  const update = { powerSource: "DG", dgNumber: "DG-2", dgStartTime: 123 };
  expect(await startAutomaticDG({}, "status", update, "DG-2")).toBe(true);
  expect(await startAutomaticDG({}, "status", update, "DG-2")).toBe(false);
  expect(transaction.set).toHaveBeenCalledTimes(1);
  expect(data.selectedDG).toBe("DG-2"); expect(data.dgStartTime).toBe(123);
});
