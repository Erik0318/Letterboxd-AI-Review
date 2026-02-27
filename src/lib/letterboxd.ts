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
  // common export names
  if (stem.includes("watched")) return "watched";
  if (stem.includes("ratings")) return "ratings";
  if (stem.includes("diary")) return "diary";
  if (stem.includes("reviews")) return "reviews";
  if (stem.includes("likes")) return "likes";
  return "unknown";
}

export async function readLetterboxdExportZip(file: File): Promise<ExportTables> {
  const zip = await JSZip.loadAsync(file);
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

export function mergeTablesToFilms(t: ExportTables): FilmRecord[] {
  const map = new Map<FilmKey, FilmRecord>();

  function upsert(row: RawRow): FilmRecord {
    const name = getField(row, ["Name", "Film", "Title"]) || "Unknown";
    const year = safeNum(getField(row, ["Year"])) ?? null;
    const uri = getField(row, ["Letterboxd URI", "Letterboxd Uri", "URI", "Url", "URL"]) || null;
    const key = makeKey(uri, name, year);

    const existing = map.get(key);
    if (existing) return existing;

    const rec: FilmRecord = {
      key,
      name,
      year,
      letterboxdUri: uri,
      watched: false,
      watchedDates: [],
      rated: false,
      rating: null,
      ratedDates: [],
      rewatchCount: 0,
      reviewCount: 0,
      reviewTextSamples: [],
      liked: false
    };
    map.set(key, rec);
    return rec;
  }

  // watched
  for (const row of t.watched || []) {
    const rec = upsert(row);
    rec.watched = true;
    const d = toISODateOnly(getField(row, ["Watched Date", "Date"]));
    if (d) rec.watchedDates.push(d);
  }

  // ratings
  for (const row of t.ratings || []) {
    const rec = upsert(row);
    rec.rated = true;
    const r = safeNum(getField(row, ["Rating", "Rated", "Stars"]));
    if (r !== null) rec.rating = r;
    const d = toISODateOnly(getField(row, ["Date", "Rated Date"]));
    if (d) rec.ratedDates.push(d);
  }

  // diary entries
  for (const row of t.diary || []) {
    const rec = upsert(row);
    rec.watched = true;

    const d = toISODateOnly(getField(row, ["Date", "Watched Date"]));
    if (d) rec.watchedDates.push(d);

    const r = safeNum(getField(row, ["Rating"]));
    if (r !== null) {
      rec.rated = true;
      rec.rating = r;
    }

    const rewatch = (getField(row, ["Rewatch"]) || "").trim().toLowerCase();
    if (rewatch === "yes" || rewatch === "true" || rewatch === "1") rec.rewatchCount += 1;
  }

  // reviews
  for (const row of t.reviews || []) {
    const rec = upsert(row);
    rec.reviewCount += 1;
    const txt = getField(row, ["Review", "Text", "Content"]);
    if (txt && txt.trim()) rec.reviewTextSamples.push(txt.trim().slice(0, 500));
  }

  // likes (may exist)
  for (const row of t.likes || []) {
    const rec = upsert(row);
    rec.liked = true;
  }

  // final cleanup
  const out = Array.from(map.values());
  for (const rec of out) {
    rec.watchedDates = Array.from(new Set(rec.watchedDates)).sort();
    rec.ratedDates = Array.from(new Set(rec.ratedDates)).sort();
  }
  return out;
}
