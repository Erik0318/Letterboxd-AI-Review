import { DatasetSummary, FilmRecord, getBestTimelineDates, isWatchedFilm } from "./letterboxd";
import {
  clamp,
  formatInt,
  formatPct,
  mean,
  median,
  round1,
  round3,
  stddev,
} from "./utils";

type CountMetric = {
  value: number;
  basis: string;
};

type RatingSummary = {
  basis: string;
  filmCount: number;
  mean: number | null;
  median: number | null;
  stddev: number | null;
  histogram: Array<{ rating: number; count: number }>;
};

type ReleaseDistribution = {
  basis: string;
  uniqueFilmCount: number;
  topYears: Array<{ year: number; count: number }>;
  span: { min: number | null; max: number | null };
  decadeBuckets: Array<{ decade: string; count: number }>;
};

export type RatingDriftSortKey =
  | "biggestDowngrade"
  | "biggestUpgrade"
  | "largestAbsoluteChange";

export type RatingDriftDirection = "unchanged" | "upgraded" | "downgraded";

export type RatingDriftCase = {
  filmKey: string;
  name: string;
  year: number | null;
  loggedRating: number;
  currentRating: number;
  delta: number;
  absoluteDelta: number;
  direction: RatingDriftDirection;
};

export type RatingDriftSummary = {
  comparableFilms: CountMetric;
  unchanged: CountMetric;
  changed: CountMetric;
  upgraded: CountMetric;
  downgraded: CountMetric;
  meanDelta: {
    value: number | null;
    basis: string;
  };
};

export type RatingDrift = {
  summary: RatingDriftSummary;
  semantics: {
    loggedRating: string;
    currentRating: string;
    delta: string;
  };
  lists: Record<RatingDriftSortKey, RatingDriftCase[]>;
};

export type BacklogDecadeComparisonRow = {
  decade: string;
  watchedFilms: number;
  watchlistFilms: number;
  combinedFilms: number;
  watchlistShare: number | null;
};

export type BacklogStats = {
  summary: {
    watchlistFilms: CountMetric;
    watchlistRows: CountMetric;
    watchlistFilmsWithAddDate: CountMetric;
    watchlistFilmsWithoutAddDate: CountMetric;
  };
  timeline: {
    byMonth: Array<{ month: string; count: number }>;
    watchlistFilmsWithAddDate: number;
    basis: string;
  };
  releaseYears: ReleaseDistribution;
  comparison: {
    watchedVsWatchlistByDecade: BacklogDecadeComparisonRow[];
  };
};

export type ReviewLengthBucket = {
  bucket: string;
  count: number;
};

export type ReviewLengthRow = {
  id: string;
  filmKey: string;
  name: string;
  year: number | null;
  length: number;
};

export type ReviewStats = {
  summary: {
    reviewRows: CountMetric;
    reviewTextRows: CountMetric;
    reviewedFilms: CountMetric;
    reviewRate: {
      value: number;
      label: string;
      basis: string;
    };
    averageReviewLength: {
      value: number | null;
      basis: string;
    };
    medianReviewLength: {
      value: number | null;
      basis: string;
    };
    longestReviewLength: CountMetric;
  };
  lengthBuckets: ReviewLengthBucket[];
  longestReviews: ReviewLengthRow[];
  topWords: Array<{ word: string; count: number }>;
};

export type DecadeRatingRow = {
  decade: string;
  watchedFilms: number;
  currentRatedFilms: number;
  currentMeanRating: number | null;
  loggedRatedFilms: number;
  loggedMeanRating: number | null;
};

export type ReleaseAnalyticsStats = {
  summary: {
    highestCurrentRatedDecade: {
      decade: string;
      meanRating: number;
      ratedFilms: number;
    } | null;
    highestLoggedRatedDecade: {
      decade: string;
      meanRating: number;
      ratedFilms: number;
    } | null;
  };
  decadeRatings: DecadeRatingRow[];
};

export type ArchiveScopeRow = {
  scope: "deleted" | "orphaned";
  diaryRows: number;
  reviewRows: number;
  commentRows: number;
  listFiles: number;
  uniqueFilmCount: number;
};

export type ArchiveListRow = {
  path: string;
  scope: "active" | "deleted" | "orphaned";
  title: string | null;
  itemCount: number;
  createdDate: string | null;
  exportedDate: string | null;
  tags: string[];
  parseError: string | null;
};

export type ArchiveListStats = {
  summary: {
    deletedDiaryRows: CountMetric;
    deletedReviewRows: CountMetric;
    orphanedDiaryRows: CountMetric;
    orphanedReviewRows: CountMetric;
    activeLists: CountMetric;
    archivedLists: CountMetric;
  };
  archiveScopes: ArchiveScopeRow[];
  lists: ArchiveListRow[];
};

export type AnalysisScopeBasis =
  | "globalDefault"
  | "watchedFilms"
  | "currentRatedFilms"
  | "loggedRatedFilms"
  | "reviewedFilms"
  | "exactDatedWatchedFilms"
  | "comparableDriftFilms"
  | "changedDriftFilms"
  | "upgradedDriftFilms"
  | "downgradedDriftFilms";

export type ReviewPresenceFilter = "all" | "hasReview" | "noReview";

export type AnalysisScope = {
  basis: AnalysisScopeBasis;
  releaseDecade: string | null;
  releaseYearMin: number | null;
  releaseYearMax: number | null;
  currentRatingMin: number | null;
  currentRatingMax: number | null;
  loggedRatingMin: number | null;
  loggedRatingMax: number | null;
  reviewPresence: ReviewPresenceFilter;
};

export const DEFAULT_ANALYSIS_SCOPE: AnalysisScope = {
  basis: "globalDefault",
  releaseDecade: null,
  releaseYearMin: null,
  releaseYearMax: null,
  currentRatingMin: null,
  currentRatingMax: null,
  loggedRatingMin: null,
  loggedRatingMax: null,
  reviewPresence: "all",
};

export type ScopeFilterChip = {
  key: string;
  label: string;
  value: string;
};

export type ScopeCounts = {
  basisFilms: number;
  matchingFilms: number;
  currentRatedFilms: number;
  loggedRatedFilms: number;
  reviewedFilms: number;
  exactDatedWatchedFilms: number;
  comparableDriftFilms: number;
  changedDriftFilms: number;
  upgradedDriftFilms: number;
  downgradedDriftFilms: number;
};

export type ShareCardSummary = {
  watchedFilmsUnique: number;
  exactDatedWatchedFilms: number;
  watchedFilmsWithoutExactDate: number;
  currentRatedFilms: number;
  currentMeanRating: number | null;
  currentMedianRating: number | null;
  bestStreakDays: number;
  commitmentIndex: number;
  topWords: string[];
  oneLine: string;
};

export type ExplorerFilmRow = {
  kind: "film";
  id: string;
  filmKey: string;
  title: string;
  year: number | null;
  filmUrl: string | null;
  currentRating: number | null;
  loggedRating: number | null;
  delta: number | null;
  exactWatchedDate: string | null;
  reviewRows: number;
  longestReviewLength: number | null;
  inWatchlist: boolean;
  watchlistAddedDate: string | null;
};

export type ExplorerReviewRow = {
  kind: "reviewRow";
  id: string;
  filmKey: string;
  title: string;
  year: number | null;
  filmUrl: string | null;
  currentRating: number | null;
  loggedRating: number | null;
  delta: number | null;
  exactWatchedDate: string | null;
  reviewLength: number;
  inWatchlist: boolean;
};

export type ScopedView = {
  generatedAt: string;
  scope: {
    activeScope: AnalysisScope;
    isActive: boolean;
    basisLabel: string;
    appliedFilters: ScopeFilterChip[];
    summary: string;
    counts: ScopeCounts;
  };
  overview: {
    scopedFilms: CountMetric;
    currentRatedFilms: CountMetric;
    loggedRatedFilms: CountMetric;
    reviewedFilms: CountMetric;
    exactDatedWatchedFilms: CountMetric;
    currentMeanRating: {
      value: number | null;
      basis: string;
    };
    meanDelta: {
      value: number | null;
      basis: string;
    };
  };
  ratings: {
    current: RatingSummary;
    logged: RatingSummary;
  };
  ratingDrift: RatingDrift;
  reviews: ReviewStats;
  releaseAnalytics: ReleaseAnalyticsStats;
  releaseDistribution: ReleaseDistribution;
  shareCard: ShareCardSummary;
  shareText: {
    short: string;
    long: string;
  };
  filmRows: ExplorerFilmRow[];
  reviewRows: ExplorerReviewRow[];
  panelNotes: {
    activity: string | null;
    backlog: string | null;
    archives: string | null;
  };
};

export type DataQualityStats = {
  summary: {
    exactDatedWatchedFilms: CountMetric;
    watchedFilmsWithoutExactDate: CountMetric;
    comparableDriftFilms: CountMetric;
    changedRatingFilms: CountMetric;
    currentOnlyRatedFilms: CountMetric;
    loggedOnlyRatedFilms: CountMetric;
  };
  duplicateRows: {
    watchedRowsBeyondUniqueFilms: CountMetric;
    ratingRowsBeyondUniqueFilms: CountMetric;
    reviewRowsBeyondUniqueFilms: CountMetric;
    watchlistRowsBeyondUniqueFilms: CountMetric;
  };
  fieldCoverage: {
    taggedFilms: CountMetric;
    rewatchEvents: CountMetric;
    commentsRows: CountMetric;
    likesRows: CountMetric;
  };
  moduleCoverage: Array<{
    id: "watchedTimeline" | "ratingDrift" | "reviewText" | "watchlistTimeline";
    label: string;
    covered: number;
    total: number;
    coverage: number | null;
    note: string;
  }>;
  tables: {
    core: Array<{ label: string; path: string; present: boolean; rows: number }>;
    optionalGroups: Array<{ label: string; present: boolean; detail: string }>;
  };
  importLog: {
    topDay: string | null;
    topDayCount: number;
    spikeDetected: boolean;
    basis: string;
  };
};

export type StatPack = {
  generatedAt: string;
  overview: {
    watchedFilmsUnique: CountMetric;
    exactDatedWatchedFilms: CountMetric;
    watchedFilmsWithoutExactDate: CountMetric;
    currentRatedFilms: CountMetric;
    currentMeanRating: {
      value: number | null;
      basis: string;
    };
    bestStreakDays: {
      value: number;
      basis: string;
    };
  };
  quickFacts: {
    watchedRows: CountMetric;
    unratedWatchedFilmsWithoutCurrentRating: CountMetric;
    loggedRatedFilms: CountMetric;
    reviewRows: CountMetric;
    watchlistFilms: CountMetric;
    commitmentIndex: {
      value: number;
      basis: string;
    };
    currentRatingStddev: {
      value: number | null;
      basis: string;
    };
  };
  ratings: {
    current: RatingSummary;
    logged: RatingSummary;
  };
  ratingDrift: RatingDrift;
  backlog: BacklogStats;
  reviews: ReviewStats;
  releaseAnalytics: ReleaseAnalyticsStats;
  archives: ArchiveListStats;
  activity: {
    heatmap: {
      byMonth: Array<{ month: string; count: number }>;
      exactWatchEvents: number;
      exactDatedWatchedFilms: number;
      basis: string;
    };
    byMonth: Array<{ month: string; count: number }>;
    byDay: Array<{ day: string; count: number }>;
    longestStreakDays: number;
    busiestDay: { day: string; count: number } | null;
    recent90: {
      exactWatchEvents: number;
      exactDatedWatchedFilms: number;
      currentRatedFilms: number;
      meanCurrentRating: number | null;
    };
  };
  releaseYears: {
    watchedFilms: ReleaseDistribution;
    watchlistFilms: ReleaseDistribution;
  };
  text: {
    topWords: Array<{ word: string; count: number }>;
    avgReviewLength: number | null;
    medianReviewLength: number | null;
  };
  fun: {
    tasteVolatilityIndex: number | null;
    commitmentIndex: number;
    chaosIndex: number | null;
    badge: string;
  };
  dataQuality: DataQualityStats;
  shareCard: ShareCardSummary;
  shareText: {
    short: string;
    long: string;
  };
};

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "so", "to", "of", "in", "on", "at", "for", "with", "as", "is", "are", "was", "were",
  "i", "you", "he", "she", "they", "we", "me", "my", "your", "his", "her", "their", "our",
  "this", "that", "these", "those", "it", "its",
  "film", "movie", "watch", "watched", "rating", "stars",
  "very", "really", "just", "like", "love", "good", "great", "bad", "dont", "didnt", "cant", "wont", "im", "ive", "ill",
]);

export const ANALYSIS_SCOPE_BASIS_LABELS: Record<AnalysisScopeBasis, string> = {
  globalDefault: "Global default",
  watchedFilms: "Watched films",
  currentRatedFilms: "Current-rated films",
  loggedRatedFilms: "Logged-rated films",
  reviewedFilms: "Reviewed films",
  exactDatedWatchedFilms: "Exact-dated watched films",
  comparableDriftFilms: "Comparable drift films",
  changedDriftFilms: "Changed drift films",
  upgradedDriftFilms: "Upgraded drift films",
  downgradedDriftFilms: "Downgraded drift films",
};

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\u00c0-\u02af\u0400-\u04ff\u4e00-\u9fff\s]/g, " ")
    .split(/\s+/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 3 && value.length <= 24);
}

function ratingBucketsHalfStars(): number[] {
  const out: number[] = [];
  for (let rating = 0.5; rating <= 5; rating += 0.5) {
    out.push(Math.round(rating * 10) / 10);
  }
  return out;
}

function buildHistogram(ratings: number[]): Array<{ rating: number; count: number }> {
  const buckets = ratingBucketsHalfStars();
  const map = new Map<number, number>(buckets.map((bucket) => [bucket, 0]));
  for (const rating of ratings) {
    const snapped = Math.round(rating * 2) / 2;
    if (map.has(snapped)) {
      map.set(snapped, (map.get(snapped) || 0) + 1);
    }
  }
  return buckets.map((rating) => ({ rating, count: map.get(rating) || 0 }));
}

function makeRatingSummary(ratings: number[], basis: string): RatingSummary {
  return {
    basis,
    filmCount: ratings.length,
    mean: mean(ratings),
    median: median(ratings),
    stddev: stddev(ratings),
    histogram: buildHistogram(ratings),
  };
}

function countByDay(dates: string[]): Array<{ day: string; count: number }> {
  const map = new Map<string, number>();
  for (const date of dates) {
    map.set(date, (map.get(date) || 0) + 1);
  }
  return [...map.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([day, count]) => ({ day, count }));
}

function countByMonth(dates: string[]): Array<{ month: string; count: number }> {
  const map = new Map<string, number>();
  for (const date of dates) {
    const month = date.slice(0, 7);
    map.set(month, (map.get(month) || 0) + 1);
  }
  return [...map.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([month, count]) => ({ month, count }));
}

function dateToEpochDay(iso: string): number {
  const date = new Date(`${iso}T00:00:00Z`);
  return Math.floor(date.getTime() / 86400000);
}

function computeLongestStreak(days: string[]): number {
  if (!days.length) {
    return 0;
  }
  const uniqueDays = Array.from(new Set(days)).sort();
  let best = 1;
  let current = 1;
  for (let index = 1; index < uniqueDays.length; index += 1) {
    const previous = dateToEpochDay(uniqueDays[index - 1]);
    const next = dateToEpochDay(uniqueDays[index]);
    if (next === previous + 1) {
      current += 1;
    } else {
      current = 1;
    }
    if (current > best) {
      best = current;
    }
  }
  return best;
}

function busiestDay(days: Array<{ day: string; count: number }>): { day: string; count: number } | null {
  if (!days.length) {
    return null;
  }
  return days.reduce((best, current) => {
    if (current.count > best.count) {
      return current;
    }
    if (current.count === best.count && current.day < best.day) {
      return current;
    }
    return best;
  });
}

function topYearsForFilms(films: FilmRecord[]): Array<{ year: number; count: number }> {
  const map = new Map<number, number>();
  for (const film of films) {
    if (film.year === null) {
      continue;
    }
    map.set(film.year, (map.get(film.year) || 0) + 1);
  }
  return [...map.entries()]
    .sort((left, right) => right[1] - left[1] || left[0] - right[0])
    .slice(0, 10)
    .map(([year, count]) => ({ year, count }));
}

function spanForFilms(films: FilmRecord[]): { min: number | null; max: number | null } {
  const years = films.map((film) => film.year).filter((year): year is number => year !== null);
  if (!years.length) {
    return { min: null, max: null };
  }
  return { min: Math.min(...years), max: Math.max(...years) };
}

function decadeBucketsForFilms(films: FilmRecord[]): Array<{ decade: string; count: number }> {
  const map = new Map<string, number>();
  for (const film of films) {
    if (film.year === null) {
      continue;
    }
    const decade = Math.floor(film.year / 10) * 10;
    const key = `${decade}s`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([decade, count]) => ({ decade, count }));
}

function makeReleaseDistribution(films: FilmRecord[], basis: string): ReleaseDistribution {
  return {
    basis,
    uniqueFilmCount: films.length,
    topYears: topYearsForFilms(films),
    span: spanForFilms(films),
    decadeBuckets: decadeBucketsForFilms(films),
  };
}

function compareNullableYearAsc(left: number | null, right: number | null): number {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return left - right;
}

function compareRatingDriftName(left: RatingDriftCase, right: RatingDriftCase): number {
  const byName = left.name.localeCompare(right.name);
  if (byName !== 0) {
    return byName;
  }
  const byYear = compareNullableYearAsc(left.year, right.year);
  if (byYear !== 0) {
    return byYear;
  }
  return left.filmKey.localeCompare(right.filmKey);
}

function compareBiggestDowngrade(left: RatingDriftCase, right: RatingDriftCase): number {
  const byDelta = left.delta - right.delta;
  if (byDelta !== 0) {
    return byDelta;
  }
  const byAbs = right.absoluteDelta - left.absoluteDelta;
  if (byAbs !== 0) {
    return byAbs;
  }
  return compareRatingDriftName(left, right);
}

function compareBiggestUpgrade(left: RatingDriftCase, right: RatingDriftCase): number {
  const byDelta = right.delta - left.delta;
  if (byDelta !== 0) {
    return byDelta;
  }
  const byAbs = right.absoluteDelta - left.absoluteDelta;
  if (byAbs !== 0) {
    return byAbs;
  }
  return compareRatingDriftName(left, right);
}

function compareLargestAbsoluteChange(left: RatingDriftCase, right: RatingDriftCase): number {
  const byAbs = right.absoluteDelta - left.absoluteDelta;
  if (byAbs !== 0) {
    return byAbs;
  }
  return compareRatingDriftName(left, right);
}

export function buildRatingDrift(films: FilmRecord[]): RatingDrift {
  const epsilon = 1e-9;
  const comparable = films
    .filter((film) => film.currentRating !== null && film.loggedRating !== null)
    .map((film) => {
      const currentRating = film.currentRating as number;
      const loggedRating = film.loggedRating as number;
      const delta = currentRating - loggedRating;
      const absoluteDelta = Math.abs(delta);
      let direction: RatingDriftDirection = "unchanged";
      if (delta > epsilon) {
        direction = "upgraded";
      } else if (delta < -epsilon) {
        direction = "downgraded";
      }

      return {
        filmKey: film.filmKey,
        name: film.name,
        year: film.year,
        loggedRating,
        currentRating,
        delta,
        absoluteDelta,
        direction,
      };
    });

  const changed = comparable.filter((film) => film.absoluteDelta > epsilon);
  const upgraded = changed.filter((film) => film.direction === "upgraded");
  const downgraded = changed.filter((film) => film.direction === "downgraded");
  const unchanged = comparable.length - changed.length;

  return {
    summary: {
      comparableFilms: {
        value: comparable.length,
        basis: "unique films that have both loggedRating and currentRating",
      },
      unchanged: {
        value: unchanged,
        basis: "comparable films where currentRating equals loggedRating",
      },
      changed: {
        value: changed.length,
        basis: "comparable films where currentRating differs from loggedRating",
      },
      upgraded: {
        value: upgraded.length,
        basis: "comparable films where currentRating is higher than loggedRating",
      },
      downgraded: {
        value: downgraded.length,
        basis: "comparable films where currentRating is lower than loggedRating",
      },
      meanDelta: {
        value: mean(comparable.map((film) => film.delta)),
        basis: "mean of currentRating - loggedRating across comparable films",
      },
    },
    semantics: {
      loggedRating: "rating recorded in diary/review at the time",
      currentRating: "rating from ratings.csv current snapshot",
      delta: "currentRating - loggedRating",
    },
    lists: {
      biggestDowngrade: [...downgraded].sort(compareBiggestDowngrade),
      biggestUpgrade: [...upgraded].sort(compareBiggestUpgrade),
      largestAbsoluteChange: [...changed].sort(compareLargestAbsoluteChange),
    },
  };
}

function isReviewPresent(film: FilmRecord): boolean {
  return film.reviewRows > 0;
}

function filmDelta(film: Pick<FilmRecord, "currentRating" | "loggedRating">): number | null {
  if (film.currentRating === null || film.loggedRating === null) {
    return null;
  }
  return film.currentRating - film.loggedRating;
}

function matchesNumericRange(value: number | null, min: number | null, max: number | null): boolean {
  if (min === null && max === null) {
    return true;
  }
  if (value === null) {
    return false;
  }
  if (min !== null && value < min) {
    return false;
  }
  if (max !== null && value > max) {
    return false;
  }
  return true;
}

function matchesScopeBasis(film: FilmRecord, basis: AnalysisScopeBasis): boolean {
  const delta = filmDelta(film);
  switch (basis) {
    case "globalDefault":
      return true;
    case "watchedFilms":
      return isWatchedFilm(film);
    case "currentRatedFilms":
      return film.currentRating !== null;
    case "loggedRatedFilms":
      return film.loggedRating !== null;
    case "reviewedFilms":
      return isReviewPresent(film);
    case "exactDatedWatchedFilms":
      return film.exactWatchedDate !== null;
    case "comparableDriftFilms":
      return delta !== null;
    case "changedDriftFilms":
      return delta !== null && Math.abs(delta) > 1e-9;
    case "upgradedDriftFilms":
      return delta !== null && delta > 1e-9;
    case "downgradedDriftFilms":
      return delta !== null && delta < -1e-9;
  }
}

export function isAnalysisScopeActive(scope: AnalysisScope): boolean {
  return scope.basis !== DEFAULT_ANALYSIS_SCOPE.basis
    || scope.releaseDecade !== null
    || scope.releaseYearMin !== null
    || scope.releaseYearMax !== null
    || scope.currentRatingMin !== null
    || scope.currentRatingMax !== null
    || scope.loggedRatingMin !== null
    || scope.loggedRatingMax !== null
    || scope.reviewPresence !== DEFAULT_ANALYSIS_SCOPE.reviewPresence;
}

function buildScopeFilterChips(scope: AnalysisScope): ScopeFilterChip[] {
  const chips: ScopeFilterChip[] = [];
  if (scope.basis !== "globalDefault") {
    chips.push({
      key: "basis",
      label: "Basis",
      value: ANALYSIS_SCOPE_BASIS_LABELS[scope.basis],
    });
  }
  if (scope.releaseDecade) {
    chips.push({
      key: "releaseDecade",
      label: "Release decade",
      value: scope.releaseDecade,
    });
  }
  if (scope.releaseYearMin !== null || scope.releaseYearMax !== null) {
    chips.push({
      key: "releaseYearRange",
      label: "Release year range",
      value: `${scope.releaseYearMin ?? "?"} to ${scope.releaseYearMax ?? "?"}`,
    });
  }
  if (scope.currentRatingMin !== null || scope.currentRatingMax !== null) {
    chips.push({
      key: "currentRatingRange",
      label: "Current rating range",
      value: `${scope.currentRatingMin ?? "?"} to ${scope.currentRatingMax ?? "?"}`,
    });
  }
  if (scope.loggedRatingMin !== null || scope.loggedRatingMax !== null) {
    chips.push({
      key: "loggedRatingRange",
      label: "Logged rating range",
      value: `${scope.loggedRatingMin ?? "?"} to ${scope.loggedRatingMax ?? "?"}`,
    });
  }
  if (scope.reviewPresence !== "all") {
    chips.push({
      key: "reviewPresence",
      label: "Review presence",
      value: scope.reviewPresence === "hasReview" ? "Has review" : "No review",
    });
  }
  return chips;
}

function scopeSummaryText(scope: AnalysisScope): string {
  const chips = buildScopeFilterChips(scope);
  if (!chips.length) {
    return "Global default view.";
  }
  return chips.map((chip) => `${chip.label}: ${chip.value}`).join(" | ");
}

export function applyAnalysisScope(films: FilmRecord[], scope: AnalysisScope): {
  films: FilmRecord[];
  basisFilms: FilmRecord[];
  chips: ScopeFilterChip[];
  summary: string;
} {
  const basisFilms = films.filter((film) => matchesScopeBasis(film, scope.basis));
  const filtered = basisFilms.filter((film) => {
    if (scope.releaseDecade) {
      if (film.year === null || toDecadeLabel(film.year) !== scope.releaseDecade) {
        return false;
      }
    }
    if (scope.releaseYearMin !== null) {
      if (film.year === null || film.year < scope.releaseYearMin) {
        return false;
      }
    }
    if (scope.releaseYearMax !== null) {
      if (film.year === null || film.year > scope.releaseYearMax) {
        return false;
      }
    }
    if (!matchesNumericRange(film.currentRating, scope.currentRatingMin, scope.currentRatingMax)) {
      return false;
    }
    if (!matchesNumericRange(film.loggedRating, scope.loggedRatingMin, scope.loggedRatingMax)) {
      return false;
    }
    if (scope.reviewPresence === "hasReview" && !isReviewPresent(film)) {
      return false;
    }
    if (scope.reviewPresence === "noReview" && isReviewPresent(film)) {
      return false;
    }
    return true;
  });

  return {
    films: filtered,
    basisFilms,
    chips: buildScopeFilterChips(scope),
    summary: describeScope(scope),
  };
}

function describeScope(scope: AnalysisScope): string {
  const chips = buildScopeFilterChips(scope);
  if (!chips.length) {
    return "Global default view";
  }
  return chips.map((chip) => `${chip.label}: ${chip.value}`).join(" | ");
}

function buildScopeCounts(basisFilms: FilmRecord[], scopedFilms: FilmRecord[]): ScopeCounts {
  const scopedDrift = buildRatingDrift(scopedFilms);
  return {
    basisFilms: basisFilms.length,
    matchingFilms: scopedFilms.length,
    currentRatedFilms: scopedFilms.filter((film) => film.currentRating !== null).length,
    loggedRatedFilms: scopedFilms.filter((film) => film.loggedRating !== null).length,
    reviewedFilms: scopedFilms.filter((film) => isReviewPresent(film)).length,
    exactDatedWatchedFilms: scopedFilms.filter((film) => film.exactWatchedDate !== null).length,
    comparableDriftFilms: scopedDrift.summary.comparableFilms.value,
    changedDriftFilms: scopedDrift.summary.changed.value,
    upgradedDriftFilms: scopedDrift.summary.upgraded.value,
    downgradedDriftFilms: scopedDrift.summary.downgraded.value,
  };
}

function earliestIsoDate(dates: string[]): string | null {
  if (!dates.length) {
    return null;
  }
  return [...dates].sort()[0];
}

function compareDecadeLabelAsc(left: string, right: string): number {
  return left.localeCompare(right);
}

function toDecadeLabel(year: number): string {
  const decade = Math.floor(year / 10) * 10;
  return `${decade}s`;
}

function decadeCountMap(films: FilmRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const film of films) {
    if (film.year === null) {
      continue;
    }
    const decade = toDecadeLabel(film.year);
    map.set(decade, (map.get(decade) || 0) + 1);
  }
  return map;
}

function buildBacklogDecadeComparison(
  watchedFilms: FilmRecord[],
  watchlistFilms: FilmRecord[],
): BacklogDecadeComparisonRow[] {
  const watchedMap = decadeCountMap(watchedFilms);
  const watchlistMap = decadeCountMap(watchlistFilms);
  const decades = new Set<string>([...watchedMap.keys(), ...watchlistMap.keys()]);

  return [...decades]
    .map((decade) => {
      const watchedCount = watchedMap.get(decade) || 0;
      const watchlistCount = watchlistMap.get(decade) || 0;
      const combinedFilms = watchedCount + watchlistCount;
      return {
        decade,
        watchedFilms: watchedCount,
        watchlistFilms: watchlistCount,
        combinedFilms,
        watchlistShare: combinedFilms ? watchlistCount / combinedFilms : null,
      };
    })
    .sort((left, right) =>
      right.combinedFilms - left.combinedFilms
      || compareDecadeLabelAsc(left.decade, right.decade))
    .slice(0, 12);
}

const REVIEW_LENGTH_BUCKETS = [
  { label: "1-99", min: 1, max: 99 },
  { label: "100-299", min: 100, max: 299 },
  { label: "300-599", min: 300, max: 599 },
  { label: "600-999", min: 600, max: 999 },
  { label: "1,000+", min: 1000, max: Number.POSITIVE_INFINITY },
];

function bucketReviewLength(length: number): string {
  for (const bucket of REVIEW_LENGTH_BUCKETS) {
    if (length >= bucket.min && length <= bucket.max) {
      return bucket.label;
    }
  }
  return "1-99";
}

function buildReviewLengthBuckets(lengths: number[]): ReviewLengthBucket[] {
  const map = new Map<string, number>(REVIEW_LENGTH_BUCKETS.map((bucket) => [bucket.label, 0]));
  for (const length of lengths) {
    const bucket = bucketReviewLength(length);
    map.set(bucket, (map.get(bucket) || 0) + 1);
  }
  return REVIEW_LENGTH_BUCKETS.map((bucket) => ({
    bucket: bucket.label,
    count: map.get(bucket.label) || 0,
  }));
}

function buildReviewRows(films: FilmRecord[]): ReviewLengthRow[] {
  const rows: ReviewLengthRow[] = [];
  for (const film of films) {
    for (let index = 0; index < film.reviewTexts.length; index += 1) {
      const reviewText = film.reviewTexts[index];
      rows.push({
        id: `${film.filmKey}:${index}`,
        filmKey: film.filmKey,
        name: film.name,
        year: film.year,
        length: reviewText.length,
      });
    }
  }
  return rows.sort((left, right) =>
    right.length - left.length
    || left.name.localeCompare(right.name)
    || compareNullableYearAsc(left.year, right.year)
    || left.id.localeCompare(right.id));
}

export function buildExplorerFilmRows(films: FilmRecord[]): ExplorerFilmRow[] {
  return [...films]
    .map((film) => {
      const delta = filmDelta(film);
      const longestReviewLength = film.reviewTexts.length
        ? Math.max(...film.reviewTexts.map((review) => review.length))
        : null;
      return {
        kind: "film" as const,
        id: film.filmKey,
        filmKey: film.filmKey,
        title: film.name,
        year: film.year,
        filmUrl: film.filmUri,
        currentRating: film.currentRating,
        loggedRating: film.loggedRating,
        delta,
        exactWatchedDate: film.exactWatchedDate,
        reviewRows: film.reviewRows,
        longestReviewLength,
        inWatchlist: film.inWatchlist,
        watchlistAddedDate: earliestIsoDate(film.watchlistAddedDates),
      };
    })
    .sort((left, right) =>
      left.title.localeCompare(right.title)
      || compareNullableYearAsc(left.year, right.year)
      || left.filmKey.localeCompare(right.filmKey));
}

export function buildExplorerReviewRows(films: FilmRecord[]): ExplorerReviewRow[] {
  const rows: ExplorerReviewRow[] = [];
  for (const film of films) {
    const delta = filmDelta(film);
    for (let index = 0; index < film.reviewTexts.length; index += 1) {
      rows.push({
        kind: "reviewRow",
        id: `${film.filmKey}:review:${index}`,
        filmKey: film.filmKey,
        title: film.name,
        year: film.year,
        filmUrl: film.filmUri,
        currentRating: film.currentRating,
        loggedRating: film.loggedRating,
        delta,
        exactWatchedDate: film.exactWatchedDate,
        reviewLength: film.reviewTexts[index].length,
        inWatchlist: film.inWatchlist,
      });
    }
  }
  return rows.sort((left, right) =>
    right.reviewLength - left.reviewLength
    || left.title.localeCompare(right.title)
    || compareNullableYearAsc(left.year, right.year)
    || left.id.localeCompare(right.id));
}

function buildReviewStats(
  films: FilmRecord[],
  reviewRateLabel: string,
  reviewRateBasis: string,
): ReviewStats {
  const reviewTexts = films.flatMap((film) => film.reviewTexts);
  const reviewRowsWithText = buildReviewRows(films);
  const reviewLengths = reviewTexts.map((review) => review.length);
  const wordCounts = new Map<string, number>();
  for (const review of reviewTexts) {
    for (const word of tokenise(review)) {
      if (STOPWORDS.has(word)) {
        continue;
      }
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }
  const topWords = [...wordCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 25)
    .map(([word, count]) => ({ word, count }));

  return {
    summary: {
      reviewRows: {
        value: films.reduce((count, film) => count + film.reviewRows, 0),
        basis: "raw review row count across the selected film set",
      },
      reviewTextRows: {
        value: reviewRowsWithText.length,
        basis: "review rows with non-empty review text across the selected film set",
      },
      reviewedFilms: {
        value: films.filter((film) => film.reviewRows > 0).length,
        basis: "unique films with at least one review row in the selected film set",
      },
      reviewRate: {
        value: films.length ? films.filter((film) => film.reviewRows > 0).length / films.length : 0,
        label: reviewRateLabel,
        basis: reviewRateBasis,
      },
      averageReviewLength: {
        value: mean(reviewLengths),
        basis: "average character length across review rows with non-empty text",
      },
      medianReviewLength: {
        value: median(reviewLengths),
        basis: "median character length across review rows with non-empty text",
      },
      longestReviewLength: {
        value: reviewRowsWithText[0]?.length || 0,
        basis: "longest character length across review rows with non-empty text",
      },
    },
    lengthBuckets: buildReviewLengthBuckets(reviewLengths),
    longestReviews: reviewRowsWithText.slice(0, 12),
    topWords: topWords.slice(0, 12),
  };
}

function buildReleaseAnalytics(films: FilmRecord[]): ReleaseAnalyticsStats {
  const decadeRatings = buildDecadeRatings(films);
  return {
    summary: {
      highestCurrentRatedDecade: pickHighestRatedDecade(decadeRatings, "current"),
      highestLoggedRatedDecade: pickHighestRatedDecade(decadeRatings, "logged"),
    },
    decadeRatings,
  };
}

function buildShareCardSummary(
  films: FilmRecord[],
  label: string,
  viewLabel: string,
): ShareCardSummary {
  const currentRatings = films
    .map((film) => film.currentRating)
    .filter((rating): rating is number => rating !== null);
  const reviewTexts = films.flatMap((film) => film.reviewTexts);
  const wordCounts = new Map<string, number>();
  for (const review of reviewTexts) {
    for (const word of tokenise(review)) {
      if (STOPWORDS.has(word)) {
        continue;
      }
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }
  const topWords = [...wordCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 10)
    .map(([word]) => word);
  const exactWatchDates = films.flatMap((film) => getBestTimelineDates(film).exact);
  const exactByDay = countByDay(exactWatchDates);
  const bestStreakDays = computeLongestStreak(exactByDay.map((item) => item.day));
  const exactDatedWatchedFilms = films.filter((film) => film.exactWatchedDate !== null).length;
  const currentRatedFilms = films.filter((film) => film.currentRating !== null).length;
  const currentMeanRating = mean(currentRatings);
  const currentMedianRating = median(currentRatings);
  const commitmentIndex = films.length ? currentRatedFilms / films.length : 0;
  const watchedFilmsWithoutExactDate = films.length - exactDatedWatchedFilms;

  return {
    watchedFilmsUnique: films.length,
    exactDatedWatchedFilms,
    watchedFilmsWithoutExactDate,
    currentRatedFilms,
    currentMeanRating,
    currentMedianRating,
    bestStreakDays,
    commitmentIndex,
    topWords,
    oneLine:
      `${label}: ${formatInt(films.length)} ${viewLabel.toLowerCase()}, ` +
      `${formatInt(currentRatedFilms)} current rated films, ` +
      `mean ${currentMeanRating === null ? "n/a" : round3(currentMeanRating)}`,
  };
}

export function computeScopedView(
  films: FilmRecord[],
  scope: AnalysisScope,
  userLabel: string | null,
): ScopedView {
  const generatedAt = new Date().toISOString();
  const label = userLabel?.trim() ? userLabel.trim() : "You";
  const scopedSelection = applyAnalysisScope(films, scope);
  const scopedFilms = scopedSelection.films;
  const counts = buildScopeCounts(scopedSelection.basisFilms, scopedFilms);
  const currentRatings = scopedFilms
    .map((film) => film.currentRating)
    .filter((rating): rating is number => rating !== null);
  const loggedRatings = scopedFilms
    .map((film) => film.loggedRating)
    .filter((rating): rating is number => rating !== null);
  const ratingDrift = buildRatingDrift(scopedFilms);
  const shareCard = buildShareCardSummary(scopedFilms, label, "Scoped films");
  const currentSummary = makeRatingSummary(currentRatings, "currentRating on scoped unique film records");
  const loggedSummary = makeRatingSummary(loggedRatings, "loggedRating on scoped unique film records");
  const scopedShareText: ScopedView["shareText"] = {
    short:
      `${label}: ${formatInt(scopedFilms.length)} scoped films | ${scopedSelection.summary} | ` +
      `${formatInt(counts.currentRatedFilms)} current rated films`,
    long:
      `${label} scoped view: ${scopedSelection.summary} ` +
      `=> ${formatInt(scopedFilms.length)} films, ${formatInt(counts.currentRatedFilms)} current rated films, ` +
      `${formatInt(counts.loggedRatedFilms)} logged-rated films, ${formatInt(counts.reviewedFilms)} reviewed films, ` +
      `current mean ${currentSummary.mean === null ? "n/a" : round3(currentSummary.mean)}, ` +
      `mean delta ${ratingDrift.summary.meanDelta.value === null ? "n/a" : round3(ratingDrift.summary.meanDelta.value)}.`,
  };
  const releaseDistribution = makeReleaseDistribution(
    scopedFilms,
    "unique film records in the active scope",
  );

  const scopedView: ScopedView = {
    generatedAt,
    scope: {
      activeScope: scope,
      isActive: isAnalysisScopeActive(scope),
      basisLabel: ANALYSIS_SCOPE_BASIS_LABELS[scope.basis],
      appliedFilters: scopedSelection.chips,
      summary: scopedSelection.summary,
      counts,
    },
    overview: {
      scopedFilms: {
        value: scopedFilms.length,
        basis: "unique films that match the active scope",
      },
      currentRatedFilms: {
        value: counts.currentRatedFilms,
        basis: "scoped films with currentRating",
      },
      loggedRatedFilms: {
        value: counts.loggedRatedFilms,
        basis: "scoped films with loggedRating",
      },
      reviewedFilms: {
        value: counts.reviewedFilms,
        basis: "scoped films with review rows",
      },
      exactDatedWatchedFilms: {
        value: counts.exactDatedWatchedFilms,
        basis: "scoped films with an exact watched date",
      },
      currentMeanRating: {
        value: currentSummary.mean,
        basis: "mean of currentRating across scoped films",
      },
      meanDelta: {
        value: ratingDrift.summary.meanDelta.value,
        basis: "mean of currentRating - loggedRating across scoped comparable films",
      },
    },
    ratings: {
      current: currentSummary,
      logged: loggedSummary,
    },
    ratingDrift,
    reviews: buildReviewStats(
      scopedFilms,
      "Review rate within scoped films",
      "reviewed films divided by scoped films",
    ),
    releaseAnalytics: buildReleaseAnalytics(scopedFilms),
    releaseDistribution,
    shareCard,
    shareText: {
      short:
        `${label}: ${formatInt(scopedFilms.length)} scoped films | ${scopedSelection.summary} | ` +
        `${formatInt(counts.currentRatedFilms)} current rated films`,
      long:
        `${label} scoped view: ${scopedSelection.summary} ` +
        `=> ${formatInt(scopedFilms.length)} films, ${formatInt(counts.currentRatedFilms)} current rated films, ` +
        `${formatInt(counts.loggedRatedFilms)} logged-rated films, ${formatInt(counts.reviewedFilms)} reviewed films, ` +
        `current mean ${currentSummary.mean === null ? "n/a" : round3(currentSummary.mean)}, ` +
        `mean delta ${ratingDrift.summary.meanDelta.value === null ? "n/a" : round3(ratingDrift.summary.meanDelta.value)}.`,
    },
    filmRows: buildExplorerFilmRows(scopedFilms),
    reviewRows: buildExplorerReviewRows(scopedFilms),
    panelNotes: {
      activity: "Global exact-dated watched activity. Active scope filters do not apply to this panel.",
      backlog: "Global watchlist dataset. Active scope filters do not apply to this panel.",
      archives: "Global archive + lists dataset. Active scope filters do not apply to this panel.",
    },
  };
  return Object.assign(scopedView, { shareText: scopedShareText });
}

function buildDataQualityStats(films: FilmRecord[], summary: DatasetSummary): DataQualityStats {
  const reviewTextRows = films.reduce((count, film) => count + film.reviewTexts.length, 0);
  const watchlistFilmsWithAddDate = films.filter((film) => film.inWatchlist && film.watchlistAddedDates.length > 0).length;
  const ratingUniverse = summary.ratingSourceSummary.both
    + summary.ratingSourceSummary.currentOnly
    + summary.ratingSourceSummary.loggedOnly;
  const optionalGroups = [
    {
      label: "Lists",
      present: summary.listSummary.activeListCount + summary.listSummary.archivedListCount > 0,
      detail: `${formatInt(summary.listSummary.activeListCount)} active, ${formatInt(summary.listSummary.archivedListCount)} archived`,
    },
    {
      label: "Deleted",
      present: summary.archiveSummary.deleted.diaryRows + summary.archiveSummary.deleted.reviewRows + summary.archiveSummary.deleted.listFiles > 0,
      detail: `${formatInt(summary.archiveSummary.deleted.diaryRows)} diary rows, ${formatInt(summary.archiveSummary.deleted.reviewRows)} review rows`,
    },
    {
      label: "Orphaned",
      present: summary.archiveSummary.orphaned.diaryRows + summary.archiveSummary.orphaned.reviewRows + summary.archiveSummary.orphaned.listFiles > 0,
      detail: `${formatInt(summary.archiveSummary.orphaned.diaryRows)} diary rows, ${formatInt(summary.archiveSummary.orphaned.reviewRows)} review rows`,
    },
    {
      label: "Likes",
      present: summary.archiveSummary.likes.filmRows + summary.archiveSummary.likes.reviewRows + summary.archiveSummary.likes.listRows > 0,
      detail: `${formatInt(summary.archiveSummary.likes.reviewRows)} review likes, ${formatInt(summary.archiveSummary.likes.listRows)} list likes`,
    },
    {
      label: "Comments",
      present: (summary.tableRowCounts["comments.csv"] || 0) > 0,
      detail: `${formatInt(summary.tableRowCounts["comments.csv"] || 0)} root comment rows`,
    },
  ];

  return {
    summary: {
      exactDatedWatchedFilms: {
        value: summary.dateQualitySummary.exactDatedWatchedFilms,
        basis: "watched films with at least one exact watched date",
      },
      watchedFilmsWithoutExactDate: {
        value: summary.dateQualitySummary.watchedFilmsWithoutExactDate,
        basis: "watched films that are excluded from default watched-time charts",
      },
      comparableDriftFilms: {
        value: summary.ratingSourceSummary.both,
        basis: "films that have both currentRating and loggedRating",
      },
      changedRatingFilms: {
        value: summary.ratingSourceSummary.changed,
        basis: "comparable films where currentRating differs from loggedRating",
      },
      currentOnlyRatedFilms: {
        value: summary.ratingSourceSummary.currentOnly,
        basis: "films with currentRating but no loggedRating",
      },
      loggedOnlyRatedFilms: {
        value: summary.ratingSourceSummary.loggedOnly,
        basis: "films with loggedRating but no currentRating",
      },
    },
    duplicateRows: {
      watchedRowsBeyondUniqueFilms: {
        value: Math.max(0, (summary.tableRowCounts["watched.csv"] || 0) - (summary.tableUniqueFilmCounts["watched.csv"] || 0)),
        basis: "extra watched.csv rows beyond unique watched films",
      },
      ratingRowsBeyondUniqueFilms: {
        value: Math.max(0, (summary.tableRowCounts["ratings.csv"] || 0) - (summary.tableUniqueFilmCounts["ratings.csv"] || 0)),
        basis: "extra ratings.csv rows beyond unique rated films",
      },
      reviewRowsBeyondUniqueFilms: {
        value: Math.max(0, (summary.tableRowCounts["reviews.csv"] || 0) - (summary.tableUniqueFilmCounts["reviews.csv"] || 0)),
        basis: "extra reviews.csv rows beyond unique reviewed films",
      },
      watchlistRowsBeyondUniqueFilms: {
        value: Math.max(0, (summary.tableRowCounts["watchlist.csv"] || 0) - (summary.tableUniqueFilmCounts["watchlist.csv"] || 0)),
        basis: "extra watchlist.csv rows beyond unique watchlist films",
      },
    },
    fieldCoverage: {
      taggedFilms: {
        value: films.filter((film) => film.tags.length > 0).length,
        basis: "unique films that carry at least one merged tag",
      },
      rewatchEvents: {
        value: films.reduce((count, film) => count + film.rewatchCount, 0),
        basis: "merged watch events marked as rewatch",
      },
      commentsRows: {
        value: summary.tableRowCounts["comments.csv"] || 0,
        basis: "raw row count from comments.csv",
      },
      likesRows: {
        value: summary.archiveSummary.likes.filmRows + summary.archiveSummary.likes.reviewRows + summary.archiveSummary.likes.listRows,
        basis: "raw like rows across likes/*",
      },
    },
    moduleCoverage: [
      {
        id: "watchedTimeline",
        label: "Watched timeline coverage",
        covered: summary.dateQualitySummary.exactDatedWatchedFilms,
        total: summary.coverageSummary.watchedUniverseFilmCount,
        coverage: summary.coverageSummary.watchedUniverseFilmCount
          ? summary.dateQualitySummary.exactDatedWatchedFilms / summary.coverageSummary.watchedUniverseFilmCount
          : null,
        note: "Default watched-time charts only use exact watched dates, so watched films without an exact date stay out.",
      },
      {
        id: "ratingDrift",
        label: "Rating drift comparable coverage",
        covered: summary.ratingSourceSummary.both,
        total: ratingUniverse,
        coverage: ratingUniverse ? summary.ratingSourceSummary.both / ratingUniverse : null,
        note: "Rating drift only compares films that have both currentRating and loggedRating.",
      },
      {
        id: "reviewText",
        label: "Review text coverage",
        covered: reviewTextRows,
        total: summary.tableRowCounts["reviews.csv"] || 0,
        coverage: (summary.tableRowCounts["reviews.csv"] || 0)
          ? reviewTextRows / (summary.tableRowCounts["reviews.csv"] || 0)
          : null,
        note: "Longest-review and word stats rely on non-empty review text rows.",
      },
      {
        id: "watchlistTimeline",
        label: "Watchlist timeline coverage",
        covered: watchlistFilmsWithAddDate,
        total: summary.coverageSummary.watchlistFilmCount,
        coverage: summary.coverageSummary.watchlistFilmCount
          ? watchlistFilmsWithAddDate / summary.coverageSummary.watchlistFilmCount
          : null,
        note: "Watchlist timeline uses earliest add dates from watchlist.csv when those dates are present.",
      },
    ],
    tables: {
      core: [
        "watched.csv",
        "ratings.csv",
        "diary.csv",
        "reviews.csv",
        "watchlist.csv",
        "profile.csv",
        "comments.csv",
      ].map((path) => ({
        label: path,
        path,
        present: summary.recognizedFiles.includes(path),
        rows: summary.tableRowCounts[path] || 0,
      })),
      optionalGroups,
    },
    importLog: {
      topDay: summary.importSpikeSummary.largestSingleDayImportDate,
      topDayCount: summary.importSpikeSummary.largestSingleDayImportCount,
      spikeDetected: summary.importSpikeSummary.importSpikeDetected,
      basis: "import/log behaviour inferred from watched.csv Date values, not watched activity",
    },
  };
}

function buildDecadeRatings(films: FilmRecord[]): DecadeRatingRow[] {
  const map = new Map<string, {
    watchedFilms: number;
    currentRatings: number[];
    loggedRatings: number[];
  }>();

  for (const film of films) {
    if (film.year === null) {
      continue;
    }
    const decade = toDecadeLabel(film.year);
    const entry = map.get(decade) || {
      watchedFilms: 0,
      currentRatings: [],
      loggedRatings: [],
    };
    entry.watchedFilms += 1;
    if (film.currentRating !== null) {
      entry.currentRatings.push(film.currentRating);
    }
    if (film.loggedRating !== null) {
      entry.loggedRatings.push(film.loggedRating);
    }
    map.set(decade, entry);
  }

  return [...map.entries()]
    .sort((left, right) => compareDecadeLabelAsc(left[0], right[0]))
    .map(([decade, entry]) => ({
      decade,
      watchedFilms: entry.watchedFilms,
      currentRatedFilms: entry.currentRatings.length,
      currentMeanRating: mean(entry.currentRatings),
      loggedRatedFilms: entry.loggedRatings.length,
      loggedMeanRating: mean(entry.loggedRatings),
    }));
}

function pickHighestRatedDecade(
  rows: DecadeRatingRow[],
  source: "current" | "logged",
): ReleaseAnalyticsStats["summary"]["highestCurrentRatedDecade"] {
  const filtered = rows
    .map((row) => ({
      decade: row.decade,
      meanRating: source === "current" ? row.currentMeanRating : row.loggedMeanRating,
      ratedFilms: source === "current" ? row.currentRatedFilms : row.loggedRatedFilms,
    }))
    .filter((row): row is { decade: string; meanRating: number; ratedFilms: number } => row.meanRating !== null && row.ratedFilms > 0);

  if (!filtered.length) {
    return null;
  }

  filtered.sort((left, right) =>
    right.meanRating - left.meanRating
    || right.ratedFilms - left.ratedFilms
    || compareDecadeLabelAsc(left.decade, right.decade));

  return filtered[0];
}

export function computeStats(
  films: FilmRecord[],
  summary: DatasetSummary,
  userLabel: string | null,
): StatPack {
  const generatedAt = new Date().toISOString();

  const watchedUniverseFilms = films.filter(isWatchedFilm);
  const watchlistFilms = films.filter((film) => film.inWatchlist);
  const watchedUniverseCurrentRatedFilms = watchedUniverseFilms.filter((film) => film.currentRating !== null);
  const currentRatedFilms = films.filter((film) => film.currentRating !== null);
  const loggedRatedFilms = films.filter((film) => film.loggedRating !== null);
  const currentRatings = currentRatedFilms
    .map((film) => film.currentRating)
    .filter((rating): rating is number => rating !== null);
  const loggedRatings = loggedRatedFilms
    .map((film) => film.loggedRating)
    .filter((rating): rating is number => rating !== null);

  const exactWatchDates = watchedUniverseFilms.flatMap((film) => getBestTimelineDates(film).exact);
  const byDay = countByDay(exactWatchDates);
  const byMonth = countByMonth(exactWatchDates);
  const longestStreakDays = computeLongestStreak(byDay.map((item) => item.day));

  const cutoffIso = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const recentWatchedFilms = watchedUniverseFilms.filter((film) => (film.exactWatchedDate || "0000-00-00") >= cutoffIso);
  const recentCurrentRatings = recentWatchedFilms
    .map((film) => film.currentRating)
    .filter((rating): rating is number => rating !== null);

  const reviewTexts = films.flatMap((film) => film.reviewTexts);
  const reviewLengths = reviewTexts.map((review) => review.length);
  const reviewRowsWithText = buildReviewRows(films);
  const wordCounts = new Map<string, number>();
  for (const review of reviewTexts) {
    for (const word of tokenise(review)) {
      if (STOPWORDS.has(word)) {
        continue;
      }
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }
  const topWords = [...wordCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 25)
    .map(([word, count]) => ({ word, count }));

  const commitmentIndex = watchedUniverseFilms.length
    ? watchedUniverseCurrentRatedFilms.length / watchedUniverseFilms.length
    : 0;
  const tasteVolatilityIndex = stddev(currentRatings);
  const chaosIndex = tasteVolatilityIndex === null ? null : clamp(tasteVolatilityIndex / 1.2, 0, 2);

  let badge = "Mixed";
  if (commitmentIndex > 0.85 && (tasteVolatilityIndex || 0) < 0.9) badge = "Curator";
  else if (commitmentIndex > 0.85 && (tasteVolatilityIndex || 0) >= 0.9) badge = "Sharpshooter";
  else if (commitmentIndex <= 0.6 && (tasteVolatilityIndex || 0) < 0.9) badge = "Wanderer";
  else if (commitmentIndex <= 0.6 && (tasteVolatilityIndex || 0) >= 0.9) badge = "Chaos Gremlin";

  const label = userLabel?.trim() ? userLabel.trim() : "You";
  const currentSummary = makeRatingSummary(currentRatings, "currentRating on unique film records");
  const loggedSummary = makeRatingSummary(loggedRatings, "loggedRating on unique film records");
  const ratingDrift = buildRatingDrift(films);
  const globalReviewStats = buildReviewStats(
    watchedUniverseFilms,
    "Review rate among watched films",
    "reviewed films divided by watched films",
  );
  const globalReleaseAnalytics = buildReleaseAnalytics(watchedUniverseFilms);
  const globalShareCard = buildShareCardSummary(watchedUniverseFilms, label, "Watched films");
  const dataQuality = buildDataQualityStats(films, summary);

  const watchedFilmsUnique = summary.coverageSummary.watchedUniverseFilmCount;
  const currentRatedFilmCount = summary.ratingSourceSummary.filmsWithCurrentRating;
  const loggedRatedFilmCount = summary.ratingSourceSummary.filmsWithLoggedRating;
  const exactDatedWatchedFilms = summary.dateQualitySummary.exactDatedWatchedFilms;
  const watchedFilmsWithoutExactDate = summary.dateQualitySummary.watchedFilmsWithoutExactDate;
  const watchedRows = summary.tableRowCounts["watched.csv"] || 0;
  const watchlistFilmCount = summary.coverageSummary.watchlistFilmCount;
  const watchlistRows = summary.tableRowCounts["watchlist.csv"] || 0;
  const exactWatchEvents = summary.dateQualitySummary.exactWatchEvents;
  const reviewedFilmCount = summary.coverageSummary.reviewFilmCount;
  const reviewRowsCount = summary.tableRowCounts["reviews.csv"] || 0;
  const watchlistFirstAddDates = watchlistFilms
    .map((film) => earliestIsoDate(film.watchlistAddedDates))
    .filter((date): date is string => date !== null);
  const watchlistReleaseDistribution = makeReleaseDistribution(
    watchlistFilms,
    "unique watchlist film records",
  );
  const watchedReleaseDistribution = makeReleaseDistribution(
    watchedUniverseFilms,
    "unique watched-universe film records",
  );
  const decadeRatings = buildDecadeRatings(watchedUniverseFilms);
  const archiveLists = [...summary.listSummary.lists]
    .map<ArchiveListRow>((list) => ({
      path: list.path,
      scope: list.scope,
      title: list.title,
      itemCount: list.itemCount,
      createdDate: list.createdDate,
      exportedDate: list.exportedDate,
      tags: list.tags,
      parseError: list.parseError,
    }))
    .sort((left, right) =>
      left.scope.localeCompare(right.scope)
      || (left.title || "").localeCompare(right.title || "")
      || left.path.localeCompare(right.path));

  return {
    generatedAt,
    overview: {
      watchedFilmsUnique: {
        value: watchedFilmsUnique,
        basis: "unique film-level watched universe merged from watched/ratings/diary/reviews",
      },
      exactDatedWatchedFilms: {
        value: exactDatedWatchedFilms,
        basis: "watched-universe films that have at least one exact watched date from diary/reviews",
      },
      watchedFilmsWithoutExactDate: {
        value: watchedFilmsWithoutExactDate,
        basis: "watched-universe films that do not have any exact watched date",
      },
      currentRatedFilms: {
        value: currentRatedFilmCount,
        basis: "unique films with currentRating sourced from ratings.csv",
      },
      currentMeanRating: {
        value: currentSummary.mean,
        basis: "mean of currentRating across unique film records",
      },
      bestStreakDays: {
        value: longestStreakDays,
        basis: "streak on exact watched dates only",
      },
    },
    quickFacts: {
      watchedRows: {
        value: watchedRows,
        basis: "raw row count from watched.csv",
      },
      unratedWatchedFilmsWithoutCurrentRating: {
        value: watchedFilmsUnique - watchedUniverseCurrentRatedFilms.length,
        basis: "watched-universe films that do not have currentRating",
      },
      loggedRatedFilms: {
        value: loggedRatedFilmCount,
        basis: "unique films with loggedRating sourced from review/diary entries",
      },
      reviewRows: {
        value: reviewRowsCount,
        basis: "raw row count from reviews.csv",
      },
      watchlistFilms: {
        value: watchlistFilmCount,
        basis: "unique film-level watchlist backlog",
      },
      commitmentIndex: {
        value: commitmentIndex,
        basis: "current-rated watched-universe films divided by watched-universe films",
      },
      currentRatingStddev: {
        value: tasteVolatilityIndex,
        basis: "standard deviation of currentRating",
      },
    },
    ratings: {
      current: currentSummary,
      logged: loggedSummary,
    },
    ratingDrift,
    backlog: {
      summary: {
        watchlistFilms: {
          value: watchlistFilmCount,
          basis: "unique film-level watchlist backlog",
        },
        watchlistRows: {
          value: watchlistRows,
          basis: "raw row count from watchlist.csv",
        },
        watchlistFilmsWithAddDate: {
          value: watchlistFirstAddDates.length,
          basis: "unique watchlist films with at least one add date in watchlist.csv",
        },
        watchlistFilmsWithoutAddDate: {
          value: watchlistFilmCount - watchlistFirstAddDates.length,
          basis: "unique watchlist films without an add date in watchlist.csv",
        },
      },
      timeline: {
        byMonth: countByMonth(watchlistFirstAddDates),
        watchlistFilmsWithAddDate: watchlistFirstAddDates.length,
        basis: "unique watchlist films grouped by earliest add date found in watchlist.csv",
      },
      releaseYears: watchlistReleaseDistribution,
      comparison: {
        watchedVsWatchlistByDecade: buildBacklogDecadeComparison(watchedUniverseFilms, watchlistFilms),
      },
    },
    reviews: globalReviewStats,
    releaseAnalytics: globalReleaseAnalytics,
    archives: {
      summary: {
        deletedDiaryRows: {
          value: summary.archiveSummary.deleted.diaryRows,
          basis: "raw row count from deleted/diary.csv",
        },
        deletedReviewRows: {
          value: summary.archiveSummary.deleted.reviewRows,
          basis: "raw row count from deleted/reviews.csv",
        },
        orphanedDiaryRows: {
          value: summary.archiveSummary.orphaned.diaryRows,
          basis: "raw row count from orphaned/diary.csv",
        },
        orphanedReviewRows: {
          value: summary.archiveSummary.orphaned.reviewRows,
          basis: "raw row count from orphaned/reviews.csv",
        },
        activeLists: {
          value: summary.listSummary.activeListCount,
          basis: "parsed active list files from lists/*.csv",
        },
        archivedLists: {
          value: summary.listSummary.archivedListCount,
          basis: "parsed archived list files from deleted/orphaned lists/*.csv",
        },
      },
      archiveScopes: [
        {
          scope: "deleted",
          diaryRows: summary.archiveSummary.deleted.diaryRows,
          reviewRows: summary.archiveSummary.deleted.reviewRows,
          commentRows: summary.archiveSummary.deleted.commentRows,
          listFiles: summary.archiveSummary.deleted.listFiles,
          uniqueFilmCount: summary.archiveSummary.deleted.uniqueFilmCount,
        },
        {
          scope: "orphaned",
          diaryRows: summary.archiveSummary.orphaned.diaryRows,
          reviewRows: summary.archiveSummary.orphaned.reviewRows,
          commentRows: summary.archiveSummary.orphaned.commentRows,
          listFiles: summary.archiveSummary.orphaned.listFiles,
          uniqueFilmCount: summary.archiveSummary.orphaned.uniqueFilmCount,
        },
      ],
      lists: archiveLists,
    },
    activity: {
      heatmap: {
        byMonth,
        exactWatchEvents,
        exactDatedWatchedFilms,
        basis: "exact watched dates only; films without an exact watched date are excluded",
      },
      byMonth,
      byDay,
      longestStreakDays,
      busiestDay: busiestDay(byDay),
      recent90: {
        exactWatchEvents: exactWatchDates.filter((date) => date >= cutoffIso).length,
        exactDatedWatchedFilms: recentWatchedFilms.length,
        currentRatedFilms: recentWatchedFilms.filter((film) => film.currentRating !== null).length,
        meanCurrentRating: mean(recentCurrentRatings),
      },
    },
    releaseYears: {
      watchedFilms: watchedReleaseDistribution,
      watchlistFilms: watchlistReleaseDistribution,
    },
    text: {
      topWords,
      avgReviewLength: mean(reviewLengths),
      medianReviewLength: median(reviewLengths),
    },
    fun: {
      tasteVolatilityIndex,
      commitmentIndex,
      chaosIndex,
      badge,
    },
    dataQuality,
    shareCard: {
      ...globalShareCard,
      watchedFilmsUnique,
      exactDatedWatchedFilms,
      watchedFilmsWithoutExactDate,
      currentRatedFilms: currentRatedFilmCount,
      currentMeanRating: currentSummary.mean,
      currentMedianRating: currentSummary.median,
      bestStreakDays: longestStreakDays,
      commitmentIndex,
      topWords: topWords.slice(0, 10).map((word) => word.word),
      oneLine:
        `${label}: ${formatInt(watchedFilmsUnique)} watched films, ` +
        `${formatInt(exactDatedWatchedFilms)} exact-dated watched films, ` +
        `${formatInt(watchedFilmsWithoutExactDate)} watched films without exact date, ` +
        `${formatInt(currentRatedFilmCount)} current rated films, ` +
        `mean ${currentSummary.mean === null ? "n/a" : round3(currentSummary.mean)}`,
    },
    shareText: {
      short:
        `${label}: ${formatInt(watchedFilmsUnique)} watched films, ` +
        `${formatInt(exactDatedWatchedFilms)} exact-dated watched films, ` +
        `${formatInt(watchedFilmsWithoutExactDate)} watched films without exact date, ` +
        `${formatInt(currentRatedFilmCount)} current rated films, ` +
        `mean ${currentSummary.mean === null ? "n/a" : round3(currentSummary.mean)}`,
      long:
        `${label} has ${formatInt(watchedFilmsUnique)} watched films, including ` +
        `${formatInt(exactDatedWatchedFilms)} exact-dated watched films and ` +
        `${formatInt(watchedFilmsWithoutExactDate)} watched films without exact date. ` +
        `${formatInt(currentRatedFilmCount)} current rated films and ${formatInt(loggedRatedFilmCount)} logged-rated films. ` +
        `Current mean ${currentSummary.mean === null ? "n/a" : round3(currentSummary.mean)}, ` +
        `current median ${currentSummary.median === null ? "n/a" : round1(currentSummary.median)}, ` +
        `best streak ${formatInt(longestStreakDays)} days on exact watched dates, commitment ${formatPct(commitmentIndex)}. ` +
        `Badge ${badge}.`,
    },
  };
}
