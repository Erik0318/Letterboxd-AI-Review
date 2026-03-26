import React, { startTransition, useEffect, useMemo, useRef, useState } from "react";
import ArchiveListsPanel from "./components/ArchiveListsPanel";
import BacklogPanel from "./components/BacklogPanel";
import { BarList } from "./components/BarList";
import DataQualityPanel from "./components/DataQualityPanel";
import FilmExplorer from "./components/FilmExplorer";
import HelpTooltip from "./components/HelpTooltip";
import { Heatmap } from "./components/Heatmap";
import OnboardingPanel from "./components/OnboardingPanel";
import ReportMenu from "./components/ReportMenu";
import ReportSection from "./components/ReportSection";
import RatingDriftPanel from "./components/RatingDriftPanel";
import ReleaseAnalyticsPanel from "./components/ReleaseAnalyticsPanel";
import ReviewStatsPanel from "./components/ReviewStatsPanel";
import SavedViewsPanel from "./components/SavedViewsPanel";
import ScopeBar from "./components/ScopeBar";
import SectionHeader from "./components/SectionHeader";
import ShareExportPanel from "./components/ShareExportPanel";
import Toast from "./components/Toast";
import WatchActivityPanel from "./components/WatchActivityPanel";
import { buildGroupedDataQuality } from "./lib/dataQuality";
import {
  buildExplorerExportRows,
  defaultExplorerSort,
  ExplorerSortDirection,
  FilmExplorerPayload,
} from "./lib/explorer";
import {
  createFilmKey,
  DatasetSummary,
  FilmRecord,
  getBestTimelineDates,
  isWatchedFilm,
  mergeTablesToFilms,
  ParsedListFile,
  readLetterboxdExportZip,
} from "./lib/letterboxd";
import {
  buildDefaultCollapsedSections,
  buildDrilldownContextTrail,
  buildReportMenuEntries,
  buildReportSectionHash,
  getReportSectionTitle,
  inferExplorerSectionId,
  parseCollapsedSections,
  parseReportSectionHash,
  ReportSectionCollapseState,
  ReportSectionId,
  REPORT_SECTIONS,
  serializeCollapsedSections,
} from "./lib/reportSections";
import {
  areSavedViewSnapshotsEqual,
  buildSavedViewSummaryText,
  BUILTIN_SAVED_VIEW_PRESETS,
  createSavedViewRecord,
  parseSavedViews,
  SAVED_VIEWS_STORAGE_KEY,
  SavedViewPreset,
  SavedViewRecord,
  SavedViewSnapshot,
  serializeSavedViews,
} from "./lib/savedViews";
import {
  AnalysisScope,
  applyAnalysisScope,
  buildExplorerFilmRows,
  buildExplorerReviewRows,
  computeScopedView,
  computeStats,
  DEFAULT_ANALYSIS_SCOPE,
  RatingDriftSortKey,
  StatPack,
} from "./lib/stats";
import { clamp, formatInt, formatPct, round1, round3 } from "./lib/utils";
import { buildCurrentViewSummary } from "./lib/viewState";
import {
  buildExactWatchActivity,
  ExactWatchEventRow,
  filterExactWatchRowsByDay,
  filterExactWatchRowsByMonth,
  filterExactWatchRowsByRange,
  filterExactWatchRowsByYear,
} from "./lib/watchActivity";

type Provider = "default" | "default_kimi" | "openai_compat" | "gemini";
type Lang = "en" | "zh" | "uk";
type HelpState = "expanded" | "collapsed" | "dismissed";
type ViewOption = SavedViewPreset | SavedViewRecord;
type UiCue = "scope" | "saved-view" | "share";
type ExplorerOrigin = {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  token: number;
};

const HELP_STATE_STORAGE_KEY = "letterboxd-ai-review.help.v1";
const REPORT_COLLAPSE_STORAGE_KEY = "letterboxd-ai-review.report-collapse.v1";
const HALF_STAR_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const VALID_SCOPE_BASES: AnalysisScope["basis"][] = [
  "globalDefault",
  "watchedFilms",
  "currentRatedFilms",
  "loggedRatedFilms",
  "reviewedFilms",
  "exactDatedWatchedFilms",
  "comparableDriftFilms",
  "changedDriftFilms",
  "upgradedDriftFilms",
  "downgradedDriftFilms",
];
const VALID_REVIEW_PRESENCE: AnalysisScope["reviewPresence"][] = ["all", "hasReview", "noReview"];

function InlineLabel({
  label,
  help,
}: {
  label: string;
  help?: string;
}) {
  return (
    <span className="labelWithHelp">
      <span>{label}</span>
      {help && <HelpTooltip label={`Explain ${label}`} text={help} />}
    </span>
  );
}

function ratingLabel(rating: number): string {
  return String(rating);
}

function parseNullableNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseScopeFromQuery(): AnalysisScope {
  if (typeof window === "undefined") {
    return DEFAULT_ANALYSIS_SCOPE;
  }
  const params = new URLSearchParams(window.location.search);
  const basis = params.get("scopeBasis");
  const reviewPresence = params.get("scopeReview");
  return {
    basis: basis && VALID_SCOPE_BASES.includes(basis as AnalysisScope["basis"])
      ? basis as AnalysisScope["basis"]
      : DEFAULT_ANALYSIS_SCOPE.basis,
    releaseDecade: params.get("scopeDecade"),
    releaseYearMin: parseNullableNumber(params.get("scopeYearMin")),
    releaseYearMax: parseNullableNumber(params.get("scopeYearMax")),
    currentRatingMin: parseNullableNumber(params.get("scopeCurrentMin")),
    currentRatingMax: parseNullableNumber(params.get("scopeCurrentMax")),
    loggedRatingMin: parseNullableNumber(params.get("scopeLoggedMin")),
    loggedRatingMax: parseNullableNumber(params.get("scopeLoggedMax")),
    reviewPresence: reviewPresence && VALID_REVIEW_PRESENCE.includes(reviewPresence as AnalysisScope["reviewPresence"])
      ? reviewPresence as AnalysisScope["reviewPresence"]
      : DEFAULT_ANALYSIS_SCOPE.reviewPresence,
  };
}

function parseRatingDriftSortFromQuery(): RatingDriftSortKey {
  if (typeof window === "undefined") {
    return "largestAbsoluteChange";
  }
  const value = new URLSearchParams(window.location.search).get("driftSort");
  if (value === "biggestDowngrade" || value === "biggestUpgrade" || value === "largestAbsoluteChange") {
    return value;
  }
  return "largestAbsoluteChange";
}

function parseShowDebugFromQuery(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).get("debug") === "1";
}

function parseExplorerRouteFromQuery(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return new URLSearchParams(window.location.search).get("explorer");
}

function parseHelpStateFromStorage(): HelpState {
  if (typeof window === "undefined") {
    return "expanded";
  }
  const value = window.localStorage.getItem(HELP_STATE_STORAGE_KEY);
  return value === "collapsed" || value === "dismissed" ? value : "expanded";
}

function parseSavedViewsFromStorage(): SavedViewRecord[] {
  if (typeof window === "undefined") {
    return [];
  }
  return parseSavedViews(window.localStorage.getItem(SAVED_VIEWS_STORAGE_KEY));
}

function parseInitialSection(): ReportSectionId {
  if (typeof window === "undefined") {
    return "overview";
  }
  return parseReportSectionHash(window.location.hash) || "overview";
}

function parseCollapsedSectionsFromStorage(activeSectionId: ReportSectionId): ReportSectionCollapseState {
  if (typeof window === "undefined") {
    return buildDefaultCollapsedSections(activeSectionId);
  }
  return parseCollapsedSections(
    window.localStorage.getItem(REPORT_COLLAPSE_STORAGE_KEY),
    activeSectionId,
  );
}

function writeCsv(
  fileName: string,
  rows: Array<Record<string, string | number | boolean | null | undefined>>,
) {
  if (!rows.length) {
    return;
  }
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escapeCsv = (value: string | number | boolean | null | undefined) => {
    const text = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadTextFile(fileName: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function slugifyFileName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "saved_view";
}

const AI_SAMPLE_LIMIT = 10;
const AI_REVIEW_SAMPLE_LIMIT = 6;
const AI_PAYLOAD_CHAR_BUDGET = 24000;

function trimAiSnippet(value: string | null | undefined, maxLength = 140): string | null {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return null;
  }
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return `${cleaned.slice(0, maxLength - 3).trimEnd()}...`;
}

function filmLabel(name: string, year: number | null): string {
  return year === null ? name : `${name} (${year})`;
}

function sortIsoDesc(left: string | null, right: string | null): number {
  return (right || "").localeCompare(left || "");
}

function pickEarliestIso(values: string[]): string | null {
  if (!values.length) {
    return null;
  }
  return [...values].sort((left, right) => left.localeCompare(right))[0] || null;
}

function longestReviewText(film: FilmRecord): string | null {
  let longest = "";
  for (const review of film.reviewTexts) {
    if (review.length > longest.length) {
      longest = review;
    }
  }
  return longest || null;
}

function pickUniqueMapped<T>(
  items: T[],
  key: (item: T) => string,
  map: (item: T) => string | null,
  limit: number,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const itemKey = key(item);
    if (seen.has(itemKey)) {
      continue;
    }
    seen.add(itemKey);
    const mapped = map(item);
    if (!mapped) {
      continue;
    }
    out.push(mapped);
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}

function compactHistogram(histogram: Array<{ rating: number; count: number }>): string[] {
  return histogram
    .filter((item) => item.count > 0)
    .map((item) => `${item.rating}:${item.count}`);
}

function compactNamedCounts(items: Array<{ word?: string; decade?: string; year?: number; count: number }>, limit: number): string[] {
  return items
    .slice(0, limit)
    .map((item) => {
      if (item.word) {
        return `${item.word}:${item.count}`;
      }
      if (item.decade) {
        return `${item.decade}:${item.count}`;
      }
      return `${item.year}:${item.count}`;
    });
}

function compactListTitles(
  lists: NonNullable<DatasetSummary["listSummary"]>["lists"] | undefined,
  scope: "active" | "orphaned",
  limit: number,
): string[] {
  return (lists || [])
    .filter((list) => list.scope === scope)
    .sort((left, right) => right.itemCount - left.itemCount || (left.title || left.path).localeCompare(right.title || right.path))
    .slice(0, limit)
    .map((list) => `${list.title || list.path}:${list.itemCount}`);
}

function aiDossier(films: FilmRecord[], stats: StatPack, summary: DatasetSummary | null) {
  const watchedFilms = films.filter((film) => film.inWatched || film.watchedRows > 0 || film.diaryRows > 0 || film.reviewRows > 0);
  const currentRatedFilms = films.filter((film) => film.currentRating !== null);
  const loggedRatedFilms = films.filter((film) => film.loggedRating !== null);
  const comparableFilms = films.filter((film) => film.currentRating !== null && film.loggedRating !== null);
  const reviewFilms = films.filter((film) => film.reviewTexts.length > 0);
  const rewatchFilms = films.filter((film) => film.rewatchCount > 0);
  const unratedWatchedFilms = watchedFilms.filter((film) => film.currentRating === null);
  const watchlistFilms = films.filter((film) => film.inWatchlist);
  const upgradedFilms = comparableFilms.filter((film) => (film.currentRating || 0) - (film.loggedRating || 0) > 0);
  const downgradedFilms = comparableFilms.filter((film) => (film.currentRating || 0) - (film.loggedRating || 0) < 0);

  const currentFavorites = [...currentRatedFilms].sort((left, right) =>
    (right.currentRating || 0) - (left.currentRating || 0)
    || right.rewatchCount - left.rewatchCount
    || right.reviewRows - left.reviewRows
    || sortIsoDesc(left.exactWatchedDate, right.exactWatchedDate)
    || left.name.localeCompare(right.name));
  const recentWatches = [...watchedFilms].sort((left, right) =>
    sortIsoDesc(left.exactWatchedDate || left.bestWatchedDate, right.exactWatchedDate || right.bestWatchedDate)
    || (right.currentRating || 0) - (left.currentRating || 0)
    || left.name.localeCompare(right.name));
  const biggestUpgrades = [...upgradedFilms].sort((left, right) =>
    ((right.currentRating || 0) - (right.loggedRating || 0)) - ((left.currentRating || 0) - (left.loggedRating || 0))
    || (right.currentRating || 0) - (left.currentRating || 0)
    || left.name.localeCompare(right.name));
  const biggestDowngrades = [...downgradedFilms].sort((left, right) =>
    ((left.currentRating || 0) - (left.loggedRating || 0)) - ((right.currentRating || 0) - (right.loggedRating || 0))
    || (left.currentRating || 0) - (right.currentRating || 0)
    || left.name.localeCompare(right.name));
  const rewatchLeaders = [...rewatchFilms].sort((left, right) =>
    right.rewatchCount - left.rewatchCount
    || (right.currentRating || 0) - (left.currentRating || 0)
    || left.name.localeCompare(right.name));
  const longestReviewed = [...reviewFilms].sort((left, right) =>
    (longestReviewText(right)?.length || 0) - (longestReviewText(left)?.length || 0)
    || right.reviewRows - left.reviewRows
    || left.name.localeCompare(right.name));
  const watchlistFrontier = [...watchlistFilms].sort((left, right) =>
    sortIsoDesc(pickEarliestIso(left.watchlistAddedDates), pickEarliestIso(right.watchlistAddedDates))
    || (right.year || 0) - (left.year || 0)
    || left.name.localeCompare(right.name));

  const profile = {
    profileVersion: "ai_profile_v3_compact",
    scope: "full_report",
    summary: {
      watchedFilms: stats.overview.watchedFilmsUnique.value,
      currentRatedFilms: stats.overview.currentRatedFilms.value,
      loggedRatedFilms: stats.quickFacts.loggedRatedFilms.value,
      exactWatchDatedFilms: stats.overview.exactDatedWatchedFilms.value,
      missingExactWatchDates: stats.overview.watchedFilmsWithoutExactDate.value,
      reviewRows: stats.quickFacts.reviewRows.value,
      reviewedFilms: stats.reviews.summary.reviewedFilms.value,
      watchlistFilms: stats.backlog.summary.watchlistFilms.value,
      bestStreakDays: stats.overview.bestStreakDays.value,
      badge: stats.fun.badge,
      commitmentIndexPct: Math.round(stats.quickFacts.commitmentIndex.value * 100),
      currentMean: stats.ratings.current.mean === null ? null : round3(stats.ratings.current.mean),
      currentMedian: stats.ratings.current.median === null ? null : round1(stats.ratings.current.median),
      loggedMean: stats.ratings.logged.mean === null ? null : round3(stats.ratings.logged.mean),
      currentStddev: stats.quickFacts.currentRatingStddev.value === null ? null : round3(stats.quickFacts.currentRatingStddev.value),
    },
    ratingPatterns: {
      currentHistogram: compactHistogram(stats.ratings.current.histogram),
      loggedHistogram: compactHistogram(stats.ratings.logged.histogram),
      drift: {
        comparableFilms: stats.ratingDrift.summary.comparableFilms.value,
        changedFilms: stats.ratingDrift.summary.changed.value,
        upgradedFilms: stats.ratingDrift.summary.upgraded.value,
        downgradedFilms: stats.ratingDrift.summary.downgraded.value,
        meanDelta: stats.ratingDrift.summary.meanDelta.value === null ? null : round3(stats.ratingDrift.summary.meanDelta.value),
        biggestUpgrades: pickUniqueMapped(
          biggestUpgrades,
          (film) => film.filmKey,
          (film) => `${filmLabel(film.name, film.year)} | ${round1((film.currentRating || 0) - (film.loggedRating || 0)) > 0 ? "+" : ""}${round1((film.currentRating || 0) - (film.loggedRating || 0))} | ${round1(film.loggedRating || 0)} -> ${round1(film.currentRating || 0)}`,
          AI_SAMPLE_LIMIT,
        ),
        biggestDowngrades: pickUniqueMapped(
          biggestDowngrades,
          (film) => film.filmKey,
          (film) => `${filmLabel(film.name, film.year)} | ${round1((film.currentRating || 0) - (film.loggedRating || 0))} | ${round1(film.loggedRating || 0)} -> ${round1(film.currentRating || 0)}`,
          AI_SAMPLE_LIMIT,
        ),
      },
    },
    activitySignals: {
      busiestDay: stats.activity.busiestDay
        ? `${stats.activity.busiestDay.day}:${stats.activity.busiestDay.count}`
        : null,
      recent90ExactWatchEvents: stats.activity.recent90.exactWatchEvents,
      recent90ExactWatchFilms: stats.activity.recent90.exactDatedWatchedFilms,
      recent90CurrentRatedFilms: stats.activity.recent90.currentRatedFilms,
      recent90MeanCurrentRating: stats.activity.recent90.meanCurrentRating === null ? null : round3(stats.activity.recent90.meanCurrentRating),
    },
    eraSignals: {
      watchedReleaseSpan: stats.releaseYears.watchedFilms.span.min !== null && stats.releaseYears.watchedFilms.span.max !== null
        ? `${stats.releaseYears.watchedFilms.span.min}-${stats.releaseYears.watchedFilms.span.max}`
        : null,
      topDecades: compactNamedCounts(
        [...stats.releaseYears.watchedFilms.decadeBuckets].sort((left, right) => right.count - left.count),
        8,
      ),
      topYears: compactNamedCounts(stats.releaseYears.watchedFilms.topYears, 8),
      highestCurrentRatedDecade: stats.releaseAnalytics.summary.highestCurrentRatedDecade
        ? `${stats.releaseAnalytics.summary.highestCurrentRatedDecade.decade}:${round1(stats.releaseAnalytics.summary.highestCurrentRatedDecade.meanRating)}`
        : null,
      highestLoggedRatedDecade: stats.releaseAnalytics.summary.highestLoggedRatedDecade
        ? `${stats.releaseAnalytics.summary.highestLoggedRatedDecade.decade}:${round1(stats.releaseAnalytics.summary.highestLoggedRatedDecade.meanRating)}`
        : null,
    },
    reviewLanguage: {
      reviewRatePct: Math.round(stats.reviews.summary.reviewRate.value * 100),
      averageLength: stats.reviews.summary.averageReviewLength.value === null ? null : round1(stats.reviews.summary.averageReviewLength.value),
      medianLength: stats.reviews.summary.medianReviewLength.value === null ? null : round1(stats.reviews.summary.medianReviewLength.value),
      topWords: compactNamedCounts(stats.text.topWords, 18),
      sampleSnippets: pickUniqueMapped(
        longestReviewed,
        (film) => film.filmKey,
        (film) => {
          const snippet = trimAiSnippet(longestReviewText(film), 120);
          return snippet ? `${filmLabel(film.name, film.year)} | ${snippet}` : null;
        },
        AI_REVIEW_SAMPLE_LIMIT,
      ),
    },
    behaviorSignals: {
      recentWatches: pickUniqueMapped(
        recentWatches,
        (film) => film.filmKey,
        (film) => `${filmLabel(film.name, film.year)} | watched ${film.exactWatchedDate || film.bestWatchedDate || "n/a"} | current ${film.currentRating === null ? "n/a" : round1(film.currentRating)}`,
        AI_SAMPLE_LIMIT,
      ),
      currentFavorites: pickUniqueMapped(
        currentFavorites,
        (film) => film.filmKey,
        (film) => `${filmLabel(film.name, film.year)} | current ${film.currentRating === null ? "n/a" : round1(film.currentRating)} | logged ${film.loggedRating === null ? "n/a" : round1(film.loggedRating)} | rewatches ${film.rewatchCount}`,
        AI_SAMPLE_LIMIT,
      ),
      rewatches: pickUniqueMapped(
        rewatchLeaders,
        (film) => film.filmKey,
        (film) => `${filmLabel(film.name, film.year)} | rewatches ${film.rewatchCount} | current ${film.currentRating === null ? "n/a" : round1(film.currentRating)}`,
        AI_SAMPLE_LIMIT,
      ),
      unratedWatched: pickUniqueMapped(
        unratedWatchedFilms.sort((left, right) =>
          sortIsoDesc(left.exactWatchedDate || left.bestWatchedDate, right.exactWatchedDate || right.bestWatchedDate)
          || right.reviewRows - left.reviewRows
          || left.name.localeCompare(right.name)),
        (film) => film.filmKey,
        (film) => `${filmLabel(film.name, film.year)} | watched ${film.exactWatchedDate || film.bestWatchedDate || "n/a"} | no current rating | reviews ${film.reviewRows}`,
        AI_SAMPLE_LIMIT,
      ),
      watchlistFrontier: pickUniqueMapped(
        watchlistFrontier,
        (film) => film.filmKey,
        (film) => `${filmLabel(film.name, film.year)} | added ${pickEarliestIso(film.watchlistAddedDates) || "n/a"}`,
        8,
      ),
    },
    listSignals: {
      activeLists: compactListTitles(summary?.listSummary.lists, "active", 6),
      archivedLists: compactListTitles(summary?.listSummary.lists, "orphaned", 4),
    },
    dataQuality: {
      parseIssueCount: summary?.parseIssues.length || 0,
      importSpikeDetected: summary?.importSpikeSummary.importSpikeDetected || false,
      largestSingleDayImport: summary?.importSpikeSummary.largestSingleDayImportDate
        ? `${summary.importSpikeSummary.largestSingleDayImportDate}:${summary.importSpikeSummary.largestSingleDayImportCount}`
        : null,
      exactDateCoveragePct: summary ? round1(summary.dateQualitySummary.exactDatedWatchedFilmCoverage * 100) : null,
      currentOnlyRatings: summary?.ratingSourceSummary.currentOnly || 0,
      loggedOnlyRatings: summary?.ratingSourceSummary.loggedOnly || 0,
      activeLists: summary?.listSummary.activeListCount || 0,
      archivedLists: summary?.listSummary.archivedListCount || 0,
    },
  };

  let compactProfile = profile;
  let serialized = JSON.stringify(compactProfile);

  if (serialized.length > AI_PAYLOAD_CHAR_BUDGET) {
    compactProfile = {
      ...compactProfile,
      reviewLanguage: {
        ...compactProfile.reviewLanguage,
        topWords: compactProfile.reviewLanguage.topWords.slice(0, 12),
        sampleSnippets: compactProfile.reviewLanguage.sampleSnippets.slice(0, 4),
      },
      behaviorSignals: {
        ...compactProfile.behaviorSignals,
        recentWatches: compactProfile.behaviorSignals.recentWatches.slice(0, 8),
        currentFavorites: compactProfile.behaviorSignals.currentFavorites.slice(0, 8),
        rewatches: compactProfile.behaviorSignals.rewatches.slice(0, 8),
        unratedWatched: compactProfile.behaviorSignals.unratedWatched.slice(0, 6),
        watchlistFrontier: compactProfile.behaviorSignals.watchlistFrontier.slice(0, 6),
      },
    };
    serialized = JSON.stringify(compactProfile);
  }

  return {
    ...compactProfile,
    payloadStats: {
      approxChars: serialized.length,
      filmsInSource: films.length,
      watchedFilmsInSource: watchedFilms.length,
      currentRatedInSource: currentRatedFilms.length,
      loggedRatedInSource: loggedRatedFilms.length,
      comparableInSource: comparableFilms.length,
      reviewFilmsInSource: reviewFilms.length,
    },
  };
}

export default function App() {
  const [toast, setToast] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [films, setFilms] = useState<FilmRecord[] | null>(null);
  const [datasetSummary, setDatasetSummary] = useState<DatasetSummary | null>(null);
  const [parsedLists, setParsedLists] = useState<ParsedListFile[]>([]);
  const [showDebug, setShowDebug] = useState(() => parseShowDebugFromQuery());
  const [scope, setScope] = useState<AnalysisScope>(() => parseScopeFromQuery());
  const [label, setLabel] = useState("");
  const [language, setLanguage] = useState<Lang>("en");
  const [mode, setMode] = useState<"praise" | "roast">("roast");
  const [roastLevel, setRoastLevel] = useState<1 | 2 | 3>(2);
  const [provider, setProvider] = useState<Provider>("default");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [ratingDriftSort, setRatingDriftSort] = useState<RatingDriftSortKey>(() => parseRatingDriftSortFromQuery());
  const [explorer, setExplorer] = useState<FilmExplorerPayload | null>(null);
  const [explorerRoute, setExplorerRoute] = useState<string | null>(() => parseExplorerRouteFromQuery());
  const [explorerSortKey, setExplorerSortKey] = useState("title");
  const [explorerSortDirection, setExplorerSortDirection] = useState<ExplorerSortDirection>("asc");
  const [helpState, setHelpState] = useState<HelpState>(() => parseHelpStateFromStorage());
  const [savedViews, setSavedViews] = useState<SavedViewRecord[]>(() => parseSavedViewsFromStorage());
  const [savedViewDraftName, setSavedViewDraftName] = useState("");
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<ReportSectionId>(() => parseInitialSection());
  const [collapsedSections, setCollapsedSections] = useState<ReportSectionCollapseState>(() => parseCollapsedSectionsFromStorage(parseInitialSection()));
  const [reducedMotion, setReducedMotion] = useState(false);
  const [reportMenuInView, setReportMenuInView] = useState(true);
  const [revealedSectionIds, setRevealedSectionIds] = useState<ReportSectionId[]>([]);
  const [uiCue, setUiCue] = useState<UiCue | null>(null);
  const [attentiveSectionId, setAttentiveSectionId] = useState<ReportSectionId | null>(null);
  const [enteredSectionId, setEnteredSectionId] = useState<ReportSectionId | null>(null);
  const [guidedSectionId, setGuidedSectionId] = useState<ReportSectionId | null>(null);
  const [explorerOrigin, setExplorerOrigin] = useState<ExplorerOrigin | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reportMenuRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Partial<Record<ReportSectionId, HTMLElement | null>>>({});
  const activeScrollFrame = useRef<number | null>(null);
  const uiCueTimerRef = useRef<number | null>(null);
  const hoverDwellTimerRef = useRef<number | null>(null);
  const sectionCueTimerRef = useRef<number | null>(null);
  const sectionEntryTimerRef = useRef<number | null>(null);

  const stats = useMemo(
    () => (films && datasetSummary ? computeStats(films, datasetSummary, label) : null),
    [films, datasetSummary, label],
  );
  const scopedView = useMemo(
    () => (films ? computeScopedView(films, scope, label) : null),
    [films, label, scope],
  );
  const scopeSelection = useMemo(
    () => (films ? applyAnalysisScope(films, scope) : null),
    [films, scope],
  );
  const scopeIsActive = scopedView?.scope.isActive || false;

  const scopedFilmRows = useMemo(
    () => (scopeIsActive && scopedView ? scopedView.filmRows : (films ? buildExplorerFilmRows(films) : [])),
    [films, scopeIsActive, scopedView],
  );
  const globalReviewRows = useMemo(
    () => (films ? buildExplorerReviewRows(films) : []),
    [films],
  );
  const watchlistExplorerRows = useMemo(
    () => (films ? buildExplorerFilmRows(films.filter((film) => film.inWatchlist)) : []),
    [films],
  );
  const watchedFilmRows = useMemo(
    () => (films ? buildExplorerFilmRows(films.filter((film) => isWatchedFilm(film))) : []),
    [films],
  );

  const currentReviewRows = scopeIsActive && scopedView ? scopedView.reviewRows : globalReviewRows;
  const currentRatingDrift = scopeIsActive && scopedView ? scopedView.ratingDrift : stats?.ratingDrift;
  const currentReviews = scopeIsActive && scopedView ? scopedView.reviews : stats?.reviews;
  const currentReleaseAnalytics = scopeIsActive && scopedView ? scopedView.releaseAnalytics : stats?.releaseAnalytics;
  const currentReleaseDistribution = scopeIsActive && scopedView ? scopedView.releaseDistribution : stats?.releaseYears.watchedFilms;
  const currentReleaseFilmRows = scopeIsActive ? scopedFilmRows : watchedFilmRows;
  const currentShareText = scopeIsActive && scopedView ? scopedView.shareText : stats?.shareText;
  const currentShareCard = scopeIsActive && scopedView ? scopedView.shareCard : stats?.shareCard;
  const currentShareGeneratedAt = scopeIsActive && scopedView ? scopedView.generatedAt : stats?.generatedAt;
  const currentShareBadge = scopeIsActive ? "Filtered view" : (stats?.fun.badge || "Full report");

  const watchActivitySourceFilms = useMemo(
    () => (scopeSelection ? scopeSelection.films : (films || [])),
    [films, scopeSelection],
  );
  const currentWatchActivity = useMemo(
    () => buildExactWatchActivity(watchActivitySourceFilms),
    [watchActivitySourceFilms],
  );
  const groupedDataQuality = useMemo(
    () => (films && datasetSummary ? buildGroupedDataQuality(films, datasetSummary) : []),
    [datasetSummary, films],
  );
  const archiveListFiles = useMemo(
    () => [...parsedLists]
      .filter((list) => list.scope !== "deleted")
      .sort((left, right) =>
        left.scope.localeCompare(right.scope)
        || (left.metadata.title || "").localeCompare(right.metadata.title || "")
        || left.path.localeCompare(right.path)),
    [parsedLists],
  );
  const filmMapByKey = useMemo(
    () => new Map((films || []).map((film) => [film.filmKey, film])),
    [films],
  );

  const allViews = useMemo<ViewOption[]>(
    () => [...BUILTIN_SAVED_VIEW_PRESETS, ...savedViews],
    [savedViews],
  );
  const activeView = allViews.find((view) => view.id === activeViewId) || null;
  const activeSavedViewName = activeView?.name || null;
  const currentScopeSummary = scopeIsActive && scopedView ? scopedView.scope.summary : "Full report";

  const currentViewSnapshot = useMemo<SavedViewSnapshot>(() => ({
    scope: { ...scope },
    explorerRoute,
    ratingDriftSort,
    explorerSortKey,
    explorerSortDirection,
  }), [explorerRoute, explorerSortDirection, explorerSortKey, ratingDriftSort, scope]);

  const currentMajorCounts = useMemo(() => {
    if (scopeIsActive && scopedView) {
      return {
        watchedFilms: scopedView.overview.scopedFilms.value,
        currentRatedFilms: scopedView.overview.currentRatedFilms.value,
        exactDatedWatchedFilms: scopedView.overview.exactDatedWatchedFilms.value,
        watchedFilmsWithoutExactDate: scopedView.overview.scopedFilms.value - scopedView.overview.exactDatedWatchedFilms.value,
      };
    }
    if (!stats) {
      return null;
    }
    return {
      watchedFilms: stats.overview.watchedFilmsUnique.value,
      currentRatedFilms: stats.overview.currentRatedFilms.value,
      exactDatedWatchedFilms: stats.overview.exactDatedWatchedFilms.value,
      watchedFilmsWithoutExactDate: stats.overview.watchedFilmsWithoutExactDate.value,
    };
  }, [scopeIsActive, scopedView, stats]);

  const reportShareContextItems = useMemo(() => {
    const items = [
      { label: "Report", value: "Current Letterboxd export" },
      { label: "View", value: currentScopeSummary },
    ];
    if (activeSavedViewName) {
      items.push({ label: "Saved view", value: activeSavedViewName });
    }
    return items;
  }, [activeSavedViewName, currentScopeSummary, scopeIsActive]);

  const currentViewSummary = useMemo(() => {
    if (!currentShareText || !currentMajorCounts) {
      return null;
    }
    return buildCurrentViewSummary({
      scopeIsActive,
      scopeSummary: currentScopeSummary,
      shareTextLong: currentShareText.long,
      majorCounts: currentMajorCounts,
      drilldown: explorer
        ? {
          title: explorer.title,
          source: explorer.source,
          rowBasis: explorer.context.rowBasis,
          rowCount: explorer.rows.length,
        }
        : null,
      activeSavedViewName,
    });
  }, [activeSavedViewName, currentMajorCounts, currentScopeSummary, currentShareText, explorer, scopeIsActive]);
  const usesBuiltInAi = provider === "default" || provider === "default_kimi";
  const usesOpenAICompatAi = provider === "openai_compat";
  const usesGeminiAi = provider === "gemini";

  const drilldownExportMetadata = useMemo(() => {
    if (!explorer) {
      return null;
    }
    const rows = buildExplorerExportRows(explorer);
    return {
      exportFileName: explorer.exportFileName,
      rowCount: rows.length,
      columns: rows.length ? Object.keys(rows[0]) : [],
      rowBasis: explorer.context.rowBasis,
    };
  }, [explorer]);

  const explorerSectionId = useMemo(
    () => inferExplorerSectionId(explorerRoute),
    [explorerRoute],
  );

  const explorerContextTrail = useMemo(
    () => explorer
      ? buildDrilldownContextTrail({
        activeScope: currentScopeSummary,
        sectionId: explorerSectionId,
        drilldownSource: explorer.source,
        drilldownTitle: explorer.title,
      })
      : [],
    [currentScopeSummary, explorer, explorerSectionId],
  );

  const ratingHistogram = (scopeIsActive ? scopedView?.ratings.current.histogram : stats?.ratings.current.histogram)
    ? (scopeIsActive ? scopedView?.ratings.current.histogram : stats?.ratings.current.histogram)!.map((item) => ({
      label: ratingLabel(item.rating),
      value: item.count,
    }))
    : [];
  const topReleaseYears = currentReleaseDistribution
    ? currentReleaseDistribution.topYears.map((item) => ({ label: String(item.year), value: item.count }))
    : [];
  const topDecades = currentReleaseDistribution
    ? [...currentReleaseDistribution.decadeBuckets]
      .sort((left, right) => right.count - left.count)
      .slice(0, 8)
      .map((item) => ({ label: item.decade, value: item.count }))
    : [];
  const watchlistReleaseYears = stats
    ? stats.backlog.releaseYears.topYears.map((item) => ({ label: String(item.year), value: item.count }))
    : [];
  const watchlistDecades = stats
    ? [...stats.backlog.releaseYears.decadeBuckets]
      .sort((left, right) => right.count - left.count)
      .slice(0, 8)
      .map((item) => ({ label: item.decade, value: item.count }))
    : [];

  const reportMenuEntries = useMemo(() => {
    if (!stats || !datasetSummary) {
      return [];
    }

    const highestCurrentDecade = currentReleaseAnalytics?.summary.highestCurrentRatedDecade || null;
    const topWatchedDecade = topDecades[0] || null;
    const topWatchlistDecade = watchlistDecades[0] || null;
    const driftCoverage = stats.dataQuality.moduleCoverage.find((row) => row.id === "ratingDrift") || null;
    const currentMeanValue = scopeIsActive && scopedView
      ? scopedView.overview.currentMeanRating.value
      : stats.overview.currentMeanRating.value;

    return buildReportMenuEntries({
      overview: [
        {
          label: scopeIsActive ? "Films in view" : "Watched films",
          value: formatInt(currentMajorCounts?.watchedFilms || 0),
        },
        {
          label: "Current ratings",
          value: formatInt(currentMajorCounts?.currentRatedFilms || 0),
        },
      ],
      "watched-activity": [
        {
          label: "Exact watch dates",
          value: formatInt(currentWatchActivity.exactDatedWatchedFilms),
        },
        {
          label: "Best streak",
          value: currentWatchActivity.bestStreak ? `${formatInt(currentWatchActivity.bestStreak.days)} days` : "n/a",
        },
      ],
      ratings: [
        {
          label: "Current mean",
          value: currentMeanValue === null ? "n/a" : String(round3(currentMeanValue)),
        },
        {
          label: "Changed ratings",
          value: formatInt((currentRatingDrift || stats.ratingDrift).summary.changed.value),
        },
      ],
      reviews: [
        {
          label: "Review rows",
          value: formatInt((currentReviews || stats.reviews).summary.reviewRows.value),
        },
        {
          label: "Review rate",
          value: formatPct((currentReviews || stats.reviews).summary.reviewRate.value),
        },
      ],
      release: [
        {
          label: "Standout decade",
          value: highestCurrentDecade ? highestCurrentDecade.decade : (topWatchedDecade?.label || "n/a"),
        },
        {
          label: "Count",
          value: highestCurrentDecade
            ? `${formatInt(highestCurrentDecade.ratedFilms)} rated`
            : (topWatchedDecade ? formatInt(topWatchedDecade.value) : "n/a"),
        },
      ],
      watchlist: [
        {
          label: "Watchlist films",
          value: formatInt(stats.backlog.summary.watchlistFilms.value),
        },
        {
          label: "Top watchlist decade",
          value: topWatchlistDecade ? topWatchlistDecade.label : "n/a",
        },
      ],
      archives: [
        {
          label: "Active lists",
          value: formatInt(stats.archives.summary.activeLists.value),
        },
        {
          label: "Archived lists",
          value: formatInt(stats.archives.summary.archivedLists.value),
        },
      ],
      "data-quality": [
        {
          label: "Exact-date coverage",
          value: formatPct(datasetSummary.dateQualitySummary.exactDatedWatchedFilmCoverage),
        },
        {
          label: "Drift coverage",
          value: driftCoverage?.coverage === null || driftCoverage?.coverage === undefined
            ? "n/a"
            : formatPct(driftCoverage.coverage),
        },
      ],
      ai: [
        {
          label: "Report films",
          value: formatInt(currentMajorCounts?.watchedFilms || 0),
        },
        {
          label: "Draft",
          value: aiBusy ? "Writing" : aiText ? "Ready" : "Idle",
        },
      ],
    });
  }, [
    aiBusy,
    aiText,
    currentMajorCounts,
    currentRatingDrift,
    currentReleaseAnalytics,
    currentReviews,
    currentWatchActivity,
    datasetSummary,
    scopeIsActive,
    scopedView,
    stats,
    topDecades,
    watchlistDecades,
  ]);

  const reportMenuMetricsById = useMemo(
    () => Object.fromEntries(reportMenuEntries.map((entry) => [entry.id, entry.metrics])) as Record<ReportSectionId, Array<{ label: string; value: string }>>,
    [reportMenuEntries],
  );

  const overviewCards = useMemo(() => {
    if (scopeIsActive && scopedView) {
      return [
        {
          title: "Films in view",
          value: formatInt(scopedView.overview.scopedFilms.value),
          label: scopedView.scope.summary,
        },
        {
          title: "Current ratings",
          value: formatInt(scopedView.overview.currentRatedFilms.value),
          label: "inside this view",
          help: "Unique films in the current view that have a currentRating from ratings.csv.",
        },
        {
          title: "Current mean",
          value: scopedView.overview.currentMeanRating.value === null ? "n/a" : String(round3(scopedView.overview.currentMeanRating.value)),
          label: "currentRating within the active scope",
        },
        {
          title: "Mean delta",
          value: scopedView.overview.meanDelta.value === null
            ? "n/a"
            : `${scopedView.overview.meanDelta.value > 0 ? "+" : ""}${round3(scopedView.overview.meanDelta.value)}`,
          label: "currentRating - loggedRating in comparable films",
        },
      ];
    }
    if (!stats) {
      return [];
    }
    return [
      {
        title: "Watched films",
        value: formatInt(stats.overview.watchedFilmsUnique.value),
        label: "the film-level watched set",
      },
      {
        title: "Current ratings",
        value: formatInt(stats.overview.currentRatedFilms.value),
        label: "films with a current rating",
        help: "Unique films that currently have a ratings.csv snapshot. This is film-level, not raw rating rows.",
      },
      {
        title: "Current mean",
        value: stats.overview.currentMeanRating.value === null ? "n/a" : String(round3(stats.overview.currentMeanRating.value)),
        label: "based on currentRating only",
      },
      {
        title: "Best streak",
        value: formatInt(stats.overview.bestStreakDays.value),
        label: "exact watched dates only",
      },
    ];
  }, [scopeIsActive, scopedView, stats]);

  const quickFacts = useMemo(() => {
    if (!stats) {
      return [] as Array<{ label: string; value: string; help?: string }>;
    }
    return [
      { label: "Watched rows", value: formatInt(stats.quickFacts.watchedRows.value) },
      { label: "Missing current ratings", value: formatInt(stats.quickFacts.unratedWatchedFilmsWithoutCurrentRating.value) },
      {
        label: "Logged ratings",
        value: formatInt(stats.quickFacts.loggedRatedFilms.value),
        help: "Unique films that have a loggedRating from diary/review history. This is separate from the current rating snapshot.",
      },
      { label: "Review rows", value: formatInt(stats.quickFacts.reviewRows.value) },
      { label: "Watchlist films", value: formatInt(stats.quickFacts.watchlistFilms.value) },
      { label: "Commitment", value: formatPct(stats.quickFacts.commitmentIndex.value) },
      {
        label: "Current volatility",
        value: stats.quickFacts.currentRatingStddev.value === null ? "n/a" : String(round1(stats.quickFacts.currentRatingStddev.value)),
      },
    ];
  }, [stats]);

  const coverageFacts = useMemo(() => {
    if (!datasetSummary) {
      return [] as Array<{ label: string; value: string; help?: string }>;
    }
    return [
      {
        label: "Exact watch dates",
        value: `${formatInt(datasetSummary.dateQualitySummary.exactDatedWatchedFilms)} / ${formatInt(datasetSummary.coverageSummary.watchedUniverseFilmCount)}`,
        help: "Watched-universe films with at least one exact diary/review watched date. These are the films that can safely enter default watched-time charts.",
      },
      {
        label: "Missing exact watch dates",
        value: formatInt(datasetSummary.dateQualitySummary.watchedFilmsWithoutExactDate),
        help: "These still count as watched films, but stay out of default watch timeline, heatmap, streak, and watched-time charts.",
      },
      { label: "Current+logged overlap", value: formatInt(datasetSummary.ratingSourceSummary.both) },
      { label: "Changed current vs logged", value: formatInt(datasetSummary.ratingSourceSummary.changed) },
      {
        label: "Lists / archived",
        value: `${formatInt(datasetSummary.listSummary.activeListCount)} / ${formatInt(datasetSummary.listSummary.archivedListCount)}`,
      },
    ];
  }, [datasetSummary]);

  const releaseYearSpan = useMemo(() => {
    if (!films) {
      return { min: null, max: null } as { min: number | null; max: number | null };
    }
    const years = films.map((film) => film.year).filter((year): year is number => year !== null);
    if (!years.length) {
      return { min: null, max: null };
    }
    return { min: Math.min(...years), max: Math.max(...years) };
  }, [films]);

  const availableDecades = useMemo(() => {
    if (!films) {
      return [] as string[];
    }
    return Array.from(new Set(
      films
        .map((film) => film.year === null ? null : `${Math.floor(film.year / 10) * 10}s`)
        .filter((decade): decade is string => decade !== null),
    )).sort();
  }, [films]);

  function triggerUiCue(type: UiCue) {
    setUiCue(type);
    if (uiCueTimerRef.current !== null) {
      window.clearTimeout(uiCueTimerRef.current);
    }
    uiCueTimerRef.current = window.setTimeout(() => {
      setUiCue(null);
      uiCueTimerRef.current = null;
    }, 900);
  }

  function cueSection(sectionId: ReportSectionId | null) {
    setGuidedSectionId(sectionId);
    if (sectionCueTimerRef.current !== null) {
      window.clearTimeout(sectionCueTimerRef.current);
    }
    if (!sectionId) {
      sectionCueTimerRef.current = null;
      return;
    }
    sectionCueTimerRef.current = window.setTimeout(() => {
      setGuidedSectionId((current) => (current === sectionId ? null : current));
      sectionCueTimerRef.current = null;
    }, 1100);
  }

  function captureExplorerOrigin(sourceElement: HTMLElement | null) {
    if (!sourceElement || reducedMotion) {
      setExplorerOrigin(null);
      return;
    }
    const rect = sourceElement.getBoundingClientRect();
    setExplorerOrigin({
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
      width: Math.max(rect.width, 32),
      height: Math.max(rect.height, 32),
      token: Date.now(),
    });
  }

  function updateMotionVariables() {
    if (typeof window === "undefined") {
      return;
    }
    const container = containerRef.current;
    if (container) {
      const scrollMax = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      const pageProgress = clamp(window.scrollY / scrollMax, 0, 1);
      container.style.setProperty("--page-progress", pageProgress.toFixed(3));
    }
  }

  function updateSectionHash(sectionId: ReportSectionId, historyMode: "replace" | "push") {
    if (typeof window === "undefined") {
      return;
    }
    const url = `${window.location.pathname}${window.location.search}${buildReportSectionHash(sectionId)}`;
    if (historyMode === "push") {
      window.history.pushState({}, "", url);
      return;
    }
    window.history.replaceState({}, "", url);
  }

  function navigateToSection(sectionId: ReportSectionId, historyMode: "replace" | "push" = "push") {
    const target = sectionRefs.current[sectionId];
    setCollapsedSections((current) => ({ ...current, [sectionId]: false }));
    setActiveSectionId(sectionId);
    cueSection(sectionId);
    updateSectionHash(sectionId, historyMode);
    if (!target) {
      return;
    }
    const top = target.getBoundingClientRect().top + window.scrollY - 112;
    window.scrollTo({
      top: Math.max(top, 0),
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }

  function handleSectionRef(sectionId: ReportSectionId, element: HTMLElement | null) {
    sectionRefs.current[sectionId] = element;
  }

  function handleSectionPointerEnter(sectionId: ReportSectionId) {
    if (hoverDwellTimerRef.current !== null) {
      window.clearTimeout(hoverDwellTimerRef.current);
    }
    hoverDwellTimerRef.current = window.setTimeout(() => {
      setAttentiveSectionId(sectionId);
      hoverDwellTimerRef.current = null;
    }, 140);
  }

  function handleSectionPointerLeave(sectionId: ReportSectionId) {
    if (hoverDwellTimerRef.current !== null) {
      window.clearTimeout(hoverDwellTimerRef.current);
      hoverDwellTimerRef.current = null;
    }
    setAttentiveSectionId((current) => (current === sectionId ? null : current));
  }

  function jumpToReportMenu() {
    const target = reportMenuRef.current;
    if (!target) {
      return;
    }
    const top = target.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({
      top: Math.max(top, 0),
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }

  function evaluateActiveSection() {
    if (typeof window === "undefined" || !stats) {
      return;
    }
    const threshold = Math.max(140, window.innerHeight * 0.28);
    let nextSectionId: ReportSectionId = REPORT_SECTIONS[0].id;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const section of REPORT_SECTIONS) {
      const element = sectionRefs.current[section.id];
      if (!element) {
        continue;
      }
      const rect = element.getBoundingClientRect();
      const distance = Math.abs(rect.top - threshold);
      if (rect.top <= threshold && distance <= closestDistance) {
        nextSectionId = section.id;
        closestDistance = distance;
      }
      if (rect.top > threshold && closestDistance === Number.POSITIVE_INFINITY) {
        nextSectionId = section.id;
        closestDistance = distance;
      }
    }

    setActiveSectionId((current) => {
      if (current === nextSectionId) {
        return current;
      }
      updateSectionHash(nextSectionId, "replace");
      return nextSectionId;
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyPreference = () => setReducedMotion(media.matches);
    applyPreference();
    media.addEventListener?.("change", applyPreference);
    return () => media.removeEventListener?.("change", applyPreference);
  }, []);

  useEffect(() => () => {
    if (uiCueTimerRef.current !== null) {
      window.clearTimeout(uiCueTimerRef.current);
    }
    if (hoverDwellTimerRef.current !== null) {
      window.clearTimeout(hoverDwellTimerRef.current);
    }
    if (sectionCueTimerRef.current !== null) {
      window.clearTimeout(sectionCueTimerRef.current);
    }
    if (sectionEntryTimerRef.current !== null) {
      window.clearTimeout(sectionEntryTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!stats) {
      return;
    }
    setEnteredSectionId(activeSectionId);
    if (sectionEntryTimerRef.current !== null) {
      window.clearTimeout(sectionEntryTimerRef.current);
    }
    sectionEntryTimerRef.current = window.setTimeout(() => {
      setEnteredSectionId((current) => (current === activeSectionId ? null : current));
      sectionEntryTimerRef.current = null;
    }, 900);
  }, [activeSectionId, stats]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(HELP_STATE_STORAGE_KEY, helpState);
  }, [helpState]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, serializeSavedViews(savedViews));
  }, [savedViews]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(REPORT_COLLAPSE_STORAGE_KEY, serializeCollapsedSections(collapsedSections));
  }, [collapsedSections]);

  useEffect(() => {
    if (!stats) {
      return;
    }
    const hashedSection = parseReportSectionHash(window.location.hash);
    if (hashedSection) {
      setCollapsedSections((current) => ({ ...current, [hashedSection]: false }));
      setActiveSectionId(hashedSection);
    }
  }, [stats]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const onHashChange = () => {
      const hashedSection = parseReportSectionHash(window.location.hash);
      if (!hashedSection) {
        return;
      }
      setCollapsedSections((current) => ({ ...current, [hashedSection]: false }));
      setActiveSectionId(hashedSection);
      const target = sectionRefs.current[hashedSection];
      if (target) {
        const top = target.getBoundingClientRect().top + window.scrollY - 112;
        window.scrollTo({ top: Math.max(top, 0), behavior: reducedMotion ? "auto" : "smooth" });
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [reducedMotion]);

  useEffect(() => {
    if (!stats || typeof window === "undefined") {
      return;
    }
    const onScroll = () => {
      if (activeScrollFrame.current !== null) {
        window.cancelAnimationFrame(activeScrollFrame.current);
      }
      activeScrollFrame.current = window.requestAnimationFrame(() => {
        updateMotionVariables();
        evaluateActiveSection();
        activeScrollFrame.current = null;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (activeScrollFrame.current !== null) {
        window.cancelAnimationFrame(activeScrollFrame.current);
      }
    };
  }, [collapsedSections, reducedMotion, stats]);

  useEffect(() => {
    if (!stats || reducedMotion || typeof IntersectionObserver === "undefined") {
      if (stats) {
        setRevealedSectionIds(REPORT_SECTIONS.map((section) => section.id));
      }
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      setRevealedSectionIds((current) => {
        const next = new Set(current);
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute("data-section") as ReportSectionId | null;
            if (sectionId) {
              next.add(sectionId);
            }
          }
        }
        return Array.from(next);
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -12% 0px" });

    for (const section of REPORT_SECTIONS) {
      const element = sectionRefs.current[section.id];
      if (element) {
        observer.observe(element);
      }
    }
    return () => observer.disconnect();
  }, [reducedMotion, stats]);

  useEffect(() => {
    if (!stats || typeof IntersectionObserver === "undefined") {
      setReportMenuInView(true);
      return;
    }
    const target = reportMenuRef.current;
    if (!target) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setReportMenuInView(entry?.isIntersecting ?? true);
    }, { threshold: 0.24 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [stats]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const setOrDelete = (key: string, value: string | number | null, defaultValue?: string | number | null) => {
      if (value === null || value === undefined || value === "" || (defaultValue !== undefined && value === defaultValue)) {
        params.delete(key);
        return;
      }
      params.set(key, String(value));
    };

    setOrDelete("scopeBasis", scope.basis, DEFAULT_ANALYSIS_SCOPE.basis);
    setOrDelete("scopeDecade", scope.releaseDecade, null);
    setOrDelete("scopeYearMin", scope.releaseYearMin, null);
    setOrDelete("scopeYearMax", scope.releaseYearMax, null);
    setOrDelete("scopeCurrentMin", scope.currentRatingMin, null);
    setOrDelete("scopeCurrentMax", scope.currentRatingMax, null);
    setOrDelete("scopeLoggedMin", scope.loggedRatingMin, null);
    setOrDelete("scopeLoggedMax", scope.loggedRatingMax, null);
    setOrDelete("scopeReview", scope.reviewPresence, DEFAULT_ANALYSIS_SCOPE.reviewPresence);
    setOrDelete("driftSort", ratingDriftSort, "largestAbsoluteChange");
    setOrDelete("debug", showDebug ? 1 : null, null);
    setOrDelete("explorer", explorerRoute, null);

    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
  }, [explorerRoute, ratingDriftSort, scope, showDebug]);

  useEffect(() => {
    if (!activeViewId) {
      return;
    }
    const activeSnapshot = allViews.find((view) => view.id === activeViewId)?.snapshot;
    if (!activeSnapshot || !areSavedViewSnapshotsEqual(activeSnapshot, currentViewSnapshot)) {
      setActiveViewId(null);
    }
  }, [activeViewId, allViews, currentViewSnapshot]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }

  async function importZip(input: Blob | ArrayBuffer, sourceName: string) {
    setAiText("");
    setFilms(null);
    setDatasetSummary(null);
    setParsedLists([]);
    setExplorer(null);
    setExplorerRoute(null);
    setFileName(sourceName);
    try {
      const tables = await readLetterboxdExportZip(input);
      const merged = mergeTablesToFilms(tables);
      const nextParsedLists = [...tables.lists, ...tables.deleted.lists, ...tables.orphaned.lists];
      const initialSection = parseInitialSection();
      startTransition(() => {
        setFilms(merged.films);
        setDatasetSummary(merged.summary);
        setParsedLists(nextParsedLists);
        setActiveSectionId(initialSection);
        setCollapsedSections(parseCollapsedSectionsFromStorage(initialSection));
      });
      showToast("Import ready.");
    } catch {
      showToast("Import failed. Check the ZIP.");
    }
  }

  async function onUploadZip(file: File) {
    await importZip(file, file.name);
  }

  async function onLoadSample() {
    try {
      const res = await fetch("/sample_data.zip", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("sample_data.zip not found");
      }
      const buffer = await res.arrayBuffer();
      await importZip(buffer, "sample_data.zip");
    } catch {
      showToast("Couldn't load sample_data.zip");
    }
  }

  async function downloadShareCard() {
    const el = document.getElementById("shareCard");
    if (!el) {
      showToast("Share card not ready.");
      return;
    }
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(el as HTMLElement, { backgroundColor: null, scale: 2 });
    const url = canvas.toDataURL("image/png");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = scopeIsActive ? "letterboxd-filtered-view.png" : "letterboxd-report-card.png";
    anchor.click();
    triggerUiCue("share");
  }

  async function runAI() {
    if (!stats || !films) {
      return;
    }
    setAiBusy(true);
    setAiText("");
    setAiProgress(8);
    const id = window.setInterval(() => setAiProgress((value) => Math.min(value + 7, 92)), 700);
    try {
      const dossier = aiDossier(films, stats, datasetSummary);
      const requestBody = {
        provider,
        language,
        mode,
        roastLevel,
        profile: dossier,
        ...(usesOpenAICompatAi
          ? {
            apiKey: apiKey || undefined,
            baseUrl: baseUrl || undefined,
            model: model || undefined,
          }
          : {}),
        ...(usesGeminiAi
          ? {
            apiKey: apiKey || undefined,
            model: model || undefined,
          }
          : {}),
      };
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = (await res.json().catch(() => ({}))) as { text?: unknown; error?: unknown };
      if (!res.ok) {
        setAiText(typeof data.error === "string" ? data.error : "AI request failed.");
      } else {
        setAiText(typeof data.text === "string" ? data.text : "");
      }
    } catch {
      setAiText("AI request failed.");
    } finally {
      window.clearInterval(id);
      setAiProgress(100);
      window.setTimeout(() => setAiProgress(0), 1200);
      setAiBusy(false);
    }
  }

  function explorerContext(
    drilldownSource: string,
    rowBasis: string,
    emptyTitle: string,
    emptyBody: string,
  ) {
    return {
      globalContext: fileName ? `Imported export: ${fileName}` : "Current Letterboxd export",
      activeScope: currentScopeSummary,
      drilldownSource,
      rowBasis,
      emptyTitle,
      emptyBody,
    };
  }

  function buildFilmExplorerPayload(
    title: string,
    subtitle: string,
    source: string,
    rows: ReturnType<typeof buildExplorerFilmRows>,
    exportFileName: string,
    emptyTitle: string,
    emptyBody: string,
  ): FilmExplorerPayload {
    return {
      kind: "films",
      title,
      subtitle,
      source,
      exportFileName,
      context: explorerContext(source, "Film-level films", emptyTitle, emptyBody),
      rows,
    };
  }

  function buildReviewExplorerPayload(
    title: string,
    subtitle: string,
    source: string,
    rows: ReturnType<typeof buildExplorerReviewRows>,
    exportFileName: string,
    emptyTitle: string,
    emptyBody: string,
  ): FilmExplorerPayload {
    return {
      kind: "reviewRows",
      title,
      subtitle,
      source,
      exportFileName,
      context: explorerContext(source, "Row-level reviews", emptyTitle, emptyBody),
      rows,
    };
  }

  function buildWatchExplorerPayload(
    title: string,
    subtitle: string,
    source: string,
    rows: ExactWatchEventRow[],
    exportFileName: string,
    emptyTitle: string,
    emptyBody: string,
  ): FilmExplorerPayload {
    return {
      kind: "watchEvents",
      title,
      subtitle,
      source,
      exportFileName,
      context: explorerContext(source, "Row-level exact watch events", emptyTitle, emptyBody),
      rows,
    };
  }

  function buildArchiveListExplorerRows(listFile: ParsedListFile) {
    return listFile.items.map((item, index) => {
      const derivedFilmKey = item.filmKey || createFilmKey(item.name, item.year);
      const matchedFilm = derivedFilmKey ? filmMapByKey.get(derivedFilmKey) || null : null;
      const currentRating = matchedFilm?.currentRating ?? null;
      const loggedRating = matchedFilm?.loggedRating ?? null;
      const longestReviewLength = matchedFilm?.reviewTexts.length
        ? Math.max(...matchedFilm.reviewTexts.map((review) => review.length))
        : null;
      const watchlistAddedDate = matchedFilm?.watchlistAddedDates.length
        ? [...matchedFilm.watchlistAddedDates].sort((left, right) => left.localeCompare(right))[0]
        : null;

      return {
        kind: "film" as const,
        id: `${listFile.path}:${item.position ?? index}:${derivedFilmKey || item.filmUrl || item.name || "item"}`,
        filmKey: derivedFilmKey || `${listFile.path}::${item.position ?? index}`,
        title: item.name || `Untitled item ${item.position ?? index + 1}`,
        year: item.year ?? matchedFilm?.year ?? null,
        filmUrl: item.filmUrl || matchedFilm?.filmUri || null,
        currentRating,
        loggedRating,
        delta: currentRating !== null && loggedRating !== null ? currentRating - loggedRating : null,
        exactWatchedDate: matchedFilm?.exactWatchedDate ?? null,
        reviewRows: matchedFilm?.reviewRows ?? 0,
        longestReviewLength,
        inWatchlist: matchedFilm?.inWatchlist ?? false,
        watchlistAddedDate,
      };
    });
  }

  function buildExplorerFromRoute(route: string): FilmExplorerPayload | null {
    const [kind, source, rawValue] = route.split("|");

    if (kind === "films" && source === "current") {
      return buildFilmExplorerPayload(
        scopeIsActive ? "Films in this view" : "All films",
        scopeIsActive
          ? "The film-level set behind the current filters."
          : "The film-level set across the full export.",
        scopeIsActive ? "Filtered films" : "Full film list",
        scopedFilmRows,
        scopeIsActive ? "filtered_films.csv" : "all_films.csv",
        "No films in this view",
        scopeIsActive
          ? "The current filters do not match any films."
          : "Import a Letterboxd export to open the film list.",
      );
    }

    if (kind === "histogram" && source) {
      const target = Number(source);
      return buildFilmExplorerPayload(
        `Current rating ${source}`,
        "The films behind this current-rating bin.",
        `Current rating ${source}`,
        scopedFilmRows.filter((row) => row.currentRating !== null && Math.round(row.currentRating * 2) / 2 === target),
        `current_rating_${source.replace(".", "_")}.csv`,
        "Nothing in this rating bin",
        "This current-rating bin is empty in the current view.",
      );
    }

    if (kind === "releaseYear" && source && rawValue) {
      const rows = source === "watchlist" ? watchlistExplorerRows : currentReleaseFilmRows;
      return buildFilmExplorerPayload(
        `Release year ${rawValue}`,
        source === "watchlist"
          ? "Watchlist films from this release year."
          : "Films from this release year in the current view.",
        source === "watchlist" ? "Watchlist release year" : "Release year",
        rows.filter((row) => row.year !== null && String(row.year) === rawValue),
        `release_year_${rawValue}.csv`,
        "Nothing in this release year",
        source === "watchlist"
          ? "This watchlist release year is empty."
          : "This release year is empty in the current view.",
      );
    }

    if (kind === "releaseDecade" && source && rawValue) {
      const rows = source === "watchlist" ? watchlistExplorerRows : currentReleaseFilmRows;
      return buildFilmExplorerPayload(
        `Release decade ${rawValue}`,
        source === "watchlist"
          ? "Watchlist films from this release decade."
          : "Films from this release decade in the current view.",
        source === "watchlist" ? "Watchlist release decade" : "Release decade",
        rows.filter((row) => row.year !== null && `${Math.floor(row.year / 10) * 10}s` === rawValue),
        `release_decade_${rawValue}.csv`,
        "Nothing in this release decade",
        source === "watchlist"
          ? "This watchlist decade is empty."
          : "This release decade is empty in the current view.",
      );
    }

    if (kind === "releaseAnalyticsDecade" && source && rawValue) {
      return buildFilmExplorerPayload(
        `Release decade ${rawValue}`,
        "The films behind this release table row.",
        "Release decade row",
        currentReleaseFilmRows.filter((row) => row.year !== null && `${Math.floor(row.year / 10) * 10}s` === rawValue),
        `release_analytics_decade_${rawValue}.csv`,
        "Nothing behind this row",
        "This release decade has no films in the current view.",
      );
    }

    if (kind === "driftCategory" && source) {
      const rows = scopedFilmRows.filter((row) => {
        if (row.currentRating === null || row.loggedRating === null || row.delta === null) {
          return false;
        }
        if (source === "comparableFilms") {
          return true;
        }
        if (source === "unchanged") {
          return Math.abs(row.delta) <= 1e-9;
        }
        if (source === "changed") {
          return Math.abs(row.delta) > 1e-9;
        }
        if (source === "upgraded") {
          return row.delta > 1e-9;
        }
        return row.delta < -1e-9;
      });
      return buildFilmExplorerPayload(
        `Rating drift: ${source}`,
        "The films behind this drift bucket.",
        `Rating drift ${source}`,
        rows,
        `rating_drift_${source}.csv`,
        "Nothing in this drift bucket",
        "The current view has no films in this drift bucket.",
      );
    }

    if (kind === "driftCase" && source) {
      const filmKey = decodeURIComponent(source);
      return buildFilmExplorerPayload(
        "Rating drift case",
        "The film behind this drift case.",
        `Drift list sorted by ${ratingDriftSort}`,
        scopedFilmRows.filter((row) => row.filmKey === filmKey),
        "rating_drift_case.csv",
        "No matching case",
        "That drift case is no longer in the current view.",
      );
    }

    if (kind === "longestReview" && source) {
      const reviewId = decodeURIComponent(source);
      return buildReviewExplorerPayload(
        "Longest review",
        "The review row behind this entry.",
        "Longest review row",
        currentReviewRows.filter((row) => row.id === reviewId),
        "longest_review_row.csv",
        "No matching review row",
        "That review row is no longer in the current view.",
      );
    }

    if (kind === "activityAll") {
      return buildWatchExplorerPayload(
        scopeIsActive ? "Watch dates in this view" : "All watch dates",
        "Exact watch rows only. Films without exact watch dates stay out.",
        "Watch dates",
        currentWatchActivity.rows,
        scopeIsActive ? "filtered_exact_watch_events.csv" : "exact_watch_events.csv",
        "No exact watch rows",
        scopeIsActive
          ? "The current filters do not contain any exact watch rows."
          : "This export does not contain any exact watch rows yet.",
      );
    }

    if (kind === "activityMonth" && source) {
      return buildWatchExplorerPayload(
        `Exact watch month ${source}`,
        "Exact watch rows in this month.",
        "Watch-date heatmap month",
        filterExactWatchRowsByMonth(currentWatchActivity.rows, source),
        `exact_watch_month_${source}.csv`,
        "No rows in this month",
        "That month has no exact watch rows in the current view.",
      );
    }

    if (kind === "activityYear" && source) {
      return buildWatchExplorerPayload(
        `Exact watch year ${source}`,
        "Exact watch rows in this year.",
        "Busiest year",
        filterExactWatchRowsByYear(currentWatchActivity.rows, source),
        `exact_watch_year_${source}.csv`,
        "No rows in this year",
        "That year has no exact watch rows in the current view.",
      );
    }

    if (kind === "activityDay" && source) {
      return buildWatchExplorerPayload(
        `Exact watch day ${source}`,
        "Exact watch rows on this day.",
        "Busiest day",
        filterExactWatchRowsByDay(currentWatchActivity.rows, source),
        `exact_watch_day_${source}.csv`,
        "No rows on this day",
        "That day has no exact watch rows in the current view.",
      );
    }

    if (kind === "activityGap" && source && rawValue) {
      return buildWatchExplorerPayload(
        "Gap context",
        "Exact watch rows around this gap.",
        "Longest gap",
        filterExactWatchRowsByRange(currentWatchActivity.rows, source, rawValue),
        `exact_watch_gap_${source}_${rawValue}.csv`,
        "No rows around this gap",
        "There are no exact watch rows around this gap in the current view.",
      );
    }

    if (kind === "activityStreak" && source && rawValue) {
      return buildWatchExplorerPayload(
        `Exact watch streak ${source} to ${rawValue}`,
        "Exact watch rows inside this streak.",
        "Best streak",
        filterExactWatchRowsByRange(currentWatchActivity.rows, source, rawValue),
        `exact_watch_streak_${source}_${rawValue}.csv`,
        "No rows in this streak",
        "This streak window has no exact watch rows in the current view.",
      );
    }

    if (kind === "archiveList" && source) {
      const listPath = decodeURIComponent(source);
      const listFile = archiveListFiles.find((list) => list.path === listPath);
      if (!listFile) {
        return null;
      }
      const rows = buildArchiveListExplorerRows(listFile);
      const exportLabel = listFile.metadata.title || listFile.path.split("/").pop() || "archive_list";
      return buildFilmExplorerPayload(
        listFile.metadata.title || "Parsed list",
        `Films parsed from ${listFile.scope === "orphaned" ? "an archived / orphaned list export" : "this list export"}.`,
        "Parsed list items",
        rows,
        `${slugifyFileName(exportLabel)}_items.csv`,
        "No films in this list",
        "This parsed list does not contain any film items.",
      );
    }

    return null;
  }

  function openExplorerRoute(
    route: string,
    sortOverride?: { key: string; direction: ExplorerSortDirection },
    sourceElement?: HTMLElement | null,
  ) {
    const payload = buildExplorerFromRoute(route);
    if (!payload) {
      showToast("No rows behind this yet.");
      return;
    }
    const nextSort = sortOverride || defaultExplorerSort(payload);
    const linkedSectionId = inferExplorerSectionId(route);
    captureExplorerOrigin(sourceElement || null);
    startTransition(() => {
      setExplorerSortKey(nextSort.key);
      setExplorerSortDirection(nextSort.direction);
      setExplorerRoute(route);
      setExplorer(payload);
      if (linkedSectionId) {
        setCollapsedSections((current) => ({ ...current, [linkedSectionId]: false }));
        setActiveSectionId(linkedSectionId);
        cueSection(linkedSectionId);
      }
    });
  }

  useEffect(() => {
    if (!explorerRoute || !films) {
      setExplorer(null);
      return;
    }
    const payload = buildExplorerFromRoute(explorerRoute);
    setExplorer(payload);
    if (!payload) {
      setExplorerRoute(null);
    }
  }, [
    archiveListFiles,
    currentReleaseFilmRows,
    currentReviewRows,
    currentWatchActivity,
    explorerRoute,
    films,
    ratingDriftSort,
    scopedFilmRows,
    scopeIsActive,
    scopedView,
    watchlistExplorerRows,
  ]);

  function exportCurrentFilmList() {
    const payload = buildExplorerFromRoute("films|current");
    if (!payload) {
      showToast("No films to export.");
      return;
    }
    const rows = buildExplorerExportRows(payload);
    if (!rows.length) {
      showToast("No films to export.");
      return;
    }
    writeCsv(payload.exportFileName, rows);
    triggerUiCue("share");
    showToast("Films exported.");
  }

  function exportCurrentDrilldown() {
    if (!explorer) {
      showToast("No detail view is open.");
      return;
    }
    writeCsv(explorer.exportFileName, buildExplorerExportRows(explorer));
    triggerUiCue("share");
    showToast("Detail CSV exported.");
  }

  async function copyCurrentViewSummary() {
    if (!currentViewSummary) {
      return;
    }
    try {
      await navigator.clipboard.writeText(currentViewSummary.text);
      triggerUiCue("share");
      showToast("View note copied.");
    } catch {
      showToast("Copy failed.");
    }
  }

  function exportActiveSavedViewSummary() {
    if (!activeView) {
      showToast("Open a saved view first.");
      return;
    }
    downloadTextFile(`${slugifyFileName(activeView.name)}_summary.txt`, buildSavedViewSummaryText(activeView));
    triggerUiCue("share");
    showToast("Saved view note exported.");
  }

  function saveCurrentView() {
    if (!films) {
      showToast("Import an export first.");
      return;
    }
    const record = createSavedViewRecord(savedViewDraftName || "Saved view", currentViewSnapshot);
    setSavedViews((current) => [record, ...current]);
    setSavedViewDraftName("");
    setActiveViewId(record.id);
    triggerUiCue("saved-view");
    showToast(`Saved: ${record.name}`);
  }

  function loadView(view: ViewOption) {
    const linkedSectionId = inferExplorerSectionId(view.snapshot.explorerRoute) || activeSectionId;
    startTransition(() => {
      setScope({ ...view.snapshot.scope });
      setRatingDriftSort(view.snapshot.ratingDriftSort);
      setExplorerSortKey(view.snapshot.explorerSortKey);
      setExplorerSortDirection(view.snapshot.explorerSortDirection);
      setExplorerRoute(view.snapshot.explorerRoute);
      if (!view.snapshot.explorerRoute) {
        setExplorer(null);
      }
      setActiveViewId(view.id);
      setActiveSectionId(linkedSectionId);
      setCollapsedSections((current) => ({ ...current, [linkedSectionId]: false }));
    });
    cueSection(linkedSectionId);
    updateSectionHash(linkedSectionId, "replace");
    triggerUiCue("saved-view");
    showToast(`Opened: ${view.name}`);
  }

  function renameSavedView(view: SavedViewRecord) {
    const nextName = window.prompt("Rename this view", view.name)?.trim();
    if (!nextName || nextName === view.name) {
      return;
    }
    setSavedViews((current) => current.map((item) => item.id === view.id
      ? { ...item, name: nextName, updatedAt: new Date().toISOString() }
      : item));
    showToast(`Renamed: ${nextName}`);
  }

  function deleteSavedView(view: SavedViewRecord) {
    if (!window.confirm(`Delete "${view.name}"?`)) {
      return;
    }
    setSavedViews((current) => current.filter((item) => item.id !== view.id));
    if (activeViewId === view.id) {
      setActiveViewId(null);
    }
    showToast(`Deleted: ${view.name}`);
  }

  function updateExplorerSort(key: string, direction: ExplorerSortDirection) {
    setExplorerSortKey(key);
    setExplorerSortDirection(direction);
  }

  function handleScopeChange(nextScope: AnalysisScope) {
    startTransition(() => {
      setScope(nextScope);
    });
    cueSection(activeSectionId);
    triggerUiCue("scope");
  }

  function handleScopeReset() {
    startTransition(() => {
      setScope(DEFAULT_ANALYSIS_SCOPE);
    });
    cueSection(activeSectionId);
    triggerUiCue("scope");
  }

  function toggleSection(sectionId: ReportSectionId) {
    setCollapsedSections((current) => {
      if (sectionId === "overview") {
        return { ...current, overview: false };
      }
      return {
        ...current,
        [sectionId]: !current[sectionId],
      };
    });
  }

  function handleDataQualityJumpTarget(target: string) {
    const sectionId = parseReportSectionHash(`#${target}`);
    if (sectionId) {
      navigateToSection(sectionId);
    }
  }

  function openHistogramBin(labelValue: string, sourceElement?: HTMLElement | null) {
    openExplorerRoute(`histogram|${labelValue}`, undefined, sourceElement);
  }

  function openReleaseYearExplorer(yearLabel: string, source: "current" | "watchlist", sourceElement?: HTMLElement | null) {
    openExplorerRoute(`releaseYear|${source}|${yearLabel}`, undefined, sourceElement);
  }

  function openReleaseDecadeExplorer(decadeLabel: string, source: "current" | "watchlist", sourceElement?: HTMLElement | null) {
    openExplorerRoute(`releaseDecade|${source}|${decadeLabel}`, undefined, sourceElement);
  }

  function openReleaseAnalyticsDecadeExplorer(decadeLabel: string, sourceElement?: HTMLElement | null) {
    openExplorerRoute(`releaseAnalyticsDecade|current|${decadeLabel}`, undefined, sourceElement);
  }

  function openDriftCategory(category: "comparableFilms" | "unchanged" | "changed" | "upgraded" | "downgraded", sourceElement?: HTMLElement | null) {
    openExplorerRoute(`driftCategory|${category}`, undefined, sourceElement);
  }

  function openDriftCaseExplorer(filmKey: string, sourceElement?: HTMLElement | null) {
    openExplorerRoute(`driftCase|${encodeURIComponent(filmKey)}`, undefined, sourceElement);
  }

  function openLongestReviewExplorer(reviewId: string, sourceElement?: HTMLElement | null) {
    openExplorerRoute(`longestReview|${encodeURIComponent(reviewId)}`, undefined, sourceElement);
  }

  function openWatchActivityExplorer(sourceElement?: HTMLElement | null) {
    openExplorerRoute("activityAll", undefined, sourceElement);
  }

  function openWatchActivityMonth(month: string, sourceElement?: HTMLElement | null) {
    openExplorerRoute(`activityMonth|${month}`, undefined, sourceElement);
  }

  function openWatchActivityYear(year: string, sourceElement?: HTMLElement | null) {
    openExplorerRoute(`activityYear|${year}`, undefined, sourceElement);
  }

  function openWatchActivityDay(day: string, sourceElement?: HTMLElement | null) {
    openExplorerRoute(`activityDay|${day}`, undefined, sourceElement);
  }

  function openWatchActivityGap(startDate: string, endDate: string, sourceElement?: HTMLElement | null) {
    openExplorerRoute(`activityGap|${startDate}|${endDate}`, undefined, sourceElement);
  }

  function openWatchActivityStreak(startDate: string, endDate: string, sourceElement?: HTMLElement | null) {
    openExplorerRoute(`activityStreak|${startDate}|${endDate}`, undefined, sourceElement);
  }

  function openArchiveListExplorer(listPath: string, sourceElement?: HTMLElement | null) {
    openExplorerRoute(`archiveList|${encodeURIComponent(listPath)}`, undefined, sourceElement);
  }

  const debugPayload = datasetSummary && stats
    ? {
      datasetSummary,
      onboarding: {
        state: helpState,
      },
      savedViews: {
        activeViewId,
        activeViewName: activeSavedViewName,
        savedCount: savedViews.length,
        presetCount: BUILTIN_SAVED_VIEW_PRESETS.length,
        currentSnapshot: currentViewSnapshot,
      },
      reportNavigation: {
        activeSectionId,
        activeSectionTitle: getReportSectionTitle(activeSectionId),
        activeSectionHash: buildReportSectionHash(activeSectionId),
        menu: {
          heroVisible: reportMenuInView,
          stickyVisible: !reportMenuInView,
          entries: reportMenuEntries,
        },
        collapsedSections,
        reducedMotion,
      },
      motion: {
        uiCue,
        attentiveSectionId,
        enteredSectionId,
        guidedSectionId,
        explorerOrigin,
      },
      activeScopeInput: scope,
      activeScope: scopedView?.scope || null,
      scopedOverview: scopedView?.overview || null,
      currentViewSummary,
      share: {
        shareText: currentShareText || null,
        shareCard: currentShareCard || null,
        reportContext: reportShareContextItems,
      },
      watchActivity: {
        exactWatchEvents: currentWatchActivity.exactWatchEvents,
        exactDatedWatchedFilms: currentWatchActivity.exactDatedWatchedFilms,
        busiestMonths: currentWatchActivity.busiestMonths,
        busiestYears: currentWatchActivity.busiestYears,
        busiestDay: currentWatchActivity.busiestDay,
        bestStreak: currentWatchActivity.bestStreak,
        longestGaps: currentWatchActivity.longestGaps,
      },
      ratingDrift: {
        summary: (currentRatingDrift || stats.ratingDrift).summary,
        semantics: (currentRatingDrift || stats.ratingDrift).semantics,
        topCases: {
          biggestDowngrade: (currentRatingDrift || stats.ratingDrift).lists.biggestDowngrade.slice(0, 10),
          biggestUpgrade: (currentRatingDrift || stats.ratingDrift).lists.biggestUpgrade.slice(0, 10),
          largestAbsoluteChange: (currentRatingDrift || stats.ratingDrift).lists.largestAbsoluteChange.slice(0, 10),
        },
      },
      reviews: {
        summary: (currentReviews || stats.reviews).summary,
        longestReviews: (currentReviews || stats.reviews).longestReviews.slice(0, 10),
        topWords: (currentReviews || stats.reviews).topWords,
      },
      releaseAnalytics: currentReleaseAnalytics || stats.releaseAnalytics,
      archives: {
        summary: stats.archives.summary,
        archiveScopes: stats.archives.archiveScopes,
        lists: stats.archives.lists.slice(0, 12),
      },
      dataQuality: {
        summary: stats.dataQuality,
        groupedSections: groupedDataQuality,
      },
      drilldown: explorer
        ? {
          route: explorerRoute,
          title: explorer.title,
          source: explorer.source,
          kind: explorer.kind,
          rowBasis: explorer.context.rowBasis,
          rowCount: explorer.rows.length,
          linkedSectionId: explorerSectionId,
          linkedSectionTitle: explorerSectionId ? getReportSectionTitle(explorerSectionId) : null,
          contextTrail: explorerContextTrail,
          exportMetadata: drilldownExportMetadata,
          sort: {
            key: explorerSortKey,
            direction: explorerSortDirection,
          },
        }
        : null,
    }
    : datasetSummary;
  const debugJson = debugPayload ? JSON.stringify(debugPayload, null, 2) : "";
  const sampleDateProbe = films
    ? films.slice(0, 3).map((film) => ({ film: film.name, timeline: getBestTimelineDates(film) }))
    : [];

  return (
    <div className="container" ref={containerRef} data-ui-cue={uiCue || undefined}>
      <div className="topbar">
        <div className="brand">
          <h1>Letterboxd Report</h1>
          <div className="sub">A calmer read on your export: charts, notes, and film detail.</div>
        </div>
        <div className="row">
          <a className="badge" href="https://github.com/Erik0318/Letterboxd-AI-Review" target="_blank" rel="noreferrer">Project GitHub</a>
          <button className="btn danger printHidden" onClick={() => window.location.reload()}>Reset</button>
        </div>
      </div>

      <section className={`dashboardSection reportPreludeSection${uiCue === "scope" ? " isScopeCue" : ""}${uiCue === "saved-view" ? " isSavedViewCue" : ""}`}>
        <SectionHeader
          title="Import, Notes, and Controls"
          description="Bring in an export, get your bearings, then shape the report with filters and saved views."
        />
        <div className="grid">
          <div className="card" id="section-import">
            <h2>Import</h2>
            <div className="drop">
              <input type="file" accept=".zip" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUploadZip(file); }} />
              <div className="small">{fileName || "Drop in a Letterboxd export ZIP"}</div>
              <div className="small">Everything runs locally in the browser. Refresh clears the session.</div>
              <button className="btn primary" style={{ marginTop: 10 }} onClick={onLoadSample}>Load sample_data.zip</button>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <div>
                <div className="small">Name on the share card</div>
                <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Optional" />
              </div>
            </div>

            {stats && (
              <div className="row" style={{ marginTop: 10 }}>
                <span className="badge">{formatInt(films?.length || 0)} merged film records</span>
                <span className="badge">{formatInt(stats.overview.watchedFilmsUnique.value)} watched films</span>
                <span className="badge">{formatInt(stats.overview.exactDatedWatchedFilms.value)} exact watch dates</span>
                <span className="badge">{formatInt(stats.quickFacts.watchlistFilms.value)} watchlist films</span>
                <span className="badge">{formatInt(stats.quickFacts.reviewRows.value)} review rows</span>
              </div>
            )}
          </div>

          {stats && (
            <OnboardingPanel
              className="onboardingCard"
              state={helpState}
              onExpand={() => setHelpState("expanded")}
              onCollapse={() => setHelpState("collapsed")}
              onDismiss={() => setHelpState("dismissed")}
            />
          )}

          {stats && (
            <div className="fullSpan" ref={reportMenuRef}>
              <ReportMenu
                entries={reportMenuEntries}
                activeSectionId={activeSectionId}
                activeScopeSummary={currentScopeSummary}
                activeViewName={activeSavedViewName}
                onNavigate={navigateToSection}
              />
            </div>
          )}

          {films && scopedView && (
            <ScopeBar
              className={uiCue === "scope" ? "isUiCue" : undefined}
              scope={scope}
              isActive={scopeIsActive}
              chips={scopedView.scope.appliedFilters}
              basisFilms={scopedView.scope.counts.basisFilms}
              matchingFilms={scopeIsActive ? scopedView.scope.counts.matchingFilms : (films?.length || 0)}
              summary={scopedView.scope.summary}
              yearSpan={releaseYearSpan}
              availableDecades={availableDecades}
              ratingOptions={HALF_STAR_OPTIONS}
              onChange={handleScopeChange}
              onReset={handleScopeReset}
              onOpenExplorer={() => openExplorerRoute("films|current")}
              onExport={exportCurrentFilmList}
              onCopySummary={() => { void copyCurrentViewSummary(); }}
            />
          )}

          {stats && (
            <SavedViewsPanel
              className={uiCue === "saved-view" ? "isUiCue" : undefined}
              draftName={savedViewDraftName}
              onDraftNameChange={setSavedViewDraftName}
              onSaveCurrent={saveCurrentView}
              presets={BUILTIN_SAVED_VIEW_PRESETS}
              savedViews={savedViews}
              activeViewId={activeViewId}
              onLoad={loadView}
              onRename={renameSavedView}
              onDelete={deleteSavedView}
              onExportSummary={(view) => {
                downloadTextFile(`${slugifyFileName(view.name)}_summary.txt`, buildSavedViewSummaryText(view));
                triggerUiCue("share");
                showToast("Saved view note exported.");
              }}
            />
          )}
        </div>
      </section>

      {stats && datasetSummary && currentViewSummary && currentShareCard && currentShareGeneratedAt && (
        <>
          <ReportSection
            ref={(element) => handleSectionRef("overview", element)}
            section={REPORT_SECTIONS[0]}
            index={0}
            active={activeSectionId === "overview"}
            collapsed={collapsedSections.overview}
            revealed={revealedSectionIds.includes("overview")}
            linkedToExplorer={explorerSectionId === "overview" && !!explorer}
            attentive={attentiveSectionId === "overview"}
            entered={enteredSectionId === "overview"}
            guided={guidedSectionId === "overview"}
            metrics={reportMenuMetricsById.overview || []}
            onToggle={() => toggleSection("overview")}
            onJumpToMenu={jumpToReportMenu}
            onPointerEnter={() => handleSectionPointerEnter("overview")}
            onPointerLeave={() => handleSectionPointerLeave("overview")}
          >
            <div className="grid">
              {overviewCards.map((card) => (
                <div className="card span3" key={card.title}>
                  <h2>
                    {card.help ? <InlineLabel label={card.title} help={card.help} /> : card.title}
                  </h2>
                  <div className="kpi">
                    <div className="value">{card.value}</div>
                    <div className="label">{card.label}</div>
                  </div>
                </div>
              ))}

              <div className="card span6">
                <h2>{scopeIsActive ? "Quick facts in this view" : "Quick facts"}</h2>
                <div className="row">
                  {quickFacts.map((item) => (
                    <div className="badge" key={item.label}>
                      <InlineLabel label={item.label} help={item.help} />: {item.value}
                    </div>
                  ))}
                </div>
              </div>

              <div className="card span6">
                <h2>{scopeIsActive ? "Coverage in this view" : "Coverage"}</h2>
                <div className="row">
                  {coverageFacts.map((item) => (
                    <div className="badge" key={item.label}>
                      <InlineLabel label={item.label} help={item.help} />: {item.value}
                    </div>
                  ))}
                </div>
              </div>

              <ShareExportPanel
                className={uiCue === "share" ? "isUiCue" : undefined}
                summary={currentViewSummary}
                generatedAt={currentShareGeneratedAt}
                badgeText={currentShareBadge}
                shareCard={currentShareCard}
                label={label}
                shareContextItems={reportShareContextItems}
                labels={{
                  generated: "Made",
                  badge: "Tag",
                  watched: scopeIsActive ? "Films in view" : "Watched",
                  rated: "Current ratings",
                  meanRating: "Mean",
                  median: "Median",
                  longestStreak: scopeIsActive ? "Best streak in view" : "Best streak",
                  commitment: "Commitment",
                  topWords: "Top words",
                  oneLine: "In one line",
                  na: "n/a",
                  titleSuffix: "report",
                }}
                onCopySummary={() => { void copyCurrentViewSummary(); }}
                onDownloadShareCard={() => { void downloadShareCard(); }}
                onExportFilmList={exportCurrentFilmList}
                onExportDrilldown={explorer ? exportCurrentDrilldown : null}
                onExportSavedViewSummary={activeView ? exportActiveSavedViewSummary : null}
                onPrint={() => window.print()}
              />
            </div>
          </ReportSection>

          <ReportSection
            ref={(element) => handleSectionRef("watched-activity", element)}
            section={REPORT_SECTIONS[1]}
            index={1}
            active={activeSectionId === "watched-activity"}
            collapsed={collapsedSections["watched-activity"]}
            revealed={revealedSectionIds.includes("watched-activity")}
            linkedToExplorer={explorerSectionId === "watched-activity" && !!explorer}
            attentive={attentiveSectionId === "watched-activity"}
            entered={enteredSectionId === "watched-activity"}
            guided={guidedSectionId === "watched-activity"}
            metrics={reportMenuMetricsById["watched-activity"] || []}
            onToggle={() => toggleSection("watched-activity")}
            onJumpToMenu={jumpToReportMenu}
            onPointerEnter={() => handleSectionPointerEnter("watched-activity")}
            onPointerLeave={() => handleSectionPointerLeave("watched-activity")}
          >
            <div className="grid">
              <WatchActivityPanel
                activity={currentWatchActivity}
                title={scopeIsActive ? "Watch dates in this view" : "Watch dates"}
                subtitle={scopeIsActive
                  ? "Exact watch dates only. Films in this view without one stay out."
                  : undefined}
                onOpenAll={openWatchActivityExplorer}
                onMonthClick={openWatchActivityMonth}
                onYearClick={openWatchActivityYear}
                onDayClick={openWatchActivityDay}
                onGapClick={(gap) => openWatchActivityGap(gap.startDate, gap.endDate)}
                onStreakClick={(streak) => openWatchActivityStreak(streak.startDate, streak.endDate)}
              />
            </div>
          </ReportSection>

          <ReportSection
            ref={(element) => handleSectionRef("ratings", element)}
            section={REPORT_SECTIONS[2]}
            index={2}
            active={activeSectionId === "ratings"}
            collapsed={collapsedSections.ratings}
            revealed={revealedSectionIds.includes("ratings")}
            linkedToExplorer={explorerSectionId === "ratings" && !!explorer}
            attentive={attentiveSectionId === "ratings"}
            entered={enteredSectionId === "ratings"}
            guided={guidedSectionId === "ratings"}
            metrics={reportMenuMetricsById.ratings || []}
            onToggle={() => toggleSection("ratings")}
            onJumpToMenu={jumpToReportMenu}
            onPointerEnter={() => handleSectionPointerEnter("ratings")}
            onPointerLeave={() => handleSectionPointerLeave("ratings")}
          >
            <div className="grid">
              <div className="span6">
                <BarList
                  title={scopeIsActive ? "Current ratings in this view" : "Current ratings"}
                  subtitle={scopeIsActive ? "Current-rating spread across the current view." : undefined}
                  items={ratingHistogram}
                  emptyText="No rating data."
                  onItemClick={(item, sourceElement) => openHistogramBin(item.label, sourceElement)}
                />
              </div>
              <RatingDriftPanel
                drift={currentRatingDrift || stats.ratingDrift}
                sort={ratingDriftSort}
                onSortChange={setRatingDriftSort}
                title={scopeIsActive ? "Rating drift in this view" : "Rating drift"}
                subtitle={scopeIsActive
                  ? "Logged and current ratings stay separate inside this view. Drift is current minus logged."
                  : undefined}
                onCategoryClick={openDriftCategory}
                onCaseClick={(item, sourceElement) => openDriftCaseExplorer(item.filmKey, sourceElement)}
              />
            </div>
          </ReportSection>

          <ReportSection
            ref={(element) => handleSectionRef("reviews", element)}
            section={REPORT_SECTIONS[3]}
            index={3}
            active={activeSectionId === "reviews"}
            collapsed={collapsedSections.reviews}
            revealed={revealedSectionIds.includes("reviews")}
            linkedToExplorer={explorerSectionId === "reviews" && !!explorer}
            attentive={attentiveSectionId === "reviews"}
            entered={enteredSectionId === "reviews"}
            guided={guidedSectionId === "reviews"}
            metrics={reportMenuMetricsById.reviews || []}
            onToggle={() => toggleSection("reviews")}
            onJumpToMenu={jumpToReportMenu}
            onPointerEnter={() => handleSectionPointerEnter("reviews")}
            onPointerLeave={() => handleSectionPointerLeave("reviews")}
          >
            <div className="grid">
              <ReviewStatsPanel
                reviews={currentReviews || stats.reviews}
                title={scopeIsActive ? "Reviews in this view" : "Reviews"}
                subtitle={scopeIsActive ? "Review rows and reviewed films inside the current view. Length stats use rows with text only." : undefined}
                onLongestReviewClick={(row, sourceElement) => openLongestReviewExplorer(row.id, sourceElement)}
              />
            </div>
          </ReportSection>

          <ReportSection
            ref={(element) => handleSectionRef("release", element)}
            section={REPORT_SECTIONS[4]}
            index={4}
            active={activeSectionId === "release"}
            collapsed={collapsedSections.release}
            revealed={revealedSectionIds.includes("release")}
            linkedToExplorer={explorerSectionId === "release" && !!explorer}
            attentive={attentiveSectionId === "release"}
            entered={enteredSectionId === "release"}
            guided={guidedSectionId === "release"}
            metrics={reportMenuMetricsById.release || []}
            onToggle={() => toggleSection("release")}
            onJumpToMenu={jumpToReportMenu}
            onPointerEnter={() => handleSectionPointerEnter("release")}
            onPointerLeave={() => handleSectionPointerLeave("release")}
          >
            <div className="grid">
              <div className="span6">
                <BarList
                  title={scopeIsActive ? "Top release years in this view" : "Top release years"}
                  subtitle={scopeIsActive ? "Films in the current view grouped by release year." : undefined}
                  items={topReleaseYears}
                  emptyText="No release years yet."
                  onItemClick={(item, sourceElement) => openReleaseYearExplorer(item.label, "current", sourceElement)}
                />
              </div>
              <div className="span6">
                <BarList
                  title={scopeIsActive ? "Top decades in this view" : "Top decades"}
                  subtitle={scopeIsActive ? "Films in the current view grouped by decade." : undefined}
                  items={topDecades}
                  emptyText="No decades yet."
                  onItemClick={(item, sourceElement) => openReleaseDecadeExplorer(item.label, "current", sourceElement)}
                />
              </div>
              <ReleaseAnalyticsPanel
                releaseAnalytics={currentReleaseAnalytics || stats.releaseAnalytics}
                title={scopeIsActive ? "Release years in this view" : "Release years"}
                subtitle={scopeIsActive ? "Release-year and decade metrics computed from the current view only." : undefined}
                onDecadeClick={(row, sourceElement) => openReleaseAnalyticsDecadeExplorer(row.decade, sourceElement)}
              />
            </div>
          </ReportSection>

          <ReportSection
            ref={(element) => handleSectionRef("watchlist", element)}
            section={REPORT_SECTIONS[5]}
            index={5}
            active={activeSectionId === "watchlist"}
            collapsed={collapsedSections.watchlist}
            revealed={revealedSectionIds.includes("watchlist")}
            linkedToExplorer={explorerSectionId === "watchlist" && !!explorer}
            attentive={attentiveSectionId === "watchlist"}
            entered={enteredSectionId === "watchlist"}
            guided={guidedSectionId === "watchlist"}
            metrics={reportMenuMetricsById.watchlist || []}
            onToggle={() => toggleSection("watchlist")}
            onJumpToMenu={jumpToReportMenu}
            onPointerEnter={() => handleSectionPointerEnter("watchlist")}
            onPointerLeave={() => handleSectionPointerLeave("watchlist")}
          >
            <div className="grid">
              <BacklogPanel backlog={stats.backlog} />
              <div className="span6">
                <Heatmap
                  byMonth={stats.backlog.timeline.byMonth}
                  title="Watchlist timeline"
                  emptyText="No watchlist add dates yet."
                  footerText="Watchlist films grouped by their earliest add date."
                />
              </div>
              <div className="span6">
                <BarList
                  title="Top watchlist release years"
                  items={watchlistReleaseYears}
                  emptyText="No watchlist years yet."
                  onItemClick={(item, sourceElement) => openReleaseYearExplorer(item.label, "watchlist", sourceElement)}
                />
              </div>
              <div className="span6">
                <BarList
                  title="Top watchlist decades"
                  items={watchlistDecades}
                  emptyText="No watchlist decades yet."
                  onItemClick={(item, sourceElement) => openReleaseDecadeExplorer(item.label, "watchlist", sourceElement)}
                />
              </div>
            </div>
          </ReportSection>

          <ReportSection
            ref={(element) => handleSectionRef("archives", element)}
            section={REPORT_SECTIONS[6]}
            index={6}
            active={activeSectionId === "archives"}
            collapsed={collapsedSections.archives}
            revealed={revealedSectionIds.includes("archives")}
            linkedToExplorer={explorerSectionId === "archives" && !!explorer}
            attentive={attentiveSectionId === "archives"}
            entered={enteredSectionId === "archives"}
            guided={guidedSectionId === "archives"}
            metrics={reportMenuMetricsById.archives || []}
            onToggle={() => toggleSection("archives")}
            onJumpToMenu={jumpToReportMenu}
            onPointerEnter={() => handleSectionPointerEnter("archives")}
            onPointerLeave={() => handleSectionPointerLeave("archives")}
          >
            <div className="grid">
              <ArchiveListsPanel
                archives={stats.archives}
                lists={archiveListFiles}
                onListClick={(list, sourceElement) => openArchiveListExplorer(list.path, sourceElement)}
              />
            </div>
          </ReportSection>

          <ReportSection
            ref={(element) => handleSectionRef("data-quality", element)}
            section={REPORT_SECTIONS[7]}
            index={7}
            active={activeSectionId === "data-quality"}
            collapsed={collapsedSections["data-quality"]}
            revealed={revealedSectionIds.includes("data-quality")}
            linkedToExplorer={explorerSectionId === "data-quality" && !!explorer}
            attentive={attentiveSectionId === "data-quality"}
            entered={enteredSectionId === "data-quality"}
            guided={guidedSectionId === "data-quality"}
            metrics={reportMenuMetricsById["data-quality"] || []}
            onToggle={() => toggleSection("data-quality")}
            onJumpToMenu={jumpToReportMenu}
            onPointerEnter={() => handleSectionPointerEnter("data-quality")}
            onPointerLeave={() => handleSectionPointerLeave("data-quality")}
          >
            <div className="grid">
              <DataQualityPanel
                dataQuality={stats.dataQuality}
                sections={groupedDataQuality}
                subtitle={scopeIsActive ? "This stays tied to the full export. Filters do not change reliability." : undefined}
                onJumpToSection={handleDataQualityJumpTarget}
              />

              <div className="card">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h2>Debug</h2>
                    <div className="small">The live state behind the current page.</div>
                  </div>
                  <label className="small" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="checkbox" checked={showDebug} onChange={(event) => setShowDebug(event.target.checked)} />
                    Show debug
                  </label>
                </div>

                {showDebug ? (
                  <div style={{ marginTop: 10 }}>
                    <div className="small">recognized files: {datasetSummary.recognizedFiles.join(", ") || "none"}</div>
                    <div className="small">unknown files: {datasetSummary.unknownFiles.map((item) => item.path).join(", ") || "none"}</div>
                    <div className="small">exact watch date coverage: {formatPct(datasetSummary.dateQualitySummary.exactDatedWatchedFilmCoverage)}</div>
                    <div className="small">missing exact watch dates: {formatInt(datasetSummary.dateQualitySummary.watchedFilmsWithoutExactDate)}</div>
                    <div className="small">lists parsed: {formatInt(datasetSummary.listSummary.activeListCount)} active / {formatInt(datasetSummary.listSummary.archivedListCount)} archived</div>
                    <div className="small">sample date probe: {JSON.stringify(sampleDateProbe)}</div>
                    <pre style={{ whiteSpace: "pre-wrap", margin: "10px 0 0", overflowX: "auto", fontSize: 12, color: "var(--muted)" }}>
                      {debugJson}
                    </pre>
                  </div>
                ) : (
                  <p>Turn on debug to inspect the live payload behind this page.</p>
                )}
              </div>
            </div>
          </ReportSection>

          <ReportSection
            ref={(element) => handleSectionRef("ai", element)}
            section={REPORT_SECTIONS[8]}
            index={8}
            active={activeSectionId === "ai"}
            collapsed={collapsedSections.ai}
            revealed={revealedSectionIds.includes("ai")}
            linkedToExplorer={explorerSectionId === "ai" && !!explorer}
            attentive={attentiveSectionId === "ai"}
            entered={enteredSectionId === "ai"}
            guided={guidedSectionId === "ai"}
            metrics={reportMenuMetricsById.ai || []}
            onToggle={() => toggleSection("ai")}
            onJumpToMenu={jumpToReportMenu}
            onPointerEnter={() => handleSectionPointerEnter("ai")}
            onPointerLeave={() => handleSectionPointerLeave("ai")}
          >
            <div className="grid">
              <div className="card">
                <h2>AI notes</h2>
                <div className="row">
                  <div>
                    <div className="small">Mode</div>
                    <select value={mode} onChange={(event) => setMode(event.target.value as "praise" | "roast")}>
                      <option value="roast">Roast</option>
                      <option value="praise">Praise</option>
                    </select>
                  </div>
                  <div>
                    <div className="small">Intensity</div>
                    <select value={roastLevel} onChange={(event) => setRoastLevel(Number(event.target.value) as 1 | 2 | 3)}>
                      <option value={1}>Soft</option>
                      <option value={2}>Medium</option>
                      <option value={3}>Sharp</option>
                    </select>
                  </div>
                  <div>
                    <div className="small">AI language</div>
                    <select value={language} onChange={(event) => setLanguage(event.target.value as Lang)}>
                      <option value="en">English</option>
                      <option value="zh">Chinese</option>
                      <option value="uk">Ukrainian</option>
                    </select>
                  </div>
                  <div>
                    <div className="small">Provider</div>
                    <select value={provider} onChange={(event) => setProvider(event.target.value as Provider)}>
                      <option value="default">Built-in DeepSeek</option>
                      <option value="default_kimi">Built-in Kimi K2.5</option>
                      <option value="openai_compat">OpenAI-compatible (your key)</option>
                      <option value="gemini">Gemini (your key)</option>
                    </select>
                  </div>
                </div>
                <p className="small" style={{ marginTop: 10 }}>
                  Built-in DeepSeek and Kimi K2.5 use the site's free default access. Other providers need your own API key, and anything you type here stays in this browser session only and is not stored by the website.
                </p>
                <p className="small">
                  AI output is always plain text only. No markdown, no asterisks, and any movie titles should stay in English.
                </p>

                {!usesBuiltInAi && (
                  <div className="row" style={{ marginTop: 10 }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div className="small">API key</div>
                      <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Required for this provider" />
                    </div>
                    {usesOpenAICompatAi && (
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div className="small">Base URL</div>
                        <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.deepseek.com" />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div className="small">Model</div>
                      <input
                        value={model}
                        onChange={(event) => setModel(event.target.value)}
                        placeholder={usesGeminiAi ? "gemini-1.5-flash" : "deepseek-chat / gpt-4.1 / kimi-k2.5"}
                      />
                    </div>
                  </div>
                )}

                <div className="row" style={{ marginTop: 10 }}>
                  {usesBuiltInAi && (
                    <span className="badge">
                      {provider === "default" ? "Using built-in DeepSeek" : "Using built-in Kimi K2.5"}
                    </span>
                  )}
                  <button className="btn primary" onClick={runAI} disabled={aiBusy}>
                    {aiBusy ? "Writing..." : "Write notes"}
                  </button>
                </div>

                {aiBusy && (
                  <div className="kpi" style={{ marginTop: 10 }}>
                    <div className="label">AI progress</div>
                    <div className="bar" style={{ height: 14, marginTop: 8 }}><div style={{ width: `${aiProgress}%` }} /></div>
                    <div className="small" style={{ marginTop: 6 }}>
                      {aiProgress < 30 ? "Reading the report..." : aiProgress < 60 ? "Finding patterns..." : aiProgress < 85 ? "Writing..." : "Finishing..."}
                    </div>
                  </div>
                )}

                {aiText && (
                  <div className="card" style={{ marginTop: 12 }}>
                    <h2>Draft</h2>
                    <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit", color: "var(--text)" }}>{aiText}</pre>
                  </div>
                )}
              </div>
            </div>
          </ReportSection>
        </>
      )}

      {stats && (
        <ReportMenu
          entries={reportMenuEntries}
          activeSectionId={activeSectionId}
          activeScopeSummary={currentScopeSummary}
          activeViewName={activeSavedViewName}
          sticky
          visible={!reportMenuInView}
          onNavigate={navigateToSection}
        />
      )}

      <FilmExplorer
        payload={explorer}
        sortKey={explorerSortKey}
        direction={explorerSortDirection}
        origin={explorerOrigin}
        onSortChange={updateExplorerSort}
        sourceSectionId={explorerSectionId}
        sourceSectionTitle={explorerSectionId ? getReportSectionTitle(explorerSectionId) : null}
        contextTrail={explorerContextTrail}
        onClose={() => {
          if (explorerSectionId) {
            cueSection(explorerSectionId);
          }
          startTransition(() => {
            setExplorer(null);
            setExplorerRoute(null);
          });
        }}
        onExport={(rows, exportFileName) => {
          writeCsv(exportFileName, rows);
          triggerUiCue("share");
          showToast("Detail CSV exported.");
        }}
        onToast={showToast}
      />

      <Toast text={toast} />
    </div>
  );
}
