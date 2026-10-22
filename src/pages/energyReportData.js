export const numberValue = (v) => (typeof v === "number" || (typeof v === "string" && v.trim() !== "")) && Number.isFinite(Number(v)) ? Number(v) : null;
export const istDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const dgMonth = (date) => new Date(`${date}T12:00:00+05:30`).toLocaleString("en-US", { month: "short", timeZone: "Asia/Kolkata" }) + "-" + date.slice(0, 4);
export const consumption = (opening, closing) => opening !== null && closing !== null && closing >= opening ? closing - opening : null;
export function dailyEnergyRows(records) {
  return records.flatMap((record) => {
    const labels = new Set(Object.keys(record).filter((key) => / KWH (Opening|Closing)$/i.test(key)).map((key) => key.replace(/ KWH (Opening|Closing)$/i, "")));
    return [...labels].map((label) => {
      const get = (type) => numberValue(record[Object.keys(record).find((key) => key.toLowerCase() === `${label} kwh ${type}`.toLowerCase())]);
      const opening = get("opening"), closing = get("closing");
      return { id: `${record.id}-${label}`, label, opening, closing, usage: consumption(opening, closing), reset: opening !== null && closing !== null && closing < opening };
    });
  });
}
export function runHours(row) {
  const hours = numberValue(row.totalRunHours), seconds = numberValue(row.runSeconds);
  if (hours !== null && hours >= 0) return hours;
  if (seconds !== null && seconds >= 0) return seconds / 3600;
  const parse = (time) => /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time || "") ? time.split(":").reduce((n, part, i) => n + Number(part) * [3600, 60, 1][i], 0) : null;
  const start = parse(row.startTime), end = parse(row.stopTime || row.endTime);
  return start !== null && end !== null ? ((end - start + 86400) % 86400) / 3600 : null;
}
export { validateSLD } from "./energySLDData";
export const sampleSLD = { title: "Sample power distribution", nodes: [{ id: "utility", label: "Utility supply", type: "source", x: 50, y: 40 }, { id: "main", label: "Main incomer", type: "breaker", meterId: "meter-1", x: 300, y: 40 }, { id: "ups", label: "UPS distribution", type: "load", meterId: "meter-2", x: 550, y: 40 }, { id: "dg", label: "DG supply", type: "generator", x: 50, y: 210 }], edges: [{ source: "utility", target: "main" }, { source: "dg", target: "main", label: "ATS" }, { source: "main", target: "ups" }] };
export function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
