import React, { useMemo } from "react";
import { calculateDailyFinalSummary } from "../utils/dailyFinalSummary";
import "../assets/FinalSummary.css";

export default function FinalSummary({ siteData, selectedDate, title = "Final Summary" }) {
  const rows = useMemo(() => calculateDailyFinalSummary(siteData, selectedDate), [siteData, selectedDate]);
  return (
    <section className="daily-final-summary" aria-label={title}>
      <h3>{title}</h3>
      <p>{selectedDate} · Calculated from source sheets for this reporting date.</p>
      <div className="daily-final-summary-scroll">
        <table>
          <thead><tr><th scope="col">Edge Data Centres Count</th><th scope="col">WB</th></tr></thead>
          <tbody>{rows.map((row, index) => (
            <tr key={index}>
              <th scope="row">{row.Edge_Data_Centres_Count}</th>
              <td>{typeof row.WB === "number" ? Number(row.WB.toFixed(2)) : row.WB}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
