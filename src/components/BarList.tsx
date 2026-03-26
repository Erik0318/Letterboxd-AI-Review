import React from "react";
import { clamp, formatInt } from "../lib/utils";

export function BarList({
  title,
  items,
  emptyText = "Nothing here yet.",
  onItemClick,
  subtitle,
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
  emptyText?: string;
  onItemClick?: (item: { label: string; value: number }, sourceElement: HTMLElement | null) => void;
  subtitle?: string;
}) {
  const max = Math.max(1, ...items.map(i => i.value));
  return (
    <div className="card">
      <h2>{title}</h2>
      {subtitle && <div className="small">{subtitle}</div>}
      {items.length === 0 ? (
        <p>{emptyText}</p>
      ) : (
        <div>
          {items.map((it) => {
            const pct = clamp((it.value / max) * 100, 0, 100);
            return (
              <button
                key={it.label}
                type="button"
                className={`barRowButton${onItemClick ? " isInteractive" : ""}`}
                onClick={(event) => onItemClick?.(it, event.currentTarget)}
                disabled={!onItemClick}
              >
                <div className="small">{it.label}</div>
                <div className="bar"><div style={{ width: `${pct}%` }} /></div>
                <div className="small" style={{ textAlign: "right" }}>{formatInt(it.value)}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
