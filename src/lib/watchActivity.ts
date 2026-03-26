import { FilmRecord, isWatchedFilm } from "./letterboxd";

export type ExactWatchEventRow = {
  kind: "watchEvent";
  id: string;
  filmKey: string;
  title: string;
  year: number | null;
  filmUrl: string | null;
  exactWatchedDate: string;
  currentRating: number | null;
  loggedRating: number | null;
  reviewPresent: boolean;
  inWatchlist: boolean;
  source: "diary" | "review" | "diary+review";
  rewatch: boolean;
};

export type ExactWatchBucket = {
  label: string;
  count: number;
  uniqueFilms: number;
};

export type ExactWatchGap = {
  id: string;
  startDate: string;
  endDate: string;
  gapDays: number;
};

export type ExactWatchStreak = {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  exactWatchEvents: number;
  uniqueFilms: number;
};

export type ExactWatchActivity = {
  rows: ExactWatchEventRow[];
  exactWatchEvents: number;
  exactDatedWatchedFilms: number;
  heatmapByMonth: Array<{ month: string; count: number }>;
  byMonth: Array<{ month: string; count: number }>;
  byDay: Array<{ day: string; count: number }>;
  byYear: Array<{ year: string; count: number }>;
  busiestMonths: ExactWatchBucket[];
  busiestYears: ExactWatchBucket[];
  busiestDays: ExactWatchBucket[];
  busiestDay: ExactWatchBucket | null;
  longestGaps: ExactWatchGap[];
  bestStreak: ExactWatchStreak | null;
};

function dateToEpochDay(iso: string): number {
  const date = new Date(`${iso}T00:00:00Z`);
  return Math.floor(date.getTime() / 86400000);
}

function sortDateDesc(left: string, right: string): number {
  return right.localeCompare(left);
}

function countBy<T extends string>(
  values: string[],
  project: (value: string) => T,
  limit?: number,
): Array<{ key: T; count: number }> {
  const map = new Map<T, number>();
  for (const value of values) {
    const key = project(value);
    map.set(key, (map.get(key) || 0) + 1);
  }
  const rows = [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || String(left.key).localeCompare(String(right.key)));
  return limit ? rows.slice(0, limit) : rows;
}

function buildBuckets(
  rows: ExactWatchEventRow[],
  project: (row: ExactWatchEventRow) => string,
  limit: number,
): ExactWatchBucket[] {
  const map = new Map<string, { count: number; films: Set<string> }>();
  for (const row of rows) {
    const key = project(row);
    const entry = map.get(key) || { count: 0, films: new Set<string>() };
    entry.count += 1;
    entry.films.add(row.filmKey);
    map.set(key, entry);
  }
  return [...map.entries()]
    .map(([label, entry]) => ({
      label,
      count: entry.count,
      uniqueFilms: entry.films.size,
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, limit);
}

function buildLongestGaps(days: string[]): ExactWatchGap[] {
  const uniqueDays = Array.from(new Set(days)).sort((left, right) => left.localeCompare(right));
  const gaps: ExactWatchGap[] = [];
  for (let index = 1; index < uniqueDays.length; index += 1) {
    const previousDay = uniqueDays[index - 1];
    const nextDay = uniqueDays[index];
    const gapDays = dateToEpochDay(nextDay) - dateToEpochDay(previousDay) - 1;
    if (gapDays <= 0) {
      continue;
    }
    gaps.push({
      id: `${previousDay}:${nextDay}`,
      startDate: previousDay,
      endDate: nextDay,
      gapDays,
    });
  }
  return gaps
    .sort((left, right) => right.gapDays - left.gapDays || left.startDate.localeCompare(right.startDate))
    .slice(0, 8);
}

function buildBestStreak(rows: ExactWatchEventRow[]): ExactWatchStreak | null {
  const uniqueDays = Array.from(new Set(rows.map((row) => row.exactWatchedDate))).sort((left, right) => left.localeCompare(right));
  if (!uniqueDays.length) {
    return null;
  }

  let bestStart = uniqueDays[0];
  let bestEnd = uniqueDays[0];
  let bestDays = 1;
  let currentStart = uniqueDays[0];
  let currentDays = 1;

  for (let index = 1; index < uniqueDays.length; index += 1) {
    const previous = uniqueDays[index - 1];
    const current = uniqueDays[index];
    if (dateToEpochDay(current) === dateToEpochDay(previous) + 1) {
      currentDays += 1;
    } else {
      currentStart = current;
      currentDays = 1;
    }
    const shouldPromote =
      currentDays > bestDays
      || (
        currentDays === bestDays
        && (current.localeCompare(bestEnd) > 0 || currentStart.localeCompare(bestStart) < 0)
      );
    if (shouldPromote) {
      bestStart = currentStart;
      bestEnd = current;
      bestDays = currentDays;
    }
  }

  const streakRows = rows.filter((row) => row.exactWatchedDate >= bestStart && row.exactWatchedDate <= bestEnd);
  return {
    id: `${bestStart}:${bestEnd}`,
    startDate: bestStart,
    endDate: bestEnd,
    days: bestDays,
    exactWatchEvents: streakRows.length,
    uniqueFilms: new Set(streakRows.map((row) => row.filmKey)).size,
  };
}

export function buildExactWatchEventRows(films: FilmRecord[]): ExactWatchEventRow[] {
  const rows: ExactWatchEventRow[] = [];
  for (const film of films) {
    if (!isWatchedFilm(film)) {
      continue;
    }
    for (const event of film.watchEvents) {
      if (!event.exactWatchedDate) {
        continue;
      }
      rows.push({
        kind: "watchEvent",
        id: event.id,
        filmKey: film.filmKey,
        title: film.name,
        year: film.year,
        filmUrl: film.filmUri,
        exactWatchedDate: event.exactWatchedDate,
        currentRating: film.currentRating,
        loggedRating: event.loggedRating,
        reviewPresent: event.source === "review" || event.source === "diary+review",
        inWatchlist: film.inWatchlist,
        source: event.source,
        rewatch: event.rewatch,
      });
    }
  }
  return rows.sort((left, right) =>
    sortDateDesc(left.exactWatchedDate, right.exactWatchedDate)
    || left.title.localeCompare(right.title)
    || left.id.localeCompare(right.id));
}

export function buildExactWatchActivity(films: FilmRecord[]): ExactWatchActivity {
  const rows = buildExactWatchEventRows(films);
  const exactDates = rows.map((row) => row.exactWatchedDate);
  const byMonth = countBy(exactDates, (value) => value.slice(0, 7))
    .map((entry) => ({ month: entry.key, count: entry.count }))
    .sort((left, right) => left.month.localeCompare(right.month));
  const byDay = countBy(exactDates, (value) => value)
    .map((entry) => ({ day: entry.key, count: entry.count }))
    .sort((left, right) => left.day.localeCompare(right.day));
  const byYear = countBy(exactDates, (value) => value.slice(0, 4))
    .map((entry) => ({ year: entry.key, count: entry.count }))
    .sort((left, right) => left.year.localeCompare(right.year));
  const busiestMonths = buildBuckets(rows, (row) => row.exactWatchedDate.slice(0, 7), 8);
  const busiestYears = buildBuckets(rows, (row) => row.exactWatchedDate.slice(0, 4), 8);
  const busiestDays = buildBuckets(rows, (row) => row.exactWatchedDate, 8);

  return {
    rows,
    exactWatchEvents: rows.length,
    exactDatedWatchedFilms: new Set(rows.map((row) => row.filmKey)).size,
    heatmapByMonth: byMonth,
    byMonth,
    byDay,
    byYear,
    busiestMonths,
    busiestYears,
    busiestDays,
    busiestDay: busiestDays[0] || null,
    longestGaps: buildLongestGaps(exactDates),
    bestStreak: buildBestStreak(rows),
  };
}

export function filterExactWatchRowsByMonth(rows: ExactWatchEventRow[], month: string): ExactWatchEventRow[] {
  return rows.filter((row) => row.exactWatchedDate.slice(0, 7) === month);
}

export function filterExactWatchRowsByYear(rows: ExactWatchEventRow[], year: string): ExactWatchEventRow[] {
  return rows.filter((row) => row.exactWatchedDate.slice(0, 4) === year);
}

export function filterExactWatchRowsByDay(rows: ExactWatchEventRow[], day: string): ExactWatchEventRow[] {
  return rows.filter((row) => row.exactWatchedDate === day);
}

export function filterExactWatchRowsByRange(
  rows: ExactWatchEventRow[],
  startDate: string,
  endDate: string,
): ExactWatchEventRow[] {
  return rows.filter((row) => row.exactWatchedDate >= startDate && row.exactWatchedDate <= endDate);
}
