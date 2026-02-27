import React from "react";

export function LineChart({
  title,
  points,
  yLabel,
  valueKey
}: {
  title: string;
  points: Array<{ period: string; watched: number; meanRating: number | null }>;
  yLabel: string;
  valueKey: "watched" | "meanRating";
}) {
  const width = 720;
  const height = 220;
  const pad = 28;
  const vals = points.map((p) => (valueKey === "watched" ? p.watched : (p.meanRating || 0)));
  const max = Math.max(1, ...vals);
  const min = Math.min(0, ...vals);
  const span = Math.max(1, max - min);

  const xy = points.map((p, i) => {
    const v = valueKey === "watched" ? p.watched : (p.meanRating || 0);
    const x = pad + (i * (width - pad * 2)) / Math.max(1, points.length - 1);
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return { x, y, period: p.period, v };
  });

  const path = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <div className="card">
      <h2>{title}</h2>
      {points.length === 0 ? <p>No data.</p> : (
        <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
          <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="rgba(230,237,243,.2)" />
          <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="rgba(230,237,243,.2)" />
          <path d={path} fill="none" stroke="rgba(85,214,190,.95)" strokeWidth="2.5" />
          {xy.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.8" fill="rgba(126,241,220,1)" />)}
          <text x={pad} y={16} fill="rgba(230,237,243,.8)" fontSize="10">{yLabel}</text>
          <text x={width - pad} y={height - 8} fill="rgba(230,237,243,.65)" fontSize="10" textAnchor="end">{points[0]?.period} → {points[points.length - 1]?.period}</text>
        </svg>
      )}
    </div>
  );
}
