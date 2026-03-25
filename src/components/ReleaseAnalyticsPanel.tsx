import React from "react";
import { StatPack } from "../lib/stats";
import { formatInt, round1 } from "../lib/utils";

function formatMean(value: number | null): string {
  return value === null ? "n/a" : String(round1(value));
}

export default function ReleaseAnalyticsPanel({
  releaseAnalytics,
  title = "Release analytics",
  subtitle,
  onDecadeClick,
}: {
  releaseAnalytics: StatPack["releaseAnalytics"];
  title?: string;
  subtitle?: string;
  onDecadeClick?: (row: StatPack["releaseAnalytics"]["decadeRatings"][number]) => void;
}) {
  const highestCurrent = releaseAnalytics.summary.highestCurrentRatedDecade;
  const highestLogged = releaseAnalytics.summary.highestLoggedRatedDecade;

  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="small">
        {subtitle || "Watched distributions stay film-level unique. Rating averages only use films that actually have the relevant rating source."}
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <span className="badge">
          Highest current-rated decade: {highestCurrent ? `${highestCurrent.decade} (${formatMean(highestCurrent.meanRating)}, n=${formatInt(highestCurrent.ratedFilms)})` : "n/a"}
        </span>
        <span className="badge">
          Highest logged-rated decade: {highestLogged ? `${highestLogged.decade} (${formatMean(highestLogged.meanRating)}, n=${formatInt(highestLogged.ratedFilms)})` : "n/a"}
        </span>
      </div>

      {releaseAnalytics.decadeRatings.length === 0 ? (
        <p>No release decade data found.</p>
      ) : (
        <div className="dataTableWrap" style={{ marginTop: 12 }}>
            <div className="dataTable">
              <div className="dataTableHead dataTableRelease">
                <div>Decade</div>
                <div>Watched films</div>
              <div>Current rated films</div>
              <div>Current mean</div>
              <div>Logged-rated films</div>
                <div>Logged mean</div>
              </div>
              {releaseAnalytics.decadeRatings.map((row) => (
                <button
                  type="button"
                  className={`dataTableRow dataTableRelease${onDecadeClick ? " dataTableRowButton" : ""}`}
                  key={row.decade}
                  onClick={() => onDecadeClick?.(row)}
                  disabled={!onDecadeClick}
                >
                  <div>{row.decade}</div>
                  <div>{formatInt(row.watchedFilms)}</div>
                  <div>{formatInt(row.currentRatedFilms)}</div>
                  <div>{formatMean(row.currentMeanRating)}</div>
                  <div>{formatInt(row.loggedRatedFilms)}</div>
                  <div>{formatMean(row.loggedMeanRating)}</div>
                </button>
              ))}
            </div>
          </div>
      )}
    </div>
  );
}
