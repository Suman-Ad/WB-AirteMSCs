import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { doc, writeBatch } from "firebase/firestore";
import SiteMeterCleanup from "./SiteMeterCleanup";
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({ doc: jest.fn((...args) => args), writeBatch: jest.fn() }));
const props = { siteId: "site-a", meters: [{id:"extra", name:"Old meter", status:"ERROR"}, {id:"keep", name:"Main"}], userData:{role:"Admin"}, now:Date.now(), fromCache:false };
test("removes only checked documents after review", async () => {
  const batch = { delete:jest.fn(), commit:jest.fn().mockResolvedValue() };
  writeBatch.mockReturnValue(batch);
  render(<SiteMeterCleanup {...props} />);
  fireEvent.click(screen.getByLabelText("Remove extra"));
  fireEvent.click(screen.getByRole("button", {name:"Review removal (1)"}));
  expect(batch.commit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name:"Confirm removal"}));
  await waitFor(() => expect(screen.getByText("Removed 1 meter records.")).toBeInTheDocument());
  expect(doc).toHaveBeenCalledWith({},"energyMonitor","site-a","meters","extra");
  expect(batch.delete).toHaveBeenCalledTimes(1);
});
test("non-admins cannot select or remove records", () => {
  render(<SiteMeterCleanup {...props} userData={{role:"User"}} />);
  expect(screen.getByLabelText("Remove extra")).toBeDisabled();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
test("cached data cannot be used for removal", () => {
  render(<SiteMeterCleanup {...props} fromCache />);
  expect(screen.getByLabelText("Remove extra")).toBeDisabled();
});
