import React from "react";
import { StatPack } from "../lib/stats";
import { formatInt } from "../lib/utils";

export default function DataQualityPanel({
  dataQuality,
  subtitle,
}: {
  dataQuality: StatPack["dataQuality"];
  subtitle?: string;
}) {
  return (
    <div className="card">
      <h2>Data quality / export audit</h2>
      <div className="small">
        {subtitle || "A compact audit of what the export can reliably support. This reflects export structure and field coverage, not a judgment about the user."}
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <span className="badge">Exact-dated watched films: {formatInt(dataQuality.summary.exactDatedWatchedFilms.value)}</span>
        <span className="badge">Watched films without exact date: {formatInt(dataQuality.summary.watchedFilmsWithoutExactDate.value)}</span>
        <span className="badge">Comparable drift films: {formatInt(dataQuality.summary.comparableDriftFilms.value)}</span>
        <span className="badge">Changed rating films: {formatInt(dataQuality.summary.changedRatingFilms.value)}</span>
        <span className="badge">Current-only ratings: {formatInt(dataQuality.summary.currentOnlyRatedFilms.value)}</span>
        <span className="badge">Logged-only ratings: {formatInt(dataQuality.summary.loggedOnlyRatedFilms.value)}</span>
      </div>

      <div className="moduleSplit">
        <div>
          <div className="small" style={{ marginTop: 12 }}>Module coverage</div>
          <div className="dataTableWrap">
            <div className="dataTable">
              <div className="dataTableHead dataTableAuditCoverage">
                <div>Module</div>
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

          <div className="small" style={{ marginTop: 12 }}>Duplicate-sensitive raw rows</div>
          <div className="row" style={{ marginTop: 8 }}>
            <span className="badge">Watched rows beyond unique films: {formatInt(dataQuality.duplicateRows.watchedRowsBeyondUniqueFilms.value)}</span>
            <span className="badge">Rating rows beyond unique films: {formatInt(dataQuality.duplicateRows.ratingRowsBeyondUniqueFilms.value)}</span>
            <span className="badge">Review rows beyond unique films: {formatInt(dataQuality.duplicateRows.reviewRowsBeyondUniqueFilms.value)}</span>
            <span className="badge">Watchlist rows beyond unique films: {formatInt(dataQuality.duplicateRows.watchlistRowsBeyondUniqueFilms.value)}</span>
          </div>

          <div className="small" style={{ marginTop: 12 }}>Sparse or optional fields</div>
          <div className="row" style={{ marginTop: 8 }}>
            <span className="badge">Tagged films: {formatInt(dataQuality.fieldCoverage.taggedFilms.value)}</span>
            <span className="badge">Rewatch events: {formatInt(dataQuality.fieldCoverage.rewatchEvents.value)}</span>
            <span className="badge">Comments rows: {formatInt(dataQuality.fieldCoverage.commentsRows.value)}</span>
            <span className="badge">Likes rows: {formatInt(dataQuality.fieldCoverage.likesRows.value)}</span>
          </div>

          <div className="small" style={{ marginTop: 12 }}>Import / log behaviour</div>
          <div className="row" style={{ marginTop: 8 }}>
            <span className="badge">
              Top import/log day: {dataQuality.importLog.topDay ? `${dataQuality.importLog.topDay} (${formatInt(dataQuality.importLog.topDayCount)})` : "n/a"}
            </span>
            <span className="badge">Import spike detected: {dataQuality.importLog.spikeDetected ? "Yes" : "No"}</span>
          </div>
          <div className="small" style={{ marginTop: 6 }}>{dataQuality.importLog.basis}</div>
        </div>

        <div>
          <div className="small" style={{ marginTop: 12 }}>Recognized core tables</div>
          <div className="dataTableWrap">
            <div className="dataTable">
              <div className="dataTableHead dataTableAuditCore">
                <div>Table</div>
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

          <div className="small" style={{ marginTop: 12 }}>Optional export areas</div>
          <div className="dataTableWrap">
            <div className="dataTable">
              <div className="dataTableHead dataTableAuditOptional">
                <div>Area</div>
                <div>Present</div>
                <div>Detail</div>
              </div>
              {dataQuality.tables.optionalGroups.map((row) => (
                <div className="dataTableRow dataTableAuditOptional" key={row.label}>
                  <div>{row.label}</div>
                  <div>{row.present ? "Yes" : "No"}</div>
                  <div className="dataEllipsis">{row.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
