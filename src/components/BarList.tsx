import React from "react";
import { clamp, formatInt } from "../lib/utils";

export function BarList({
  title,
  items
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(1, ...items.map(i => i.value));
  return (
    <div className="card">
      <h2>{title}</h2>
      {items.length === 0 ? (
        <p>No data.</p>
      ) : (
        <div>
          {items.map((it) => {
            const pct = clamp((it.value / max) * 100, 0, 100);
            return (
              <div key={it.label} className="barRow">
                <div className="small">{it.label}</div>
                <div className="bar"><div style={{ width: `${pct}%` }} /></div>
                <div className="small" style={{ textAlign: "right" }}>{formatInt(it.value)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
