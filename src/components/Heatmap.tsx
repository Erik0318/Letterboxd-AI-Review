import React from "react";
import { clamp } from "../lib/utils";

export function Heatmap({
  byMonth,
  title = "Activity heatmap",
  onMonthClick,
  selectedMonth,
}: {
  byMonth: Array<{ month: string; count: number }>;
  title?: string;
  onMonthClick?: (month: string) => void;
  selectedMonth?: string | null;
}) {
  const map = new Map(byMonth.map((m) => [m.month, m.count]));
  const months = Array.from(map.keys()).sort();
  const years = Array.from(new Set(months.map((m) => m.slice(0, 4)))).sort();
  const max = Math.max(1, ...byMonth.map((m) => m.count));

  return (
    <div className="card">
      <h2>{title}</h2>
      {!years.length ? <p>No data</p> : years.map((y) => (
        <div key={y}>
          <div className="small">{y}</div>
          <div className="heat">
            {Array.from({ length: 12 }).map((_, i) => {
              const mm = String(i + 1).padStart(2, "0");
              const month = `${y}-${mm}`;
              const count = map.get(month) || 0;
              const alpha = 0.08 + clamp(count / max, 0, 1) * 0.6;
              return (
                <button
                  key={month}
                  className="cell"
                  style={{ background: `rgba(85,214,190,${alpha})`, outline: selectedMonth === month ? "2px solid #fff" : "none" }}
                  title={`${month}: ${count}`}
                  onClick={() => onMonthClick?.(month)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
