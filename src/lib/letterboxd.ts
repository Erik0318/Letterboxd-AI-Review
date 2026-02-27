import JSZip from "jszip";
import Papa from "papaparse";
import { safeNum, toISODateOnly } from "./utils";

export type RawRow = Record<string, string>;

type SupportedCsv = "watched" | "ratings" | "reviews" | "diary" | "watchlist" | "profile" | "comments";

export type ExportTables = {
  files: string[];
  detectedCsv: SupportedCsv[];
  watched: RawRow[];
  ratings: RawRow[];
  diary: RawRow[];
  reviews: RawRow[];
  watchlist: RawRow[];
  profile: RawRow[];
  comments: RawRow[];
  unknown: Record<string, RawRow[]>;
};

export type FilmKey = string;

export type DiaryEntry = {
  watchedAt: string;
  estimated: boolean;
  loggedAt: string | null;
  rewatch: boolean;
  tags: string[];
};

export type FilmRecord = {
  key: FilmKey;
  slug: string;
  name: string;
  year: number | null;
  letterboxdUri: string | null;

  watched: boolean;
  watchedDates: string[];

  rated: boolean;
  rating: number | null;
  ratedDates: string[];

  diaryEntries: DiaryEntry[];
  rewatchCount: number;
  reviewCount: number;
  reviewTextSamples: string[];
  tags: string[];

  liked: boolean;
  sources: Array<"watched" | "ratings" | "reviews" | "diary">;
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
  csvDetected: SupportedCsv[];
  filmTotal: number;
  watchedTrueCount: number;
  watchedAtCoverage: number;
  ratingsHitRate: number;
  reviewsHitRate: number;
  onlyInRatingsNotInWatched: number;
  onlyInReviewsNotInWatched: number;
  watchedTrueWithDatesCount: number;
  watchedTrueWithoutDatesCount: number;
  diaryRowsTotal: number;
  diaryRowsMatchedToWatchedCount: number;
  reviewsRowsMatchedToWatchedCount: number;
  largestSingleDayImportCount: number;
  largestSingleDayImportDate: string | null;
  watchedDateSpanYears: number;
  importSpikeDetected: boolean;
  randomFilmSamples: Array<{
    key: string;
    name: string;
    sources: string[];
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
  return (res.data || []).filter(r => Object.keys(r).length > 0);
}

function detectTableName(filename: string): SupportedCsv | "unknown" {
  const lower = filename.toLowerCase().trim();
  if (lower.includes("/")) return "unknown";
  if (lower === "watched.csv") return "watched";
  if (lower === "ratings.csv") return "ratings";
  if (lower === "reviews.csv") return "reviews";
  if (lower === "diary.csv") return "diary";
  if (lower === "watchlist.csv") return "watchlist";
  if (lower === "profile.csv") return "profile";
  if (lower === "comments.csv") return "comments";
  return "unknown";
}

export async function readLetterboxdExportZip(input: Blob | ArrayBuffer): Promise<ExportTables> {
  const zip = await JSZip.loadAsync(input);
  const files = Object.keys(zip.files).filter(f => f.toLowerCase().endsWith(".csv"));
  const tables: ExportTables = {
    files,
    detectedCsv: [],
    watched: [], ratings: [], diary: [], reviews: [], watchlist: [], profile: [], comments: [],
    unknown: {}
  };

  for (const fn of files) {
    const zf = zip.file(fn);
    if (!zf) continue;
    const rows = parseCSV(await zf.async("string"));
    const kind = detectTableName(fn);
    if (kind === "unknown") {
      tables.unknown[fn] = rows;
      continue;
    }
    if (!tables.detectedCsv.includes(kind)) tables.detectedCsv.push(kind);
    tables[kind] = rows;
  }

  return tables;
}

function normaliseName(v: string | null): string {
  return (v || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function extractSlug(link: string | null): string {
  const v = (link || "").trim();
  const short = v.match(/boxd\.it\/([a-zA-Z0-9]+)/);
  if (short?.[1]) return short[1].toLowerCase();
  const full = v.match(/letterboxd\.com\/film\/([^/\s?#]+)/);
  if (full?.[1]) return full[1].toLowerCase();
  return "";
}

function filmKeyFromRow(row: RawRow): FilmKey | null {
  const name = normaliseName(getField(row, ["Name", "Film", "Title"]));
  if (!name) return null;
  const year = safeNum(getField(row, ["Year"]));
  return `${name}::${year ?? "unknown"}`;
}

function spanYears(dates: string[]): number {
  const clean = dates.filter(Boolean).sort();
  if (!clean.length) return 0;
  return Math.max(0, Number(clean[clean.length - 1].slice(0, 4)) - Number(clean[0].slice(0, 4)));
}

function shuffled<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function mergeTablesToFilms(t: ExportTables): MergeResult {
  const map = new Map<FilmKey, FilmRecord>();
  const watchedKeys = new Set<FilmKey>();

  function upsert(row: RawRow): FilmRecord | null {
    const key = filmKeyFromRow(row);
    if (!key) return null;
    const existing = map.get(key);
    if (existing) return existing;

    const uri = getField(row, ["Letterboxd URI", "Letterboxd Uri", "URI", "Url", "URL", "Link", "Content"]);
    const rec: FilmRecord = {
      key,
      slug: extractSlug(uri) || key,
      name: getField(row, ["Name", "Film", "Title"]) || "Unknown",
      year: safeNum(getField(row, ["Year"])) ?? null,
      letterboxdUri: uri,
      watched: false,
      watchedDates: [],
      rated: false,
      rating: null,
      ratedDates: [],
      diaryEntries: [],
      rewatchCount: 0,
      reviewCount: 0,
      reviewTextSamples: [],
      tags: [],
      liked: false,
      sources: []
    };
    map.set(key, rec);
    return rec;
  }

  for (const row of t.watched) {
    const rec = upsert(row);
    if (!rec) continue;
    rec.watched = true;
    if (!rec.sources.includes("watched")) rec.sources.push("watched");
    watchedKeys.add(rec.key);
  }

  for (const row of t.ratings) {
    const rec = upsert(row);
    if (!rec) continue;
    rec.rated = true;
    rec.rating = safeNum(getField(row, ["Rating", "Rated", "Stars"]));
    const d = toISODateOnly(getField(row, ["Date", "Rated Date"]));
    if (d) rec.ratedDates.push(d);
    if (!rec.sources.includes("ratings")) rec.sources.push("ratings");
  }

  let diaryWithWatchedAt = 0;
  let diaryRowsMatchedToWatchedCount = 0;
  let reviewsRowsMatchedToWatchedCount = 0;
  const diaryEffectiveDates: string[] = [];
  const diaryLoggedDates: string[] = [];

  for (const row of t.diary) {
    const rec = upsert(row);
    if (!rec) continue;
    if (watchedKeys.has(rec.key)) diaryRowsMatchedToWatchedCount += 1;
    if (!rec.sources.includes("diary")) rec.sources.push("diary");

    const watchedAt = toISODateOnly(getField(row, ["Watched Date", "Watched At", "watched_at"]));
    const loggedAt = toISODateOnly(getField(row, ["Date", "Logged Date", "logged_at"]));
    const effective = watchedAt || loggedAt;
    if (watchedAt) diaryWithWatchedAt += 1;
    if (!effective) continue;

    const rewatchRaw = (getField(row, ["Rewatch"]) || "").trim().toLowerCase();
    const rewatch = rewatchRaw === "yes" || rewatchRaw === "true" || rewatchRaw === "1";
    const tags = (getField(row, ["Tags"]) || "").split(",").map(x => x.trim()).filter(Boolean);

    rec.diaryEntries.push({ watchedAt: effective, estimated: !watchedAt, loggedAt, rewatch, tags });
    rec.watchedDates.push(effective);
    if (rewatch) rec.rewatchCount += 1;
    for (const tag of tags) rec.tags.push(tag);

    diaryEffectiveDates.push(effective);
    if (loggedAt) diaryLoggedDates.push(loggedAt);
  }

  for (const row of t.reviews) {
    const rec = upsert(row);
    if (!rec) continue;
    if (watchedKeys.has(rec.key)) reviewsRowsMatchedToWatchedCount += 1;
    rec.reviewCount += 1;
    const txt = getField(row, ["Review", "Text", "Content"]);
    if (txt?.trim()) rec.reviewTextSamples.push(txt.trim().slice(0, 500));
    if (!rec.sources.includes("reviews")) rec.sources.push("reviews");
  }

  const out = Array.from(map.values());
  for (const rec of out) {
    rec.watchedDates = Array.from(new Set(rec.watchedDates)).sort();
    rec.ratedDates = Array.from(new Set(rec.ratedDates)).sort();
    rec.tags = Array.from(new Set(rec.tags));
  }

  const watchedTrueCount = out.filter(f => f.watched).length;
  const watchedTrueWithDatesCount = out.filter(f => f.watched && f.watchedDates.length > 0).length;
  const watchedTrueWithoutDatesCount = watchedTrueCount - watchedTrueWithDatesCount;
  const onlyInRatingsNotInWatched = out.filter(f => f.sources.includes("ratings") && !f.watched).length;
  const onlyInReviewsNotInWatched = out.filter(f => f.sources.includes("reviews") && !f.watched).length;

  const importMap = new Map<string, number>();
  for (const row of t.watched) {
    const d = toISODateOnly(getField(row, ["Date"]));
    if (d) importMap.set(d, (importMap.get(d) || 0) + 1);
  }
  const importPeak = Array.from(importMap.entries()).sort((a, b) => b[1] - a[1])[0] || null;

  const largestSingleDayImportCount = importPeak?.[1] || 0;
  const largestSingleDayImportDate = importPeak?.[0] || null;
  const percentWithWatchedAt = t.diary.length ? diaryWithWatchedAt / t.diary.length : 0;
  const watchedDateSpanYears = spanYears(diaryEffectiveDates);
  const diaryEntrySpanYears = spanYears(diaryLoggedDates);
  const importSpikeDetected = largestSingleDayImportCount >= Math.max(40, Math.round(t.watched.length * 0.35));

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
    debug: {
      csvDetected: t.detectedCsv,
      filmTotal: out.length,
      watchedTrueCount,
      watchedAtCoverage: watchedTrueCount ? watchedTrueWithDatesCount / watchedTrueCount : 0,
      ratingsHitRate: out.length ? out.filter(f => f.rated).length / out.length : 0,
      reviewsHitRate: out.length ? out.filter(f => f.reviewCount > 0).length / out.length : 0,
      onlyInRatingsNotInWatched,
      onlyInReviewsNotInWatched,
      watchedTrueWithDatesCount,
      watchedTrueWithoutDatesCount,
      diaryRowsTotal: t.diary.length,
      diaryRowsMatchedToWatchedCount,
      reviewsRowsMatchedToWatchedCount,
      largestSingleDayImportCount,
      largestSingleDayImportDate,
      watchedDateSpanYears,
      importSpikeDetected,
      randomFilmSamples: shuffled(out).slice(0, 5).map((f) => ({
        key: f.key,
        name: f.name,
        sources: f.sources,
        watchDatesCount: f.watchedDates.length,
        hasRating: f.rating !== null,
        hasReview: f.reviewCount > 0,
        hasTags: f.tags.length > 0
      }))
    }
  };
}
