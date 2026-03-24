import JSZip from "jszip";
import Papa from "papaparse";
import { safeNum, toISODateOnly } from "./utils";

export type RawRow = Record<string, string>;

export type SupportedCsv =
  | "profile"
  | "watched"
  | "ratings"
  | "diary"
  | "reviews"
  | "watchlist"
  | "comments";

export type ActiveFilmTable = "watched" | "ratings" | "diary" | "reviews" | "watchlist";
export type ArchivedCsv = "diary" | "reviews" | "comments";
export type LikeCsv = "films" | "reviews" | "lists";
export type ArchiveScope = "deleted" | "orphaned";
export type FilmKey = string;

export type ParseIssue = {
  path: string;
  message: string;
};

export type ListMetadata = {
  title: string | null;
  description: string | null;
  url: string | null;
  tags: string[];
  createdDate: string | null;
  exportedDate: string | null;
  exportVersion: string | null;
};

export type ListItem = {
  position: number | null;
  name: string | null;
  year: number | null;
  filmUrl: string | null;
  description: string | null;
  filmKey: FilmKey | null;
};

export type ParsedListFile = {
  path: string;
  scope: "active" | ArchiveScope;
  metadata: ListMetadata;
  items: ListItem[];
  parseError: string | null;
};

export type ArchivedTables = {
  diary: RawRow[];
  reviews: RawRow[];
  comments: RawRow[];
  lists: ParsedListFile[];
  unknown: Record<string, RawRow[]>;
};

export type LikeTables = {
  films: RawRow[];
  reviews: RawRow[];
  lists: RawRow[];
  unknown: Record<string, RawRow[]>;
};

export type ExportTables = {
  files: string[];
  recognizedFiles: string[];
  unknownFiles: string[];
  parseIssues: ParseIssue[];
  detectedCsv: SupportedCsv[];
  watched: RawRow[];
  ratings: RawRow[];
  diary: RawRow[];
  reviews: RawRow[];
  watchlist: RawRow[];
  profile: RawRow[];
  comments: RawRow[];
  deleted: ArchivedTables;
  orphaned: ArchivedTables;
  likes: LikeTables;
  lists: ParsedListFile[];
  unknown: Record<string, RawRow[]>;
};

export type WatchEvent = {
  id: string;
  source: "diary" | "review" | "diary+review";
  diaryEntryUri: string | null;
  reviewEntryUri: string | null;
  loggedAt: string | null;
  exactWatchedDate: string | null;
  estimatedWatchedDate: null;
  bestWatchedDate: string | null;
  watchedDateIsExact: boolean;
  loggedRating: number | null;
  reviewText: string | null;
  rewatch: boolean;
  tags: string[];
};

export type FilmRecord = {
  filmKey: FilmKey;
  name: string;
  year: number | null;
  filmUri: string | null;
  diaryEntryUris: string[];
  reviewEntryUris: string[];
  inWatched: boolean;
  inRatings: boolean;
  inDiary: boolean;
  inReviews: boolean;
  inWatchlist: boolean;
  watchedRows: number;
  ratingRows: number;
  diaryRows: number;
  reviewRows: number;
  watchlistRows: number;
  watchedImportDates: string[];
  watchlistAddedDates: string[];
  watchEvents: WatchEvent[];
  currentRating: number | null;
  loggedRating: number | null;
  bestRating: number | null;
  exactWatchedDate: string | null;
  estimatedWatchedDate: string | null;
  bestWatchedDate: string | null;
  watchedDateIsExact: boolean;
  reviewTexts: string[];
  tags: string[];
  rewatchCount: number;
  sourceFlags: {
    tables: ActiveFilmTable[];
    provenance: Array<{ table: ActiveFilmTable; rowIndex: number; path: string }>;
  };
};

export type DatasetTableSummary = {
  path: string;
  scope: "active" | ArchiveScope | "likes" | "unknown";
  parser: "csv" | "list";
  rowCount: number;
  uniqueFilmCount: number | null;
};

export type DatasetSummary = {
  recognizedFiles: string[];
  unknownFiles: Array<{ path: string; rowCount: number }>;
  parseIssues: ParseIssue[];
  tableRowCounts: Record<string, number>;
  tableUniqueFilmCounts: Record<string, number | null>;
  fileSummaries: DatasetTableSummary[];
  coverageSummary: {
    activeFilmCount: number;
    watchedUniverseFilmCount: number;
    watchedFilmCount: number;
    ratingFilmCount: number;
    diaryFilmCount: number;
    reviewFilmCount: number;
    watchlistFilmCount: number;
  };
  overlapSummary: {
    watchedAndRatings: number;
    watchedAndDiary: number;
    watchedAndReviews: number;
    diaryAndReviews: number;
    watchlistAndWatchedUniverse: number;
    watchedOnly: number;
    ratingsOnly: number;
    diaryOnly: number;
    reviewsOnly: number;
    watchlistOnly: number;
  };
  dateQualitySummary: {
    filmsWithExactDate: number;
    filmsWithEstimatedOnly: number;
    filmsWithNoWatchedDate: number;
    exactWatchEvents: number;
    loggedEntriesWithoutExactDate: number;
    estimatedWatchRows: number;
    estimatedFallbackRows: number;
    exactCoverage: number;
  };
  ratingSourceSummary: {
    filmsWithCurrentRating: number;
    filmsWithLoggedRating: number;
    both: number;
    currentOnly: number;
    loggedOnly: number;
    changed: number;
    unchanged: number;
    upgraded: number;
    downgraded: number;
  };
  importSpikeSummary: {
    topDays: Array<{ date: string; count: number }>;
    largestSingleDayImportCount: number;
    largestSingleDayImportDate: string | null;
    importSpikeDetected: boolean;
  };
  listSummary: {
    activeListCount: number;
    archivedListCount: number;
    activeListItemCount: number;
    archivedListItemCount: number;
    lists: Array<{
      path: string;
      scope: "active" | ArchiveScope;
      title: string | null;
      itemCount: number;
      createdDate: string | null;
      exportedDate: string | null;
      tags: string[];
      parseError: string | null;
    }>;
  };
  archiveSummary: {
    deleted: {
      diaryRows: number;
      reviewRows: number;
      commentRows: number;
      listFiles: number;
      uniqueFilmCount: number;
    };
    orphaned: {
      diaryRows: number;
      reviewRows: number;
      commentRows: number;
      listFiles: number;
      uniqueFilmCount: number;
    };
    likes: {
      filmRows: number;
      filmUniqueCount: number;
      reviewRows: number;
      listRows: number;
    };
  };
  samples: Array<{
    filmKey: string;
    name: string;
    tables: string[];
    filmUri: string | null;
    diaryEntryCount: number;
    reviewEntryCount: number;
    exactWatchedDate: string | null;
    estimatedWatchedDate: string | null;
    currentRating: number | null;
    loggedRating: number | null;
    inWatchlist: boolean;
  }>;
};

export type MergeAnomaly = {
  importSpikeDetected: boolean;
  largestSingleDayImportCount: number;
  largestSingleDayImportDate: string | null;
  exactWatchedCoverage: number;
  estimatedOnlyFilms: number;
  currentOnlyRatingFilms: number;
  loggedOnlyRatingFilms: number;
};

export type MergeResult = {
  films: FilmRecord[];
  anomaly: MergeAnomaly;
  summary: DatasetSummary;
};

type CsvClassification =
  | { kind: "active"; table: SupportedCsv }
  | { kind: "archive"; scope: ArchiveScope; table: ArchivedCsv }
  | { kind: "likes"; table: LikeCsv }
  | { kind: "list"; scope: "active" | ArchiveScope }
  | { kind: "unknown" };

const FILM_URI_FIELDS = ["Letterboxd URI", "Letterboxd Uri", "URI", "Url", "URL", "Link"];
const TITLE_FIELDS = ["Name", "Film", "Title"];
const YEAR_FIELDS = ["Year"];

function normaliseHeader(value: string): string {
  return value.trim().toLowerCase().normalize("NFKC");
}

function getField(row: RawRow, names: string[]): string | null {
  const map: Record<string, string> = {};
  for (const key of Object.keys(row)) {
    map[normaliseHeader(key)] = row[key];
  }
  for (const name of names) {
    const value = map[normaliseHeader(name)];
    if (value !== undefined && String(value).trim() !== "") {
      return String(value);
    }
  }
  return null;
}

function cleanRow(row: Record<string, unknown>): RawRow {
  const out: RawRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "__parsed_extra") {
      continue;
    }
    out[String(key)] = value === undefined || value === null ? "" : String(value);
  }
  return out;
}

function hasAnyValue(row: RawRow): boolean {
  return Object.values(row).some((value) => String(value).trim() !== "");
}

function parseCSV(text: string): { rows: RawRow[]; issues: string[] } {
  const result = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: true,
  });

  return {
    rows: (result.data || []).map(cleanRow).filter(hasAnyValue),
    issues: (result.errors || []).map((error) => error.message),
  };
}

function parseMatrix(text: string): { rows: string[][]; issues: string[] } {
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: false,
  });

  return {
    rows: (result.data || []).map((row) => row.map((value) => value ?? "")),
    issues: (result.errors || []).map((error) => error.message),
  };
}

function rowIsBlank(row: string[]): boolean {
  return row.every((value) => String(value).trim() === "");
}

function findNextNonEmptyRow(rows: string[][], startIndex: number): number {
  for (let index = startIndex; index < rows.length; index += 1) {
    if (!rowIsBlank(rows[index])) {
      return index;
    }
  }
  return -1;
}

function mapRow(headers: string[], values: string[]): RawRow {
  const out: RawRow = {};
  for (let index = 0; index < headers.length; index += 1) {
    out[headers[index]] = values[index] ?? "";
  }
  return out;
}

export function normaliseFilmTitle(value: string | null): string {
  return (value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normaliseFilmYear(value: unknown): number | null {
  const year = safeNum(value);
  if (year === null) {
    return null;
  }
  return Math.trunc(year);
}

export function createFilmKey(name: string | null, year: unknown): FilmKey | null {
  const normalisedName = normaliseFilmTitle(name);
  if (!normalisedName) {
    return null;
  }
  const normalisedYear = normaliseFilmYear(year);
  return `${normalisedName}::${normalisedYear ?? "unknown"}`;
}

export function filmKeyFromRow(row: RawRow): FilmKey | null {
  return createFilmKey(getField(row, TITLE_FIELDS), getField(row, YEAR_FIELDS));
}

function parseTagList(value: string | null): string[] {
  return (value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normaliseUri(value: string | null): string | null {
  const uri = (value || "").trim();
  return uri || null;
}

function compareIsoAsc(left: string | null, right: string | null): number {
  return (left || "").localeCompare(right || "");
}

function sortIsoDates(dates: string[]): string[] {
  return [...dates].sort((left, right) => left.localeCompare(right));
}

function pickLaterIso(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return right.localeCompare(left) > 0 ? right : left;
}

function classifyCsvPath(filename: string): CsvClassification {
  const parts = filename.split("/").map((part) => part.trim().toLowerCase()).filter(Boolean);
  if (!parts.length) {
    return { kind: "unknown" };
  }

  if (parts.length === 1) {
    const file = parts[0];
    if (file === "profile.csv") return { kind: "active", table: "profile" };
    if (file === "watched.csv") return { kind: "active", table: "watched" };
    if (file === "ratings.csv") return { kind: "active", table: "ratings" };
    if (file === "diary.csv") return { kind: "active", table: "diary" };
    if (file === "reviews.csv") return { kind: "active", table: "reviews" };
    if (file === "watchlist.csv") return { kind: "active", table: "watchlist" };
    if (file === "comments.csv") return { kind: "active", table: "comments" };
    return { kind: "unknown" };
  }

  if (parts[0] === "likes" && parts.length === 2) {
    if (parts[1] === "films.csv") return { kind: "likes", table: "films" };
    if (parts[1] === "reviews.csv") return { kind: "likes", table: "reviews" };
    if (parts[1] === "lists.csv") return { kind: "likes", table: "lists" };
  }

  if (parts[0] === "lists" && parts.length >= 2) {
    return { kind: "list", scope: "active" };
  }

  if ((parts[0] === "deleted" || parts[0] === "orphaned") && parts.length >= 2) {
    const scope = parts[0] as ArchiveScope;
    if (parts[1] === "lists" && parts.length >= 3) {
      return { kind: "list", scope };
    }
    if (parts.length === 2) {
      if (parts[1] === "diary.csv") return { kind: "archive", scope, table: "diary" };
      if (parts[1] === "reviews.csv") return { kind: "archive", scope, table: "reviews" };
      if (parts[1] === "comments.csv") return { kind: "archive", scope, table: "comments" };
    }
  }

  return { kind: "unknown" };
}

function createArchivedTables(): ArchivedTables {
  return {
    diary: [],
    reviews: [],
    comments: [],
    lists: [],
    unknown: {},
  };
}

function createLikeTables(): LikeTables {
  return {
    films: [],
    reviews: [],
    lists: [],
    unknown: {},
  };
}

export function parseLetterboxdListCsv(
  text: string,
  path: string,
  scope: "active" | ArchiveScope,
  exportedDate: string | null,
): ParsedListFile {
  const { rows, issues } = parseMatrix(text);
  const version = rows[0]?.[0]?.trim() || null;
  const metadata: ListMetadata = {
    title: null,
    description: null,
    url: null,
    tags: [],
    createdDate: null,
    exportedDate,
    exportVersion: version,
  };

  if (!version || !version.toLowerCase().startsWith("letterboxd list export")) {
    return {
      path,
      scope,
      metadata,
      items: [],
      parseError: "Unsupported list export format.",
    };
  }

  const metaHeaderIndex = findNextNonEmptyRow(rows, 1);
  const metaValueIndex = metaHeaderIndex === -1 ? -1 : findNextNonEmptyRow(rows, metaHeaderIndex + 1);
  const itemHeaderIndex = metaValueIndex === -1 ? -1 : findNextNonEmptyRow(rows, metaValueIndex + 1);

  if (metaHeaderIndex === -1 || metaValueIndex === -1 || itemHeaderIndex === -1) {
    return {
      path,
      scope,
      metadata,
      items: [],
      parseError: "Incomplete list export sections.",
    };
  }

  const metaRow = mapRow(rows[metaHeaderIndex], rows[metaValueIndex]);
  metadata.title = getField(metaRow, ["Name", "Title"]);
  metadata.description = getField(metaRow, ["Description", "Notes"]);
  metadata.url = getField(metaRow, ["URL", "Url", "Letterboxd URI"]);
  metadata.tags = parseTagList(getField(metaRow, ["Tags"]));
  metadata.createdDate = toISODateOnly(getField(metaRow, ["Date", "Created", "Created Date"]));

  const itemHeaders = rows[itemHeaderIndex];
  const items: ListItem[] = [];
  for (let rowIndex = itemHeaderIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    if (rowIsBlank(rows[rowIndex])) {
      continue;
    }
    const itemRow = mapRow(itemHeaders, rows[rowIndex]);
    const name = getField(itemRow, ["Name", "Film", "Title"]);
    const year = normaliseFilmYear(getField(itemRow, ["Year"]));
    items.push({
      position: safeNum(getField(itemRow, ["Position"])) ?? null,
      name,
      year,
      filmUrl: getField(itemRow, ["URL", "Url", "Letterboxd URI"]),
      description: getField(itemRow, ["Description", "Notes"]),
      filmKey: createFilmKey(name, year),
    });
  }

  return {
    path,
    scope,
    metadata,
    items,
    parseError: issues.length ? issues.join("; ") : null,
  };
}

type WatchEventAccumulator = {
  id: string;
  diaryEntryUri: string | null;
  reviewEntryUri: string | null;
  loggedAt: string | null;
  exactWatchedDate: string | null;
  diaryRating: number | null;
  reviewRating: number | null;
  reviewText: string | null;
  rewatch: boolean;
  tags: Set<string>;
  fromDiary: boolean;
  fromReview: boolean;
};

type FilmAccumulator = {
  filmKey: FilmKey;
  name: string;
  year: number | null;
  filmUri: string | null;
  diaryEntryUris: Set<string>;
  reviewEntryUris: Set<string>;
  inWatched: boolean;
  inRatings: boolean;
  inDiary: boolean;
  inReviews: boolean;
  inWatchlist: boolean;
  watchedRows: number;
  ratingRows: number;
  diaryRows: number;
  reviewRows: number;
  watchlistRows: number;
  watchedImportDates: string[];
  watchlistAddedDates: string[];
  ratingSnapshots: Array<{ date: string | null; rating: number | null }>;
  watchEventMap: Map<string, WatchEventAccumulator>;
  reviewTexts: string[];
  tags: Set<string>;
  provenance: Array<{ table: ActiveFilmTable; rowIndex: number; path: string }>;
};

export async function readLetterboxdExportZip(input: Blob | ArrayBuffer): Promise<ExportTables> {
  const zip = await JSZip.loadAsync(input);
  const files = Object.keys(zip.files)
    .filter((filename) => filename.toLowerCase().endsWith(".csv"))
    .sort((left, right) => left.localeCompare(right));

  const tables: ExportTables = {
    files,
    recognizedFiles: [],
    unknownFiles: [],
    parseIssues: [],
    detectedCsv: [],
    watched: [],
    ratings: [],
    diary: [],
    reviews: [],
    watchlist: [],
    profile: [],
    comments: [],
    deleted: createArchivedTables(),
    orphaned: createArchivedTables(),
    likes: createLikeTables(),
    lists: [],
    unknown: {},
  };

  for (const path of files) {
    const entry = zip.file(path);
    if (!entry) {
      continue;
    }

    const text = await entry.async("string");
    const exportedDate =
      entry.date && !Number.isNaN(entry.date.getTime()) ? entry.date.toISOString().slice(0, 10) : null;
    const classification = classifyCsvPath(path);

    if (classification.kind === "list") {
      const parsed = parseLetterboxdListCsv(text, path, classification.scope, exportedDate);
      tables.recognizedFiles.push(path);
      if (parsed.parseError) {
        tables.parseIssues.push({ path, message: parsed.parseError });
      }
      if (classification.scope === "active") {
        tables.lists.push(parsed);
      } else {
        tables[classification.scope].lists.push(parsed);
      }
      continue;
    }

    const parsed = parseCSV(text);
    for (const issue of parsed.issues) {
      tables.parseIssues.push({ path, message: issue });
    }

    if (classification.kind === "unknown") {
      tables.unknown[path] = parsed.rows;
      tables.unknownFiles.push(path);
      continue;
    }

    tables.recognizedFiles.push(path);
    if (classification.kind === "active") {
      if (!tables.detectedCsv.includes(classification.table)) {
        tables.detectedCsv.push(classification.table);
      }
      tables[classification.table] = parsed.rows;
      continue;
    }

    if (classification.kind === "archive") {
      tables[classification.scope][classification.table] = parsed.rows;
      continue;
    }

    tables.likes[classification.table] = parsed.rows;
  }

  tables.recognizedFiles.sort((left, right) => left.localeCompare(right));
  tables.unknownFiles.sort((left, right) => left.localeCompare(right));

  return tables;
}

function ensureFilmRecord(map: Map<FilmKey, FilmAccumulator>, row: RawRow): FilmAccumulator | null {
  const filmKey = filmKeyFromRow(row);
  if (!filmKey) {
    return null;
  }

  const existing = map.get(filmKey);
  if (existing) {
    const candidateName = getField(row, TITLE_FIELDS);
    if (!existing.name && candidateName) {
      existing.name = candidateName;
    }
    if (existing.year === null) {
      existing.year = normaliseFilmYear(getField(row, YEAR_FIELDS));
    }
    return existing;
  }

  const created: FilmAccumulator = {
    filmKey,
    name: getField(row, TITLE_FIELDS) || "Unknown",
    year: normaliseFilmYear(getField(row, YEAR_FIELDS)),
    filmUri: null,
    diaryEntryUris: new Set<string>(),
    reviewEntryUris: new Set<string>(),
    inWatched: false,
    inRatings: false,
    inDiary: false,
    inReviews: false,
    inWatchlist: false,
    watchedRows: 0,
    ratingRows: 0,
    diaryRows: 0,
    reviewRows: 0,
    watchlistRows: 0,
    watchedImportDates: [],
    watchlistAddedDates: [],
    ratingSnapshots: [],
    watchEventMap: new Map<string, WatchEventAccumulator>(),
    reviewTexts: [],
    tags: new Set<string>(),
    provenance: [],
  };
  map.set(filmKey, created);
  return created;
}

function makeWatchEventId(
  filmKey: FilmKey,
  entryUri: string | null,
  exactWatchedDate: string | null,
  loggedAt: string | null,
  rating: number | null,
  rewatch: boolean,
): string {
  if (entryUri) {
    return entryUri;
  }
  return [
    filmKey,
    exactWatchedDate || "",
    loggedAt || "",
    rating === null ? "" : String(rating),
    rewatch ? "rewatch" : "fresh",
  ].join("::");
}

function getOrCreateWatchEvent(
  record: FilmAccumulator,
  filmKey: FilmKey,
  entryUri: string | null,
  exactWatchedDate: string | null,
  loggedAt: string | null,
  rating: number | null,
  rewatch: boolean,
): WatchEventAccumulator {
  const id = makeWatchEventId(filmKey, entryUri, exactWatchedDate, loggedAt, rating, rewatch);
  const existing = record.watchEventMap.get(id);
  if (existing) {
    return existing;
  }
  const created: WatchEventAccumulator = {
    id,
    diaryEntryUri: null,
    reviewEntryUri: null,
    loggedAt,
    exactWatchedDate,
    diaryRating: null,
    reviewRating: null,
    reviewText: null,
    rewatch,
    tags: new Set<string>(),
    fromDiary: false,
    fromReview: false,
  };
  record.watchEventMap.set(id, created);
  return created;
}

function finaliseWatchEvent(event: WatchEventAccumulator): WatchEvent {
  const source = event.fromDiary && event.fromReview
    ? "diary+review"
    : event.fromReview
      ? "review"
      : "diary";

  return {
    id: event.id,
    source,
    diaryEntryUri: event.diaryEntryUri,
    reviewEntryUri: event.reviewEntryUri,
    loggedAt: event.loggedAt,
    exactWatchedDate: event.exactWatchedDate,
    estimatedWatchedDate: null,
    bestWatchedDate: event.exactWatchedDate,
    watchedDateIsExact: event.exactWatchedDate !== null,
    loggedRating: event.reviewRating ?? event.diaryRating,
    reviewText: event.reviewText,
    rewatch: event.rewatch,
    tags: [...event.tags].sort((left, right) => left.localeCompare(right)),
  };
}

function isWatchedFilmRecord(record: FilmRecord): boolean {
  return record.inWatched || record.inDiary || record.inReviews || record.inRatings;
}

export function isWatchedFilm(record: FilmRecord): boolean {
  return isWatchedFilmRecord(record);
}

export function getBestTimelineDates(record: FilmRecord): { exact: string[]; estimated: string[]; best: string[] } {
  const exact = sortIsoDates(
    record.watchEvents
      .map((event) => event.exactWatchedDate)
      .filter((date): date is string => Boolean(date)),
  );
  const estimated = exact.length === 0 ? sortIsoDates(record.watchedImportDates) : [];
  return {
    exact,
    estimated,
    best: sortIsoDates([...exact, ...estimated]),
  };
}

function pickLatestRating(
  ratings: Array<{ date: string | null; rating: number | null }>,
): number | null {
  const valid = ratings.filter((rating) => rating.rating !== null);
  if (!valid.length) {
    return null;
  }
  valid.sort((left, right) => compareIsoAsc(left.date, right.date));
  return valid[valid.length - 1].rating;
}

function sortEventsChronologically(events: WatchEvent[]): WatchEvent[] {
  return [...events].sort((left, right) => {
    const byWatched = compareIsoAsc(left.bestWatchedDate, right.bestWatchedDate);
    if (byWatched !== 0) {
      return byWatched;
    }
    const byLogged = compareIsoAsc(left.loggedAt, right.loggedAt);
    if (byLogged !== 0) {
      return byLogged;
    }
    return left.id.localeCompare(right.id);
  });
}

function collectLatestEventValue<T>(
  events: WatchEvent[],
  selector: (event: WatchEvent) => T | null,
): T | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const value = selector(events[index]);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

function countUniqueFilmKeys(rows: RawRow[]): number {
  const keys = new Set<FilmKey>();
  for (const row of rows) {
    const key = filmKeyFromRow(row);
    if (key) {
      keys.add(key);
    }
  }
  return keys.size;
}

function addFileSummary(
  summaries: DatasetTableSummary[],
  path: string,
  scope: DatasetTableSummary["scope"],
  parser: DatasetTableSummary["parser"],
  rowCount: number,
  uniqueFilmCount: number | null,
): void {
  summaries.push({ path, scope, parser, rowCount, uniqueFilmCount });
}

function collectTableSummaries(tables: ExportTables): DatasetTableSummary[] {
  const summaries: DatasetTableSummary[] = [];

  addFileSummary(summaries, "profile.csv", "active", "csv", tables.profile.length, null);
  addFileSummary(summaries, "watched.csv", "active", "csv", tables.watched.length, countUniqueFilmKeys(tables.watched));
  addFileSummary(summaries, "ratings.csv", "active", "csv", tables.ratings.length, countUniqueFilmKeys(tables.ratings));
  addFileSummary(summaries, "diary.csv", "active", "csv", tables.diary.length, countUniqueFilmKeys(tables.diary));
  addFileSummary(summaries, "reviews.csv", "active", "csv", tables.reviews.length, countUniqueFilmKeys(tables.reviews));
  addFileSummary(summaries, "watchlist.csv", "active", "csv", tables.watchlist.length, countUniqueFilmKeys(tables.watchlist));
  addFileSummary(summaries, "comments.csv", "active", "csv", tables.comments.length, null);

  for (const list of tables.lists) {
    addFileSummary(
      summaries,
      list.path,
      "active",
      "list",
      list.items.length,
      new Set(list.items.map((item) => item.filmKey).filter(Boolean)).size,
    );
  }

  for (const scope of ["deleted", "orphaned"] as const) {
    addFileSummary(
      summaries,
      `${scope}/diary.csv`,
      scope,
      "csv",
      tables[scope].diary.length,
      countUniqueFilmKeys(tables[scope].diary),
    );
    addFileSummary(
      summaries,
      `${scope}/reviews.csv`,
      scope,
      "csv",
      tables[scope].reviews.length,
      countUniqueFilmKeys(tables[scope].reviews),
    );
    addFileSummary(
      summaries,
      `${scope}/comments.csv`,
      scope,
      "csv",
      tables[scope].comments.length,
      null,
    );
    for (const list of tables[scope].lists) {
      addFileSummary(
        summaries,
        list.path,
        scope,
        "list",
        list.items.length,
        new Set(list.items.map((item) => item.filmKey).filter(Boolean)).size,
      );
    }
  }

  addFileSummary(
    summaries,
    "likes/films.csv",
    "likes",
    "csv",
    tables.likes.films.length,
    countUniqueFilmKeys(tables.likes.films),
  );
  addFileSummary(summaries, "likes/reviews.csv", "likes", "csv", tables.likes.reviews.length, null);
  addFileSummary(summaries, "likes/lists.csv", "likes", "csv", tables.likes.lists.length, null);

  for (const [path, rows] of Object.entries(tables.unknown)) {
    addFileSummary(summaries, path, "unknown", "csv", rows.length, null);
  }

  return summaries.filter((summary) => {
    if (summary.scope === "unknown") {
      return true;
    }
    return tables.files.includes(summary.path);
  });
}

function collectArchiveUniqueFilmCount(tables: ArchivedTables): number {
  const keys = new Set<FilmKey>();
  for (const row of tables.diary) {
    const key = filmKeyFromRow(row);
    if (key) keys.add(key);
  }
  for (const row of tables.reviews) {
    const key = filmKeyFromRow(row);
    if (key) keys.add(key);
  }
  for (const list of tables.lists) {
    for (const item of list.items) {
      if (item.filmKey) {
        keys.add(item.filmKey);
      }
    }
  }
  return keys.size;
}

function deterministicSamples(films: FilmRecord[]): DatasetSummary["samples"] {
  return [...films]
    .sort((left, right) => {
      const leftScore =
        left.sourceFlags.tables.length * 10 + left.watchEvents.length * 2 + left.reviewRows + left.watchlistRows;
      const rightScore =
        right.sourceFlags.tables.length * 10 + right.watchEvents.length * 2 + right.reviewRows + right.watchlistRows;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      return left.filmKey.localeCompare(right.filmKey);
    })
    .slice(0, 8)
    .map((film) => ({
      filmKey: film.filmKey,
      name: film.name,
      tables: film.sourceFlags.tables,
      filmUri: film.filmUri,
      diaryEntryCount: film.diaryEntryUris.length,
      reviewEntryCount: film.reviewEntryUris.length,
      exactWatchedDate: film.exactWatchedDate,
      estimatedWatchedDate: film.estimatedWatchedDate,
      currentRating: film.currentRating,
      loggedRating: film.loggedRating,
      inWatchlist: film.inWatchlist,
    }));
}

export function mergeTablesToFilms(tables: ExportTables): MergeResult {
  const filmMap = new Map<FilmKey, FilmAccumulator>();

  for (let index = 0; index < tables.watched.length; index += 1) {
    const row = tables.watched[index];
    const record = ensureFilmRecord(filmMap, row);
    if (!record) continue;

    record.inWatched = true;
    record.watchedRows += 1;
    record.provenance.push({ table: "watched", rowIndex: index, path: "watched.csv" });

    const filmUri = normaliseUri(getField(row, FILM_URI_FIELDS));
    if (!record.filmUri && filmUri) {
      record.filmUri = filmUri;
    }

    const importDate = toISODateOnly(getField(row, ["Date", "Watched Date"]));
    if (importDate) {
      record.watchedImportDates.push(importDate);
    }
  }

  for (let index = 0; index < tables.ratings.length; index += 1) {
    const row = tables.ratings[index];
    const record = ensureFilmRecord(filmMap, row);
    if (!record) continue;

    record.inRatings = true;
    record.ratingRows += 1;
    record.provenance.push({ table: "ratings", rowIndex: index, path: "ratings.csv" });

    const filmUri = normaliseUri(getField(row, FILM_URI_FIELDS));
    if (!record.filmUri && filmUri) {
      record.filmUri = filmUri;
    }

    record.ratingSnapshots.push({
      date: toISODateOnly(getField(row, ["Date", "Rated Date"])),
      rating: safeNum(getField(row, ["Rating", "Rated", "Stars"])),
    });
  }

  for (let index = 0; index < tables.watchlist.length; index += 1) {
    const row = tables.watchlist[index];
    const record = ensureFilmRecord(filmMap, row);
    if (!record) continue;

    record.inWatchlist = true;
    record.watchlistRows += 1;
    record.provenance.push({ table: "watchlist", rowIndex: index, path: "watchlist.csv" });

    const filmUri = normaliseUri(getField(row, FILM_URI_FIELDS));
    if (!record.filmUri && filmUri) {
      record.filmUri = filmUri;
    }

    const addedDate = toISODateOnly(getField(row, ["Date"]));
    if (addedDate) {
      record.watchlistAddedDates.push(addedDate);
    }
  }

  for (let index = 0; index < tables.diary.length; index += 1) {
    const row = tables.diary[index];
    const record = ensureFilmRecord(filmMap, row);
    if (!record) continue;

    record.inDiary = true;
    record.diaryRows += 1;
    record.provenance.push({ table: "diary", rowIndex: index, path: "diary.csv" });

    const entryUri = normaliseUri(getField(row, FILM_URI_FIELDS));
    const exactWatchedDate = toISODateOnly(getField(row, ["Watched Date"]));
    const loggedAt = toISODateOnly(getField(row, ["Date", "Logged Date"]));
    const rating = safeNum(getField(row, ["Rating", "Rated", "Stars"]));
    const rewatchRaw = (getField(row, ["Rewatch"]) || "").trim().toLowerCase();
    const rewatch = rewatchRaw === "yes" || rewatchRaw === "true" || rewatchRaw === "1";
    const tags = parseTagList(getField(row, ["Tags"]));

    if (entryUri) {
      record.diaryEntryUris.add(entryUri);
    }
    for (const tag of tags) {
      record.tags.add(tag);
    }

    const event = getOrCreateWatchEvent(
      record,
      record.filmKey,
      entryUri,
      exactWatchedDate,
      loggedAt,
      rating,
      rewatch,
    );
    event.diaryEntryUri ||= entryUri;
    event.loggedAt = pickLaterIso(event.loggedAt, loggedAt);
    event.exactWatchedDate = pickLaterIso(event.exactWatchedDate, exactWatchedDate);
    event.diaryRating = rating ?? event.diaryRating;
    event.rewatch = event.rewatch || rewatch;
    event.fromDiary = true;
    for (const tag of tags) {
      event.tags.add(tag);
    }
  }

  for (let index = 0; index < tables.reviews.length; index += 1) {
    const row = tables.reviews[index];
    const record = ensureFilmRecord(filmMap, row);
    if (!record) continue;

    record.inReviews = true;
    record.reviewRows += 1;
    record.provenance.push({ table: "reviews", rowIndex: index, path: "reviews.csv" });

    const entryUri = normaliseUri(getField(row, FILM_URI_FIELDS));
    const exactWatchedDate = toISODateOnly(getField(row, ["Watched Date"]));
    const loggedAt = toISODateOnly(getField(row, ["Date", "Logged Date"]));
    const rating = safeNum(getField(row, ["Rating", "Rated", "Stars"]));
    const rewatchRaw = (getField(row, ["Rewatch"]) || "").trim().toLowerCase();
    const rewatch = rewatchRaw === "yes" || rewatchRaw === "true" || rewatchRaw === "1";
    const tags = parseTagList(getField(row, ["Tags"]));
    const reviewText = (getField(row, ["Review", "Text", "Comment"]) || "").trim() || null;

    if (entryUri) {
      record.reviewEntryUris.add(entryUri);
    }
    if (reviewText) {
      record.reviewTexts.push(reviewText);
    }
    for (const tag of tags) {
      record.tags.add(tag);
    }

    const event = getOrCreateWatchEvent(
      record,
      record.filmKey,
      entryUri,
      exactWatchedDate,
      loggedAt,
      rating,
      rewatch,
    );
    event.reviewEntryUri ||= entryUri;
    event.loggedAt = pickLaterIso(event.loggedAt, loggedAt);
    event.exactWatchedDate = pickLaterIso(event.exactWatchedDate, exactWatchedDate);
    event.reviewRating = rating ?? event.reviewRating;
    event.reviewText ||= reviewText;
    event.rewatch = event.rewatch || rewatch;
    event.fromReview = true;
    for (const tag of tags) {
      event.tags.add(tag);
    }
  }

  const films = [...filmMap.values()]
    .map<FilmRecord>((record) => {
      const watchEvents = sortEventsChronologically(
        [...record.watchEventMap.values()].map(finaliseWatchEvent),
      );
      const exactDates = watchEvents
        .map((event) => event.exactWatchedDate)
        .filter((date): date is string => Boolean(date));
      const loggedRating = collectLatestEventValue(watchEvents, (event) => event.loggedRating);
      const currentRating = pickLatestRating(record.ratingSnapshots);
      const exactWatchedDate = exactDates.length ? exactDates[exactDates.length - 1] : null;
      const estimatedDates = sortIsoDates(record.watchedImportDates);
      const estimatedWatchedDate = estimatedDates.length ? estimatedDates[estimatedDates.length - 1] : null;

      return {
        filmKey: record.filmKey,
        name: record.name,
        year: record.year,
        filmUri: record.filmUri,
        diaryEntryUris: [...record.diaryEntryUris].sort((left, right) => left.localeCompare(right)),
        reviewEntryUris: [...record.reviewEntryUris].sort((left, right) => left.localeCompare(right)),
        inWatched: record.inWatched,
        inRatings: record.inRatings,
        inDiary: record.inDiary,
        inReviews: record.inReviews,
        inWatchlist: record.inWatchlist,
        watchedRows: record.watchedRows,
        ratingRows: record.ratingRows,
        diaryRows: record.diaryRows,
        reviewRows: record.reviewRows,
        watchlistRows: record.watchlistRows,
        watchedImportDates: estimatedDates,
        watchlistAddedDates: sortIsoDates(record.watchlistAddedDates),
        watchEvents,
        currentRating,
        loggedRating,
        bestRating: currentRating ?? loggedRating,
        exactWatchedDate,
        estimatedWatchedDate,
        bestWatchedDate: exactWatchedDate ?? estimatedWatchedDate,
        watchedDateIsExact: exactWatchedDate !== null,
        reviewTexts: record.reviewTexts,
        tags: [...record.tags].sort((left, right) => left.localeCompare(right)),
        rewatchCount: watchEvents.filter((event) => event.rewatch).length,
        sourceFlags: {
          tables: (["watched", "ratings", "diary", "reviews", "watchlist"] as const).filter(
            (table) =>
              (table === "watched" && record.inWatched)
              || (table === "ratings" && record.inRatings)
              || (table === "diary" && record.inDiary)
              || (table === "reviews" && record.inReviews)
              || (table === "watchlist" && record.inWatchlist),
          ),
          provenance: record.provenance,
        },
      };
    })
    .sort((left, right) => left.filmKey.localeCompare(right.filmKey));

  const fileSummaries = collectTableSummaries(tables);
  const watchedUniverseFilms = films.filter(isWatchedFilmRecord);
  const filmsWithExactDate = watchedUniverseFilms.filter((film) => film.exactWatchedDate !== null).length;
  const filmsWithEstimatedOnly = watchedUniverseFilms.filter(
    (film) => film.exactWatchedDate === null && film.estimatedWatchedDate !== null,
  ).length;
  const exactWatchEvents = films.reduce(
    (count, film) => count + film.watchEvents.filter((event) => event.exactWatchedDate !== null).length,
    0,
  );
  const loggedEntriesWithoutExactDate = films.reduce(
    (count, film) => count + film.watchEvents.filter((event) => event.exactWatchedDate === null).length,
    0,
  );
  const estimatedWatchRows = films.reduce((count, film) => count + film.watchedImportDates.length, 0);
  const estimatedFallbackRows = films.reduce((count, film) => count + getBestTimelineDates(film).estimated.length, 0);

  const importDayCounts = new Map<string, number>();
  for (const row of tables.watched) {
    const date = toISODateOnly(getField(row, ["Date"]));
    if (date) {
      importDayCounts.set(date, (importDayCounts.get(date) || 0) + 1);
    }
  }
  const topImportDays = [...importDayCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([date, count]) => ({ date, count }));
  const largestImportDay = topImportDays[0] || null;
  const largestSingleDayImportCount = largestImportDay?.count || 0;
  const largestSingleDayImportDate = largestImportDay?.date || null;
  const importSpikeDetected =
    largestSingleDayImportCount >= Math.max(40, Math.round(tables.watched.length * 0.35));

  const bothRatings = films.filter((film) => film.currentRating !== null && film.loggedRating !== null);
  const changedRatings = bothRatings.filter(
    (film) => Math.abs((film.currentRating || 0) - (film.loggedRating || 0)) > 1e-9,
  );

  const summary: DatasetSummary = {
    recognizedFiles: tables.recognizedFiles,
    unknownFiles: tables.unknownFiles.map((path) => ({
      path,
      rowCount: tables.unknown[path]?.length || 0,
    })),
    parseIssues: tables.parseIssues,
    tableRowCounts: Object.fromEntries(fileSummaries.map((item) => [item.path, item.rowCount])),
    tableUniqueFilmCounts: Object.fromEntries(fileSummaries.map((item) => [item.path, item.uniqueFilmCount])),
    fileSummaries,
    coverageSummary: {
      activeFilmCount: films.length,
      watchedUniverseFilmCount: watchedUniverseFilms.length,
      watchedFilmCount: films.filter((film) => film.inWatched).length,
      ratingFilmCount: films.filter((film) => film.inRatings).length,
      diaryFilmCount: films.filter((film) => film.inDiary).length,
      reviewFilmCount: films.filter((film) => film.inReviews).length,
      watchlistFilmCount: films.filter((film) => film.inWatchlist).length,
    },
    overlapSummary: {
      watchedAndRatings: films.filter((film) => film.inWatched && film.inRatings).length,
      watchedAndDiary: films.filter((film) => film.inWatched && film.inDiary).length,
      watchedAndReviews: films.filter((film) => film.inWatched && film.inReviews).length,
      diaryAndReviews: films.filter((film) => film.inDiary && film.inReviews).length,
      watchlistAndWatchedUniverse: films.filter((film) => film.inWatchlist && isWatchedFilmRecord(film)).length,
      watchedOnly: films.filter((film) => film.inWatched && !film.inRatings && !film.inDiary && !film.inReviews).length,
      ratingsOnly: films.filter((film) => film.inRatings && !film.inWatched && !film.inDiary && !film.inReviews).length,
      diaryOnly: films.filter((film) => film.inDiary && !film.inWatched && !film.inRatings && !film.inReviews).length,
      reviewsOnly: films.filter((film) => film.inReviews && !film.inWatched && !film.inRatings && !film.inDiary).length,
      watchlistOnly: films.filter((film) => film.inWatchlist && !isWatchedFilmRecord(film)).length,
    },
    dateQualitySummary: {
      filmsWithExactDate,
      filmsWithEstimatedOnly,
      filmsWithNoWatchedDate: watchedUniverseFilms.length - filmsWithExactDate - filmsWithEstimatedOnly,
      exactWatchEvents,
      loggedEntriesWithoutExactDate,
      estimatedWatchRows,
      estimatedFallbackRows,
      exactCoverage: watchedUniverseFilms.length ? filmsWithExactDate / watchedUniverseFilms.length : 0,
    },
    ratingSourceSummary: {
      filmsWithCurrentRating: films.filter((film) => film.currentRating !== null).length,
      filmsWithLoggedRating: films.filter((film) => film.loggedRating !== null).length,
      both: bothRatings.length,
      currentOnly: films.filter((film) => film.currentRating !== null && film.loggedRating === null).length,
      loggedOnly: films.filter((film) => film.currentRating === null && film.loggedRating !== null).length,
      changed: changedRatings.length,
      unchanged: bothRatings.length - changedRatings.length,
      upgraded: bothRatings.filter((film) => (film.currentRating || 0) > (film.loggedRating || 0)).length,
      downgraded: bothRatings.filter((film) => (film.currentRating || 0) < (film.loggedRating || 0)).length,
    },
    importSpikeSummary: {
      topDays: topImportDays,
      largestSingleDayImportCount,
      largestSingleDayImportDate,
      importSpikeDetected,
    },
    listSummary: {
      activeListCount: tables.lists.length,
      archivedListCount: tables.deleted.lists.length + tables.orphaned.lists.length,
      activeListItemCount: tables.lists.reduce((count, list) => count + list.items.length, 0),
      archivedListItemCount:
        [...tables.deleted.lists, ...tables.orphaned.lists].reduce((count, list) => count + list.items.length, 0),
      lists: [...tables.lists, ...tables.deleted.lists, ...tables.orphaned.lists].map((list) => ({
        path: list.path,
        scope: list.scope,
        title: list.metadata.title,
        itemCount: list.items.length,
        createdDate: list.metadata.createdDate,
        exportedDate: list.metadata.exportedDate,
        tags: list.metadata.tags,
        parseError: list.parseError,
      })),
    },
    archiveSummary: {
      deleted: {
        diaryRows: tables.deleted.diary.length,
        reviewRows: tables.deleted.reviews.length,
        commentRows: tables.deleted.comments.length,
        listFiles: tables.deleted.lists.length,
        uniqueFilmCount: collectArchiveUniqueFilmCount(tables.deleted),
      },
      orphaned: {
        diaryRows: tables.orphaned.diary.length,
        reviewRows: tables.orphaned.reviews.length,
        commentRows: tables.orphaned.comments.length,
        listFiles: tables.orphaned.lists.length,
        uniqueFilmCount: collectArchiveUniqueFilmCount(tables.orphaned),
      },
      likes: {
        filmRows: tables.likes.films.length,
        filmUniqueCount: countUniqueFilmKeys(tables.likes.films),
        reviewRows: tables.likes.reviews.length,
        listRows: tables.likes.lists.length,
      },
    },
    samples: deterministicSamples(films),
  };

  return {
    films,
    anomaly: {
      importSpikeDetected,
      largestSingleDayImportCount,
      largestSingleDayImportDate,
      exactWatchedCoverage: summary.dateQualitySummary.exactCoverage,
      estimatedOnlyFilms: summary.dateQualitySummary.filmsWithEstimatedOnly,
      currentOnlyRatingFilms: summary.ratingSourceSummary.currentOnly,
      loggedOnlyRatingFilms: summary.ratingSourceSummary.loggedOnly,
    },
    summary,
  };
}
