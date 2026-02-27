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
  likes?: RawRow[];
  unknown: Record<string, RawRow[]>;
};

export type FilmKey = string;

export type DiaryEntry = {
  watchedAt: string | null;
  loggedAt: string | null;
  rewatch: boolean;
};

export type FilmRecord = {
  filmId: FilmKey;
  title: string;
  year: number | null;
  letterboxdUri: string | null;

  watched: boolean;
  watchedAtDates: string[]; // diary watched date only
  loggedAtDates: string[]; // diary/review log date fallback
  importedAtDates: string[]; // watched/ratings import-ish dates

  diaryEntries: DiaryEntry[];

  rated: boolean;
  rating: number | null;
  reviewText: string[];
  like: boolean;
  tags: string[];
  importedAt: string | null;

  ratingRows: number;
  reviewRows: number;
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
  return (res.data || []).filter((r) => Object.keys(r).length > 0);
}

function detectTableName(filename: string): string {
  const stem = (filename.toLowerCase().split("/").pop() || filename.toLowerCase());
  if (stem.includes("watched")) return "watched";
  if (stem.includes("ratings")) return "ratings";
  if (stem.includes("diary")) return "diary";
  if (stem.includes("reviews")) return "reviews";
  if (stem.includes("likes")) return "likes";
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
    if (kind === "watched") tables.watched = rows;
    else if (kind === "ratings") tables.ratings = rows;
    else if (kind === "diary") tables.diary = rows;
    else if (kind === "reviews") tables.reviews = rows;
    else if (kind === "likes") tables.likes = rows;
    else tables.unknown[fn] = rows;
  }

  return tables;
}

function uriToFilmId(uri: string | null): string | null {
  if (!uri) return null;
  const clean = uri.trim();
  if (!clean) return null;
  return clean.replace(/^https?:\/\/letterboxd\.com/i, "").replace(/\/$/, "");
}

function makeKey(uri: string | null, title: string | null, year: number | null): FilmKey {
  const byUri = uriToFilmId(uri);
  if (byUri) return byUri;
  return `${(title || "unknown").trim().toLowerCase()}::${year ?? ""}`;
}

export function mergeTablesToFilms(t: ExportTables): FilmRecord[] {
  const map = new Map<FilmKey, FilmRecord>();

  function upsert(row: RawRow): FilmRecord {
    const title = getField(row, ["Name", "Film", "Title"]) || "Unknown";
    const year = safeNum(getField(row, ["Year"])) ?? null;
    const uri = getField(row, ["Letterboxd URI", "Letterboxd Uri", "URI", "Url", "URL"]) || null;
    const filmId = makeKey(uri, title, year);
    const existing = map.get(filmId);
    if (existing) return existing;

    const rec: FilmRecord = {
      filmId,
      title,
      year,
      letterboxdUri: uri,
      watched: false,
      watchedAtDates: [],
      loggedAtDates: [],
      importedAtDates: [],
      diaryEntries: [],
      rated: false,
      rating: null,
      reviewText: [],
      like: false,
      tags: [],
      importedAt: null,
      ratingRows: 0,
      reviewRows: 0
    };
    map.set(filmId, rec);
    return rec;
  }

  for (const row of t.diary || []) {
    const rec = upsert(row);
    rec.watched = true;
    const watchedAt = toISODateOnly(getField(row, ["Watched Date", "Date"]));
    const loggedAt = toISODateOnly(getField(row, ["Entry Date", "Logged Date", "Date"]));
    const rewatchRaw = (getField(row, ["Rewatch"]) || "").trim().toLowerCase();
    const rewatch = rewatchRaw === "yes" || rewatchRaw === "true" || rewatchRaw === "1";

    rec.diaryEntries.push({ watchedAt, loggedAt, rewatch });
    if (watchedAt) rec.watchedAtDates.push(watchedAt);
    if (loggedAt) rec.loggedAtDates.push(loggedAt);

    const r = safeNum(getField(row, ["Rating"]));
    if (r !== null) {
      rec.rated = true;
      rec.rating = r;
    }

    const tags = (getField(row, ["Tags", "Tag"]) || "").split(",").map((x) => x.trim()).filter(Boolean);
    rec.tags.push(...tags);
  }

  for (const row of t.watched || []) {
    const rec = upsert(row);
    rec.watched = true;
    const importedAt = toISODateOnly(getField(row, ["Date", "Watched Date", "Imported Date"]));
    if (importedAt) {
      rec.importedAtDates.push(importedAt);
      rec.importedAt = rec.importedAt || importedAt;
    }
  }

  for (const row of t.ratings || []) {
    const rec = upsert(row);
    rec.rated = true;
    rec.ratingRows += 1;
    const r = safeNum(getField(row, ["Rating", "Rated", "Stars"]));
    if (r !== null) rec.rating = r;

    const importedAt = toISODateOnly(getField(row, ["Date", "Rated Date", "Imported Date"]));
    if (importedAt) {
      rec.importedAtDates.push(importedAt);
      rec.importedAt = rec.importedAt || importedAt;
    }
  }

  for (const row of t.reviews || []) {
    const rec = upsert(row);
    rec.reviewRows += 1;
    const txt = getField(row, ["Review", "Text", "Content"]);
    if (txt && txt.trim()) rec.reviewText.push(txt.trim());

    const loggedAt = toISODateOnly(getField(row, ["Date", "Logged Date", "Watched Date"]));
    if (loggedAt) rec.loggedAtDates.push(loggedAt);
  }

  for (const row of t.likes || []) {
    const rec = upsert(row);
    rec.like = true;
  }

  const out = Array.from(map.values());
  for (const rec of out) {
    rec.watchedAtDates = Array.from(new Set(rec.watchedAtDates)).sort();
    rec.loggedAtDates = Array.from(new Set(rec.loggedAtDates)).sort();
    rec.importedAtDates = Array.from(new Set(rec.importedAtDates)).sort();
    rec.tags = Array.from(new Set(rec.tags));
    rec.reviewText = rec.reviewText.slice(0, 5);
  }
  return out;
}
