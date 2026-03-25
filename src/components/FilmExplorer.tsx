import React, { useEffect, useMemo, useState } from "react";
import { ExplorerFilmRow, ExplorerReviewRow } from "../lib/stats";
import { formatInt, round1 } from "../lib/utils";

type ExplorerSortDirection = "asc" | "desc";

type ExplorerColumn<T> = {
  key: string;
  label: string;
  render: (row: T) => string;
  sortValue: (row: T) => string | number | null;
};

export type FilmExplorerPayload =
  | {
    kind: "films";
    title: string;
    subtitle: string;
    source: string;
    exportFileName: string;
    rows: ExplorerFilmRow[];
  }
  | {
    kind: "reviewRows";
    title: string;
    subtitle: string;
    source: string;
    exportFileName: string;
    rows: ExplorerReviewRow[];
  };

function compareNullable(left: string | number | null, right: string | number | null): number {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left).localeCompare(String(right));
}

function baseFilmColumns(): ExplorerColumn<ExplorerFilmRow>[] {
  return [
    { key: "title", label: "Title", render: (row) => row.title, sortValue: (row) => row.title },
    { key: "year", label: "Year", render: (row) => row.year === null ? "n/a" : String(row.year), sortValue: (row) => row.year },
    { key: "currentRating", label: "Current rating", render: (row) => row.currentRating === null ? "n/a" : String(round1(row.currentRating)), sortValue: (row) => row.currentRating },
    { key: "loggedRating", label: "Logged rating", render: (row) => row.loggedRating === null ? "n/a" : String(round1(row.loggedRating)), sortValue: (row) => row.loggedRating },
    { key: "delta", label: "Delta", render: (row) => row.delta === null ? "n/a" : `${row.delta > 0 ? "+" : ""}${round1(row.delta)}`, sortValue: (row) => row.delta },
    { key: "exactWatchedDate", label: "Exact watched date", render: (row) => row.exactWatchedDate || "n/a", sortValue: (row) => row.exactWatchedDate },
    { key: "reviewRows", label: "Review rows", render: (row) => formatInt(row.reviewRows), sortValue: (row) => row.reviewRows },
    { key: "longestReviewLength", label: "Longest review", render: (row) => row.longestReviewLength === null ? "n/a" : formatInt(row.longestReviewLength), sortValue: (row) => row.longestReviewLength },
    { key: "inWatchlist", label: "In watchlist", render: (row) => row.inWatchlist ? "Yes" : "No", sortValue: (row) => row.inWatchlist ? 1 : 0 },
  ];
}

function baseReviewColumns(): ExplorerColumn<ExplorerReviewRow>[] {
  return [
    { key: "title", label: "Title", render: (row) => row.title, sortValue: (row) => row.title },
    { key: "year", label: "Year", render: (row) => row.year === null ? "n/a" : String(row.year), sortValue: (row) => row.year },
    { key: "currentRating", label: "Current rating", render: (row) => row.currentRating === null ? "n/a" : String(round1(row.currentRating)), sortValue: (row) => row.currentRating },
    { key: "loggedRating", label: "Logged rating", render: (row) => row.loggedRating === null ? "n/a" : String(round1(row.loggedRating)), sortValue: (row) => row.loggedRating },
    { key: "delta", label: "Delta", render: (row) => row.delta === null ? "n/a" : `${row.delta > 0 ? "+" : ""}${round1(row.delta)}`, sortValue: (row) => row.delta },
    { key: "exactWatchedDate", label: "Exact watched date", render: (row) => row.exactWatchedDate || "n/a", sortValue: (row) => row.exactWatchedDate },
    { key: "reviewLength", label: "Review length", render: (row) => formatInt(row.reviewLength), sortValue: (row) => row.reviewLength },
    { key: "inWatchlist", label: "In watchlist", render: (row) => row.inWatchlist ? "Yes" : "No", sortValue: (row) => row.inWatchlist ? 1 : 0 },
  ];
}

export default function FilmExplorer({
  payload,
  onClose,
  onExport,
}: {
  payload: FilmExplorerPayload | null;
  onClose: () => void;
  onExport: (rows: Array<Record<string, string | number | boolean | null>>, fileName: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("title");
  const [direction, setDirection] = useState<ExplorerSortDirection>("asc");

  useEffect(() => {
    setSearch("");
    setSortKey("title");
    setDirection("asc");
  }, [payload?.kind, payload?.title, payload?.source]);

  const columns = useMemo(() => {
    if (!payload) {
      return [] as Array<ExplorerColumn<ExplorerFilmRow | ExplorerReviewRow>>;
    }
    return payload.kind === "films"
      ? baseFilmColumns()
      : baseReviewColumns();
  }, [payload]);

  const filteredRows = useMemo(() => {
    if (!payload) {
      return [] as Array<ExplorerFilmRow | ExplorerReviewRow>;
    }
    const normalized = search.trim().toLowerCase();
    const rows = payload.rows.filter((row) => {
      if (!normalized) {
        return true;
      }
      return [
        row.title,
        row.year === null ? "" : String(row.year),
        row.exactWatchedDate || "",
      ].join(" ").toLowerCase().includes(normalized);
    });
    const column = columns.find((entry) => entry.key === sortKey) || columns[0];
    return [...rows].sort((left, right) => {
      const value = compareNullable(column.sortValue(left as never), column.sortValue(right as never));
      if (value !== 0) {
        return direction === "asc" ? value : -value;
      }
      return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
    });
  }, [columns, direction, payload, search, sortKey]);

  if (!payload) {
    return null;
  }

  return (
    <div className="explorerOverlay" role="dialog" aria-modal="true">
      <div className="explorerPanel">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2>{payload.title}</h2>
            <div className="small">{payload.subtitle}</div>
            <div className="small" style={{ marginTop: 4 }}>
              Source: {payload.source}. Showing {payload.kind === "films" ? "unique films" : "review rows"}.
            </div>
          </div>
          <button className="btn danger" type="button" onClick={onClose}>Close</button>
        </div>

        <div className="explorerToolbar">
          <label>
            <div className="small">Search</div>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or year" />
          </label>
          <label>
            <div className="small">Sort by</div>
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
              {columns.map((column) => (
                <option value={column.key} key={column.key}>{column.label}</option>
              ))}
            </select>
          </label>
          <label>
            <div className="small">Direction</div>
            <select value={direction} onChange={(event) => setDirection(event.target.value as ExplorerSortDirection)}>
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
          <div className="row" style={{ alignSelf: "end" }}>
            <span className="badge">Rows: {formatInt(filteredRows.length)}</span>
            <button
              className="btn primary"
              type="button"
              onClick={() => onExport(
                filteredRows.map((row) => ({ ...row })),
                payload.exportFileName,
              )}
            >
              Export CSV
            </button>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <p>No rows match the current explorer filters.</p>
        ) : (
          <div className="dataTableWrap" style={{ marginTop: 12 }}>
            <div className="dataTable explorerTable">
              <div className={`dataTableHead ${payload.kind === "films" ? "explorerFilms" : "explorerReviews"}`}>
                {columns.map((column) => (
                  <div key={column.key}>{column.label}</div>
                ))}
              </div>
              {filteredRows.map((row) => (
                <div className={`dataTableRow ${payload.kind === "films" ? "explorerFilms" : "explorerReviews"}`} key={row.id}>
                  {columns.map((column) => (
                    <div className={column.key === "title" ? "dataEllipsis" : ""} key={`${row.id}:${column.key}`}>
                      {column.render(row as never)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
