import React from "react";
import { DataQualitySection } from "../lib/dataQuality";
import { StatPack } from "../lib/stats";
import { formatInt } from "../lib/utils";
import HelpTooltip from "./HelpTooltip";

export default function DataQualityPanel({
  dataQuality,
  sections,
  subtitle,
  onJumpToSection,
}: {
  dataQuality: StatPack["dataQuality"];
  sections: DataQualitySection[];
  subtitle?: string;
  onJumpToSection?: (target: string) => void;
}) {
  return (
    <div className="card">
      <h2>Data quality</h2>
      <div className="small">
        {subtitle || "What the export can support, and what it cannot."}
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <span className="badge">
          Exact watch dates: {formatInt(dataQuality.summary.exactDatedWatchedFilms.value)}
          <HelpTooltip
            label="Exact watch dates note"
            text="Watched-universe films with at least one exact diary/review watched date. These are the films that can safely enter default watched-time charts."
          />
        </span>
        <span className="badge">
          Missing exact watch dates: {formatInt(dataQuality.summary.watchedFilmsWithoutExactDate.value)}
          <HelpTooltip
            label="Missing exact watch dates note"
            text="These still count as watched films, but they stay out of the default watch timeline, heatmap, streak, and watched-time charts."
          />
        </span>
        <span className="badge">
          Comparable ratings: {formatInt(dataQuality.summary.comparableDriftFilms.value)}
          <HelpTooltip
            label="Comparable ratings note"
            text="Films that have both currentRating and loggedRating, so they can participate in rating drift comparisons."
          />
        </span>
        <span className="badge">Changed ratings: {formatInt(dataQuality.summary.changedRatingFilms.value)}</span>
        <span className="badge">Current-only: {formatInt(dataQuality.summary.currentOnlyRatedFilms.value)}</span>
        <span className="badge">Logged-only: {formatInt(dataQuality.summary.loggedOnlyRatedFilms.value)}</span>
      </div>

      <div className="qualitySectionGrid">
        {sections.map((section) => (
          <div className="qualitySectionCard" key={section.id}>
            <h3>{section.title}</h3>
            <div className="small">{section.description}</div>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {section.items.map((item) => (
                <div className="qualityIssue" key={item.id}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div className="qualityIssueTitle">{item.label}</div>
                    <span className="badge">{item.valueLabel}</span>
                  </div>
                  <div className="small" style={{ marginTop: 6 }}>Counted from: {item.basis}</div>
                  <div className="small" style={{ marginTop: 4 }}>What this changes: {item.whatThisAffects}</div>
                  {item.jumpTarget && item.jumpLabel && (onJumpToSection ? (
                    <button
                      type="button"
                      className="small sectionLink linkButton"
                      onClick={() => onJumpToSection(item.jumpTarget!)}
                    >
                      Open {item.jumpLabel}
                    </button>
                  ) : (
                    <a className="small sectionLink" href={`#${item.jumpTarget}`}>Open {item.jumpLabel}</a>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="moduleSplit" style={{ marginTop: 14 }}>
        <div>
          <div className="small" style={{ marginTop: 12 }}>Core files</div>
          <div className="dataTableWrap">
            <div className="dataTable">
              <div className="dataTableHead dataTableAuditCore">
                <div>File</div>
                <div>Present</div>
                <div>Rows</div>
              </div>
              {dataQuality.tables.core.map((row) => (
                <div className="dataTableRow dataTableAuditCore" key={row.path}>
                  <div>{row.label}</div>
                  <div>{row.present ? "Yes" : "No"}</div>
                  <div>{formatInt(row.rows)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="small" style={{ marginTop: 12 }}>Coverage by section</div>
          <div className="dataTableWrap">
            <div className="dataTable">
              <div className="dataTableHead dataTableAuditCoverage">
                <div>Section</div>
                <div>Coverage</div>
                <div>Why it matters</div>
              </div>
              {dataQuality.moduleCoverage.map((row) => (
                <div className="dataTableRow dataTableAuditCoverage" key={row.id}>
                  <div>{row.label}</div>
                  <div>
                    {row.coverage === null
                      ? "n/a"
                      : `${formatInt(row.covered)} / ${formatInt(row.total)} (${Math.round(row.coverage * 100)}%)`}
                  </div>
                  <div>{row.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
