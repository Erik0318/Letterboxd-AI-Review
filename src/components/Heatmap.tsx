import React from "react";
import { clamp } from "../lib/utils";

export function Heatmap({
  byMonth
}: {
  byMonth: Array<{ month: string; count: number }>;
}) {
  const map = new Map(byMonth.map(m => [m.month, m.count]));
  const months = Array.from(map.keys()).sort();
  const years = Array.from(new Set(months.map(m => m.slice(0, 4)))).sort();
  const max = Math.max(1, ...byMonth.map(m => m.count));

  function cellStyle(count: number) {
    const t = clamp(count / max, 0, 1);
    // simple alpha ramp
    const a = 0.06 + t * 0.50;
    return { background: `rgba(85,214,190,${a})` };
  }

  return (
    <div className="card">
      <h2>Activity heatmap</h2>
      {years.length === 0 ? (
        <p>No dates found in the export.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {years.slice(-6).map((y) => {
            const row = [];
            for (let m = 1; m <= 12; m++) {
              const mm = String(m).padStart(2, "0");
              const key = `${y}-${mm}`;
              const c = map.get(key) || 0;
              row.push(<div key={key} className="cell" style={cellStyle(c)} title={`${key}: ${c}`} />);
            }
            return (
              <div key={y}>
                <div className="small" style={{ marginBottom: 6 }}>{y}</div>
                <div className="heat">{row}</div>
              </div>
            );
          })}
          <div className="small">Shows the last 6 years found in your dates.</div>
        </div>
      )}
    </div>
  );
}
