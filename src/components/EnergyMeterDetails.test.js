import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MeterVectorDiagram, MeterReadingPanels } from "./EnergyMeterDetails";

test("vector diagram stays visible with labelled reference when measured angles are missing", () => {
  const view = renderToStaticMarkup(<MeterVectorDiagram meter={{ id: "m1", status: "OK", voltage_ll: 415 }} status="Live" />);
  expect(view).toContain("<svg");
  expect(view).toContain("No measured phase vectors");
  expect(view).toContain("They are not meter measurements");
});
test("measured aliases draw real vectors and expose their angles", () => {
  const view = renderToStaticMarkup(<MeterVectorDiagram meter={{ id: "m1", status: "OK", RMS_Voltage_R: 230, voltage_angle_r: 0, rms_current_r: 10, current_angle_r: -30 }} status="Live" />);
  expect(view).toContain("2/6 measured vectors");
  expect(view).toContain("VR");
  expect(view).toContain("IR");
  expect(view).toContain("-30");
});
test("RMS and FWD tables render supplied and extra registers", () => {
  const view = renderToStaticMarkup(<MeterReadingPanels meter={{ status: "OK", voltage_ll: 415, fwd_kWh: 5, fwd_extra: 7 }} />);
  expect(view).toContain("415");
  expect(view).toContain("FWD active energy");
  expect(view).toContain("fwd_extra");
});
