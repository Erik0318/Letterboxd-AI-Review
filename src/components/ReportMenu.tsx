import React from "react";
import { ReportMenuEntry, ReportSectionId } from "../lib/reportSections";

export default function ReportMenu({
  entries,
  activeSectionId,
  sticky = false,
  visible = true,
  activeScopeSummary,
  activeViewName,
  onNavigate,
}: {
  entries: ReportMenuEntry[];
  activeSectionId: ReportSectionId;
  sticky?: boolean;
  visible?: boolean;
  activeScopeSummary: string;
  activeViewName: string | null;
  onNavigate: (sectionId: ReportSectionId) => void;
}) {
  if (!entries.length) {
    return null;
  }

  if (sticky) {
    return (
      <div className={`reportMenuDock${visible ? " isVisible" : ""}`} aria-hidden={!visible}>
        <div className="reportMenuProgress" aria-hidden="true"><span /></div>
        <div className="reportMenuDockMeta">
          <div className="small">Now reading</div>
          <div className="reportMenuDockTitle">{entries.find((entry) => entry.id === activeSectionId)?.title || "Report"}</div>
        </div>
        <div className="reportMenuPills" role="navigation" aria-label="Report section navigator">
          {entries.map((entry) => (
            <button
              key={`sticky:${entry.id}`}
              type="button"
              className={`reportMenuPill${entry.id === activeSectionId ? " isActive" : ""}`}
              data-section={entry.id}
              onClick={() => onNavigate(entry.id)}
              aria-current={entry.id === activeSectionId ? "true" : undefined}
            >
              <span>{entry.shortTitle}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card reportMenuShell" id="report-menu">
      <div className="reportMenuProgress" aria-hidden="true"><span /></div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="sectionEyebrow">Report Map</div>
          <h2 style={{ marginTop: 4 }}>Find your way</h2>
          <div className="small">
            Jump to a section, keep the rest for later, and let the report unfold as you move.
          </div>
        </div>
        <div className="reportMenuMeta">
          <span className="badge">Now: {entries.find((entry) => entry.id === activeSectionId)?.title || "Overview"}</span>
          <span className="badge">View: {activeScopeSummary}</span>
          {activeViewName && <span className="badge">Saved: {activeViewName}</span>}
        </div>
      </div>

      <div className="reportMenuGrid" role="navigation" aria-label="Report section map">
        {entries.map((entry, index) => (
          <button
            key={entry.id}
            type="button"
            className={`reportMenuCard${entry.id === activeSectionId ? " isActive" : ""}`}
            data-section={entry.id}
            onClick={() => onNavigate(entry.id)}
            aria-current={entry.id === activeSectionId ? "true" : undefined}
          >
            <div className="reportMenuCardTop">
              <span className="reportMenuIndex">{String(index + 1).padStart(2, "0")}</span>
              {entry.id === activeSectionId && <span className="badge">Active</span>}
            </div>
            <div className="reportMenuTitle">{entry.title}</div>
            <div className="reportMenuPurpose">{entry.purpose}</div>
            <div className="reportMenuMetrics">
              {entry.metrics.length > 0 ? entry.metrics.map((metric) => (
                <div className="reportMenuMetric" key={`${entry.id}:${metric.label}`}>
                  <div className="small">{metric.label}</div>
                  <div>{metric.value}</div>
                </div>
              )) : (
                <div className="reportMenuMetric">
                  <div className="small">Ready</div>
                  <div>Open section</div>
                </div>
              )}
            </div>
            <div className="reportMenuHint">Jump to {entry.shortTitle.toLowerCase()}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
