import React from "react";
import { StatPack } from "../lib/stats";
import { formatInt, formatPct } from "../lib/utils";

export default function BacklogPanel({
  backlog,
  title = "Watchlist",
  subtitle,
}: {
  backlog: StatPack["backlog"];
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="small">
        {subtitle || <>This is a separate backlog dataset. Add dates come from <code>watchlist.csv</code>.</>}
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <span className="badge">Watchlist films: {formatInt(backlog.summary.watchlistFilms.value)}</span>
        <span className="badge">Watchlist rows: {formatInt(backlog.summary.watchlistRows.value)}</span>
        <span className="badge">With add date: {formatInt(backlog.summary.watchlistFilmsWithAddDate.value)}</span>
        <span className="badge">Missing add date: {formatInt(backlog.summary.watchlistFilmsWithoutAddDate.value)}</span>
      </div>

      <div className="small" style={{ marginTop: 12 }}>
        Watched vs watchlist by decade
      </div>
      {backlog.comparison.watchedVsWatchlistByDecade.length === 0 ? (
        <p>No decade data yet.</p>
      ) : (
        <div className="dataTableWrap">
          <div className="dataTable">
            <div className="dataTableHead dataTableBacklog">
              <div>Decade</div>
              <div>Watched films</div>
              <div>Watchlist films</div>
              <div>Watchlist share</div>
            </div>
            {backlog.comparison.watchedVsWatchlistByDecade.map((row) => (
              <div className="dataTableRow dataTableBacklog" key={row.decade}>
                <div>{row.decade}</div>
                <div>{formatInt(row.watchedFilms)}</div>
                <div>{formatInt(row.watchlistFilms)}</div>
                <div>{row.watchlistShare === null ? "n/a" : formatPct(row.watchlistShare)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
