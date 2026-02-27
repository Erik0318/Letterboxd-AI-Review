import React from "react";
import { clamp } from "../lib/utils";

export function Heatmap({
  byMonth,
  title = "Activity heatmap",
  emptyText = "No dates found in the export.",
  footerText = "Click a month to filter film list.",
  onSelectMonth,
  activeMonth
}: {
  byMonth: Array<{ month: string; count: number }>;
  title?: string;
  emptyText?: string;
  footerText?: string;
  onSelectMonth?: (month: string | null) => void;
  activeMonth?: string | null;
}) {
  const map = new Map(byMonth.map((m) => [m.month, m.count]));
  const months = Array.from(map.keys()).sort();
  const years = Array.from(new Set(months.map((m) => m.slice(0, 4)))).sort();
  const max = Math.max(1, ...byMonth.map((m) => m.count));

  function cellStyle(count: number, active: boolean) {
    const t = clamp(count / max, 0, 1);
    const a = 0.06 + t * 0.5;
    return { background: `rgba(85,214,190,${a})`, outline: active ? "2px solid #55d6be" : "none", cursor: "pointer" as const };
  }

  return (
    <div className="card">
      <h2>{title}</h2>
      {years.length === 0 ? <p>{emptyText}</p> : (
        <div style={{ display: "grid", gap: 10 }}>
          {years.map((y) => {
            const row = [];
            for (let m = 1; m <= 12; m++) {
              const mm = String(m).padStart(2, "0");
              const key = `${y}-${mm}`;
              const c = map.get(key) || 0;
              row.push(
                <button
                  key={key}
                  className="cell"
                  style={cellStyle(c, activeMonth === key)}
                  title={`${key}: ${c}`}
                  onClick={() => onSelectMonth?.(activeMonth === key ? null : key)}
                />
              );
            }
            return <div key={y}><div className="small" style={{ marginBottom: 6 }}>{y}</div><div className="heat">{row}</div></div>;
          })}
          <div className="small">{footerText}</div>
        </div>
      )}
    </div>
  );
}
