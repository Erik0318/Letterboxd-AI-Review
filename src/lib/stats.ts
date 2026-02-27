import { FilmRecord } from "./letterboxd";
import { clamp, formatInt, formatPct, mean, median, monthKey, pearson, round1, stddev } from "./utils";

export type TrendPoint = { period: string; watched: number; meanRating: number | null; unratedShare: number };
export type RadarMetric = { key: string; label: string; value: number };

export type StatPack = {
  generatedAt: string;
  totals: {
    filmsWatched: number;
    filmsRated: number;
    filmsWithReviews: number;
    diaryEntries: number;
    unratedWatched: number;
    ratedShare: number;
    rewatchFilms: number;
    likes: number;
  };
  ratings: {
    mean: number | null;
    median: number | null;
    stddev: number | null;
    histogram: Array<{ rating: number; count: number }>;
    mode: number | null;
    indecisiveShare: number;
  };
  activity: {
    byMonth: Array<{ month: string; count: number }>;
    longestStreakDays: number;
    topStreaks: Array<{ start: string; end: string; days: number }>;
    busiestRealDay: { day: string; count: number } | null;
    ratingDateCorrelation: number | null;
    usedLoggedFallback: boolean;
  };
  trends: {
    timeline: TrendPoint[];
    recent12: TrendPoint[];
    recent24: TrendPoint[];
  };
  releaseYears: {
    top: Array<{ year: number; count: number }>;
    span: { min: number | null; max: number | null };
    decadeBuckets: Array<{ decade: string; count: number }>;
    comfortZoneReturnRate: number;
    explorationIndex: number;
  };
  text: {
    topWords: Array<{ word: string; count: number }>;
    avgReviewLength: number | null;
    expressionIntensity: number;
    persona: { type: string; reason: string };
  };
  anomaly: {
    importSpikeDetected: boolean;
    largestSingleDayImportCount: number;
    percentWithWatchedDates: number;
    watchedDateSpanYears: number;
    diaryEntrySpanYears: number;
  };
  radar: RadarMetric[];
  shareText: { short: string; long: string };
};

const STOPWORDS = new Set(["the", "and", "for", "that", "with", "this", "have", "you", "are", "was", "film", "movie", "just", "very", "really", "good", "great", "like", "dont", "didnt"]);

function ratingBucketsHalfStars(): number[] {
  const out: number[] = [];
  for (let r = 0.5; r <= 5; r += 0.5) out.push(Math.round(r * 10) / 10);
  return out;
}

function ymdToEpochDay(iso: string): number {
  return Math.floor(new Date(iso + "T00:00:00Z").getTime() / 86400000);
}

function bestTimelineDate(f: FilmRecord): { date: string | null; usedFallback: boolean } {
  if (f.watchedAtDates.length) return { date: f.watchedAtDates[f.watchedAtDates.length - 1], usedFallback: false };
  if (f.loggedAtDates.length) return { date: f.loggedAtDates[f.loggedAtDates.length - 1], usedFallback: true };
  return { date: null, usedFallback: false };
}

function computeStreaks(days: string[]) {
  if (!days.length) return { longest: 0, top: [] as Array<{ start: string; end: string; days: number }> };
  const unique = Array.from(new Set(days)).sort();
  const streaks: Array<{ start: string; end: string; days: number }> = [];
  let start = unique[0];
  let prev = unique[0];
  for (let i = 1; i < unique.length; i++) {
    const cur = unique[i];
    if (ymdToEpochDay(cur) === ymdToEpochDay(prev) + 1) {
      prev = cur;
      continue;
    }
    streaks.push({ start, end: prev, days: ymdToEpochDay(prev) - ymdToEpochDay(start) + 1 });
    start = cur;
    prev = cur;
  }
  streaks.push({ start, end: prev, days: ymdToEpochDay(prev) - ymdToEpochDay(start) + 1 });
  streaks.sort((a, b) => b.days - a.days);
  return { longest: streaks[0]?.days || 0, top: streaks.slice(0, 3) };
}

function buildTimeline(points: Array<{ month: string; watched: number; ratingNums: number[]; unrated: number }>): TrendPoint[] {
  return points.map((p) => ({
    period: p.month,
    watched: p.watched,
    meanRating: mean(p.ratingNums),
    unratedShare: p.watched ? p.unrated / p.watched : 0
  }));
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^a-z0-9\u4e00-\u9fff\u0400-\u04ff\s]/g, " ").split(/\s+/).map((s) => s.trim()).filter((s) => s.length >= 2);
}

function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

export function computeStats(films: FilmRecord[], userLabel: string | null): StatPack {
  const generatedAt = new Date().toISOString();
  const watchedFilms = films.filter((f) => f.watched || f.watchedAtDates.length > 0 || f.loggedAtDates.length > 0);
  const ratedFilms = films.filter((f) => f.rated && f.rating !== null);
  const reviewFilms = films.filter((f) => f.reviewText.length > 0);

  const timelineRows = watchedFilms.map((f) => ({ f, ...bestTimelineDate(f) })).filter((x) => x.date) as Array<{ f: FilmRecord; date: string; usedFallback: boolean }>;
  const usedLoggedFallback = timelineRows.some((x) => x.usedFallback);

  const byDay = new Map<string, number>();
  const byMonthTmp = new Map<string, { watched: number; ratingNums: number[]; unrated: number }>();
  for (const row of timelineRows) {
    byDay.set(row.date, (byDay.get(row.date) || 0) + 1);
    const mk = monthKey(row.date);
    const cur = byMonthTmp.get(mk) || { watched: 0, ratingNums: [], unrated: 0 };
    cur.watched += 1;
    if (row.f.rating !== null) cur.ratingNums.push(row.f.rating);
    else cur.unrated += 1;
    byMonthTmp.set(mk, cur);
  }

  const monthRows = Array.from(byMonthTmp.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([month, val]) => ({ month, ...val }));
  const timeline = buildTimeline(monthRows);
  const latestMonth = timeline[timeline.length - 1]?.period;
  const recent12 = latestMonth ? timeline.filter((t) => monthDiff(t.period, latestMonth) <= 11) : [];
  const recent24 = latestMonth ? timeline.filter((t) => monthDiff(t.period, latestMonth) <= 23) : [];

  const watchedDays = timelineRows.map((x) => x.date);
  const streakData = computeStreaks(watchedDays);
  const busiestRealDay = Array.from(byDay.entries()).sort((a, b) => b[1] - a[1])[0];

  const ratingNums = ratedFilms.map((f) => f.rating!).filter((n) => Number.isFinite(n));
  const histBuckets = ratingBucketsHalfStars();
  const histMap = new Map(histBuckets.map((r) => [r, 0]));
  for (const r of ratingNums) {
    const snapped = Math.round(r * 2) / 2;
    histMap.set(snapped, (histMap.get(snapped) || 0) + 1);
  }
  const histogram = histBuckets.map((r) => ({ rating: r, count: histMap.get(r) || 0 }));
  const modePair = histogram.reduce((a, b) => (b.count > a.count ? b : a), { rating: 0, count: -1 });
  const indecisiveShare = ratedFilms.length ? ((histMap.get(2.5) || 0) + (histMap.get(3) || 0)) / ratedFilms.length : 0;

  const dateRated = timelineRows.filter((r) => r.f.rating !== null).map((r) => ({ x: ymdToEpochDay(r.date), y: r.f.rating! }));
  const ratingDateCorrelation = pearson(dateRated.map((p) => p.x), dateRated.map((p) => p.y));

  const yearMap = new Map<number, number>();
  for (const f of watchedFilms) if (f.year !== null) yearMap.set(f.year, (yearMap.get(f.year) || 0) + 1);
  const topYears = Array.from(yearMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([year, count]) => ({ year, count }));
  const years = Array.from(yearMap.keys());
  const span = years.length ? { min: Math.min(...years), max: Math.max(...years) } : { min: null, max: null };

  const decadeMap = new Map<string, number>();
  for (const f of watchedFilms) {
    if (f.year === null) continue;
    const dec = `${Math.floor(f.year / 10) * 10}s`;
    decadeMap.set(dec, (decadeMap.get(dec) || 0) + 1);
  }
  const decadeBuckets = Array.from(decadeMap.entries()).sort((a, b) => b[1] - a[1]).map(([decade, count]) => ({ decade, count }));
  const top5DecadesCount = decadeBuckets.slice(0, 5).reduce((a, b) => a + b.count, 0);
  const comfortZoneReturnRate = watchedFilms.length ? top5DecadesCount / watchedFilms.length : 0;

  const last12 = recent12;
  const first12 = timeline.slice(0, Math.min(12, timeline.length));
  const diversityRecent = new Set(watchedFilms.filter((f) => {
    const d = bestTimelineDate(f).date;
    return d && latestMonth && monthDiff(monthKey(d), latestMonth) <= 11;
  }).map((f) => (f.year ? Math.floor(f.year / 10) : null)).filter(Boolean)).size;
  const diversityAll = new Set(watchedFilms.map((f) => (f.year ? Math.floor(f.year / 10) : null)).filter(Boolean)).size;
  const explorationIndex = clamp(diversityAll ? diversityRecent / diversityAll : 0, 0, 1);

  const reviews = films.flatMap((f) => f.reviewText);
  const wordMap = new Map<string, number>();
  let totalLen = 0;
  for (const r of reviews) {
    totalLen += r.length;
    for (const w of tokenize(r)) {
      if (STOPWORDS.has(w)) continue;
      wordMap.set(w, (wordMap.get(w) || 0) + 1);
    }
  }
  const topWords = Array.from(wordMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([word, count]) => ({ word, count }));
  const avgReviewLength = reviews.length ? totalLen / reviews.length : null;
  const expressionIntensity = clamp((avgReviewLength || 0) / 350, 0, 1);

  let persona = { type: "Minimalist", reason: "Short and sparse review text." };
  if ((avgReviewLength || 0) > 420) persona = { type: "Essayist", reason: "Long review length and dense wording." };
  else if (topWords.some((x) => ["cry", "love", "hate", "amazing", "terrible"].includes(x.word))) persona = { type: "Emotional", reason: "Frequent emotional vocabulary in reviews." };
  else if (topWords.some((x) => ["editing", "frame", "narrative", "structure", "cinema"].includes(x.word))) persona = { type: "Analytical", reason: "Craft-focused wording appears repeatedly." };

  const importByDay = new Map<string, number>();
  for (const f of films) for (const d of f.importedAtDates) importByDay.set(d, (importByDay.get(d) || 0) + 1);
  const largestSingleDayImportCount = Math.max(0, ...Array.from(importByDay.values()));

  const watchedDatesAll = watchedFilms.flatMap((f) => f.watchedAtDates);
  const diaryDatesAll = watchedFilms.flatMap((f) => f.diaryEntries.map((e) => e.loggedAt || e.watchedAt).filter(Boolean)) as string[];
  const watchedSpanYears = watchedDatesAll.length ? (new Date(watchedDatesAll[watchedDatesAll.length - 1]).getUTCFullYear() - new Date(watchedDatesAll[0]).getUTCFullYear() + 1) : 0;
  const diarySpanYears = diaryDatesAll.length ? (new Date(diaryDatesAll.sort()[diaryDatesAll.length - 1]).getUTCFullYear() - new Date(diaryDatesAll.sort()[0]).getUTCFullYear() + 1) : 0;
  const percentWithWatchedDates = watchedFilms.length ? watchedFilms.filter((f) => f.watchedAtDates.length > 0).length / watchedFilms.length : 0;
  const importSpikeDetected = largestSingleDayImportCount >= 100 && watchedSpanYears >= 2;

  const strictness = clamp(ratedFilms.length ? 1 - ((mean(ratingNums) || 0) / 5) : 0, 0, 1);
  const diversity = clamp((decadeBuckets.length || 0) / 10, 0, 1);
  const unratedInclination = watchedFilms.length ? (watchedFilms.length - ratedFilms.length) / watchedFilms.length : 0;
  const rewatch = watchedFilms.length ? watchedFilms.filter((f) => f.diaryEntries.some((d) => d.rewatch)).length / watchedFilms.length : 0;
  const concentration = 1 - comfortZoneReturnRate;

  const radar: RadarMetric[] = [
    { key: "strictness", label: "Rating strictness", value: Math.round(strictness * 100) },
    { key: "diversity", label: "Diversity index", value: Math.round(diversity * 100) },
    { key: "exploration", label: "Exploration", value: Math.round(explorationIndex * 100) },
    { key: "rewatch", label: "Rewatch tendency", value: Math.round(rewatch * 100) },
    { key: "unrated", label: "Unrated tendency", value: Math.round(unratedInclination * 100) },
    { key: "expression", label: "Review intensity", value: Math.round(expressionIntensity * 100) },
    { key: "concentration", label: "Concentration", value: Math.round(concentration * 100) }
  ];

  const label = userLabel?.trim() || "You";
  const shareShort = `${label}: ${formatInt(watchedFilms.length)} watched, mean ${mean(ratingNums) ? round1(mean(ratingNums)!) : "n/a"}`;
  const shareLong = `${label} watched ${formatInt(watchedFilms.length)} films (${formatPct(percentWithWatchedDates)} with real watched dates), rated ${formatInt(ratedFilms.length)}. Longest streak ${streakData.longest} days.`;

  return {
    generatedAt,
    totals: {
      filmsWatched: watchedFilms.length,
      filmsRated: ratedFilms.length,
      filmsWithReviews: reviewFilms.length,
      diaryEntries: watchedFilms.reduce((a, f) => a + f.diaryEntries.length, 0),
      unratedWatched: watchedFilms.length - ratedFilms.length,
      ratedShare: watchedFilms.length ? ratedFilms.length / watchedFilms.length : 0,
      rewatchFilms: watchedFilms.filter((f) => f.diaryEntries.some((d) => d.rewatch)).length,
      likes: films.filter((f) => f.like).length
    },
    ratings: {
      mean: mean(ratingNums),
      median: median(ratingNums),
      stddev: stddev(ratingNums),
      histogram,
      mode: modePair.count > 0 ? modePair.rating : null,
      indecisiveShare
    },
    activity: {
      byMonth: monthRows.map((m) => ({ month: m.month, count: m.watched })),
      longestStreakDays: streakData.longest,
      topStreaks: streakData.top,
      busiestRealDay: busiestRealDay ? { day: busiestRealDay[0], count: busiestRealDay[1] } : null,
      ratingDateCorrelation,
      usedLoggedFallback
    },
    trends: { timeline, recent12: last12, recent24 },
    releaseYears: {
      top: topYears,
      span,
      decadeBuckets,
      comfortZoneReturnRate,
      explorationIndex
    },
    text: { topWords, avgReviewLength, expressionIntensity, persona },
    anomaly: {
      importSpikeDetected,
      largestSingleDayImportCount,
      percentWithWatchedDates,
      watchedDateSpanYears: watchedSpanYears,
      diaryEntrySpanYears: diarySpanYears
    },
    radar,
    shareText: { short: shareShort, long: shareLong }
  };
}
