import React from "react";

export default function Toast({ text }: { text: string | null }) {
  if (!text) return null;
  return <div className="toast" role="status" aria-live="polite">{text}</div>;
}
