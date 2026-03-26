import {
  ANALYSIS_SCOPE_BASIS_LABELS,
  AnalysisScope,
  DEFAULT_ANALYSIS_SCOPE,
  RatingDriftSortKey,
} from "./stats";
import { ExplorerSortDirection } from "./explorer";

export const SAVED_VIEWS_STORAGE_KEY = "letterboxd-ai-review.saved-views.v1";

export type SavedViewSnapshot = {
  scope: AnalysisScope;
  explorerRoute: string | null;
  ratingDriftSort: RatingDriftSortKey;
  explorerSortKey: string;
  explorerSortDirection: ExplorerSortDirection;
};

export type SavedViewRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  snapshot: SavedViewSnapshot;
};

export type SavedViewPreset = {
  id: string;
  name: string;
  description: string;
  snapshot: SavedViewSnapshot;
};

function cloneScope(scope: AnalysisScope): AnalysisScope {
  return {
    basis: scope.basis,
    releaseDecade: scope.releaseDecade,
    releaseYearMin: scope.releaseYearMin,
    releaseYearMax: scope.releaseYearMax,
    currentRatingMin: scope.currentRatingMin,
    currentRatingMax: scope.currentRatingMax,
    loggedRatingMin: scope.loggedRatingMin,
    loggedRatingMax: scope.loggedRatingMax,
    reviewPresence: scope.reviewPresence,
  };
}

export function normaliseSavedViewSnapshot(snapshot: SavedViewSnapshot): SavedViewSnapshot {
  return {
    scope: cloneScope(snapshot.scope),
    explorerRoute: snapshot.explorerRoute || null,
    ratingDriftSort: snapshot.ratingDriftSort,
    explorerSortKey: snapshot.explorerSortKey || "title",
    explorerSortDirection: snapshot.explorerSortDirection === "desc" ? "desc" : "asc",
  };
}

export function areSavedViewSnapshotsEqual(left: SavedViewSnapshot, right: SavedViewSnapshot): boolean {
  const leftScope = normaliseSavedViewSnapshot(left).scope;
  const rightScope = normaliseSavedViewSnapshot(right).scope;
  return JSON.stringify({
    ...left,
    scope: leftScope,
  }) === JSON.stringify({
    ...right,
    scope: rightScope,
  });
}

function scopeSummary(scope: AnalysisScope): string {
  const parts: string[] = [];
  if (scope.basis !== DEFAULT_ANALYSIS_SCOPE.basis) {
    parts.push(`Basis: ${ANALYSIS_SCOPE_BASIS_LABELS[scope.basis]}`);
  }
  if (scope.releaseDecade) {
    parts.push(`Release decade: ${scope.releaseDecade}`);
  }
  if (scope.releaseYearMin !== null || scope.releaseYearMax !== null) {
    parts.push(`Release year range: ${scope.releaseYearMin ?? "?"} to ${scope.releaseYearMax ?? "?"}`);
  }
  if (scope.currentRatingMin !== null || scope.currentRatingMax !== null) {
    parts.push(`Current rating range: ${scope.currentRatingMin ?? "?"} to ${scope.currentRatingMax ?? "?"}`);
  }
  if (scope.loggedRatingMin !== null || scope.loggedRatingMax !== null) {
    parts.push(`Logged rating range: ${scope.loggedRatingMin ?? "?"} to ${scope.loggedRatingMax ?? "?"}`);
  }
  if (scope.reviewPresence !== DEFAULT_ANALYSIS_SCOPE.reviewPresence) {
    parts.push(`Review presence: ${scope.reviewPresence === "hasReview" ? "Has review" : "No review"}`);
  }
  return parts.join(" | ") || "Global default view";
}

function baseSnapshot(scope: AnalysisScope): SavedViewSnapshot {
  return {
    scope: cloneScope(scope),
    explorerRoute: null,
    ratingDriftSort: "largestAbsoluteChange",
    explorerSortKey: "title",
    explorerSortDirection: "asc",
  };
}

export const BUILTIN_SAVED_VIEW_PRESETS: SavedViewPreset[] = [
  {
    id: "preset_all_watched_films",
    name: "All watched films",
    description: "Film-level watched universe with no extra filters.",
    snapshot: baseSnapshot({ ...DEFAULT_ANALYSIS_SCOPE, basis: "watchedFilms" }),
  },
  {
    id: "preset_current_rated_films",
    name: "Current-rated films",
    description: "Films that currently have a ratings.csv snapshot.",
    snapshot: baseSnapshot({ ...DEFAULT_ANALYSIS_SCOPE, basis: "currentRatedFilms" }),
  },
  {
    id: "preset_logged_rated_films",
    name: "Logged-rated films",
    description: "Films with a diary/review-era logged rating.",
    snapshot: baseSnapshot({ ...DEFAULT_ANALYSIS_SCOPE, basis: "loggedRatedFilms" }),
  },
  {
    id: "preset_changed_drift_films",
    name: "Changed drift films",
    description: "Comparable films whose current rating changed from the logged rating.",
    snapshot: baseSnapshot({ ...DEFAULT_ANALYSIS_SCOPE, basis: "changedDriftFilms" }),
  },
  {
    id: "preset_reviewed_films",
    name: "Reviewed films",
    description: "Films that have at least one review row.",
    snapshot: baseSnapshot({ ...DEFAULT_ANALYSIS_SCOPE, basis: "reviewedFilms" }),
  },
  {
    id: "preset_exact_dated_watched_films",
    name: "Exact-dated watched films",
    description: "Watched films that have at least one exact diary/review watched date.",
    snapshot: baseSnapshot({ ...DEFAULT_ANALYSIS_SCOPE, basis: "exactDatedWatchedFilms" }),
  },
];

export function createSavedViewRecord(name: string, snapshot: SavedViewSnapshot, now = new Date().toISOString()): SavedViewRecord {
  return {
    id: `view_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || "Saved view",
    createdAt: now,
    updatedAt: now,
    snapshot: normaliseSavedViewSnapshot(snapshot),
  };
}

export function serializeSavedViews(views: SavedViewRecord[]): string {
  return JSON.stringify(
    views.map((view) => ({
      ...view,
      snapshot: normaliseSavedViewSnapshot(view.snapshot),
    })),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseScope(value: unknown): AnalysisScope | null {
  if (!isRecord(value)) {
    return null;
  }
  const basis = typeof value.basis === "string" ? value.basis : DEFAULT_ANALYSIS_SCOPE.basis;
  const reviewPresence = typeof value.reviewPresence === "string" ? value.reviewPresence : DEFAULT_ANALYSIS_SCOPE.reviewPresence;
  return {
    basis: basis as AnalysisScope["basis"],
    releaseDecade: typeof value.releaseDecade === "string" ? value.releaseDecade : null,
    releaseYearMin: typeof value.releaseYearMin === "number" ? value.releaseYearMin : null,
    releaseYearMax: typeof value.releaseYearMax === "number" ? value.releaseYearMax : null,
    currentRatingMin: typeof value.currentRatingMin === "number" ? value.currentRatingMin : null,
    currentRatingMax: typeof value.currentRatingMax === "number" ? value.currentRatingMax : null,
    loggedRatingMin: typeof value.loggedRatingMin === "number" ? value.loggedRatingMin : null,
    loggedRatingMax: typeof value.loggedRatingMax === "number" ? value.loggedRatingMax : null,
    reviewPresence: reviewPresence as AnalysisScope["reviewPresence"],
  };
}

export function parseSavedViews(raw: string | null): SavedViewRecord[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((value) => {
      if (!isRecord(value) || typeof value.name !== "string" || typeof value.id !== "string") {
        return [];
      }
      const scope = parseScope(isRecord(value.snapshot) ? value.snapshot.scope : null);
      if (!scope) {
        return [];
      }
      const snapshot: SavedViewSnapshot = normaliseSavedViewSnapshot({
        scope,
        explorerRoute: isRecord(value.snapshot) && typeof value.snapshot.explorerRoute === "string"
          ? value.snapshot.explorerRoute
          : null,
        ratingDriftSort: isRecord(value.snapshot) && typeof value.snapshot.ratingDriftSort === "string"
          ? value.snapshot.ratingDriftSort as RatingDriftSortKey
          : "largestAbsoluteChange",
        explorerSortKey: isRecord(value.snapshot) && typeof value.snapshot.explorerSortKey === "string"
          ? value.snapshot.explorerSortKey
          : "title",
        explorerSortDirection: isRecord(value.snapshot) && value.snapshot.explorerSortDirection === "desc"
          ? "desc"
          : "asc",
      });
      return [{
        id: value.id,
        name: value.name.trim() || "Saved view",
        createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
        updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
        snapshot,
      }];
    });
  } catch {
    return [];
  }
}

export function buildSavedViewSummaryText(view: SavedViewRecord | SavedViewPreset): string {
  const scopeText = scopeSummary(view.snapshot.scope);
  return [
    view.name,
    `Scope: ${scopeText}`,
    `Drilldown route: ${view.snapshot.explorerRoute || "none"}`,
    `Rating drift sort: ${view.snapshot.ratingDriftSort}`,
    `Explorer sort: ${view.snapshot.explorerSortKey} (${view.snapshot.explorerSortDirection})`,
  ].join("\n");
}
