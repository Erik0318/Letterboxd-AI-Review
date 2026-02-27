import { FilmRecord } from "./letterboxd";
import { clamp, dayKey, formatInt, formatPct, mean, median, monthKey, pearson, round1, stddev, toISODateOnly } from "./utils";

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
  };

  activity: {
    byMonth: Array<{ month: string; count: number }>;
    byDay: Array<{ day: string; count: number }>;
    longestStreakDays: number;
    busiestDay: { day: string; count: number } | null;
    recent90: { watched: number; rated: number; meanRating: number | null };
    ratingDateCorrelation: number | null;
  };

  releaseYears: {
    top: Array<{ year: number; count: number }>;
    span: { min: number | null; max: number | null };
    decadeBuckets: Array<{ decade: string; count: number }>;
  };

  text: {
    topWords: Array<{ word: string; count: number }>;
    avgReviewLength: number | null;
  };

  fun: {
    tasteVolatilityIndex: number | null;
    commitmentIndex: number; // rated / watched
    chaosIndex: number | null; // rating stddev normalised
    badge: string;
  };

  shareText: {
    short: string;
    long: string;
  };
};

const STOPWORDS = new Set([
  "the","a","an","and","or","but","if","then","so","to","of","in","on","at","for","with","as","is","are","was","were",
  "i","you","he","she","they","we","me","my","your","his","her","their","our",
  "this","that","these","those","it","its",
  "film","movie","watch","watched","rating","stars",
  "very","really","just","like","love","good","great","bad","dont","didnt","cant","wont","im","ive","ill"
]);

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\u00c0-\u02af\u0400-\u04ff\u4e00-\u9fff\s]/g, " ")
    .split(/\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 3 && s.length <= 24);
}

function ratingBucketsHalfStars(): number[] {
  const out: number[] = [];
  for (let r = 0.5; r <= 5; r += 0.5) out.push(Math.round(r * 10) / 10);
  return out;
}

function bestDate(rec: FilmRecord): string | null {
  const w = rec.watchedDates[rec.watchedDates.length - 1];
  if (w) return w;
  return null;
}

function dateToEpochDay(iso: string): number {
  const d = new Date(iso + "T00:00:00Z");
  return Math.floor(d.getTime() / 86400000);
}

function computeLongestStreak(days: string[]): number {
  if (!days.length) return 0;
  const ds = Array.from(new Set(days)).sort();
  let best = 1;
  let cur = 1;
  for (let i = 1; i < ds.length; i++) {
    const a = dateToEpochDay(ds[i - 1]);
    const b = dateToEpochDay(ds[i]);
    if (b === a + 1) cur += 1;
    else cur = 1;
    if (cur > best) best = cur;
  }
  return best;
}

export function computeStats(films: FilmRecord[], userLabel: string | null): StatPack {
  const generatedAt = new Date().toISOString();

  const watchedFilms = films.filter(f => f.watched);
  const ratedFilms = films.filter(f => f.rated && f.rating !== null);
  const reviewFilms = films.filter(f => f.reviewCount > 0);
  const unratedWatched = watchedFilms.filter(f => !f.rated || f.rating === null).length;

  // timeline must come from diary watched_at/logged_at-derived dates, never import dates
  const allWatchedDates = films.flatMap(f => f.watchedDates);
  const byDayMap = new Map<string, number>();
  for (const d of allWatchedDates) byDayMap.set(dayKey(d), (byDayMap.get(dayKey(d)) || 0) + 1);
  const byDay = Array.from(byDayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, count]) => ({ day, count }));

  const byMonthMap = new Map<string, number>();
  for (const d of allWatchedDates) byMonthMap.set(monthKey(d), (byMonthMap.get(monthKey(d)) || 0) + 1);
  const byMonth = Array.from(byMonthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count }));

  const longestStreakDays = computeLongestStreak(byDay.map(d => d.day));

  const busiestDay = byDay.length
    ? byDay.reduce((a, b) => (b.count > a.count ? b : a))
    : null;

  const ratingNums = ratedFilms.map(f => f.rating!).filter(n => Number.isFinite(n));
  const histBuckets = ratingBucketsHalfStars();
  const histMap = new Map<number, number>(histBuckets.map(r => [r, 0]));
  for (const r of ratingNums) {
    // snap to nearest 0.5
    const snapped = Math.round(r * 2) / 2;
    if (histMap.has(snapped)) histMap.set(snapped, (histMap.get(snapped) || 0) + 1);
  }
  const histogram = histBuckets.map(r => ({ rating: r, count: histMap.get(r) || 0 }));

  // recent 90 days
  const now = new Date();
  const cutoff = new Date(now.getTime() - 90 * 86400000);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const recentWatched = watchedFilms.filter(f => (bestDate(f) || "0000-00-00") >= cutoffIso);
  const recentRated = ratedFilms.filter(f => (bestDate(f) || "0000-00-00") >= cutoffIso);
  const recentMean = mean(recentRated.map(f => f.rating!).filter(n => Number.isFinite(n)));

  // rating date correlation
  const datedRated = ratedFilms
    .map(f => {
      const d = bestDate(f);
      return d ? { x: dateToEpochDay(d), y: f.rating! } : null;
    })
    .filter(Boolean) as Array<{ x: number; y: number }>;
  const corr = pearson(datedRated.map(p => p.x), datedRated.map(p => p.y));

  // release years distribution
  const yearMap = new Map<number, number>();
  for (const f of watchedFilms) {
    if (f.year === null) continue;
    yearMap.set(f.year, (yearMap.get(f.year) || 0) + 1);
  }
  const yearPairs = Array.from(yearMap.entries()).sort((a, b) => b[1] - a[1]);
  const topYears = yearPairs.slice(0, 10).map(([year, count]) => ({ year, count }));
  const years = yearPairs.map(([y]) => y);
  const span = years.length ? { min: Math.min(...years), max: Math.max(...years) } : { min: null, max: null };

  const decadeMap = new Map<string, number>();
  for (const f of watchedFilms) {
    if (f.year === null) continue;
    const dec = Math.floor(f.year / 10) * 10;
    const k = `${dec}s`;
    decadeMap.set(k, (decadeMap.get(k) || 0) + 1);
  }
  const decadeBuckets = Array.from(decadeMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([decade, count]) => ({ decade, count }));

  // text stats
  const reviews = films.flatMap(f => f.reviewTextSamples);
  const wordMap = new Map<string, number>();
  let totalLen = 0;
  for (const r of reviews) {
    totalLen += r.length;
    for (const w of tokenise(r)) {
      if (STOPWORDS.has(w)) continue;
      wordMap.set(w, (wordMap.get(w) || 0) + 1);
    }
  }
  const topWords = Array.from(wordMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([word, count]) => ({ word, count }));
  const avgReviewLength = reviews.length ? totalLen / reviews.length : null;

  // fun indices
  const commitmentIndex = watchedFilms.length ? ratedFilms.length / watchedFilms.length : 0;
  const tasteVolatilityIndex = stddev(ratingNums);
  const chaosIndex = tasteVolatilityIndex === null ? null : clamp(tasteVolatilityIndex / 1.2, 0, 2.0);

  let badge = "Mixed";
  if (commitmentIndex > 0.85 && (tasteVolatilityIndex || 0) < 0.9) badge = "Curator";
  else if (commitmentIndex > 0.85 && (tasteVolatilityIndex || 0) >= 0.9) badge = "Sharpshooter";
  else if (commitmentIndex <= 0.6 && (tasteVolatilityIndex || 0) < 0.9) badge = "Wanderer";
  else if (commitmentIndex <= 0.6 && (tasteVolatilityIndex || 0) >= 0.9) badge = "Chaos Gremlin";

  const label = userLabel?.trim() ? userLabel.trim() : "You";
  const meanR = mean(ratingNums);
  const medR = median(ratingNums);

  const shareShort = `${label}: ${formatInt(watchedFilms.length)} watched, ${formatInt(ratedFilms.length)} rated, mean ${meanR ? round1(meanR) : "n/a"}`;
  const shareLong =
    `${label} watched ${formatInt(watchedFilms.length)} films and rated ${formatInt(ratedFilms.length)}. ` +
    `Mean rating ${meanR ? round1(meanR) : "n/a"}, median ${medR ? round1(medR) : "n/a"}. ` +
    `Longest streak ${formatInt(longestStreakDays)} days. ` +
    `Commitment ${formatPct(commitmentIndex)}. Badge ${badge}.`;

  return {
    generatedAt,
    totals: {
      filmsWatched: watchedFilms.length,
      filmsRated: ratedFilms.length,
      filmsWithReviews: reviewFilms.length,
      diaryEntriesApprox: allWatchedDates.length,
      unratedWatched,
      ratedShare: commitmentIndex,
      rewatchFilms: watchedFilms.filter(f => f.rewatchCount > 0).length
    },
    ratings: {
      mean: meanR,
      median: medR,
      stddev: stddev(ratingNums),
      histogram
    },
    activity: {
      byMonth,
      byDay,
      longestStreakDays,
      busiestDay,
      recent90: { watched: recentWatched.length, rated: recentRated.length, meanRating: recentMean },
      ratingDateCorrelation: corr
    },
    releaseYears: {
      top: topYears,
      span,
      decadeBuckets
    },
    text: {
      topWords,
      avgReviewLength
    },
    fun: {
      tasteVolatilityIndex,
      commitmentIndex,
      chaosIndex,
      badge
    },
    shareText: {
      short: shareShort,
      long: shareLong
    }
  };
}
