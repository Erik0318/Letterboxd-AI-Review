import React from "react";

export function LineChart({
  title,
  series,
  color = "#55d6be"
}: {
  title: string;
  series: Array<{ month: string; value: number | null }>;
  color?: string;
}) {
  const w = 520;
  const h = 200;
  const pad = 24;
  const vals = series.map((s) => s.value || 0);
  const max = Math.max(1, ...vals);
  const step = series.length > 1 ? (w - pad * 2) / (series.length - 1) : 0;
  const pts = series.map((s, i) => {
    const x = pad + i * step;
    const y = h - pad - ((s.value || 0) / max) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="card">
      <h2>{title}</h2>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} />
      </svg>
      <div className="small">{series[0]?.month} → {series[series.length - 1]?.month}</div>
    </div>
  );
}
