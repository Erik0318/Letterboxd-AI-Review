import React, { ReactNode, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  buildExplorerExportRows,
  collectExplorerTitles,
  ExplorerSortDirection,
  FilmExplorerPayload,
} from "../lib/explorer";
import { ExplorerFilmRow, ExplorerReviewRow } from "../lib/stats";
import { formatInt, round1 } from "../lib/utils";
import { ExactWatchEventRow } from "../lib/watchActivity";

type ExplorerRow = ExplorerFilmRow | ExplorerReviewRow | ExactWatchEventRow;

type ExplorerColumn = {
  key: string;
  label: string;
  preferredDirection: ExplorerSortDirection;
  render: (row: ExplorerRow) => ReactNode;
  sortValue: (row: ExplorerRow) => string | number | boolean | null;
};

function compareNullable(
  left: string | number | boolean | null,
  right: string | number | boolean | null,
): number {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right);
  }
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left).localeCompare(String(right));
}

function formatRating(value: number | null): string {
  return value === null ? "n/a" : String(round1(value));
}

function formatDelta(value: number | null): string {
  if (value === null) {
    return "n/a";
  }
  const rounded = round1(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function baseFilmColumns(): ExplorerColumn[] {
  return [
    { key: "title", label: "Title", preferredDirection: "asc", render: (row) => row.title, sortValue: (row) => row.title },
    { key: "year", label: "Year", preferredDirection: "desc", render: (row) => row.year === null ? "n/a" : String(row.year), sortValue: (row) => row.year },
    { key: "currentRating", label: "Current rating", preferredDirection: "desc", render: (row) => formatRating((row as ExplorerFilmRow).currentRating), sortValue: (row) => (row as ExplorerFilmRow).currentRating },
    { key: "loggedRating", label: "Logged rating", preferredDirection: "desc", render: (row) => formatRating((row as ExplorerFilmRow).loggedRating), sortValue: (row) => (row as ExplorerFilmRow).loggedRating },
    { key: "delta", label: "Delta", preferredDirection: "desc", render: (row) => formatDelta((row as ExplorerFilmRow).delta), sortValue: (row) => (row as ExplorerFilmRow).delta },
    { key: "exactWatchedDate", label: "Exact watched date", preferredDirection: "desc", render: (row) => (row as ExplorerFilmRow).exactWatchedDate || "n/a", sortValue: (row) => (row as ExplorerFilmRow).exactWatchedDate },
    { key: "reviewRows", label: "Review rows", preferredDirection: "desc", render: (row) => formatInt((row as ExplorerFilmRow).reviewRows), sortValue: (row) => (row as ExplorerFilmRow).reviewRows },
    { key: "inWatchlist", label: "In watchlist", preferredDirection: "desc", render: (row) => (row as ExplorerFilmRow).inWatchlist ? "Yes" : "No", sortValue: (row) => (row as ExplorerFilmRow).inWatchlist },
  ];
}

function baseReviewColumns(): ExplorerColumn[] {
  return [
    { key: "title", label: "Title", preferredDirection: "asc", render: (row) => row.title, sortValue: (row) => row.title },
    { key: "year", label: "Year", preferredDirection: "desc", render: (row) => row.year === null ? "n/a" : String(row.year), sortValue: (row) => row.year },
    { key: "currentRating", label: "Current rating", preferredDirection: "desc", render: (row) => formatRating((row as ExplorerReviewRow).currentRating), sortValue: (row) => (row as ExplorerReviewRow).currentRating },
    { key: "loggedRating", label: "Logged rating", preferredDirection: "desc", render: (row) => formatRating((row as ExplorerReviewRow).loggedRating), sortValue: (row) => (row as ExplorerReviewRow).loggedRating },
    { key: "delta", label: "Delta", preferredDirection: "desc", render: (row) => formatDelta((row as ExplorerReviewRow).delta), sortValue: (row) => (row as ExplorerReviewRow).delta },
    { key: "exactWatchedDate", label: "Exact watched date", preferredDirection: "desc", render: (row) => (row as ExplorerReviewRow).exactWatchedDate || "n/a", sortValue: (row) => (row as ExplorerReviewRow).exactWatchedDate },
    { key: "reviewLength", label: "Review length", preferredDirection: "desc", render: (row) => formatInt((row as ExplorerReviewRow).reviewLength), sortValue: (row) => (row as ExplorerReviewRow).reviewLength },
    { key: "inWatchlist", label: "In watchlist", preferredDirection: "desc", render: (row) => (row as ExplorerReviewRow).inWatchlist ? "Yes" : "No", sortValue: (row) => (row as ExplorerReviewRow).inWatchlist },
  ];
}

function baseWatchEventColumns(): ExplorerColumn[] {
  return [
    { key: "title", label: "Title", preferredDirection: "asc", render: (row) => row.title, sortValue: (row) => row.title },
    { key: "year", label: "Year", preferredDirection: "desc", render: (row) => row.year === null ? "n/a" : String(row.year), sortValue: (row) => row.year },
    { key: "exactWatchedDate", label: "Exact watched date", preferredDirection: "desc", render: (row) => (row as ExactWatchEventRow).exactWatchedDate, sortValue: (row) => (row as ExactWatchEventRow).exactWatchedDate },
    { key: "currentRating", label: "Current rating", preferredDirection: "desc", render: (row) => formatRating((row as ExactWatchEventRow).currentRating), sortValue: (row) => (row as ExactWatchEventRow).currentRating },
    { key: "loggedRating", label: "Logged rating (row)", preferredDirection: "desc", render: (row) => formatRating((row as ExactWatchEventRow).loggedRating), sortValue: (row) => (row as ExactWatchEventRow).loggedRating },
    { key: "reviewPresent", label: "Review row", preferredDirection: "desc", render: (row) => (row as ExactWatchEventRow).reviewPresent ? "Yes" : "No", sortValue: (row) => (row as ExactWatchEventRow).reviewPresent },
    { key: "inWatchlist", label: "In watchlist", preferredDirection: "desc", render: (row) => (row as ExactWatchEventRow).inWatchlist ? "Yes" : "No", sortValue: (row) => (row as ExactWatchEventRow).inWatchlist },
    { key: "source", label: "Source", preferredDirection: "asc", render: (row) => (row as ExactWatchEventRow).source, sortValue: (row) => (row as ExactWatchEventRow).source },
    { key: "rewatch", label: "Rewatch", preferredDirection: "desc", render: (row) => (row as ExactWatchEventRow).rewatch ? "Yes" : "No", sortValue: (row) => (row as ExactWatchEventRow).rewatch },
  ];
}

function gridClass(payload: FilmExplorerPayload): string {
  if (payload.kind === "films") {
    return "explorerGridFilms";
  }
  if (payload.kind === "reviewRows") {
    return "explorerGridReviews";
  }
  return "explorerGridWatchEvents";
}

function sortLabel(columns: ExplorerColumn[], sortKey: string, direction: ExplorerSortDirection): string {
  const label = columns.find((column) => column.key === sortKey)?.label || sortKey;
  return `${label} (${direction === "asc" ? "ascending" : "descending"})`;
}

export default function FilmExplorer({
  payload,
  sortKey,
  direction,
  sourceSectionId,
  sourceSectionTitle,
  contextTrail,
  onSortChange,
  onClose,
  onExport,
  onToast,
}: {
  payload: FilmExplorerPayload | null;
  sortKey: string;
  direction: ExplorerSortDirection;
  sourceSectionId: string | null;
  sourceSectionTitle: string | null;
  contextTrail: Array<{ label: string; value: string }>;
  onSortChange: (key: string, direction: ExplorerSortDirection) => void;
  onClose: () => void;
  onExport: (rows: Array<Record<string, string | number | boolean | null>>, fileName: string) => void;
  onToast: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [renderedPayload, setRenderedPayload] = useState<FilmExplorerPayload | null>(payload);
  const [stage, setStage] = useState<"closed" | "opening" | "open" | "closing">(payload ? "open" : "closed");
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const deferredSearch = useDeferredValue(search);
  const displayPayload = payload || renderedPayload;

  useEffect(() => {
    if (payload) {
      setRenderedPayload(payload);
      setStage("opening");
      const frameId = window.requestAnimationFrame(() => setStage("open"));
      return () => window.cancelAnimationFrame(frameId);
    }
    if (renderedPayload) {
      setStage("closing");
      const timeoutId = window.setTimeout(() => {
        setRenderedPayload(null);
        setStage("closed");
      }, 220);
      return () => window.clearTimeout(timeoutId);
    }
    setStage("closed");
    return undefined;
  }, [payload]);

  useEffect(() => {
    setSearch("");
    setSelectedIds([]);
  }, [displayPayload?.kind, displayPayload?.title, displayPayload?.source]);

  useEffect(() => {
    if (!displayPayload) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [displayPayload, onClose]);

  useEffect(() => {
    if (stage === "open") {
      closeButtonRef.current?.focus();
    }
  }, [stage]);

  const columns = useMemo(() => {
    if (!displayPayload) {
      return [] as ExplorerColumn[];
    }
    if (displayPayload.kind === "films") {
      return baseFilmColumns();
    }
    if (displayPayload.kind === "reviewRows") {
      return baseReviewColumns();
    }
    return baseWatchEventColumns();
  }, [displayPayload]);

  const filteredRows = useMemo(() => {
    if (!displayPayload) {
      return [] as ExplorerRow[];
    }
    const normalized = deferredSearch.trim().toLowerCase();
    const column = columns.find((entry) => entry.key === sortKey) || columns[0];
    const rows = displayPayload.rows.filter((row) => {
      if (!normalized) {
        return true;
      }
      return [
        row.title,
        row.year === null ? "" : String(row.year),
        "exactWatchedDate" in row ? row.exactWatchedDate || "" : "",
      ].join(" ").toLowerCase().includes(normalized);
    });
    return [...rows].sort((left, right) => {
      const value = compareNullable(column.sortValue(left), column.sortValue(right));
      if (value !== 0) {
        return direction === "asc" ? value : -value;
      }
      return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
    });
  }, [columns, deferredSearch, direction, displayPayload, sortKey]);

  const selectedCount = selectedIds.filter((id) => filteredRows.some((row) => row.id === id)).length;
  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedIds.includes(row.id));

  function toggleSort(column: ExplorerColumn) {
    if (column.key === sortKey) {
      onSortChange(column.key, direction === "asc" ? "desc" : "asc");
      return;
    }
    onSortChange(column.key, column.preferredDirection);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id]);
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !filteredRows.some((row) => row.id === id)));
      return;
    }
    setSelectedIds((current) => Array.from(new Set([...current, ...filteredRows.map((row) => row.id)])));
  }

  async function copySelectedTitles() {
    if (!displayPayload || selectedCount === 0) {
      onToast("Select at least one row first.");
      return;
    }
    const text = collectExplorerTitles(displayPayload, selectedIds);
    if (!text) {
      onToast("No titles available for the current selection.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      onToast(`Copied ${selectedCount} selected title${selectedCount === 1 ? "" : "s"}.`);
    } catch {
      onToast("Copy failed.");
    }
  }

  if (!displayPayload) {
    return null;
  }

  return (
    <div
      className={`explorerOverlay is${stage[0].toUpperCase()}${stage.slice(1)}`}
      data-section={sourceSectionId || undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="explorer-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={`explorerPanel is${stage[0].toUpperCase()}${stage.slice(1)}`} data-section={sourceSectionId || undefined}>
        {contextTrail.length > 0 && (
          <div className="explorerTrail" aria-label="Drilldown context">
            {contextTrail.map((item) => (
              <span className="badge" key={`${item.label}:${item.value}`}>{item.label}: {item.value}</span>
            ))}
          </div>
        )}

        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="row" style={{ gap: 8 }}>
              {sourceSectionTitle && <span className="badge">From {sourceSectionTitle}</span>}
              <span className="badge">Row basis: {displayPayload.context.rowBasis}</span>
            </div>
            <h2 id="explorer-title">{displayPayload.title}</h2>
            <div className="small">{displayPayload.subtitle}</div>
          </div>
          <button className="btn danger" type="button" onClick={onClose} ref={closeButtonRef}>Close</button>
        </div>

        <div className="explorerSummary">
          <div className="explorerSummaryRow">
            <div className="small">Global context</div>
            <div>{displayPayload.context.globalContext}</div>
          </div>
          <div className="explorerSummaryRow">
            <div className="small">Active scope</div>
            <div>{displayPayload.context.activeScope}</div>
          </div>
          <div className="explorerSummaryRow">
            <div className="small">Drilldown source</div>
            <div>{displayPayload.context.drilldownSource}</div>
          </div>
          <div className="explorerSummaryRow">
            <div className="small">Current sort</div>
            <div>{sortLabel(columns, sortKey, direction)}</div>
          </div>
          <div className="explorerSummaryRow">
            <div className="small">Visible rows</div>
            <div>{formatInt(filteredRows.length)}</div>
          </div>
          <div className="explorerSummaryRow">
            <div className="small">Selected rows</div>
            <div>{formatInt(selectedCount)}</div>
          </div>
        </div>

        <div className="explorerToolbar">
          <label>
            <div className="small">Search</div>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, year, or exact date" />
          </label>
          <label>
            <div className="small">Sort by</div>
            <select value={sortKey} onChange={(event) => {
              const column = columns.find((item) => item.key === event.target.value);
              onSortChange(event.target.value, column?.preferredDirection || "asc");
            }}>
              {columns.map((column) => (
                <option value={column.key} key={column.key}>{column.label}</option>
              ))}
            </select>
          </label>
          <label>
            <div className="small">Direction</div>
            <select value={direction} onChange={(event) => onSortChange(sortKey, event.target.value as ExplorerSortDirection)}>
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
          <div className="row explorerToolbarActions">
            <span className="badge">Selected: {formatInt(selectedCount)}</span>
            <button className="btn" type="button" onClick={copySelectedTitles}>Copy selected titles</button>
            <button
              className="btn primary"
              type="button"
              onClick={() => onExport(
                buildExplorerExportRows({
                  ...displayPayload,
                  rows: filteredRows as never,
                } as FilmExplorerPayload),
                displayPayload.exportFileName,
              )}
            >
              Export CSV
            </button>
          </div>
        </div>

        {displayPayload.rows.length === 0 ? (
          <div className="explorerEmptyState">
            <h3>{displayPayload.context.emptyTitle}</h3>
            <p>{displayPayload.context.emptyBody}</p>
            {sourceSectionTitle && <div className="small">This drilldown was opened from {sourceSectionTitle}.</div>}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="explorerEmptyState">
            <h3>No rows match the current explorer filters</h3>
            <p>The underlying drilldown still exists, but the current search text removed every visible row.</p>
            <button className="btn" type="button" onClick={() => setSearch("")}>Clear search</button>
          </div>
        ) : (
          <div className="dataTableWrap" style={{ marginTop: 12 }}>
            <div className="dataTable explorerTable">
              <div className={`dataTableHead ${gridClass(displayPayload)}`}>
                <div>
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select all visible rows" />
                </div>
                {columns.map((column) => (
                  <button
                    type="button"
                    className="tableHeadButton"
                    key={column.key}
                    onClick={() => toggleSort(column)}
                  >
                    {column.label}
                    {sortKey === column.key && <span className="small"> {direction === "asc" ? "(asc)" : "(desc)"}</span>}
                  </button>
                ))}
                <div>Actions</div>
              </div>
              {filteredRows.map((row) => (
                <div className={`dataTableRow ${gridClass(displayPayload)}`} key={row.id}>
                  <div>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      onChange={() => toggleSelected(row.id)}
                      aria-label={`Select ${row.title}`}
                    />
                  </div>
                  {columns.map((column) => (
                    <div className={column.key === "title" ? "dataEllipsis" : ""} key={`${row.id}:${column.key}`}>
                      {column.render(row)}
                    </div>
                  ))}
                  <div>
                    {row.filmUrl ? (
                      <a className="explorerLink" href={row.filmUrl} target="_blank" rel="noreferrer">Open</a>
                    ) : (
                      <span className="small">n/a</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
