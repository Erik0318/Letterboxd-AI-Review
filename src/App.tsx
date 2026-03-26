import React, { startTransition, useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
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
  DatasetSummary,
  FilmRecord,
  getBestTimelineDates,
  isWatchedFilm,
  mergeTablesToFilms,
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
import { formatInt, formatPct, round1, round3 } from "./lib/utils";
import { buildCurrentViewSummary } from "./lib/viewState";
import {
  buildExactWatchActivity,
  ExactWatchEventRow,
  filterExactWatchRowsByDay,
  filterExactWatchRowsByMonth,
  filterExactWatchRowsByRange,
  filterExactWatchRowsByYear,
} from "./lib/watchActivity";

type Provider = "default" | "openai_compat" | "gemini";
type Lang = "en" | "zh" | "uk";
type HelpState = "expanded" | "collapsed" | "dismissed";
type ViewOption = SavedViewPreset | SavedViewRecord;
type UiCue = "scope" | "saved-view" | "share";

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

function aiDossier(films: FilmRecord[], stats: StatPack, summary: DatasetSummary | null) {
  const entries = [...films]
    .sort((left, right) => (right.exactWatchedDate || "0000-00-00").localeCompare(left.exactWatchedDate || "0000-00-00"))
    .map((film) => ({
      name: film.name,
      year: film.year,
      currentRating: film.currentRating,
      loggedRating: film.loggedRating,
      bestRating: film.bestRating,
      bestWatchedDate: film.bestWatchedDate,
      exactWatchedDate: film.exactWatchedDate,
      estimatedWatchedDate: film.estimatedWatchedDate,
      sources: film.sourceFlags.tables,
      inWatchlist: film.inWatchlist,
      rewatchCount: film.rewatchCount,
      reviewSample: film.reviewTexts.slice(0, 1),
    }));

  return {
    overview: stats.overview,
    quickFacts: stats.quickFacts,
    ratings: stats.ratings,
    ratingDrift: stats.ratingDrift,
    backlog: stats.backlog,
    reviews: stats.reviews,
    releaseAnalytics: stats.releaseAnalytics,
    archives: stats.archives,
    activity: stats.activity,
    releaseYears: stats.releaseYears,
    text: stats.text,
    shareCard: stats.shareCard,
    summary,
    films: entries,
  };
}

export default function App() {
  const [toast, setToast] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [films, setFilms] = useState<FilmRecord[] | null>(null);
  const [datasetSummary, setDatasetSummary] = useState<DatasetSummary | null>(null);
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
  const reportMenuRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Partial<Record<ReportSectionId, HTMLElement | null>>>({});
  const activeScrollFrame = useRef<number | null>(null);
  const uiCueTimerRef = useRef<number | null>(null);

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
  const currentShareBadge = scopeIsActive ? "Scoped view" : (stats?.fun.badge || "Global view");

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

  const allViews = useMemo<ViewOption[]>(
    () => [...BUILTIN_SAVED_VIEW_PRESETS, ...savedViews],
    [savedViews],
  );
  const activeView = allViews.find((view) => view.id === activeViewId) || null;
  const activeSavedViewName = activeView?.name || null;
  const currentScopeSummary = scopeIsActive && scopedView ? scopedView.scope.summary : "Global default view";

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
      { label: "Report", value: scopeIsActive ? "Scoped view" : "Global report" },
      { label: "Scope", value: currentScopeSummary },
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
          label: scopeIsActive ? "Scoped films" : "Watched films",
          value: formatInt(currentMajorCounts?.watchedFilms || 0),
        },
        {
          label: "Current rated",
          value: formatInt(currentMajorCounts?.currentRatedFilms || 0),
        },
      ],
      "watched-activity": [
        {
          label: "Exact-dated films",
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
          label: "Changed drift",
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
          label: "Highest decade",
          value: highestCurrentDecade ? highestCurrentDecade.decade : (topWatchedDecade?.label || "n/a"),
        },
        {
          label: "Top decade count",
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
          label: "Prompt films",
          value: formatInt(currentMajorCounts?.watchedFilms || 0),
        },
        {
          label: "Output",
          value: aiBusy ? "Thinking" : aiText ? "Ready" : "Idle",
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
          title: "Scoped films",
          value: formatInt(scopedView.overview.scopedFilms.value),
          label: scopedView.scope.summary,
        },
        {
          title: "Current rated films",
          value: formatInt(scopedView.overview.currentRatedFilms.value),
          label: "within the active scope",
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
          label: "currentRating - loggedRating within scoped comparable films",
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
        label: "unique film-level watched universe",
      },
      {
        title: "Current rated films",
        value: formatInt(stats.overview.currentRatedFilms.value),
        label: "unique films with current rating",
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
      { label: "Unrated watched films", value: formatInt(stats.quickFacts.unratedWatchedFilmsWithoutCurrentRating.value) },
      {
        label: "Logged-rated films",
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
        label: "Exact-dated watched films",
        value: `${formatInt(datasetSummary.dateQualitySummary.exactDatedWatchedFilms)} / ${formatInt(datasetSummary.coverageSummary.watchedUniverseFilmCount)}`,
        help: "Watched-universe films with at least one exact diary/review watched date. These are the films that can safely enter default watched-time charts.",
      },
      {
        label: "Watched films without exact date",
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
  }, []);

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
    setExplorer(null);
    setExplorerRoute(null);
    setFileName(sourceName);
    try {
      const tables = await readLetterboxdExportZip(input);
      const merged = mergeTablesToFilms(tables);
      const initialSection = parseInitialSection();
      startTransition(() => {
        setFilms(merged.films);
        setDatasetSummary(merged.summary);
        setActiveSectionId(initialSection);
        setCollapsedSections(parseCollapsedSectionsFromStorage(initialSection));
      });
      showToast("Import complete.");
    } catch {
      showToast("Import failed. Check ZIP format.");
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
      showToast("Failed to load sample_data.zip");
    }
  }

  async function downloadShareCard() {
    const el = document.getElementById("shareCard");
    if (!el) {
      showToast("Share card not ready.");
      return;
    }
    const canvas = await html2canvas(el as HTMLElement, { backgroundColor: null, scale: 2 });
    const url = canvas.toDataURL("image/png");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = scopeIsActive ? "letterboxd-scoped-view.png" : "letterboxd-ai-card.png";
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
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: apiKey || undefined,
          baseUrl: baseUrl || undefined,
          model: model || undefined,
          language,
          mode,
          roastLevel,
          profile: dossier,
        }),
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
      globalContext: fileName ? `Imported export: ${fileName}` : "Current imported Letterboxd export",
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
      context: explorerContext(source, "Unique films (film-level)", emptyTitle, emptyBody),
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
      context: explorerContext(source, "Review rows (row-level)", emptyTitle, emptyBody),
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
      context: explorerContext(source, "Exact watch events (row-level, exact-date only)", emptyTitle, emptyBody),
      rows,
    };
  }

  function buildExplorerFromRoute(route: string): FilmExplorerPayload | null {
    const [kind, source, rawValue] = route.split("|");

    if (kind === "films" && source === "current") {
      return buildFilmExplorerPayload(
        scopeIsActive ? "Scoped film explorer" : "Global film explorer",
        scopeIsActive
          ? "Unique films that match the active scope."
          : "Unique merged film records across the full export.",
        scopeIsActive ? "Open scoped film surface" : "Open global film surface",
        scopedFilmRows,
        scopeIsActive ? "scoped_films.csv" : "all_films.csv",
        "No films in the current view",
        scopeIsActive
          ? "The active scope currently matches no films."
          : "Import a Letterboxd export to explore the merged film set.",
      );
    }

    if (kind === "histogram" && source) {
      const target = Number(source);
      return buildFilmExplorerPayload(
        `Current rating ${source}`,
        "Unique films in the current view whose current rating falls into this histogram bin.",
        `Current rating histogram bin ${source}`,
        scopedFilmRows.filter((row) => row.currentRating !== null && Math.round(row.currentRating * 2) / 2 === target),
        `current_rating_${source.replace(".", "_")}.csv`,
        "No films in this rating bin",
        "This current-rating bucket is empty under the active scope.",
      );
    }

    if (kind === "releaseYear" && source && rawValue) {
      const rows = source === "watchlist" ? watchlistExplorerRows : currentReleaseFilmRows;
      return buildFilmExplorerPayload(
        `Release year ${rawValue}`,
        source === "watchlist"
          ? "Unique watchlist films from the selected release year."
          : "Unique films from the selected release year in the current view.",
        source === "watchlist" ? "Watchlist release year bucket" : "Release year bucket",
        rows.filter((row) => row.year !== null && String(row.year) === rawValue),
        `release_year_${rawValue}.csv`,
        "No films in this release year",
        source === "watchlist"
          ? "The selected watchlist release-year bucket has no rows."
          : "The selected release-year bucket has no rows in the current view.",
      );
    }

    if (kind === "releaseDecade" && source && rawValue) {
      const rows = source === "watchlist" ? watchlistExplorerRows : currentReleaseFilmRows;
      return buildFilmExplorerPayload(
        `Release decade ${rawValue}`,
        source === "watchlist"
          ? "Unique watchlist films from the selected release decade."
          : "Unique films from the selected release decade in the current view.",
        source === "watchlist" ? "Watchlist release decade bucket" : "Release decade bucket",
        rows.filter((row) => row.year !== null && `${Math.floor(row.year / 10) * 10}s` === rawValue),
        `release_decade_${rawValue}.csv`,
        "No films in this release decade",
        source === "watchlist"
          ? "The selected watchlist release-decade bucket has no rows."
          : "The selected release-decade bucket has no rows in the current view.",
      );
    }

    if (kind === "releaseAnalyticsDecade" && source && rawValue) {
      return buildFilmExplorerPayload(
        `Release decade ${rawValue}`,
        "Unique films behind the selected release-analytics decade row.",
        "Release analytics decade row",
        currentReleaseFilmRows.filter((row) => row.year !== null && `${Math.floor(row.year / 10) * 10}s` === rawValue),
        `release_analytics_decade_${rawValue}.csv`,
        "No films behind this decade row",
        "The selected release-analytics decade has no films in the current view.",
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
        "Unique films behind the selected rating-drift bucket.",
        `Rating drift summary bucket ${source}`,
        rows,
        `rating_drift_${source}.csv`,
        "No films in this drift bucket",
        "The current scope contains no films for the selected drift bucket.",
      );
    }

    if (kind === "driftCase" && source) {
      const filmKey = decodeURIComponent(source);
      return buildFilmExplorerPayload(
        "Rating drift case",
        "Unique film behind the selected representative rating-drift case.",
        `Representative drift list sorted by ${ratingDriftSort}`,
        scopedFilmRows.filter((row) => row.filmKey === filmKey),
        "rating_drift_case.csv",
        "No matching drift case",
        "The representative drift case is no longer available in the current view.",
      );
    }

    if (kind === "longestReview" && source) {
      const reviewId = decodeURIComponent(source);
      return buildReviewExplorerPayload(
        "Longest review",
        "Review rows behind the selected longest-review entry.",
        "Review stats longest review row",
        currentReviewRows.filter((row) => row.id === reviewId),
        "longest_review_row.csv",
        "No matching review row",
        "That longest-review entry is no longer present in the current view.",
      );
    }

    if (kind === "activityAll") {
      return buildWatchExplorerPayload(
        scopeIsActive ? "Scoped exact watch activity" : "Global exact watch activity",
        "Row-level exact watch events only. Films without exact watched dates stay out of this explorer.",
        "Exact-date watch activity explorer",
        currentWatchActivity.rows,
        scopeIsActive ? "scoped_exact_watch_events.csv" : "exact_watch_events.csv",
        "No exact watch events available",
        scopeIsActive
          ? "The active scope currently contains no exact watch events."
          : "The imported export does not contain any exact watch events yet.",
      );
    }

    if (kind === "activityMonth" && source) {
      return buildWatchExplorerPayload(
        `Exact watch month ${source}`,
        "Row-level exact watch events in the selected month.",
        "Watch activity heatmap month",
        filterExactWatchRowsByMonth(currentWatchActivity.rows, source),
        `exact_watch_month_${source}.csv`,
        "No exact watch events in this month",
        "That month has no exact watch events in the current view.",
      );
    }

    if (kind === "activityYear" && source) {
      return buildWatchExplorerPayload(
        `Exact watch year ${source}`,
        "Row-level exact watch events in the selected year.",
        "Busiest exact-watch year summary",
        filterExactWatchRowsByYear(currentWatchActivity.rows, source),
        `exact_watch_year_${source}.csv`,
        "No exact watch events in this year",
        "That year has no exact watch events in the current view.",
      );
    }

    if (kind === "activityDay" && source) {
      return buildWatchExplorerPayload(
        `Exact watch day ${source}`,
        "Row-level exact watch events on the selected day.",
        "Busiest exact-watch day summary",
        filterExactWatchRowsByDay(currentWatchActivity.rows, source),
        `exact_watch_day_${source}.csv`,
        "No exact watch events on this day",
        "That day has no exact watch events in the current view.",
      );
    }

    if (kind === "activityGap" && source && rawValue) {
      return buildWatchExplorerPayload(
        "Exact watch gap context",
        "Row-level exact watch events immediately around the selected gap window.",
        "Longest exact-watch gap summary",
        filterExactWatchRowsByRange(currentWatchActivity.rows, source, rawValue),
        `exact_watch_gap_${source}_${rawValue}.csv`,
        "No exact watch events around this gap",
        "The selected gap context does not have exact watch events in the current view.",
      );
    }

    if (kind === "activityStreak" && source && rawValue) {
      return buildWatchExplorerPayload(
        `Exact watch streak ${source} to ${rawValue}`,
        "Row-level exact watch events inside the selected streak window.",
        "Best exact-date streak summary",
        filterExactWatchRowsByRange(currentWatchActivity.rows, source, rawValue),
        `exact_watch_streak_${source}_${rawValue}.csv`,
        "No exact watch events in this streak",
        "The selected streak window does not have exact watch events in the current view.",
      );
    }

    return null;
  }

  function openExplorerRoute(
    route: string,
    sortOverride?: { key: string; direction: ExplorerSortDirection },
  ) {
    const payload = buildExplorerFromRoute(route);
    if (!payload) {
      showToast("No drilldown rows for this view.");
      return;
    }
    const nextSort = sortOverride || defaultExplorerSort(payload);
    const linkedSectionId = inferExplorerSectionId(route);
    startTransition(() => {
      setExplorerSortKey(nextSort.key);
      setExplorerSortDirection(nextSort.direction);
      setExplorerRoute(route);
      setExplorer(payload);
      if (linkedSectionId) {
        setCollapsedSections((current) => ({ ...current, [linkedSectionId]: false }));
        setActiveSectionId(linkedSectionId);
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
    showToast("Exported current film list.");
  }

  function exportCurrentDrilldown() {
    if (!explorer) {
      showToast("No drilldown is open.");
      return;
    }
    writeCsv(explorer.exportFileName, buildExplorerExportRows(explorer));
    triggerUiCue("share");
    showToast("Exported current drilldown CSV.");
  }

  async function copyCurrentViewSummary() {
    if (!currentViewSummary) {
      return;
    }
    try {
      await navigator.clipboard.writeText(currentViewSummary.text);
      triggerUiCue("share");
      showToast("Copied current view summary.");
    } catch {
      showToast("Copy failed.");
    }
  }

  function exportActiveSavedViewSummary() {
    if (!activeView) {
      showToast("Load a preset or saved view first.");
      return;
    }
    downloadTextFile(`${slugifyFileName(activeView.name)}_summary.txt`, buildSavedViewSummaryText(activeView));
    triggerUiCue("share");
    showToast("Exported saved view summary.");
  }

  function saveCurrentView() {
    if (!films) {
      showToast("Import an export before saving a view.");
      return;
    }
    const record = createSavedViewRecord(savedViewDraftName || "Saved view", currentViewSnapshot);
    setSavedViews((current) => [record, ...current]);
    setSavedViewDraftName("");
    setActiveViewId(record.id);
    triggerUiCue("saved-view");
    showToast(`Saved view: ${record.name}`);
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
    updateSectionHash(linkedSectionId, "replace");
    triggerUiCue("saved-view");
    showToast(`Loaded view: ${view.name}`);
  }

  function renameSavedView(view: SavedViewRecord) {
    const nextName = window.prompt("Rename saved view", view.name)?.trim();
    if (!nextName || nextName === view.name) {
      return;
    }
    setSavedViews((current) => current.map((item) => item.id === view.id
      ? { ...item, name: nextName, updatedAt: new Date().toISOString() }
      : item));
    showToast(`Renamed view: ${nextName}`);
  }

  function deleteSavedView(view: SavedViewRecord) {
    if (!window.confirm(`Delete saved view "${view.name}"?`)) {
      return;
    }
    setSavedViews((current) => current.filter((item) => item.id !== view.id));
    if (activeViewId === view.id) {
      setActiveViewId(null);
    }
    showToast(`Deleted view: ${view.name}`);
  }

  function updateExplorerSort(key: string, direction: ExplorerSortDirection) {
    setExplorerSortKey(key);
    setExplorerSortDirection(direction);
  }

  function handleScopeChange(nextScope: AnalysisScope) {
    startTransition(() => {
      setScope(nextScope);
    });
    triggerUiCue("scope");
  }

  function handleScopeReset() {
    startTransition(() => {
      setScope(DEFAULT_ANALYSIS_SCOPE);
    });
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

  function openHistogramBin(labelValue: string) {
    openExplorerRoute(`histogram|${labelValue}`);
  }

  function openReleaseYearExplorer(yearLabel: string, source: "current" | "watchlist") {
    openExplorerRoute(`releaseYear|${source}|${yearLabel}`);
  }

  function openReleaseDecadeExplorer(decadeLabel: string, source: "current" | "watchlist") {
    openExplorerRoute(`releaseDecade|${source}|${decadeLabel}`);
  }

  function openReleaseAnalyticsDecadeExplorer(decadeLabel: string) {
    openExplorerRoute(`releaseAnalyticsDecade|current|${decadeLabel}`);
  }

  function openDriftCategory(category: "comparableFilms" | "unchanged" | "changed" | "upgraded" | "downgraded") {
    openExplorerRoute(`driftCategory|${category}`);
  }

  function openDriftCaseExplorer(filmKey: string) {
    openExplorerRoute(`driftCase|${encodeURIComponent(filmKey)}`);
  }

  function openLongestReviewExplorer(reviewId: string) {
    openExplorerRoute(`longestReview|${encodeURIComponent(reviewId)}`);
  }

  function openWatchActivityExplorer() {
    openExplorerRoute("activityAll");
  }

  function openWatchActivityMonth(month: string) {
    openExplorerRoute(`activityMonth|${month}`);
  }

  function openWatchActivityYear(year: string) {
    openExplorerRoute(`activityYear|${year}`);
  }

  function openWatchActivityDay(day: string) {
    openExplorerRoute(`activityDay|${day}`);
  }

  function openWatchActivityGap(startDate: string, endDate: string) {
    openExplorerRoute(`activityGap|${startDate}|${endDate}`);
  }

  function openWatchActivityStreak(startDate: string, endDate: string) {
    openExplorerRoute(`activityStreak|${startDate}|${endDate}`);
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
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <h1>Letterboxd AI Review</h1>
          <div className="sub">Product-focused Letterboxd export analysis with explicit data semantics and drilldowns.</div>
        </div>
        <div className="row">
          <a className="badge" href="https://github.com/Erik0318/Letterboxd-AI-Review" target="_blank" rel="noreferrer">Project GitHub</a>
          <button className="btn danger printHidden" onClick={() => window.location.reload()}>Reset</button>
        </div>
      </div>

      <section className={`dashboardSection reportPreludeSection${uiCue === "scope" ? " isScopeCue" : ""}${uiCue === "saved-view" ? " isSavedViewCue" : ""}`}>
        <SectionHeader
          title="Import / Onboarding / Report Controls"
          description="Load an export, get oriented, jump into the report map, and adjust reusable scope or saved-view controls when you need them."
        />
        <div className="grid">
          <div className="card" id="section-import">
            <h2>Import</h2>
            <div className="drop">
              <input type="file" accept=".zip" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUploadZip(file); }} />
              <div className="small">{fileName || "Upload your Letterboxd export ZIP"}</div>
              <div className="small">All parsing and stats run locally in your browser. Refresh clears everything.</div>
              <button className="btn primary" style={{ marginTop: 10 }} onClick={onLoadSample}>Use sample_data.zip</button>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <div>
                <div className="small">Label on share card</div>
                <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Optional" />
              </div>
              <div>
                <div className="small">AI language</div>
                <select value={language} onChange={(event) => setLanguage(event.target.value as Lang)}>
                  <option value="en">English</option>
                  <option value="zh">Chinese</option>
                  <option value="uk">Ukrainian</option>
                </select>
              </div>
            </div>

            {stats && (
              <div className="row" style={{ marginTop: 10 }}>
                <span className="badge">{formatInt(films?.length || 0)} merged film records</span>
                <span className="badge">{formatInt(stats.overview.watchedFilmsUnique.value)} watched films</span>
                <span className="badge">{formatInt(stats.overview.exactDatedWatchedFilms.value)} exact-dated watched films</span>
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
                showToast("Exported saved view summary.");
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
            metrics={reportMenuMetricsById.overview || []}
            onToggle={() => toggleSection("overview")}
            onJumpToMenu={jumpToReportMenu}
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
                <h2>{scopeIsActive ? "Quick facts in current report" : "Quick facts"}</h2>
                <div className="row">
                  {quickFacts.map((item) => (
                    <div className="badge" key={item.label}>
                      <InlineLabel label={item.label} help={item.help} />: {item.value}
                    </div>
                  ))}
                </div>
              </div>

              <div className="card span6">
                <h2>{scopeIsActive ? "Coverage in current report" : "Coverage"}</h2>
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
                  generated: "Generated",
                  badge: "Badge",
                  watched: scopeIsActive ? "Scoped films" : "Watched films",
                  rated: "Current rated films",
                  meanRating: "Current mean",
                  median: "Current median",
                  longestStreak: scopeIsActive ? "Scoped streak (exact dates)" : "Best streak (exact dates)",
                  commitment: "Commitment",
                  topWords: "Top words",
                  oneLine: "One line",
                  na: "n/a",
                  titleSuffix: scopeIsActive ? "scoped report" : "taste report",
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
            metrics={reportMenuMetricsById["watched-activity"] || []}
            onToggle={() => toggleSection("watched-activity")}
            onJumpToMenu={jumpToReportMenu}
          >
            <div className="grid">
              <WatchActivityPanel
                activity={currentWatchActivity}
                title={scopeIsActive ? "Exact-date watch activity in scope" : "Exact-date watch activity"}
                subtitle={scopeIsActive
                  ? "Exact-date only within the active scope. Films in scope without exact dates stay out of this module."
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
            metrics={reportMenuMetricsById.ratings || []}
            onToggle={() => toggleSection("ratings")}
            onJumpToMenu={jumpToReportMenu}
          >
            <div className="grid">
              <div className="span6">
                <BarList
                  title={scopeIsActive ? "Current rating histogram in scope" : "Current rating histogram"}
                  subtitle={scopeIsActive ? "Current-rating distribution across films in the active scope." : undefined}
                  items={ratingHistogram}
                  emptyText="No rating data."
                  onItemClick={(item) => openHistogramBin(item.label)}
                />
              </div>
              <RatingDriftPanel
                drift={currentRatingDrift || stats.ratingDrift}
                sort={ratingDriftSort}
                onSortChange={setRatingDriftSort}
                title={scopeIsActive ? "Rating drift in scope" : "Rating drift"}
                subtitle={scopeIsActive
                  ? "Logged rating = rating recorded on a diary/review log entry. Current rating = the ratings.csv snapshot right now. Delta = currentRating - loggedRating inside the active scope."
                  : undefined}
                onCategoryClick={openDriftCategory}
                onCaseClick={(item) => openDriftCaseExplorer(item.filmKey)}
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
            metrics={reportMenuMetricsById.reviews || []}
            onToggle={() => toggleSection("reviews")}
            onJumpToMenu={jumpToReportMenu}
          >
            <div className="grid">
              <ReviewStatsPanel
                reviews={currentReviews || stats.reviews}
                title={scopeIsActive ? "Review stats in scope" : "Review stats"}
                subtitle={scopeIsActive ? "Review rows and reviewed films within the active scope. Length stats use review rows with non-empty text only." : undefined}
                onLongestReviewClick={(row) => openLongestReviewExplorer(row.id)}
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
            metrics={reportMenuMetricsById.release || []}
            onToggle={() => toggleSection("release")}
            onJumpToMenu={jumpToReportMenu}
          >
            <div className="grid">
              <div className="span6">
                <BarList
                  title={scopeIsActive ? "Top release years in scope" : "Top release years by watched films"}
                  subtitle={scopeIsActive ? "Unique films in the active scope grouped by release year." : undefined}
                  items={topReleaseYears}
                  emptyText="No watched release years."
                  onItemClick={(item) => openReleaseYearExplorer(item.label, "current")}
                />
              </div>
              <div className="span6">
                <BarList
                  title={scopeIsActive ? "Top decades in scope" : "Top decades by watched films"}
                  subtitle={scopeIsActive ? "Unique films in the active scope grouped by release decade." : undefined}
                  items={topDecades}
                  emptyText="No watched decades."
                  onItemClick={(item) => openReleaseDecadeExplorer(item.label, "current")}
                />
              </div>
              <ReleaseAnalyticsPanel
                releaseAnalytics={currentReleaseAnalytics || stats.releaseAnalytics}
                title={scopeIsActive ? "Release analytics in scope" : "Release analytics"}
                subtitle={scopeIsActive ? "Release-year and decade metrics computed only from films in the active scope." : undefined}
                onDecadeClick={(row) => openReleaseAnalyticsDecadeExplorer(row.decade)}
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
            metrics={reportMenuMetricsById.watchlist || []}
            onToggle={() => toggleSection("watchlist")}
            onJumpToMenu={jumpToReportMenu}
          >
            <div className="grid">
              <BacklogPanel backlog={stats.backlog} />
              <div className="span6">
                <Heatmap
                  byMonth={stats.backlog.timeline.byMonth}
                  title="Watchlist add timeline"
                  emptyText="No watchlist add dates found in the export."
                  footerText="Unique watchlist films grouped by earliest watchlist add date found."
                />
              </div>
              <div className="span6">
                <BarList
                  title="Top watchlist release years"
                  items={watchlistReleaseYears}
                  emptyText="No watchlist release years."
                  onItemClick={(item) => openReleaseYearExplorer(item.label, "watchlist")}
                />
              </div>
              <div className="span6">
                <BarList
                  title="Top watchlist decades"
                  items={watchlistDecades}
                  emptyText="No watchlist decades."
                  onItemClick={(item) => openReleaseDecadeExplorer(item.label, "watchlist")}
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
            metrics={reportMenuMetricsById.archives || []}
            onToggle={() => toggleSection("archives")}
            onJumpToMenu={jumpToReportMenu}
          >
            <div className="grid">
              <ArchiveListsPanel archives={stats.archives} />
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
            metrics={reportMenuMetricsById["data-quality"] || []}
            onToggle={() => toggleSection("data-quality")}
            onJumpToMenu={jumpToReportMenu}
          >
            <div className="grid">
              <DataQualityPanel
                dataQuality={stats.dataQuality}
                sections={groupedDataQuality}
                subtitle={scopeIsActive ? "Global export audit. Scope filters do not change the underlying export reliability." : undefined}
                onJumpToSection={handleDataQualityJumpTarget}
              />

              <div className="card">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h2>Debug summary</h2>
                    <div className="small">Selector-aligned debug payload for verification and regression checks.</div>
                  </div>
                  <label className="small" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="checkbox" checked={showDebug} onChange={(event) => setShowDebug(event.target.checked)} />
                    Show debug summary
                  </label>
                </div>

                {showDebug ? (
                  <div style={{ marginTop: 10 }}>
                    <div className="small">recognized files: {datasetSummary.recognizedFiles.join(", ") || "none"}</div>
                    <div className="small">unknown files: {datasetSummary.unknownFiles.map((item) => item.path).join(", ") || "none"}</div>
                    <div className="small">exact-dated watched films coverage: {formatPct(datasetSummary.dateQualitySummary.exactDatedWatchedFilmCoverage)}</div>
                    <div className="small">watched films without exact date: {formatInt(datasetSummary.dateQualitySummary.watchedFilmsWithoutExactDate)}</div>
                    <div className="small">lists parsed: {formatInt(datasetSummary.listSummary.activeListCount)} active / {formatInt(datasetSummary.listSummary.archivedListCount)} archived</div>
                    <div className="small">sample date probe: {JSON.stringify(sampleDateProbe)}</div>
                    <pre style={{ whiteSpace: "pre-wrap", margin: "10px 0 0", overflowX: "auto", fontSize: 12, color: "var(--muted)" }}>
                      {debugJson}
                    </pre>
                  </div>
                ) : (
                  <p>Enable debug summary to inspect the selector payload behind the current page state.</p>
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
            metrics={reportMenuMetricsById.ai || []}
            onToggle={() => toggleSection("ai")}
            onJumpToMenu={jumpToReportMenu}
          >
            <div className="grid">
              <div className="card">
                <h2>AI Roast / Praise</h2>
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
                      <option value={1}>Mild</option>
                      <option value={2}>Normal</option>
                      <option value={3}>Savage</option>
                    </select>
                  </div>
                  <div>
                    <div className="small">Provider</div>
                    <select value={provider} onChange={(event) => setProvider(event.target.value as Provider)}>
                      <option value="default">Default (DeepSeek)</option>
                      <option value="openai_compat">DeepSeek / GPT / Doubao</option>
                      <option value="gemini">Gemini</option>
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="small">API key</div>
                    <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Optional" />
                  </div>
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="small">Base URL</div>
                    <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.deepseek.com" />
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="small">Model</div>
                    <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="deepseek-chat" />
                  </div>
                  <button className="btn primary" onClick={runAI} disabled={aiBusy}>
                    {aiBusy ? "Analyzing..." : "Generate"}
                  </button>
                </div>
                <p className="small" style={{ marginTop: 10 }}>
                  Default backend model is DeepSeek. Other models require your own API settings.
                </p>

                {aiBusy && (
                  <div className="kpi" style={{ marginTop: 10 }}>
                    <div className="label">AI analysis progress</div>
                    <div className="bar" style={{ height: 14, marginTop: 8 }}><div style={{ width: `${aiProgress}%` }} /></div>
                    <div className="small" style={{ marginTop: 6 }}>
                      {aiProgress < 30 ? "Building full film dossier..." : aiProgress < 60 ? "Extracting patterns..." : aiProgress < 85 ? "Writing critique..." : "Final polishing..."}
                    </div>
                  </div>
                )}

                {aiText && (
                  <div className="card" style={{ marginTop: 12 }}>
                    <h2>AI output</h2>
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
        onSortChange={updateExplorerSort}
        sourceSectionId={explorerSectionId}
        sourceSectionTitle={explorerSectionId ? getReportSectionTitle(explorerSectionId) : null}
        contextTrail={explorerContextTrail}
        onClose={() => {
          startTransition(() => {
            setExplorer(null);
            setExplorerRoute(null);
          });
        }}
        onExport={(rows, exportFileName) => {
          writeCsv(exportFileName, rows);
          triggerUiCue("share");
          showToast("Exported drilldown CSV.");
        }}
        onToast={showToast}
      />

      <Toast text={toast} />
    </div>
  );
}
