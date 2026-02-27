import React from "react";

export function RadarChart({ title, metrics }: { title: string; metrics: Array<{ label: string; value: number }> }) {
  const size = 320;
  const c = size / 2;
  const r = 120;
  const n = Math.max(3, metrics.length);

  const points = metrics.map((m, i) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rr = (m.value / 100) * r;
    return { x: c + Math.cos(ang) * rr, y: c + Math.sin(ang) * rr, lx: c + Math.cos(ang) * (r + 18), ly: c + Math.sin(ang) * (r + 18), label: m.label };
  });

  const poly = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="card">
      <h2>{title}</h2>
      <svg width="100%" viewBox={`0 0 ${size} ${size}`}>
        {[0.2, 0.4, 0.6, 0.8, 1].map((t) => {
          const ring = metrics.map((_, i) => {
            const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
            return `${c + Math.cos(ang) * r * t},${c + Math.sin(ang) * r * t}`;
          }).join(" ");
          return <polygon key={t} points={ring} fill="none" stroke="rgba(230,237,243,.18)" strokeWidth="1" />;
        })}
        {metrics.map((_, i) => {
          const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
          return <line key={i} x1={c} y1={c} x2={c + Math.cos(ang) * r} y2={c + Math.sin(ang) * r} stroke="rgba(230,237,243,.16)" />;
        })}
        <polygon points={poly} fill="rgba(85,214,190,.3)" stroke="rgba(85,214,190,.9)" strokeWidth="2" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="rgba(126,241,220,1)" />
            <text x={p.lx} y={p.ly} fill="rgba(230,237,243,.85)" fontSize="9" textAnchor="middle">{p.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
