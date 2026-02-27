import React from "react";

export function RadarChart({ items }: { items: Array<{ label: string; score: number }> }) {
  const size = 320;
  const c = size / 2;
  const r = 120;
  const n = Math.max(3, items.length);
  const points = items.map((it, i) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rr = (it.score / 100) * r;
    return [c + Math.cos(ang) * rr, c + Math.sin(ang) * rr];
  });
  const outline = Array.from({ length: n }).map((_, i) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(ang) * r, c + Math.sin(ang) * r];
  });

  return (
    <div className="card">
      <h2>Taste Radar</h2>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {[0.25, 0.5, 0.75, 1].map((k) => (
          <circle key={k} cx={c} cy={c} r={r * k} fill="none" stroke="rgba(255,255,255,0.15)" />
        ))}
        {outline.map((p, i) => <line key={i} x1={c} y1={c} x2={p[0]} y2={p[1]} stroke="rgba(255,255,255,0.2)" />)}
        <polygon points={outline.map((p) => p.join(",")).join(" ")} fill="none" stroke="rgba(255,255,255,0.3)" />
        <polygon points={points.map((p) => p.join(",")).join(" ")} fill="rgba(85,214,190,0.35)" stroke="#55d6be" strokeWidth={2} />
        {outline.map((p, i) => <text key={i} x={p[0]} y={p[1]} fill="#c8d0ff" fontSize={11}>{items[i]?.label}</text>)}
      </svg>
    </div>
  );
}
