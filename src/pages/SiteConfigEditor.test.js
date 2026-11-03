import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import SiteConfigEditor from "./SiteConfigEditor";
import { getDoc, setDoc } from "firebase/firestore";
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({ doc:jest.fn(), getDoc:jest.fn(async () => ({exists:() => false})), setDoc:jest.fn() }));
jest.mock("firebase/storage", () => ({ getStorage:jest.fn(), ref:jest.fn(), uploadBytes:jest.fn(), getDownloadURL:jest.fn() }));
jest.mock("./SiteEnergySettings", () => ({siteId}) => <div data-testid="energy-settings">{siteId}</div>);
test("Site Config exposes energy automation and its separate settings saves", async () => {
  getDoc.mockResolvedValue({exists:() => false});
  await act(async () => render(<SiteConfigEditor userData={{site:"Asansol",siteId:"ASL",role:"Admin"}} />));
  fireEvent.click(screen.getByRole("button", {name:"Energy Automation"}));
  expect(screen.getByTestId("energy-settings")).toHaveTextContent("ASL");
  expect(screen.queryByRole("button", {name:"Save Config"})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name:"Overview"}));
  expect(screen.getByRole("button", {name:"Save Config"})).toBeInTheDocument();
});

test('save failures preserve edited site details and show inline feedback',async()=>{
  getDoc.mockResolvedValue({exists:()=>false});
  setDoc.mockRejectedValue(new Error('offline'));
  await act(async()=>render(<SiteConfigEditor userData={{site:'Asansol',siteId:'ASL',role:'Admin'}}/>));
  const address=screen.getByLabelText('Site Address');
  fireEvent.change(address,{target:{name:'address',value:'Updated address'}});
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Save Config'})));
  expect(screen.getByRole('status')).toHaveTextContent('Unable to save');
  expect(address).toHaveValue('Updated address');
  expect(screen.getByRole('button',{name:'Save Config'})).toBeEnabled();
});
