import { ExplorerFilmRow, ExplorerReviewRow } from "./stats";
import { ExactWatchEventRow } from "./watchActivity";

export type ExplorerSortDirection = "asc" | "desc";

export type ExplorerContext = {
  globalContext: string;
  activeScope: string;
  drilldownSource: string;
  rowBasis: string;
  emptyTitle: string;
  emptyBody: string;
};

export type FilmExplorerPayload =
  | {
    kind: "films";
    title: string;
    subtitle: string;
    source: string;
    exportFileName: string;
    context: ExplorerContext;
    rows: ExplorerFilmRow[];
  }
  | {
    kind: "reviewRows";
    title: string;
    subtitle: string;
    source: string;
    exportFileName: string;
    context: ExplorerContext;
    rows: ExplorerReviewRow[];
  }
  | {
    kind: "watchEvents";
    title: string;
    subtitle: string;
    source: string;
    exportFileName: string;
    context: ExplorerContext;
    rows: ExactWatchEventRow[];
  };

export function defaultExplorerSort(payload: FilmExplorerPayload | null): {
  key: string;
  direction: ExplorerSortDirection;
} {
  if (!payload) {
    return { key: "title", direction: "asc" };
  }
  if (payload.kind === "reviewRows") {
    return { key: "reviewLength", direction: "desc" };
  }
  if (payload.kind === "watchEvents") {
    return { key: "exactWatchedDate", direction: "desc" };
  }
  return { key: "title", direction: "asc" };
}

export function buildExplorerExportRows(
  payload: FilmExplorerPayload,
): Array<Record<string, string | number | boolean | null>> {
  if (payload.kind === "films") {
    return payload.rows.map((row) => ({
      title: row.title,
      year: row.year,
      current_rating: row.currentRating,
      logged_rating: row.loggedRating,
      delta: row.delta,
      exact_watched_date: row.exactWatchedDate,
      review_rows: row.reviewRows,
      longest_review_length: row.longestReviewLength,
      in_watchlist: row.inWatchlist,
      watchlist_added_date: row.watchlistAddedDate,
      film_url: row.filmUrl,
    }));
  }
  if (payload.kind === "reviewRows") {
    return payload.rows.map((row) => ({
      title: row.title,
      year: row.year,
      current_rating: row.currentRating,
      logged_rating: row.loggedRating,
      delta: row.delta,
      exact_watched_date: row.exactWatchedDate,
      review_length: row.reviewLength,
      in_watchlist: row.inWatchlist,
      film_url: row.filmUrl,
    }));
  }
  return payload.rows.map((row) => ({
    title: row.title,
    year: row.year,
    exact_watched_date: row.exactWatchedDate,
    current_rating: row.currentRating,
    logged_rating: row.loggedRating,
    review_present: row.reviewPresent,
    in_watchlist: row.inWatchlist,
    source: row.source,
    rewatch: row.rewatch,
    film_url: row.filmUrl,
  }));
}

export function collectExplorerTitles(
  payload: FilmExplorerPayload,
  selectedIds: string[],
): string {
  const selected = new Set(selectedIds);
  const titles = payload.rows
    .filter((row) => selected.has(row.id))
    .map((row) => row.title);
  return Array.from(new Set(titles)).join("\n");
}
