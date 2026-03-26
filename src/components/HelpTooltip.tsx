import React from "react";

export default function HelpTooltip({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
  return (
    <span className="helpTip">
      <button type="button" className="helpTipButton" aria-label={label}>
        ?
      </button>
      <span className="helpTipBubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}
