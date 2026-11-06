import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Login from "./Login";
import { sendPasswordResetEmail } from "firebase/auth";

jest.mock("../firebase", () => ({ auth: {}, db: {} }));
jest.mock("../services/deviceNotifications", () => ({ disableDeviceNotifications: jest.fn() }));
jest.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("firebase/firestore", () => ({ doc: jest.fn(), getDoc: jest.fn(), updateDoc: jest.fn() }));
jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}));

test("password visibility toggles without submitting the form", () => {
  render(<Login setUserData={jest.fn()} />);
  const password = screen.getByLabelText("Password");
  expect(password).toHaveAttribute("type", "password");
  fireEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(password).toHaveAttribute("type", "text");
  fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
  expect(password).toHaveAttribute("type", "password");
});

test("reset mode submits the reset email in one form and returns to login", async () => {
  const { container } = render(<Login setUserData={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
  expect(container.querySelectorAll("form")).toHaveLength(1);
  expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "employee@example.com" } });
  fireEvent.submit(container.querySelector("form"));
  await waitFor(() => expect(sendPasswordResetEmail).toHaveBeenCalledWith({}, "employee@example.com"));
  expect(await screen.findByRole("status")).toHaveTextContent("a password reset link has been sent");
  fireEvent.click(screen.getByRole("button", { name: "Back to login" }));
  expect(screen.getByLabelText("Password")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Create new account" })).toHaveAttribute("href", "/register");
});


test("prefills the login email and prevents duplicate reset requests", async () => {
  let resolveRequest;
  sendPasswordResetEmail.mockImplementationOnce(() => new Promise(resolve => { resolveRequest = resolve; }));
  const { container } = render(<Login setUserData={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "employee@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
  expect(screen.getByLabelText("Email address")).toHaveValue("employee@example.com");
  const callsBefore = sendPasswordResetEmail.mock.calls.length;
  fireEvent.submit(container.querySelector("form"));
  fireEvent.submit(container.querySelector("form"));
  expect(sendPasswordResetEmail.mock.calls.length).toBe(callsBefore + 1);
  expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  resolveRequest();
  await screen.findByRole("status");
  expect(screen.getByRole("button", { name: "Send reset email" })).toBeEnabled();
});

test.each([
  ["auth/network-request-failed", "Check your internet connection"],
  ["auth/too-many-requests", "Too many reset requests"],
])("handles %s and allows retry", async (code, message) => {
  sendPasswordResetEmail.mockRejectedValueOnce({ code });
  const { container } = render(<Login setUserData={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "employee@example.com" } });
  fireEvent.submit(container.querySelector("form"));
  expect(await screen.findByRole("alert")).toHaveTextContent(message);
  expect(screen.getByRole("button", { name: "Send reset email" })).toBeEnabled();
});
