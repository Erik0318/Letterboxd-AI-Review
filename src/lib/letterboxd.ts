import JSZip from "jszip";
import Papa from "papaparse";
import { safeNum, toISODateOnly } from "./utils";

export type RawRow = Record<string, string>;

export type KnownCsvName = "watched" | "ratings" | "reviews" | "diary" | "watchlist" | "profile" | "comments";

export type ExportTables = {
  files: string[];
  watched?: RawRow[];
  ratings?: RawRow[];
  diary?: RawRow[];
  reviews?: RawRow[];
  watchlist?: RawRow[];
  profile?: RawRow[];
  comments?: RawRow[];
  unknown: Record<string, RawRow[]>;
};

export type FilmKey = string;

export type FilmRecord = {
  key: FilmKey;
  name: string;
  year: number | null;
  letterboxdUri: string | null;

  watched: boolean; // strictly from watched.csv
  watchedDates: string[]; // timeline dates from diary watched_at/logged_at fallback
  watchedDateEstimatedCount: number;

  rated: boolean;
  rating: number | null; // strictly from ratings.csv

  rewatchCount: number;
  reviewCount: number;
  reviewTextSamples: string[]; // strictly from reviews.csv

  tags: string[];
  sources: KnownCsvName[];
};

export type MergeAnomaly = {
  importSpikeDetected: boolean;
  largestSingleDayImportCount: number;
  largestSingleDayImportDate: string | null;
  percentWithWatchedAt: number;
  watchedDateSpanYears: number;
  diaryEntrySpanYears: number;
};

export type MergeDebugSummary = {
  recognizedCsvFiles: string[];
  filmsTotal: number;
  watchedTrueCount: number;
  percentWithWatchedAt: number;
  ratingsHitRate: number;
  reviewsHitRate: number;
  onlyInRatingsNotInWatched: number;
  onlyInReviewsNotInWatched: number;
  largestSingleDayImportCount: number;
  largestSingleDayImportDate: string | null;
  watchedDateSpanYears: number;
  importSpikeDetected: boolean;
  sampleFilms: Array<{
    key: string;
    name: string;
    sources: KnownCsvName[];
    watchDatesCount: number;
    hasRating: boolean;
    hasReview: boolean;
    hasTags: boolean;
  }>;
};

export type MergeResult = {
  films: FilmRecord[];
  anomaly: MergeAnomaly;
  debug: MergeDebugSummary;
};

function normaliseHeader(h: string): string {
  return h.trim().toLowerCase();
}

function getField(row: RawRow, names: string[]): string | null {
  const map: Record<string, string> = {};
  for (const k of Object.keys(row)) map[normaliseHeader(k)] = row[k];
  for (const n of names) {
    const v = map[normaliseHeader(n)];
    if (v !== undefined && String(v).trim() !== "") return String(v);
  }
  return null;
}

function parseCSV(text: string): RawRow[] {
  const res = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true });
  const rows = (res.data || []).filter(r => Object.keys(r).length > 0);
  return rows;
}

function detectTableName(filename: string): string {
  const b = filename.toLowerCase();
  const stem = b.split("/").pop() || b;
  if (stem === "watched.csv") return "watched";
  if (stem === "ratings.csv") return "ratings";
  if (stem === "reviews.csv") return "reviews";
  if (stem === "diary.csv") return "diary";
  if (stem === "watchlist.csv") return "watchlist";
  if (stem === "profile.csv") return "profile";
  if (stem === "comments.csv") return "comments";

  if (stem.includes("watched")) return "watched";
  if (stem.includes("ratings")) return "ratings";
  if (stem.includes("reviews")) return "reviews";
  if (stem.includes("diary")) return "diary";
  if (stem.includes("watchlist")) return "watchlist";
  if (stem.includes("profile")) return "profile";
  if (stem.includes("comments")) return "comments";
  return "unknown";
}

export async function readLetterboxdExportZip(file: File): Promise<ExportTables> {
  const buffer = await file.arrayBuffer();
  return readLetterboxdExportZipBuffer(buffer);
}

export async function readLetterboxdExportZipBuffer(buffer: ArrayBuffer): Promise<ExportTables> {
  const zip = await JSZip.loadAsync(buffer);
  const files = Object.keys(zip.files).filter(f => f.toLowerCase().endsWith(".csv"));
  const tables: ExportTables = { files, unknown: {} };

  for (const fn of files) {
    const zf = zip.file(fn);
    if (!zf) continue;
    const text = await zf.async("string");
    const rows = parseCSV(text);
    const kind = detectTableName(fn);

    if (kind === "watched") tables.watched = rows;
    else if (kind === "ratings") tables.ratings = rows;
    else if (kind === "diary") tables.diary = rows;
    else if (kind === "reviews") tables.reviews = rows;
    else if (kind === "watchlist") tables.watchlist = rows;
    else if (kind === "profile") tables.profile = rows;
    else if (kind === "comments") tables.comments = rows;
    else tables.unknown[fn] = rows;
  }

  return tables;
}

function extractSlugFromUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/\/film\/([^/?#]+)\/?/i);
  if (m && m[1]) return m[1].toLowerCase();
  return null;
}

function makeKeyFromRow(row: RawRow, fallback: string): { key: FilmKey; uri: string | null } {
  const uri = getField(row, ["Letterboxd URI", "Letterboxd Uri", "URI", "Url", "URL", "Link"]);
  const slug = uri ? extractSlugFromUrl(uri) : null;
  if (slug) return { key: `slug:${slug}`, uri };
  return { key: fallback, uri: uri || null };
}

function collectSpanYears(dates: string[]): number {
  if (!dates.length) return 0;
  const sorted = [...new Set(dates)].sort();
  const start = new Date(sorted[0] + "T00:00:00Z");
  const end = new Date(sorted[sorted.length - 1] + "T00:00:00Z");
  const diffYears = (end.getTime() - start.getTime()) / (365.25 * 86400000);
  return Math.max(0, Number(diffYears.toFixed(2)));
}

function parseRewatchFlag(v: string | null): boolean {
  const x = (v || "").trim().toLowerCase();
  return x === "yes" || x === "true" || x === "1";
}

export function mergeTablesToFilms(t: ExportTables): MergeResult {
  const map = new Map<FilmKey, FilmRecord>();
  const fromWatched = new Set<FilmKey>();
  const fromRatings = new Set<FilmKey>();
  const fromReviews = new Set<FilmKey>();
  const importDayMap = new Map<string, number>();
  const diaryDirectDates: string[] = [];
  const diaryTimelineDates: string[] = [];

  function upsert(row: RawRow, source: KnownCsvName, index: number): FilmRecord {
    const name = getField(row, ["Name", "Film", "Title"]) || "Unknown";
    const year = safeNum(getField(row, ["Year"])) ?? null;
    const { key, uri } = makeKeyFromRow(row, `unknown:${source}:${index}`);

    const existing = map.get(key);
    if (existing) {
      if (!existing.sources.includes(source)) existing.sources.push(source);
      return existing;
    }

    const rec: FilmRecord = {
      key,
      name,
      year,
      letterboxdUri: uri,
      watched: false,
      watchedDates: [],
      watchedDateEstimatedCount: 0,
      rated: false,
      rating: null,
      rewatchCount: 0,
      reviewCount: 0,
      reviewTextSamples: [],
      tags: [],
      sources: [source]
    };
    map.set(key, rec);
    return rec;
  }

  (t.watched || []).forEach((row, idx) => {
    const rec = upsert(row, "watched", idx);
    rec.watched = true;
    fromWatched.add(rec.key);

    const importedDate = toISODateOnly(getField(row, ["Watched Date", "Date", "Imported Date"]));
    if (importedDate) importDayMap.set(importedDate, (importDayMap.get(importedDate) || 0) + 1);
  });

  (t.ratings || []).forEach((row, idx) => {
    const rec = upsert(row, "ratings", idx);
    const r = safeNum(getField(row, ["Rating", "Rated", "Stars"]));
    if (r !== null) {
      rec.rated = true;
      rec.rating = r;
    }
    fromRatings.add(rec.key);
  });

  (t.reviews || []).forEach((row, idx) => {
    const rec = upsert(row, "reviews", idx);
    rec.reviewCount += 1;
    const txt = getField(row, ["Review", "Text", "Content"]);
    if (txt && txt.trim()) rec.reviewTextSamples.push(txt.trim().slice(0, 500));
    fromReviews.add(rec.key);
  });

  (t.diary || []).forEach((row, idx) => {
    const rec = upsert(row, "diary", idx);

    const watchedAt = toISODateOnly(getField(row, ["Watched Date", "Watched", "Date"]));
    const loggedAt = toISODateOnly(getField(row, ["Logged Date", "Logged", "Diary Date"]));
    if (watchedAt) {
      rec.watchedDates.push(watchedAt);
      diaryDirectDates.push(watchedAt);
      diaryTimelineDates.push(watchedAt);
    } else if (loggedAt) {
      rec.watchedDates.push(loggedAt);
      rec.watchedDateEstimatedCount += 1;
      diaryTimelineDates.push(loggedAt);
    }

    if (parseRewatchFlag(getField(row, ["Rewatch"]))) rec.rewatchCount += 1;

    const tags = (getField(row, ["Tags", "Tag"]) || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (tags.length) rec.tags.push(...tags);
  });

  (t.watchlist || []).forEach((row, idx) => {
    upsert(row, "watchlist", idx);
  });

  (t.profile || []).forEach((row, idx) => {
    upsert(row, "profile", idx);
  });

  (t.comments || []).forEach((row, idx) => {
    // must not be treated as reviews; source tracking only
    upsert(row, "comments", idx);
  });

  const out = Array.from(map.values());
  for (const rec of out) {
    rec.watchedDates = Array.from(new Set(rec.watchedDates)).sort();
    rec.reviewTextSamples = Array.from(new Set(rec.reviewTextSamples));
    rec.tags = Array.from(new Set(rec.tags));
    rec.sources.sort();
  }

  let largestSingleDayImportDate: string | null = null;
  let largestSingleDayImportCount = 0;
  for (const [day, count] of importDayMap.entries()) {
    if (count > largestSingleDayImportCount) {
      largestSingleDayImportCount = count;
      largestSingleDayImportDate = day;
    }
  }

  const watchedWithTimeline = out.filter((f) => f.watchedDates.length > 0).length;
  const percentWithWatchedAt = out.length ? watchedWithTimeline / out.length : 0;
  const watchedDateSpanYears = collectSpanYears(diaryTimelineDates);
  const diaryEntrySpanYears = collectSpanYears(diaryDirectDates);
  const spikeRatio = out.length ? largestSingleDayImportCount / out.length : 0;
  const importSpikeDetected = largestSingleDayImportCount >= 20 && spikeRatio >= 0.25 && watchedDateSpanYears > 1;

  const onlyInRatingsNotInWatched = [...fromRatings].filter((k) => !fromWatched.has(k)).length;
  const onlyInReviewsNotInWatched = [...fromReviews].filter((k) => !fromWatched.has(k)).length;

  const random5 = [...out].sort(() => Math.random() - 0.5).slice(0, 5);

  const debug: MergeDebugSummary = {
    recognizedCsvFiles: t.files,
    filmsTotal: out.length,
    watchedTrueCount: out.filter((f) => f.watched).length,
    percentWithWatchedAt,
    ratingsHitRate: out.length ? out.filter((f) => f.rated && f.rating !== null).length / out.length : 0,
    reviewsHitRate: out.length ? out.filter((f) => f.reviewCount > 0).length / out.length : 0,
    onlyInRatingsNotInWatched,
    onlyInReviewsNotInWatched,
    largestSingleDayImportCount,
    largestSingleDayImportDate,
    watchedDateSpanYears,
    importSpikeDetected,
    sampleFilms: random5.map((f) => ({
      key: f.key,
      name: f.name,
      sources: f.sources,
      watchDatesCount: f.watchedDates.length,
      hasRating: f.rated && f.rating !== null,
      hasReview: f.reviewCount > 0,
      hasTags: f.tags.length > 0
    }))
  };

  return {
    films: out,
    anomaly: {
      importSpikeDetected,
      largestSingleDayImportCount,
      largestSingleDayImportDate,
      percentWithWatchedAt,
      watchedDateSpanYears,
      diaryEntrySpanYears
    },
    debug
  };
}
