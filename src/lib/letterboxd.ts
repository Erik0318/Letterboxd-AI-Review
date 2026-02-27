import JSZip from "jszip";
import Papa from "papaparse";
import { safeNum, toISODateOnly } from "./utils";

export type RawRow = Record<string, string>;
export type FilmKey = string;

export type ExportTables = {
  files: string[];
  watched?: RawRow[];
  ratings?: RawRow[];
  diary?: RawRow[];
  reviews?: RawRow[];
  comments?: RawRow[];
  profile?: RawRow[];
  unknown: Record<string, RawRow[]>;
};

export type DiaryEntry = {
  watched_at: string | null;
  logged_at: string | null;
  tags: string[];
  rewatch: boolean;
};

export type FilmRecord = {
  film_id: FilmKey;
  name: string;
  year: number | null;
  letterboxdUri: string | null;
  watched: boolean;
  rating: number | null;
  review_text: string[];
  diary_entries: DiaryEntry[];
  watch_dates: string[];
  watched_at: string | null;
  logged_at: string | null;
  imported_at: string | null;
  hasEstimatedDate: boolean;
};

export type MergeDebug = {
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

function detectTableName(filename: string): string {
  const stem = (filename.toLowerCase().split("/").pop() || filename.toLowerCase());
  if (stem === "watched.csv") return "watched";
  if (stem === "ratings.csv") return "ratings";
  if (stem === "diary.csv") return "diary";
  if (stem === "reviews.csv") return "reviews";
  if (stem === "comments.csv") return "comments";
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
    if (kind === "watched") tables.watched = rows;
    else if (kind === "ratings") tables.ratings = rows;
    else if (kind === "diary") tables.diary = rows;
    else if (kind === "reviews") tables.reviews = rows;
    else if (kind === "comments") tables.comments = rows;
    else if (kind === "profile") tables.profile = rows;
    else tables.unknown[fn] = rows;
  }
  return tables;
}

function makeKey(row: RawRow): FilmKey {
  const uri = getField(row, ["Letterboxd URI", "Letterboxd Url", "Letterboxd link", "URI", "URL", "Link"]);
  if (uri) return uri.trim();
  const slug = getField(row, ["Slug", "Name slug"]);
  if (slug) return `slug:${slug.trim().toLowerCase()}`;
  const name = getField(row, ["Name", "Film", "Title"]) || "unknown";
  const year = safeNum(getField(row, ["Year"])) ?? "";
  return `fallback:${name.trim().toLowerCase()}::${year}`;
}

export function mergeTablesToFilms(t: ExportTables): { films: FilmRecord[]; debug: MergeDebug } {
  const map = new Map<FilmKey, FilmRecord>();
  const watchedSet = new Set<FilmKey>();
  let ratingsHits = 0;
  let reviewsHits = 0;

  function upsert(row: RawRow): FilmRecord {
    const key = makeKey(row);
    const existing = map.get(key);
    if (existing) return existing;
    const rec: FilmRecord = {
      film_id: key,
      name: getField(row, ["Name", "Film", "Title"]) || "Unknown",
      year: safeNum(getField(row, ["Year"])),
      letterboxdUri: getField(row, ["Letterboxd URI", "URI", "URL", "Link"]),
      watched: false,
      rating: null,
      review_text: [],
      diary_entries: [],
      watch_dates: [],
      watched_at: null,
      logged_at: null,
      imported_at: null,
      hasEstimatedDate: false
    };
    map.set(key, rec);
    return rec;
  }

  for (const row of t.watched || []) {
    const rec = upsert(row);
    rec.watched = true;
    watchedSet.add(rec.film_id);
  }

  for (const row of t.ratings || []) {
    const rec = upsert(row);
    if (watchedSet.has(rec.film_id)) ratingsHits += 1;
    const rating = safeNum(getField(row, ["Rating", "Rated", "Stars"]));
    if (rating !== null) rec.rating = rating;
    const logged = toISODateOnly(getField(row, ["Date", "Rated Date", "Last watched date"]));
    if (logged) rec.logged_at = logged;
  }

  for (const row of t.reviews || []) {
    const rec = upsert(row);
    if (watchedSet.has(rec.film_id)) reviewsHits += 1;
    const review = getField(row, ["Review", "Text", "Content"]);
    if (review) rec.review_text.push(review.trim());
  }

  for (const row of t.diary || []) {
    const rec = upsert(row);
    rec.watched = true;
    const watchedAt = toISODateOnly(getField(row, ["Watched Date", "Date"]));
    const loggedAt = toISODateOnly(getField(row, ["Date", "Logged Date"]));
    const tagsRaw = getField(row, ["Tags"]);
    const tags = tagsRaw ? tagsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const rewatch = /^(yes|true|1)$/i.test(getField(row, ["Rewatch"]) || "");
    rec.diary_entries.push({ watched_at: watchedAt, logged_at: loggedAt, tags, rewatch });
    if (watchedAt) rec.watch_dates.push(watchedAt);
    else if (loggedAt) {
      rec.watch_dates.push(loggedAt);
      rec.hasEstimatedDate = true;
    }
  }

  const films = Array.from(map.values()).map((f) => {
    const dates = Array.from(new Set(f.watch_dates)).sort();
    const diaryWatched = f.diary_entries.map((d) => d.watched_at).filter(Boolean) as string[];
    const diaryLogged = f.diary_entries.map((d) => d.logged_at).filter(Boolean) as string[];
    return {
      ...f,
      watch_dates: dates,
      watched_at: diaryWatched.sort().at(-1) || null,
      logged_at: diaryLogged.sort().at(-1) || f.logged_at,
      imported_at: new Date().toISOString().slice(0, 10)
    };
  });

  const onlyInRatingsOrReviews = films.filter((f) => !f.watched && (f.rating !== null || f.review_text.length > 0)).length;

  return {
    films,
    debug: {
      csvDetected: t.files,
      mergedFilmCount: films.length,
      percentWithWatchedAt: films.length ? films.filter((f) => !!f.watched_at).length / films.length : 0,
      ratingsMergeHitRate: (t.ratings || []).length ? ratingsHits / (t.ratings || []).length : 0,
      reviewsMergeHitRate: (t.reviews || []).length ? reviewsHits / (t.reviews || []).length : 0,
      onlyInRatingsOrReviews
    }
  };
}
