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
  watched_at: string | null;
  logged_at: string | null;
  rewatch: boolean;
  rating: number | null;
  review_text: string | null;
  tags: string[];
  source: "diary" | "reviews";
};

export type FilmRecord = {
  film_id: FilmKey;
  key: FilmKey;
  name: string;
  year: number | null;
  letterboxdUri: string | null;

  watched: boolean;
  watchedDates: string[];
  watched_at_dates: string[];
  logged_at_dates: string[];
  imported_at_dates: string[];

  diary_entries: DiaryEntry[];
  diaryEntries: DiaryEntry[];

  rated: boolean;
  rating: number | null;
  ratedDates: string[];

  rewatchCount: number;
  reviewCount: number;
  reviewTextSamples: string[];
  review_text: string | null;

  liked: boolean;
  like: boolean;
  tags: string[];
  imported_at: string | null;
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
  const b = filename.toLowerCase();
  const stem = b.split("/").pop() || b;
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
    const text = await zf.async("string");
    const rows = parseCSV(text);
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

function makeKey(uri: string | null, name: string | null, year: number | null): FilmKey {
  if (uri && uri.trim()) return uri.trim();
  const n = (name || "").trim().toLowerCase();
  const y = year ?? "";
  return `${n}::${y}`;
}

function parseTags(row: RawRow): string[] {
  const raw = getField(row, ["Tags", "Tag"]);
  if (!raw) return [];
  return raw
    .split(/[|,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseBool(v: string | null): boolean {
  const x = (v || "").trim().toLowerCase();
  return x === "yes" || x === "true" || x === "1";
}

export function mergeTablesToFilms(t: ExportTables): FilmRecord[] {
  const map = new Map<FilmKey, FilmRecord>();

  function upsert(row: RawRow): FilmRecord {
    const name = getField(row, ["Name", "Film", "Title"]) || "Unknown";
    const year = safeNum(getField(row, ["Year"])) ?? null;
    const uri = getField(row, ["Letterboxd URI", "Letterboxd Uri", "URI", "Url", "URL", "Slug"]) || null;
    const key = makeKey(uri, name, year);

    const existing = map.get(key);
    if (existing) return existing;

    const rec: FilmRecord = {
      film_id: key,
      key,
      name,
      year,
      letterboxdUri: uri,
      watched: false,
      watchedDates: [],
      watched_at_dates: [],
      logged_at_dates: [],
      imported_at_dates: [],
      diary_entries: [],
      diaryEntries: [],
      rated: false,
      rating: null,
      ratedDates: [],
      rewatchCount: 0,
      reviewCount: 0,
      reviewTextSamples: [],
      review_text: null,
      liked: false,
      like: false,
      tags: [],
      imported_at: null
    };
    map.set(key, rec);
    return rec;
  }

  for (const row of t.watched || []) {
    const rec = upsert(row);
    rec.watched = true;
    const importedAt = toISODateOnly(getField(row, ["Date", "Watched Date", "Created Date"]));
    if (importedAt) rec.imported_at_dates.push(importedAt);
  }

  for (const row of t.ratings || []) {
    const rec = upsert(row);
    rec.rated = true;
    const r = safeNum(getField(row, ["Rating", "Rated", "Stars"]));
    if (r !== null) rec.rating = r;
    const importedAt = toISODateOnly(getField(row, ["Date", "Rated Date", "Created Date"]));
    if (importedAt) rec.imported_at_dates.push(importedAt);
    if (importedAt) rec.ratedDates.push(importedAt);
  }

  for (const row of t.diary || []) {
    const rec = upsert(row);
    rec.watched = true;

    const watchedAt = toISODateOnly(getField(row, ["Watched Date", "Date"]));
    const loggedAt = toISODateOnly(getField(row, ["Date", "Logged Date", "Diary Date", "Entry Date"]));
    const rating = safeNum(getField(row, ["Rating"]));
    const rewatch = parseBool(getField(row, ["Rewatch"]));
    const tags = parseTags(row);

    if (watchedAt) rec.watched_at_dates.push(watchedAt);
    if (loggedAt) rec.logged_at_dates.push(loggedAt);
    if (rating !== null) {
      rec.rated = true;
      rec.rating = rating;
      if (loggedAt) rec.ratedDates.push(loggedAt);
    }
    if (rewatch) rec.rewatchCount += 1;

    rec.diary_entries.push({
      watched_at: watchedAt,
      logged_at: loggedAt,
      rewatch,
      rating,
      review_text: null,
      tags,
      source: "diary"
    });
    if (tags.length) rec.tags.push(...tags);
  }

  for (const row of t.reviews || []) {
    const rec = upsert(row);
    rec.reviewCount += 1;
    const txt = getField(row, ["Review", "Text", "Content"]);
    const watchedAt = toISODateOnly(getField(row, ["Watched Date"]));
    const loggedAt = toISODateOnly(getField(row, ["Date", "Logged Date", "Review Date"]));
    const rating = safeNum(getField(row, ["Rating"]));
    const tags = parseTags(row);

    if (txt && txt.trim()) rec.reviewTextSamples.push(txt.trim().slice(0, 500));
    if (txt && !rec.review_text) rec.review_text = txt.trim();
    if (rating !== null) {
      rec.rated = true;
      rec.rating = rating;
      if (loggedAt) rec.ratedDates.push(loggedAt);
    }
    if (watchedAt) rec.watched_at_dates.push(watchedAt);
    if (loggedAt) rec.logged_at_dates.push(loggedAt);
    if (loggedAt && !watchedAt) rec.imported_at_dates.push(loggedAt);

    rec.diary_entries.push({
      watched_at: watchedAt,
      logged_at: loggedAt,
      rewatch: false,
      rating,
      review_text: txt || null,
      tags,
      source: "reviews"
    });
    if (tags.length) rec.tags.push(...tags);
  }

  for (const row of t.likes || []) {
    const rec = upsert(row);
    rec.liked = true;
    rec.like = true;
    const importedAt = toISODateOnly(getField(row, ["Date", "Created Date"]));
    if (importedAt) rec.imported_at_dates.push(importedAt);
  }

  const out = Array.from(map.values());
  for (const rec of out) {
    rec.watched_at_dates = Array.from(new Set(rec.watched_at_dates)).sort();
    rec.logged_at_dates = Array.from(new Set(rec.logged_at_dates)).sort();
    rec.imported_at_dates = Array.from(new Set(rec.imported_at_dates)).sort();
    rec.watchedDates = rec.watched_at_dates;
    rec.ratedDates = Array.from(new Set(rec.ratedDates)).sort();
    rec.diaryEntries = rec.diary_entries;
    rec.tags = Array.from(new Set(rec.tags));
    rec.imported_at = rec.imported_at_dates[0] || null;
  }
  return out;
}
