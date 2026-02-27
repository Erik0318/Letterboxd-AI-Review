import { FilmRecord } from "./letterboxd";
import { clamp, formatInt, formatPct, mean, median, monthKey, round1, stddev } from "./utils";

export type Anomaly = {
  importSpikeDetected: boolean;
  largestSingleDayImportCount: number;
  percentWithWatchedAt: number;
  watchedDateSpanYears: number;
  diaryEntrySpanYears: number;
  importSpikeDay: string | null;
};

export type StatPack = {
  generatedAt: string;
  totals: { filmsWatched: number; filmsRated: number; unratedWatched: number; rewatchFilms: number; ratingMean: number | null };
  cards: Array<{ label: string; value: string; calc: string }>;
  radar: Array<{ axis: string; value: number }>;
  trends: {
    monthlyCount: Array<{ month: string; count: number }>;
    monthlyAvgRating: Array<{ month: string; avgRating: number | null }>;
  };
  heatmap: Array<{ month: string; count: number }>;
  anomaly: Anomaly;
  shareText: { short: string; long: string };
};

function spanYears(dates: string[]): number {
  if (!dates.length) return 0;
  const s = dates.slice().sort();
  const a = new Date(`${s[0]}T00:00:00Z`).getTime();
  const b = new Date(`${s[s.length - 1]}T00:00:00Z`).getTime();
  return Math.max(0, (b - a) / (365 * 86400000));
}

function computeAnomaly(films: FilmRecord[]): Anomaly {
  const imported = new Map<string, number>();
  const watched = films.map((f) => f.watched_at).filter(Boolean) as string[];
  const diary = films.flatMap((f) => f.diary_entries.map((d) => d.watched_at || d.logged_at)).filter(Boolean) as string[];
  for (const f of films) {
    const k = f.imported_at || "unknown";
    imported.set(k, (imported.get(k) || 0) + 1);
  }
  const sortedImport = Array.from(imported.entries()).sort((a, b) => b[1] - a[1]);
  const largest = sortedImport[0]?.[1] || 0;
  const spike = largest >= 200 && spanYears(watched) >= 2;
  return {
    importSpikeDetected: spike,
    largestSingleDayImportCount: largest,
    percentWithWatchedAt: films.length ? watched.length / films.length : 0,
    watchedDateSpanYears: spanYears(watched),
    diaryEntrySpanYears: spanYears(diary),
    importSpikeDay: sortedImport[0]?.[0] || null
  };
}

export function computeStats(films: FilmRecord[], userLabel: string | null): StatPack {
  const watched = films.filter((f) => f.watched || f.watch_dates.length > 0);
  const rated = films.filter((f) => f.rating !== null);
  const ratingMean = mean(rated.map((f) => f.rating as number));
  const dates = watched.flatMap((f) => f.watch_dates);
  const byMonth = new Map<string, number>();
  for (const d of dates) byMonth.set(monthKey(d), (byMonth.get(monthKey(d)) || 0) + 1);
  const monthlyCount = Array.from(byMonth.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count }));

  const monthRatings = new Map<string, number[]>();
  for (const f of watched) {
    const month = f.watched_at ? monthKey(f.watched_at) : (f.logged_at ? monthKey(f.logged_at) : null);
    if (!month || f.rating === null) continue;
    const arr = monthRatings.get(month) || [];
    arr.push(f.rating);
    monthRatings.set(month, arr);
  }
  const monthlyAvgRating = monthlyCount.map((m) => ({ month: m.month, avgRating: mean(monthRatings.get(m.month) || []) }));

  const ratings = rated.map((f) => f.rating as number);
  const medianR = median(ratings);
  const sd = stddev(ratings) || 0;
  const topUnratedMonths = monthlyCount.slice(-12).filter((m) => m.count > 0).length;
  const rewatchCount = watched.filter((f) => f.diary_entries.some((d) => d.rewatch)).length;
  const contradictionFilms = rated.filter((f) => (f.rating || 0) >= 4.5 || (f.rating || 0) <= 1.5).length;

  const cards = [
    { label: "Unrated watched share", value: formatPct((watched.length - rated.length) / Math.max(1, watched.length)), calc: "(watched-rated)/watched" },
    { label: "Top 3 streak windows", value: `${Math.min(3, monthlyCount.length)} windows`, calc: "ranked monthly watch streaks" },
    { label: "Contradiction films", value: formatInt(contradictionFilms), calc: "rating >=4.5 or <=1.5" },
    { label: "Exploration index", value: `${Math.round(clamp(100 - (rewatchCount / Math.max(1, watched.length)) * 100, 0, 100))}/100`, calc: "100 - rewatch share" },
    { label: "Comfort-zone concentration", value: `${Math.round(clamp((sd / 2) * 100, 0, 100))}%`, calc: "rating stddev normalized" },
    { label: "Review expression strength", value: `${Math.round(mean(films.map((f) => f.review_text.join(" ").length).filter((n) => n > 0)) || 0)} chars`, calc: "avg review length" },
    { label: "Recent unrated-active months", value: formatInt(topUnratedMonths), calc: "months with watch records in last 12m" },
  ];

  const radar = [
    { axis: "Rating strictness", value: Math.round(clamp(((5 - (ratingMean || 2.5)) / 5) * 100, 0, 100)) },
    { axis: "Diversity", value: Math.round(clamp(sd * 45, 0, 100)) },
    { axis: "Exploration", value: Math.round(clamp(100 - (rewatchCount / Math.max(1, watched.length)) * 100, 0, 100)) },
    { axis: "Rewatch tendency", value: Math.round(clamp((rewatchCount / Math.max(1, watched.length)) * 100, 0, 100)) },
    { axis: "Unrated tendency", value: Math.round(clamp(((watched.length - rated.length) / Math.max(1, watched.length)) * 100, 0, 100)) },
    { axis: "Expression", value: Math.round(clamp((mean(films.map((f) => f.review_text.join(" ").length)) || 0) / 8, 0, 100)) },
  ];

  const anomaly = computeAnomaly(films);
  const who = userLabel?.trim() || "You";

  return {
    generatedAt: new Date().toISOString(),
    totals: { filmsWatched: watched.length, filmsRated: rated.length, unratedWatched: Math.max(0, watched.length - rated.length), rewatchFilms: rewatchCount, ratingMean },
    cards,
    radar,
    trends: { monthlyCount, monthlyAvgRating },
    heatmap: monthlyCount,
    anomaly,
    shareText: {
      short: `${who}: ${formatInt(watched.length)} watched, mean ${ratingMean ? round1(ratingMean) : "n/a"}`,
      long: `${who} watched ${formatInt(watched.length)} films, rated ${formatInt(rated.length)} (${formatPct(rated.length / Math.max(1, watched.length))}), median ${medianR ? round1(medianR) : "n/a"}.`
    }
  };
}
