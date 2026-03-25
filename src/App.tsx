import React, { useEffect, useMemo, useState } from "react";
import html2canvas from "html2canvas";
import Toast from "./components/Toast";
import {
  DatasetSummary,
  FilmRecord,
  getBestTimelineDates,
  isWatchedFilm,
  mergeTablesToFilms,
  readLetterboxdExportZip,
} from "./lib/letterboxd";
import {
  AnalysisScope,
  buildExplorerFilmRows,
  buildExplorerReviewRows,
  computeScopedView,
  computeStats,
  DEFAULT_ANALYSIS_SCOPE,
  isAnalysisScopeActive,
  RatingDriftSortKey,
  StatPack,
} from "./lib/stats";
import ArchiveListsPanel from "./components/ArchiveListsPanel";
import BacklogPanel from "./components/BacklogPanel";
import { BarList } from "./components/BarList";
import DataQualityPanel from "./components/DataQualityPanel";
import FilmExplorer, { FilmExplorerPayload } from "./components/FilmExplorer";
import { Heatmap } from "./components/Heatmap";
import RatingDriftPanel from "./components/RatingDriftPanel";
import ReleaseAnalyticsPanel from "./components/ReleaseAnalyticsPanel";
import ReviewStatsPanel from "./components/ReviewStatsPanel";
import ShareCard from "./components/ShareCard";
import ScopeBar from "./components/ScopeBar";
import { formatInt, formatPct, round1, round3 } from "./lib/utils";

type Provider = "default" | "openai_compat" | "gemini";
type Lang = "en" | "zh" | "uk";

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
    basis: basis && VALID_SCOPE_BASES.includes(basis as AnalysisScope["basis"]) ? basis as AnalysisScope["basis"] : DEFAULT_ANALYSIS_SCOPE.basis,
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
  const params = new URLSearchParams(window.location.search);
  const value = params.get("driftSort");
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
      return `"${text.replace(/"/g, "\"\"")}"`;
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

  const stats = useMemo(
    () => (films && datasetSummary ? computeStats(films, datasetSummary, label) : null),
    [films, datasetSummary, label],
  );
  const scopedView = useMemo(
    () => (films ? computeScopedView(films, scope, label) : null),
    [films, label, scope],
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
  const currentShareContext = scopeIsActive && scopedView ? scopedView.scope.summary : null;
  const currentOverviewCards = scopeIsActive && scopedView
    ? {
      primaryTitle: "Scoped films",
      primaryValue: formatInt(scopedView.overview.scopedFilms.value),
      primaryLabel: scopedView.scope.summary,
      secondaryTitle: "Current rated films",
      secondaryValue: formatInt(scopedView.overview.currentRatedFilms.value),
      secondaryLabel: "within the active scope",
      tertiaryTitle: "Current mean",
      tertiaryValue: scopedView.overview.currentMeanRating.value === null ? "n/a" : String(round3(scopedView.overview.currentMeanRating.value)),
      tertiaryLabel: "currentRating within the active scope",
      quaternaryTitle: "Mean delta",
      quaternaryValue: scopedView.overview.meanDelta.value === null ? "n/a" : `${scopedView.overview.meanDelta.value > 0 ? "+" : ""}${round3(scopedView.overview.meanDelta.value)}`,
      quaternaryLabel: "currentRating - loggedRating within scoped comparable films",
    }
    : (stats ? {
      primaryTitle: "Watched films",
      primaryValue: formatInt(stats.overview.watchedFilmsUnique.value),
      primaryLabel: "unique film-level watched universe",
      secondaryTitle: "Current rated films",
      secondaryValue: formatInt(stats.overview.currentRatedFilms.value),
      secondaryLabel: "unique films with current rating",
      tertiaryTitle: "Current mean",
      tertiaryValue: stats.overview.currentMeanRating.value === null ? "n/a" : String(round3(stats.overview.currentMeanRating.value)),
      tertiaryLabel: "based on currentRating only",
      quaternaryTitle: "Best streak",
      quaternaryValue: formatInt(stats.overview.bestStreakDays.value),
      quaternaryLabel: "exact watched dates only",
    } : null);

  const ratingHistogram = (scopeIsActive ? scopedView?.ratings.current.histogram : stats?.ratings.current.histogram)
    ? (scopeIsActive ? scopedView?.ratings.current.histogram : stats?.ratings.current.histogram)!.map((item) => ({ label: ratingLabel(item.rating), value: item.count }))
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

  const quickFacts = useMemo(() => {
    if (!stats) {
      return [] as Array<{ label: string; value: string }>;
    }
    return [
      {
        label: "Watched rows",
        value: formatInt(stats.quickFacts.watchedRows.value),
      },
      { label: "Unrated watched films", value: formatInt(stats.quickFacts.unratedWatchedFilmsWithoutCurrentRating.value) },
      { label: "Logged-rated films", value: formatInt(stats.quickFacts.loggedRatedFilms.value) },
      { label: "Review rows", value: formatInt(stats.quickFacts.reviewRows.value) },
      { label: "Watchlist films", value: formatInt(stats.quickFacts.watchlistFilms.value) },
      { label: "Commitment", value: formatPct(stats.quickFacts.commitmentIndex.value) },
      { label: "Current volatility", value: stats.quickFacts.currentRatingStddev.value === null ? "n/a" : String(round1(stats.quickFacts.currentRatingStddev.value)) },
    ];
  }, [stats]);

  const coverageFacts = useMemo(() => {
    if (!datasetSummary) {
      return [] as Array<{ label: string; value: string }>;
    }
    return [
      {
        label: "Exact-dated watched films",
        value: `${formatInt(datasetSummary.dateQualitySummary.exactDatedWatchedFilms)} / ${formatInt(datasetSummary.coverageSummary.watchedUniverseFilmCount)}`,
      },
      { label: "Watched films without exact date", value: formatInt(datasetSummary.dateQualitySummary.watchedFilmsWithoutExactDate) },
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

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }

  async function importZip(input: Blob | ArrayBuffer, sourceName: string) {
    setAiText("");
    setFilms(null);
    setDatasetSummary(null);
    setFileName(sourceName);
    try {
      const tables = await readLetterboxdExportZip(input);
      const merged = mergeTablesToFilms(tables);
      setFilms(merged.films);
      setDatasetSummary(merged.summary);
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
      return showToast("Share card not ready.");
    }
    const canvas = await html2canvas(el as HTMLElement, { backgroundColor: null, scale: 2 });
    const url = canvas.toDataURL("image/png");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = scopeIsActive ? "letterboxd-scoped-view.png" : "letterboxd-ai-card.png";
    anchor.click();
  }

  async function runAI() {
    if (!stats || !films) return;
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

  function buildFilmExplorerPayload(
    title: string,
    subtitle: string,
    source: string,
    rows: ReturnType<typeof buildExplorerFilmRows>,
    exportFileName: string,
  ): FilmExplorerPayload {
    return {
      kind: "films",
      title,
      subtitle,
      source,
      exportFileName,
      rows,
    };
  }

  function buildReviewExplorerPayload(
    title: string,
    subtitle: string,
    source: string,
    rows: ReturnType<typeof buildExplorerReviewRows>,
    exportFileName: string,
  ): FilmExplorerPayload {
    return {
      kind: "reviewRows",
      title,
      subtitle,
      source,
      exportFileName,
      rows,
    };
  }

  function buildExplorerFromRoute(route: string): FilmExplorerPayload | null {
    const [kind, source, rawValue] = route.split("|");

    if (kind === "films" && source === "current") {
      const routeSource = scopeIsActive && scopedView
        ? `Active scope: ${scopedView.scope.summary}`
        : "Global merged film set";
      return buildFilmExplorerPayload(
        scopeIsActive ? "Scoped film explorer" : "Global film explorer",
        scopeIsActive
          ? "Unique films that match the active scope."
          : "Unique merged film records across the full export.",
        routeSource,
        scopedFilmRows,
        scopeIsActive ? "scoped_films.csv" : "all_films.csv",
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
      );
    }

    if (kind === "releaseYear" && source && rawValue) {
      const rows = source === "watchlist" ? watchlistExplorerRows : currentReleaseFilmRows;
      const routeSource = source === "watchlist"
        ? "Watchlist release year bucket"
        : scopeIsActive
          ? "Scoped release year bucket"
          : "Watched release year bucket";
      return buildFilmExplorerPayload(
        `Release year ${rawValue}`,
        source === "watchlist"
          ? "Unique watchlist films from the selected release year."
          : scopeIsActive
            ? "Unique films in the active scope from the selected release year."
            : "Unique watched films from the selected release year.",
        routeSource,
        rows.filter((row) => row.year !== null && String(row.year) === rawValue),
        `release_year_${rawValue}.csv`,
      );
    }

    if (kind === "releaseDecade" && source && rawValue) {
      const rows = source === "watchlist" ? watchlistExplorerRows : currentReleaseFilmRows;
      const routeSource = source === "watchlist"
        ? "Watchlist release decade bucket"
        : scopeIsActive
          ? "Scoped release decade bucket"
          : "Watched release decade bucket";
      return buildFilmExplorerPayload(
        `Release decade ${rawValue}`,
        source === "watchlist"
          ? "Unique watchlist films from the selected release decade."
          : scopeIsActive
            ? "Unique films in the active scope from the selected release decade."
            : "Unique watched films from the selected release decade.",
        routeSource,
        rows.filter((row) => row.year !== null && `${Math.floor(row.year / 10) * 10}s` === rawValue),
        `release_decade_${rawValue}.csv`,
      );
    }

    if (kind === "releaseAnalyticsDecade" && source && rawValue) {
      return buildFilmExplorerPayload(
        `Release decade ${rawValue}`,
        "Unique films behind the selected release-analytics decade row.",
        scopeIsActive ? "Scoped release analytics decade row" : "Release analytics decade row",
        currentReleaseFilmRows.filter((row) => row.year !== null && `${Math.floor(row.year / 10) * 10}s` === rawValue),
        `release_analytics_decade_${rawValue}.csv`,
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
      );
    }

    if (kind === "driftCase" && source) {
      const filmKey = decodeURIComponent(source);
      return buildFilmExplorerPayload(
        "Rating drift case",
        "Unique film behind the selected representative rating-drift case.",
        `Representative drift list: ${ratingDriftSort}`,
        scopedFilmRows.filter((row) => row.filmKey === filmKey),
        "rating_drift_case.csv",
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
      );
    }

    return null;
  }

  function openExplorerRoute(route: string) {
    const payload = buildExplorerFromRoute(route);
    if (!payload) {
      showToast("No drilldown rows for this view.");
      return;
    }
    setExplorerRoute(route);
    setExplorer(payload);
  }

  useEffect(() => {
    if (!explorerRoute) {
      setExplorer(null);
      return;
    }
    if (!films) {
      setExplorer(null);
      return;
    }
    const payload = buildExplorerFromRoute(explorerRoute);
    setExplorer(payload);
    if (!payload && films) {
      setExplorerRoute(null);
    }
  }, [
    currentReleaseFilmRows,
    currentReviewRows,
    explorerRoute,
    films,
    ratingDriftSort,
    scopeIsActive,
    scopedFilmRows,
    scopedView,
    watchlistExplorerRows,
  ]);

  function openScopedExplorer() {
    openExplorerRoute("films|current");
  }

  function exportCurrentScopedFilms() {
    if (!scopedFilmRows.length) {
      showToast("No films to export.");
      return;
    }
    writeCsv(
      scopeIsActive ? "scoped_films.csv" : "all_films.csv",
      scopedFilmRows.map((row) => ({
        title: row.title,
        year: row.year,
        current_rating: row.currentRating,
        logged_rating: row.loggedRating,
        delta: row.delta,
        exact_watched_date: row.exactWatchedDate,
        review_rows: row.reviewRows,
        longest_review_length: row.longestReviewLength,
        in_watchlist: row.inWatchlist ? "yes" : "no",
        watchlist_added_date: row.watchlistAddedDate,
      })),
    );
    showToast("Exported current film view.");
  }

  async function copyCurrentViewSummary() {
    if (!currentShareText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(currentShareText.long);
      showToast("Copied current view summary.");
    } catch {
      showToast("Copy failed.");
    }
  }

  function openHistogramBin(label: string) {
    openExplorerRoute(`histogram|${label}`);
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

  const debugPayload = datasetSummary && stats
    ? {
      datasetSummary,
      activeScope: scopedView?.scope || null,
      activeScopeInput: scope,
      scopedOverview: scopedView?.overview || null,
      scopedCounts: scopedView?.scope.counts || null,
      currentView: {
        overviewCards: currentOverviewCards,
        shareText: currentShareText || null,
        shareCard: currentShareCard || null,
        releaseDistribution: currentReleaseDistribution || null,
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
      backlog: stats.backlog,
      reviews: {
        summary: (currentReviews || stats.reviews).summary,
        lengthBuckets: (currentReviews || stats.reviews).lengthBuckets,
        longestReviews: (currentReviews || stats.reviews).longestReviews.slice(0, 10),
        topWords: (currentReviews || stats.reviews).topWords,
      },
      releaseAnalytics: currentReleaseAnalytics || stats.releaseAnalytics,
      archives: {
        summary: stats.archives.summary,
        archiveScopes: stats.archives.archiveScopes,
        lists: stats.archives.lists.slice(0, 12),
      },
      dataQuality: stats.dataQuality,
      drilldown: explorer
        ? {
          route: explorerRoute,
          title: explorer.title,
          source: explorer.source,
          kind: explorer.kind,
          rowMode: explorer.kind === "films" ? "uniqueFilms" : "reviewRows",
          rowCount: explorer.rows.length,
          exportFileName: explorer.exportFileName,
        }
        : null,
    }
    : datasetSummary;
  const debugJson = debugPayload ? JSON.stringify(debugPayload, null, 2) : "";
  const sampleDateProbe = films ? films.slice(0, 3).map((film) => ({ film: film.name, timeline: getBestTimelineDates(film) })) : [];

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <h1>Letterboxd AI Review</h1>
          <div className="sub">Generic Letterboxd ZIP parsing with corrected data semantics.</div>
        </div>
        <div className="row">
          <a className="badge" href="https://github.com/Erik0318/Letterboxd-AI-Review" target="_blank" rel="noreferrer">Project GitHub</a>
          <button className="btn danger" onClick={() => window.location.reload()}>Reset</button>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>1) Import</h2>
          <div className="drop">
            <input type="file" accept=".zip" onChange={(e) => { const file = e.target.files?.[0]; if (file) void onUploadZip(file); }} />
            <div className="small">{fileName || "Upload your Letterboxd export ZIP"}</div>
            <div className="small">All parsing and stats run locally in your browser. Refresh clears everything.</div>
            <button className="btn primary" style={{ marginTop: 10 }} onClick={onLoadSample}>Use sample_data.zip</button>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <div>
              <div className="small">Label on share card</div>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <div className="small">AI language</div>
              <select value={language} onChange={(e) => setLanguage(e.target.value as Lang)}>
                <option value="en">English</option>
                <option value="zh">Chinese</option>
                <option value="uk">Ukrainian</option>
              </select>
            </div>
          </div>

          <div className="hr" />
          <h2>Quick tutorial</h2>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            <li>Export Letterboxd data from Settings to a ZIP file.</li>
            <li>Upload any user export here. The sample ZIP is only a regression fixture.</li>
            <li>Current phase adds reusable scope filters, clickable drilldowns and export audit modules on top of the corrected merge semantics.</li>
            <li>The debug summary below is the fastest way to validate unfamiliar exports.</li>
          </ul>

          {stats && (
            <div className="row" style={{ marginTop: 10 }}>
              <span className="badge">{formatInt(films?.length || 0)} merged film records</span>
              <span className="badge">{formatInt(stats.overview.watchedFilmsUnique.value)} watched films</span>
              <span className="badge">{formatInt(stats.overview.exactDatedWatchedFilms.value)} exact-dated watched films</span>
              <span className="badge">{formatInt(stats.quickFacts.watchlistFilms.value)} watchlist films</span>
              <span className="badge">{formatInt(stats.quickFacts.reviewRows.value)} review rows</span>
            </div>
          )}

          {datasetSummary && (
            <div style={{ marginTop: 10 }}>
              <label className="small" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={showDebug} onChange={(e) => setShowDebug(e.target.checked)} /> Debug summary
              </label>
              {showDebug && (
                <div className="card" style={{ marginTop: 8 }}>
                  <div className="small">recognized files: {datasetSummary.recognizedFiles.join(", ") || "none"}</div>
                  <div className="small">unknown files: {datasetSummary.unknownFiles.map((item) => item.path).join(", ") || "none"}</div>
                  <div className="small">exact-dated watched films coverage: {formatPct(datasetSummary.dateQualitySummary.exactDatedWatchedFilmCoverage)}</div>
                  <div className="small">watched films without exact date: {formatInt(datasetSummary.dateQualitySummary.watchedFilmsWithoutExactDate)}</div>
                  {stats && (
                    <div className="small">
                      rating drift comparable / changed / upgraded / downgraded / mean delta: {formatInt(stats.ratingDrift.summary.comparableFilms.value)} / {formatInt(stats.ratingDrift.summary.changed.value)} / {formatInt(stats.ratingDrift.summary.upgraded.value)} / {formatInt(stats.ratingDrift.summary.downgraded.value)} / {stats.ratingDrift.summary.meanDelta.value === null ? "n/a" : `${stats.ratingDrift.summary.meanDelta.value > 0 ? "+" : ""}${round3(stats.ratingDrift.summary.meanDelta.value)}`}
                    </div>
                  )}
                  {stats && (
                    <div className="small">
                      backlog watchlist films / rows / with add date: {formatInt(stats.backlog.summary.watchlistFilms.value)} / {formatInt(stats.backlog.summary.watchlistRows.value)} / {formatInt(stats.backlog.summary.watchlistFilmsWithAddDate.value)}
                    </div>
                  )}
                  {stats && (
                    <div className="small">
                      review stats reviewed films / review rows / longest review: {formatInt(stats.reviews.summary.reviewedFilms.value)} / {formatInt(stats.reviews.summary.reviewRows.value)} / {formatInt(stats.reviews.summary.longestReviewLength.value)}
                    </div>
                  )}
                  {stats && (
                    <div className="small">
                      release analytics highest current / logged decade: {stats.releaseAnalytics.summary.highestCurrentRatedDecade ? `${stats.releaseAnalytics.summary.highestCurrentRatedDecade.decade} (${round1(stats.releaseAnalytics.summary.highestCurrentRatedDecade.meanRating)})` : "n/a"} / {stats.releaseAnalytics.summary.highestLoggedRatedDecade ? `${stats.releaseAnalytics.summary.highestLoggedRatedDecade.decade} (${round1(stats.releaseAnalytics.summary.highestLoggedRatedDecade.meanRating)})` : "n/a"}
                    </div>
                  )}
                  {stats && (
                    <div className="small">
                      archive + lists active / archived lists, deleted / orphaned diary rows: {formatInt(stats.archives.summary.activeLists.value)} / {formatInt(stats.archives.summary.archivedLists.value)}, {formatInt(stats.archives.summary.deletedDiaryRows.value)} / {formatInt(stats.archives.summary.orphanedDiaryRows.value)}
                    </div>
                  )}
                  <div className="small">watched.csv import/log spike: {datasetSummary.importSpikeSummary.largestSingleDayImportDate ? `${datasetSummary.importSpikeSummary.largestSingleDayImportDate} (${formatInt(datasetSummary.importSpikeSummary.largestSingleDayImportCount)})` : "none"}</div>
                  <div className="small">lists parsed: {formatInt(datasetSummary.listSummary.activeListCount)} active / {formatInt(datasetSummary.listSummary.archivedListCount)} archived</div>
                  <div className="small">likes rows: {formatInt(datasetSummary.archiveSummary.likes.filmRows + datasetSummary.archiveSummary.likes.reviewRows + datasetSummary.archiveSummary.likes.listRows)}</div>
                  <div className="small">sample date probe: {JSON.stringify(sampleDateProbe)}</div>
                  <pre style={{ whiteSpace: "pre-wrap", margin: "10px 0 0", overflowX: "auto", fontSize: 12, color: "var(--muted)" }}>
                    {debugJson}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {films && scopedView && (
          <ScopeBar
            scope={scope}
            isActive={scopeIsActive}
            chips={scopedView.scope.appliedFilters}
            basisFilms={scopedView.scope.counts.basisFilms}
            matchingFilms={scopeIsActive ? scopedView.scope.counts.matchingFilms : (films?.length || 0)}
            summary={scopedView.scope.summary}
            yearSpan={releaseYearSpan}
            availableDecades={availableDecades}
            ratingOptions={HALF_STAR_OPTIONS}
            onChange={(nextScope) => {
              setScope(nextScope);
              setExplorer(null);
              setExplorerRoute(null);
            }}
            onReset={() => {
              setScope(DEFAULT_ANALYSIS_SCOPE);
              setExplorer(null);
              setExplorerRoute(null);
            }}
            onOpenExplorer={openScopedExplorer}
            onExport={exportCurrentScopedFilms}
            onCopySummary={() => { void copyCurrentViewSummary(); }}
          />
        )}

        {stats && datasetSummary && (
          <>
            <div className="card span3">
              <h2>{currentOverviewCards?.primaryTitle || "Watched films"}</h2>
              <div className="kpi">
                <div className="value">{currentOverviewCards?.primaryValue || formatInt(stats.overview.watchedFilmsUnique.value)}</div>
                <div className="label">{currentOverviewCards?.primaryLabel || "unique film-level watched universe"}</div>
              </div>
            </div>
            <div className="card span3">
              <h2>{currentOverviewCards?.secondaryTitle || "Current rated films"}</h2>
              <div className="kpi">
                <div className="value">{currentOverviewCards?.secondaryValue || formatInt(stats.overview.currentRatedFilms.value)}</div>
                <div className="label">{currentOverviewCards?.secondaryLabel || "unique films with current rating"}</div>
              </div>
            </div>
            <div className="card span3">
              <h2>{currentOverviewCards?.tertiaryTitle || "Current mean"}</h2>
              <div className="kpi">
                <div className="value">{currentOverviewCards?.tertiaryValue || (stats.overview.currentMeanRating.value === null ? "n/a" : String(round3(stats.overview.currentMeanRating.value)))}</div>
                <div className="label">{currentOverviewCards?.tertiaryLabel || "based on currentRating only"}</div>
              </div>
            </div>
            <div className="card span3">
              <h2>{currentOverviewCards?.quaternaryTitle || "Best streak"}</h2>
              <div className="kpi">
                <div className="value">{currentOverviewCards?.quaternaryValue || formatInt(stats.overview.bestStreakDays.value)}</div>
                <div className="label">{currentOverviewCards?.quaternaryLabel || "exact watched dates only"}</div>
              </div>
            </div>

            <div className="card span6">
              <h2>{scopeIsActive ? "Quick Facts (global export)" : "Quick Facts"}</h2>
              <div className="row">
                {quickFacts.map((item) => <div className="badge" key={item.label}>{item.label}: {item.value}</div>)}
              </div>
            </div>

            <div className="card span6">
              <h2>{scopeIsActive ? "Coverage (global export)" : "Coverage"}</h2>
              <div className="row">
                {coverageFacts.map((item) => <div className="badge" key={item.label}>{item.label}: {item.value}</div>)}
              </div>
            </div>

            <DataQualityPanel
              dataQuality={stats.dataQuality}
              subtitle={scopeIsActive ? "Global export audit. Scope filters do not change the underlying export reliability." : undefined}
            />

            <div className="span6">
              <BarList
                title={scopeIsActive ? "Current rating histogram in scope" : "Current rating histogram"}
                subtitle={scopeIsActive ? "Current-rating distribution across films in the active scope." : undefined}
                items={ratingHistogram}
                emptyText="No rating data."
                onItemClick={(item) => openHistogramBin(item.label)}
              />
            </div>
            <div className="span6">
              <Heatmap
                byMonth={stats.activity.heatmap.byMonth}
                title="Watch timeline (exact watched dates only)"
                emptyText="No exact watched dates found in the export."
                footerText="Exact watched dates only. Watched films without exact date are excluded."
                subtitle={scopeIsActive ? (scopedView?.panelNotes.activity || undefined) : undefined}
              />
            </div>
            <RatingDriftPanel
              drift={currentRatingDrift || stats.ratingDrift}
              sort={ratingDriftSort}
              onSortChange={setRatingDriftSort}
              title={scopeIsActive ? "Rating drift in scope" : "Rating drift"}
              subtitle={scopeIsActive ? "Logged rating = rating recorded in diary/review at the time. Current rating = rating from ratings.csv current snapshot. Delta = currentRating - loggedRating inside the active scope." : undefined}
              onCategoryClick={openDriftCategory}
              onCaseClick={(item) => openDriftCaseExplorer(item.filmKey)}
            />
            <BacklogPanel
              backlog={stats.backlog}
              subtitle={scopeIsActive ? scopedView?.panelNotes.backlog || undefined : undefined}
            />
            <div className="span6">
              <Heatmap
                byMonth={stats.backlog.timeline.byMonth}
                title="Watchlist add timeline"
                emptyText="No watchlist add dates found in the export."
                footerText="Unique watchlist films grouped by earliest watchlist add date found."
                subtitle={scopeIsActive ? "Global watchlist add timeline. Scope filters do not apply to this backlog panel." : undefined}
              />
            </div>
            <div className="span6">
              <BarList
                title="Top watchlist release years"
                subtitle={scopeIsActive ? "Global watchlist backlog. Scope filters do not apply here." : undefined}
                items={watchlistReleaseYears}
                emptyText="No watchlist release years."
                onItemClick={(item) => openReleaseYearExplorer(item.label, "watchlist")}
              />
            </div>
            <div className="span6">
              <BarList
                title="Top watchlist decades"
                subtitle={scopeIsActive ? "Global watchlist backlog. Scope filters do not apply here." : undefined}
                items={watchlistDecades}
                emptyText="No watchlist decades."
                onItemClick={(item) => openReleaseDecadeExplorer(item.label, "watchlist")}
              />
            </div>
            <ReviewStatsPanel
              reviews={currentReviews || stats.reviews}
              title={scopeIsActive ? "Review stats in scope" : "Review stats"}
              subtitle={scopeIsActive ? "Review rows and reviewed films within the active scope. Length stats use review rows with non-empty text only." : undefined}
              onLongestReviewClick={(row) => openLongestReviewExplorer(row.id)}
            />
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
            <ArchiveListsPanel
              archives={stats.archives}
              subtitle={scopeIsActive ? scopedView?.panelNotes.archives || undefined : undefined}
            />

            <div className="card">
              <h2>2) Share</h2>
              <div className="small">
                {scopeIsActive
                  ? `This share card reflects the active scope. ${scopedView?.scope.summary || ""}`
                  : "This share card reflects the global view."}
              </div>
              <div className="row">
                <button className="btn primary" onClick={() => { void copyCurrentViewSummary(); }}>
                  Copy current view summary
                </button>
                <button className="btn primary" onClick={downloadShareCard}>
                  Download share card PNG
                </button>
              </div>
              <div style={{ marginTop: 12 }}>
                <ShareCard
                  generatedAt={currentShareGeneratedAt || stats.generatedAt}
                  badgeText={currentShareBadge}
                  shareCard={currentShareCard || stats.shareCard}
                  label={label}
                  contextNote={currentShareContext}
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
                />
              </div>
            </div>

            <div className="card">
              <h2>3) AI Roast / Praise</h2>
              <div className="row">
                <div>
                  <div className="small">Mode</div>
                  <select value={mode} onChange={(e) => setMode(e.target.value as "praise" | "roast")}>
                    <option value="roast">Roast</option>
                    <option value="praise">Praise</option>
                  </select>
                </div>
                <div>
                  <div className="small">Intensity</div>
                  <select value={roastLevel} onChange={(e) => setRoastLevel(Number(e.target.value) as 1 | 2 | 3)}>
                    <option value={1}>Mild</option>
                    <option value={2}>Normal</option>
                    <option value={3}>Savage</option>
                  </select>
                </div>
                <div>
                  <div className="small">Provider</div>
                  <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
                    <option value="default">Default (DeepSeek)</option>
                    <option value="openai_compat">DeepSeek / GPT / Doubao</option>
                    <option value="gemini">Gemini</option>
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="small">API key</div>
                  <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Optional" />
                </div>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="small">Base URL</div>
                  <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.deepseek.com" />
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="small">Model</div>
                  <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="deepseek-chat" />
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
                  <h2>AI Output</h2>
                  <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit", color: "var(--text)" }}>{aiText}</pre>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <FilmExplorer
        payload={explorer}
        onClose={() => {
          setExplorer(null);
          setExplorerRoute(null);
        }}
        onExport={(rows, fileName) => {
          writeCsv(fileName, rows);
          showToast("Exported drilldown CSV.");
        }}
      />

      <Toast text={toast} />
    </div>
  );
}
