import React from "react";
import { meterLight } from "./meterHealth";
export default function MeterStatus({ state }) {
  return <span className={`energy-badge ${state === "Live" ? "is-live" : ""}`} role="status"><span className={`energy-status-light is-${meterLight(state)}`} aria-hidden="true" />{state}</span>;
}
