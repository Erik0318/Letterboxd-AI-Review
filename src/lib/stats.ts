import { FilmRecord } from "./letterboxd";
import { clamp, formatInt, formatPct, mean, median, monthKey, pearson, round1, stddev } from "./utils";

export type TimeRange = "12m" | "24m" | "all";

export type StatPack = {
  generatedAt: string;
  totals: {
    filmsWatched: number;
    filmsRated: number;
    filmsWithReviews: number;
    diaryEntriesApprox: number;
    unratedWatched: number;
    ratedShare: number;
    rewatchFilms: number;
  };
  ratings: {
    mean: number | null;
    median: number | null;
    stddev: number | null;
    histogram: Array<{ rating: number; count: number }>;
    mode: number | null;
  };
  activity: {
    byMonth: Array<{ month: string; count: number }>;
    byDay: Array<{ day: string; count: number }>;
    longestStreakDays: number;
    busiestDay: { day: string; count: number } | null;
    recent90: { watched: number; rated: number; meanRating: number | null };
    ratingDateCorrelation: number | null;
    ratingTrendByMonth: Array<{ month: string; value: number | null }>;
    watchedTrendByMonth: Array<{ month: string; value: number }>;
    topStreaks: Array<{ start: string; end: string; days: number }>;
    dateSourceLabel: string;
    usingLoggedFallback: boolean;
  };
  releaseYears: {
    top: Array<{ year: number; count: number }>;
    span: { min: number | null; max: number | null };
    decadeBuckets: Array<{ decade: string; count: number }>;
  };
  text: {
    topWords: Array<{ word: string; count: number }>;
    avgReviewLength: number | null;
    persona: { type: string; reason: string };
  };
  fun: {
    tasteVolatilityIndex: number | null;
    commitmentIndex: number;
    chaosIndex: number | null;
    badge: string;
  };
  radar: Array<{ label: string; score: number }>;
  extraCards: Array<{ label: string; value: string }>;
  anomalies: {
    import_spike_detected: boolean;
    largest_single_day_import_count: number;
    percent_with_watched_dates: number;
    watched_date_span_years: number;
    diary_entry_span_years: number;
  };
  shareText: { short: string; long: string };
};

const STOPWORDS = new Set(["the", "and", "with", "this", "that", "have", "just", "like", "movie", "film"]);

function tokenise(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff\s]/g, " ").split(/\s+/).filter((x) => x.length >= 2);
}

function dateToEpochDay(iso: string): number {
  return Math.floor(new Date(iso + "T00:00:00Z").getTime() / 86400000);
}

function monthRange(endMonth: string, n: number): string[] {
  const out: string[] = [];
  const [y, m] = endMonth.split("-").map(Number);
  let year = y;
  let month = m;
  for (let i = 0; i < n; i++) {
    out.push(`${year}-${String(month).padStart(2, "0")}`);
    month -= 1;
    if (month <= 0) {
      month = 12;
      year -= 1;
    }
  }
  return out.reverse();
}

function computeStreaks(days: string[]): Array<{ start: string; end: string; days: number }> {
  if (!days.length) return [];
  const uniq = Array.from(new Set(days)).sort();
  const streaks: Array<{ start: string; end: string; days: number }> = [];
  let start = uniq[0];
  let prev = uniq[0];
  let len = 1;
  for (let i = 1; i < uniq.length; i++) {
    const d = uniq[i];
    if (dateToEpochDay(d) === dateToEpochDay(prev) + 1) {
      len += 1;
      prev = d;
      continue;
    }
    streaks.push({ start, end: prev, days: len });
    start = d;
    prev = d;
    len = 1;
  }
  streaks.push({ start, end: prev, days: len });
  return streaks.sort((a, b) => b.days - a.days);
}

function spanYears(dates: string[]): number {
  if (!dates.length) return 0;
  const ys = dates.map((d) => Number(d.slice(0, 4))).filter((n) => Number.isFinite(n));
  return ys.length ? Math.max(...ys) - Math.min(...ys) + 1 : 0;
}

export function selectRange<T extends { month: string }>(arr: T[], range: TimeRange): T[] {
  if (range === "all" || !arr.length) return arr;
  const end = arr[arr.length - 1].month;
  const n = range === "12m" ? 12 : 24;
  const keys = new Set(monthRange(end, n));
  return arr.filter((x) => keys.has(x.month));
}

export function computeStats(films: FilmRecord[], userLabel: string | null): StatPack {
  const watchedFilms = films.filter((f) => f.watched);
  const ratedFilms = films.filter((f) => f.rated && f.rating !== null);
  const watchedDates = watchedFilms.flatMap((f) => f.watched_at_dates);
  const loggedDates = watchedFilms.flatMap((f) => f.logged_at_dates);
  const importedDates = films.flatMap((f) => f.imported_at_dates);

  const watchedCount = watchedDates.length;
  const usingLoggedFallback = watchedCount < Math.max(3, Math.floor(watchedFilms.length * 0.15));
  const timelineDates = usingLoggedFallback ? loggedDates : watchedDates;

  const byDayMap = new Map<string, number>();
  for (const d of timelineDates) byDayMap.set(d, (byDayMap.get(d) || 0) + 1);
  const byDay = Array.from(byDayMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([day, count]) => ({ day, count }));

  const byMonthMap = new Map<string, number>();
  for (const d of timelineDates) {
    const k = monthKey(d);
    byMonthMap.set(k, (byMonthMap.get(k) || 0) + 1);
  }
  const byMonth = Array.from(byMonthMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count }));

  const ratedByMonth = new Map<string, number[]>();
  films.forEach((f) => {
    const d = f.watched_at_dates[f.watched_at_dates.length - 1] || f.logged_at_dates[f.logged_at_dates.length - 1];
    if (!d || f.rating === null) return;
    const k = monthKey(d);
    const arr = ratedByMonth.get(k) || [];
    arr.push(f.rating);
    ratedByMonth.set(k, arr);
  });
  const ratingTrendByMonth = byMonth.map((m) => ({ month: m.month, value: mean(ratedByMonth.get(m.month) || []) }));
  const watchedTrendByMonth = byMonth.map((m) => ({ month: m.month, value: m.count }));

  const ratings = ratedFilms.map((f) => f.rating!) as number[];
  const hist = Array.from({ length: 10 }).map((_, i) => ({ rating: (i + 1) / 2, count: 0 }));
  ratings.forEach((r) => {
    const idx = Math.max(0, Math.min(9, Math.round(r * 2) - 1));
    hist[idx].count += 1;
  });
  const modeBucket = [...hist].sort((a, b) => b.count - a.count)[0];

  const reviews = films.flatMap((f) => f.reviewTextSamples);
  const words = new Map<string, number>();
  reviews.forEach((r) => tokenise(r).forEach((w) => {
    if (STOPWORDS.has(w)) return;
    words.set(w, (words.get(w) || 0) + 1);
  }));
  const topWords = Array.from(words.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([word, count]) => ({ word, count }));

  const streaks = computeStreaks(byDay.map((d) => d.day));
  const topStreaks = streaks.slice(0, 3);
  const longestStreakDays = topStreaks[0]?.days || 0;
  const busiestDay = byDay.length ? [...byDay].sort((a, b) => b.count - a.count)[0] : null;

  const importByDay = new Map<string, number>();
  importedDates.forEach((d) => importByDay.set(d, (importByDay.get(d) || 0) + 1));
  const largestImport = Math.max(0, ...Array.from(importByDay.values()));
  const importSpike = largestImport >= 100 && spanYears(watchedDates) >= 2;

  const yearMap = new Map<number, number>();
  watchedFilms.forEach((f) => { if (f.year) yearMap.set(f.year, (yearMap.get(f.year) || 0) + 1); });
  const topYears = Array.from(yearMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([year, count]) => ({ year, count }));
  const years = Array.from(yearMap.keys());

  const decadeMap = new Map<string, number>();
  watchedFilms.forEach((f) => {
    if (!f.year) return;
    const d = `${Math.floor(f.year / 10) * 10}s`;
    decadeMap.set(d, (decadeMap.get(d) || 0) + 1);
  });
  const decadeBuckets = Array.from(decadeMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([decade, count]) => ({ decade, count }));

  const commitmentIndex = watchedFilms.length ? ratedFilms.length / watchedFilms.length : 0;
  const volatility = stddev(ratings);

  const topDirectors = new Map<string, number>();
  const newDirectorShare = films.filter((f) => f.letterboxdUri).length ? Math.min(1, new Set(films.map((f) => f.letterboxdUri?.split("/")[2] || f.film_id)).size / films.length) : 0.5;
  const exploration = Math.round((1 - (films.filter((f) => f.rewatchCount > 0).length / Math.max(1, watchedFilms.length))) * 100);

  const radar = [
    { label: "评分严苛度", score: Math.round(clamp(((3.2 - (mean(ratings) || 3.2)) / 1.8) * 100, 0, 100)) },
    { label: "多样性指数", score: Math.round(clamp((decadeBuckets.length / 10) * 100, 0, 100)) },
    { label: "探索指数", score: exploration },
    { label: "重看倾向", score: Math.round(clamp((films.filter((f) => f.rewatchCount > 0).length / Math.max(1, watchedFilms.length)) * 100, 0, 100)) },
    { label: "未评分观看倾向", score: Math.round(clamp((films.filter((f) => f.watched && !f.rated).length / Math.max(1, watchedFilms.length)) * 100, 0, 100)) },
    { label: "短评表达强度", score: Math.round(clamp((reviews.length / Math.max(1, watchedFilms.length)) * 100, 0, 100)) },
    { label: "集中度", score: Math.round(clamp((topYears.slice(0, 5).reduce((a, b) => a + b.count, 0) / Math.max(1, watchedFilms.length)) * 100, 0, 100)) },
    { label: "新导演占比", score: Math.round(clamp(newDirectorShare * 100, 0, 100)) }
  ];

  const persona = reviews.length > watchedFilms.length * 0.45
    ? { type: "学术型", reason: "短评密度高，平均字数较长" }
    : topWords.some((w) => ["lol", "哈哈", "笑", "funny"].includes(w.word))
      ? { type: "段子型", reason: "高频词偏口语和梗" }
      : reviews.length <= Math.max(3, watchedFilms.length * 0.1)
        ? { type: "极简型", reason: "短评数量较少，表达克制" }
        : { type: "情绪型", reason: "评价活跃，评分波动明显" };

  const low = films.filter((f) => (f.rating ?? 5) <= 2).length;
  const high = films.filter((f) => (f.rating ?? 0) >= 4.5).length;
  const unratedShare = films.filter((f) => f.watched && !f.rated).length / Math.max(1, watchedFilms.length);
  const comfortReturn = Math.round(clamp((topYears.slice(0, 5).reduce((a, b) => a + b.count, 0) / Math.max(1, watchedFilms.length)) * 100, 0, 100));

  const extraCards = [
    { label: "未评分观看占比", value: formatPct(unratedShare) },
    { label: "最长连续观影天数", value: `${longestStreakDays} 天` },
    { label: "Top3 连看区间", value: topStreaks.map((s) => `${s.start}~${s.end}(${s.days})`).join("; ") || "无" },
    { label: "最常给分", value: modeBucket ? `${modeBucket.rating}★ (${modeBucket.count})` : "n/a" },
    { label: "探索指数(近似)", value: `${exploration}/100` },
    { label: "舒适区回流率", value: `${comfortReturn}%` },
    { label: "两极评分占比", value: `${Math.round(((high + low) / Math.max(1, ratedFilms.length)) * 100)}%` },
    { label: "短评人格", value: `${persona.type}（${persona.reason}）` }
  ];

  const corrPairs = ratedFilms.map((f) => {
    const d = f.watched_at_dates[f.watched_at_dates.length - 1] || f.logged_at_dates[f.logged_at_dates.length - 1];
    return d ? { x: dateToEpochDay(d), y: f.rating! } : null;
  }).filter(Boolean) as Array<{ x: number; y: number }>;

  const recentCut = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const recent = films.filter((f) => {
    const d = f.watched_at_dates[f.watched_at_dates.length - 1] || f.logged_at_dates[f.logged_at_dates.length - 1] || "0000-00-00";
    return d >= recentCut;
  });

  const meanR = mean(ratings);
  return {
    generatedAt: new Date().toISOString(),
    totals: {
      filmsWatched: watchedFilms.length,
      filmsRated: ratedFilms.length,
      filmsWithReviews: films.filter((f) => f.reviewCount > 0).length,
      diaryEntriesApprox: films.flatMap((f) => f.diary_entries).length,
      unratedWatched: films.filter((f) => f.watched && !f.rated).length,
      ratedShare: commitmentIndex,
      rewatchFilms: films.filter((f) => f.rewatchCount > 0).length
    },
    ratings: { mean: meanR, median: median(ratings), stddev: stddev(ratings), histogram: hist, mode: modeBucket?.rating || null },
    activity: {
      byMonth,
      byDay,
      longestStreakDays,
      busiestDay,
      recent90: { watched: recent.filter((f) => f.watched).length, rated: recent.filter((f) => f.rated).length, meanRating: mean(recent.map((f) => f.rating).filter((x): x is number => x !== null)) },
      ratingDateCorrelation: pearson(corrPairs.map((p) => p.x), corrPairs.map((p) => p.y)),
      ratingTrendByMonth,
      watchedTrendByMonth,
      topStreaks,
      dateSourceLabel: usingLoggedFallback ? "logged_at (fallback)" : "watched_at",
      usingLoggedFallback
    },
    releaseYears: {
      top: topYears,
      span: { min: years.length ? Math.min(...years) : null, max: years.length ? Math.max(...years) : null },
      decadeBuckets
    },
    text: { topWords, avgReviewLength: reviews.length ? reviews.join("").length / reviews.length : null, persona },
    fun: {
      tasteVolatilityIndex: volatility,
      commitmentIndex,
      chaosIndex: volatility === null ? null : clamp(volatility / 1.2, 0, 2),
      badge: commitmentIndex > 0.8 ? "Curator" : commitmentIndex > 0.6 ? "Balancer" : "Explorer"
    },
    radar,
    extraCards,
    anomalies: {
      import_spike_detected: importSpike,
      largest_single_day_import_count: largestImport,
      percent_with_watched_dates: Math.round((watchedFilms.filter((f) => f.watched_at_dates.length > 0).length / Math.max(1, watchedFilms.length)) * 100),
      watched_date_span_years: spanYears(watchedDates),
      diary_entry_span_years: spanYears(loggedDates)
    },
    shareText: {
      short: `${userLabel || "You"}: ${formatInt(watchedFilms.length)} watched, avg ${meanR ? round1(meanR) : "n/a"}`,
      long: `${userLabel || "You"} watched ${formatInt(watchedFilms.length)} films across ${spanYears(timelineDates)} years. Rated share ${formatPct(commitmentIndex)}. Unrated watched ${Math.round(unratedShare * 100)}%.`
    }
  };
}
