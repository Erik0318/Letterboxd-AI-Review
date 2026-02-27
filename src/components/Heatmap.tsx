import React from "react";
import { clamp } from "../lib/utils";

export function Heatmap({
  byMonth,
  title = "Activity heatmap",
  selectedMonth,
  onSelectMonth,
  emptyText = "No dates found in the export.",
  footerText = "Click a month cell to filter films list."
}: {
  byMonth: Array<{ month: string; count: number }>;
  title?: string;
  selectedMonth?: string | null;
  onSelectMonth?: (month: string) => void;
  emptyText?: string;
  footerText?: string;
}) {
  const map = new Map(byMonth.map((m) => [m.month, m.count]));
  const months = Array.from(map.keys()).sort();
  const years = Array.from(new Set(months.map((m) => m.slice(0, 4)))).sort();
  const max = Math.max(1, ...byMonth.map((m) => m.count));

  function cellStyle(count: number, active: boolean) {
    const t = clamp(count / max, 0, 1);
    const a = 0.08 + t * 0.56;
    return {
      background: `rgba(85,214,190,${a})`,
      outline: active ? "2px solid rgba(255,204,102,.95)" : "1px solid rgba(230,237,243,0.08)",
      cursor: "pointer"
    } as React.CSSProperties;
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
              const active = selectedMonth === key;
              row.push(
                <div
                  key={key}
                  className="cell"
                  style={cellStyle(c, active)}
                  title={`${key}: ${c}`}
                  onClick={() => onSelectMonth?.(key)}
                  aria-label={`month-${key}`}
                />
              );
            }
            return (
              <div key={y}>
                <div className="small" style={{ marginBottom: 6 }}>{y}</div>
                <div className="heat">{row}</div>
              </div>
            );
          })}
          <div className="small">{footerText}</div>
        </div>
      )}
    </div>
  );
}
