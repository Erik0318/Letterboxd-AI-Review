import React from "react";

export default function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="sectionHeader">
      <div className="sectionEyebrow">Section</div>
      <h2>{title}</h2>
      {description && <div className="small">{description}</div>}
    </div>
  );
}
