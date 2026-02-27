import JSZip from "jszip";
import Papa from "papaparse";
import { safeNum, toISODateOnly } from "./utils";

export type RawRow = Record<string, string>;

export type ExportTables = {
  files: string[];
  watched?: RawRow[];
  ratings?: RawRow[];
  diary?: RawRow[];
  reviews?: RawRow[];
  comments?: RawRow[];
  likes?: RawRow[];
  profile?: RawRow[];
  unknown: Record<string, RawRow[]>;
};

export type FilmKey = string;

export type FilmRecord = {
  key: FilmKey;
  name: string;
  year: number | null;
  letterboxdUri: string | null;
  watched: boolean;
  watchedDates: string[];
  rated: boolean;
  rating: number | null;
  ratedDates: string[];
  rewatchCount: number;
  reviewCount: number;
  reviewTextSamples: string[];
  liked: boolean;
  watchedAt: string | null;
  loggedAt: string | null;
  hasEstimatedWatchDate: boolean;
};

export type MergeDebugSummary = {
  csvDetected: string[];
  mergedFilmCount: number;
  percentWithWatchedAt: number;
  ratingsMergeHitRate: number;
  reviewsMergeHitRate: number;
  onlyInRatingsOrReviews: number;
};

function normaliseHeader(h: string): string { return h.trim().toLowerCase(); }

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
  return (res.data || []).filter((r) => Object.keys(r).length > 0);
}

function detectTableName(filename: string): keyof Omit<ExportTables, "files" | "unknown"> | "unknown" {
  const stem = (filename.toLowerCase().split("/").pop() || filename.toLowerCase()).trim();
  if (stem === "watched.csv") return "watched";
  if (stem === "ratings.csv") return "ratings";
  if (stem === "diary.csv") return "diary";
  if (stem === "reviews.csv") return "reviews";
  if (stem === "comments.csv") return "comments";
  if (stem === "likes.csv") return "likes";
  if (stem === "profile.csv") return "profile";
  return "unknown";
}

export async function readLetterboxdExportZip(file: File): Promise<ExportTables> {
  const zip = await JSZip.loadAsync(file);
  const files = Object.keys(zip.files).filter((f) => f.toLowerCase().endsWith(".csv"));
  const tables: ExportTables = { files, unknown: {} };

  for (const fn of files) {
    const zf = zip.file(fn);
    if (!zf) continue;
    const rows = parseCSV(await zf.async("string"));
    const kind = detectTableName(fn);
    if (kind === "unknown") tables.unknown[fn] = rows;
    else tables[kind] = rows;
  }

  return tables;
}

function makeKey(row: RawRow): FilmKey {
  const uri = getField(row, ["Letterboxd URI", "Letterboxd Url", "URI", "URL", "Link"]);
  if (uri) return uri.trim();
  const slug = getField(row, ["Slug", "Name slug"]);
  if (slug) return `slug:${slug.trim().toLowerCase()}`;
  const name = getField(row, ["Name", "Film", "Title"]) || "unknown";
  const year = safeNum(getField(row, ["Year"])) ?? "";
  return `fallback:${name.trim().toLowerCase()}::${year}`;
}

export function mergeTablesToMaster(t: ExportTables): { films: FilmRecord[]; debug: MergeDebugSummary } {
  const map = new Map<FilmKey, FilmRecord>();
  const watchedSet = new Set<FilmKey>();
  let ratingHits = 0;
  let reviewHits = 0;

  function upsert(row: RawRow): FilmRecord {
    const key = makeKey(row);
    const existing = map.get(key);
    if (existing) return existing;
    const rec: FilmRecord = {
      key,
      name: getField(row, ["Name", "Film", "Title"]) || "Unknown",
      year: safeNum(getField(row, ["Year"])),
      letterboxdUri: getField(row, ["Letterboxd URI", "URI", "URL", "Link"]),
      watched: false,
      watchedDates: [],
      rated: false,
      rating: null,
      ratedDates: [],
      rewatchCount: 0,
      reviewCount: 0,
      reviewTextSamples: [],
      liked: false,
      watchedAt: null,
      loggedAt: null,
      hasEstimatedWatchDate: false,
    };
    map.set(key, rec);
    return rec;
  }

  for (const row of t.watched || []) {
    const rec = upsert(row);
    rec.watched = true;
    watchedSet.add(rec.key);
  }

  for (const row of t.ratings || []) {
    const rec = upsert(row);
    if (watchedSet.has(rec.key)) ratingHits += 1;
    rec.rated = true;
    const r = safeNum(getField(row, ["Rating", "Rated", "Stars"]));
    if (r !== null) rec.rating = r;
    const d = toISODateOnly(getField(row, ["Date", "Rated Date"]));
    if (d) {
      rec.ratedDates.push(d);
      rec.loggedAt = rec.loggedAt || d;
    }
  }

  for (const row of t.reviews || []) {
    const rec = upsert(row);
    if (watchedSet.has(rec.key)) reviewHits += 1;
    rec.reviewCount += 1;
    const txt = getField(row, ["Review", "Text", "Content"]);
    if (txt && txt.trim()) rec.reviewTextSamples.push(txt.trim().slice(0, 500));
  }

  for (const row of t.diary || []) {
    const rec = upsert(row);
    rec.watched = true;
    const watchedAt = toISODateOnly(getField(row, ["Watched Date", "Date"]));
    const loggedAt = toISODateOnly(getField(row, ["Date", "Logged Date"]));
    if (watchedAt) {
      rec.watchedDates.push(watchedAt);
      rec.watchedAt = watchedAt;
    } else if (loggedAt) {
      rec.watchedDates.push(loggedAt);
      rec.hasEstimatedWatchDate = true;
    }
    if (loggedAt) rec.loggedAt = loggedAt;

    const rewatch = (getField(row, ["Rewatch"]) || "").trim().toLowerCase();
    if (rewatch === "yes" || rewatch === "true" || rewatch === "1") rec.rewatchCount += 1;
  }

  for (const row of t.likes || []) {
    const rec = upsert(row);
    rec.liked = true;
  }

  // comments.csv deliberately ignored for review text

  const films = Array.from(map.values()).map((rec) => ({
    ...rec,
    watchedDates: Array.from(new Set(rec.watchedDates)).sort(),
    ratedDates: Array.from(new Set(rec.ratedDates)).sort(),
  }));

  const onlyInRatingsOrReviews = films.filter((f) => !f.watched && (f.rated || f.reviewCount > 0)).length;

  return {
    films,
    debug: {
      csvDetected: t.files,
      mergedFilmCount: films.length,
      percentWithWatchedAt: films.length ? films.filter((f) => Boolean(f.watchedAt)).length / films.length : 0,
      ratingsMergeHitRate: (t.ratings || []).length ? ratingHits / (t.ratings || []).length : 0,
      reviewsMergeHitRate: (t.reviews || []).length ? reviewHits / (t.reviews || []).length : 0,
      onlyInRatingsOrReviews,
    },
  };
}

export function mergeTablesToFilms(t: ExportTables): FilmRecord[] {
  return mergeTablesToMaster(t).films;
}
