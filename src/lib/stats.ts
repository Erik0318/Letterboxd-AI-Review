import { DatasetSummary, FilmRecord, getBestTimelineDates, isWatchedFilm } from "./letterboxd";
import {
  clamp,
  formatInt,
  formatPct,
  mean,
  median,
  round1,
  round3,
  stddev,
} from "./utils";

type CountMetric = {
  value: number;
  basis: string;
};

type RatingSummary = {
  basis: string;
  filmCount: number;
  mean: number | null;
  median: number | null;
  stddev: number | null;
  histogram: Array<{ rating: number; count: number }>;
};

type ReleaseDistribution = {
  basis: string;
  uniqueFilmCount: number;
  topYears: Array<{ year: number; count: number }>;
  span: { min: number | null; max: number | null };
  decadeBuckets: Array<{ decade: string; count: number }>;
};

export type StatPack = {
  generatedAt: string;
  overview: {
    watchedFilmsUnique: CountMetric;
    watchEntries: CountMetric & {
      exactEntries: number;
      estimatedEntries: number;
    };
    currentRatedFilms: CountMetric;
    currentMeanRating: {
      value: number | null;
      basis: string;
    };
    bestStreakDays: {
      value: number;
      exactOnlyValue: number;
      basis: string;
    };
  };
  quickFacts: {
    unratedWatchedFilmsWithoutCurrentRating: CountMetric;
    loggedRatedFilms: CountMetric;
    reviewRows: CountMetric;
    watchlistFilms: CountMetric;
    commitmentIndex: {
      value: number;
      basis: string;
    };
    currentRatingStddev: {
      value: number | null;
      basis: string;
    };
  };
  ratings: {
    current: RatingSummary;
    logged: RatingSummary;
  };
  activity: {
    heatmap: {
      byMonth: Array<{ month: string; count: number }>;
      exactEntries: number;
      estimatedEntries: number;
      totalEntries: number;
      basis: string;
    };
    exactByMonth: Array<{ month: string; count: number }>;
    bestByMonth: Array<{ month: string; count: number }>;
    exactByDay: Array<{ day: string; count: number }>;
    bestByDay: Array<{ day: string; count: number }>;
    longestExactStreakDays: number;
    longestBestStreakDays: number;
    busiestExactDay: { day: string; count: number } | null;
    busiestBestDay: { day: string; count: number } | null;
    recent90: {
      exactWatchEntries: number;
      bestWatchEntries: number;
      currentRatedFilms: number;
      meanCurrentRating: number | null;
    };
  };
  releaseYears: {
    watchedFilms: ReleaseDistribution;
    watchlistFilms: ReleaseDistribution;
  };
  text: {
    topWords: Array<{ word: string; count: number }>;
    avgReviewLength: number | null;
    medianReviewLength: number | null;
  };
  fun: {
    tasteVolatilityIndex: number | null;
    commitmentIndex: number;
    chaosIndex: number | null;
    badge: string;
  };
  shareCard: {
    watchedFilmsUnique: number;
    currentRatedFilms: number;
    currentMeanRating: number | null;
    currentMedianRating: number | null;
    bestStreakDays: number;
    commitmentIndex: number;
    topWords: string[];
    oneLine: string;
  };
  shareText: {
    short: string;
    long: string;
  };
};

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "so", "to", "of", "in", "on", "at", "for", "with", "as", "is", "are", "was", "were",
  "i", "you", "he", "she", "they", "we", "me", "my", "your", "his", "her", "their", "our",
  "this", "that", "these", "those", "it", "its",
  "film", "movie", "watch", "watched", "rating", "stars",
  "very", "really", "just", "like", "love", "good", "great", "bad", "dont", "didnt", "cant", "wont", "im", "ive", "ill",
]);

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\u00c0-\u02af\u0400-\u04ff\u4e00-\u9fff\s]/g, " ")
    .split(/\s+/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 3 && value.length <= 24);
}

function ratingBucketsHalfStars(): number[] {
  const out: number[] = [];
  for (let rating = 0.5; rating <= 5; rating += 0.5) {
    out.push(Math.round(rating * 10) / 10);
  }
  return out;
}

function buildHistogram(ratings: number[]): Array<{ rating: number; count: number }> {
  const buckets = ratingBucketsHalfStars();
  const map = new Map<number, number>(buckets.map((bucket) => [bucket, 0]));
  for (const rating of ratings) {
    const snapped = Math.round(rating * 2) / 2;
    if (map.has(snapped)) {
      map.set(snapped, (map.get(snapped) || 0) + 1);
    }
  }
  return buckets.map((rating) => ({ rating, count: map.get(rating) || 0 }));
}

function makeRatingSummary(ratings: number[], basis: string): RatingSummary {
  return {
    basis,
    filmCount: ratings.length,
    mean: mean(ratings),
    median: median(ratings),
    stddev: stddev(ratings),
    histogram: buildHistogram(ratings),
  };
}

function countByDay(dates: string[]): Array<{ day: string; count: number }> {
  const map = new Map<string, number>();
  for (const date of dates) {
    map.set(date, (map.get(date) || 0) + 1);
  }
  return [...map.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([day, count]) => ({ day, count }));
}

function countByMonth(dates: string[]): Array<{ month: string; count: number }> {
  const map = new Map<string, number>();
  for (const date of dates) {
    const month = date.slice(0, 7);
    map.set(month, (map.get(month) || 0) + 1);
  }
  return [...map.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([month, count]) => ({ month, count }));
}

function dateToEpochDay(iso: string): number {
  const date = new Date(`${iso}T00:00:00Z`);
  return Math.floor(date.getTime() / 86400000);
}

function computeLongestStreak(days: string[]): number {
  if (!days.length) {
    return 0;
  }
  const uniqueDays = Array.from(new Set(days)).sort();
  let best = 1;
  let current = 1;
  for (let index = 1; index < uniqueDays.length; index += 1) {
    const previous = dateToEpochDay(uniqueDays[index - 1]);
    const next = dateToEpochDay(uniqueDays[index]);
    if (next === previous + 1) {
      current += 1;
    } else {
      current = 1;
    }
    if (current > best) {
      best = current;
    }
  }
  return best;
}

function busiestDay(days: Array<{ day: string; count: number }>): { day: string; count: number } | null {
  if (!days.length) {
    return null;
  }
  return days.reduce((best, current) => {
    if (current.count > best.count) {
      return current;
    }
    if (current.count === best.count && current.day < best.day) {
      return current;
    }
    return best;
  });
}

function topYearsForFilms(films: FilmRecord[]): Array<{ year: number; count: number }> {
  const map = new Map<number, number>();
  for (const film of films) {
    if (film.year === null) {
      continue;
    }
    map.set(film.year, (map.get(film.year) || 0) + 1);
  }
  return [...map.entries()]
    .sort((left, right) => right[1] - left[1] || left[0] - right[0])
    .slice(0, 10)
    .map(([year, count]) => ({ year, count }));
}

function spanForFilms(films: FilmRecord[]): { min: number | null; max: number | null } {
  const years = films.map((film) => film.year).filter((year): year is number => year !== null);
  if (!years.length) {
    return { min: null, max: null };
  }
  return { min: Math.min(...years), max: Math.max(...years) };
}

function decadeBucketsForFilms(films: FilmRecord[]): Array<{ decade: string; count: number }> {
  const map = new Map<string, number>();
  for (const film of films) {
    if (film.year === null) {
      continue;
    }
    const decade = Math.floor(film.year / 10) * 10;
    const key = `${decade}s`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([decade, count]) => ({ decade, count }));
}

function makeReleaseDistribution(films: FilmRecord[], basis: string): ReleaseDistribution {
  return {
    basis,
    uniqueFilmCount: films.length,
    topYears: topYearsForFilms(films),
    span: spanForFilms(films),
    decadeBuckets: decadeBucketsForFilms(films),
  };
}

export function computeStats(
  films: FilmRecord[],
  summary: DatasetSummary,
  userLabel: string | null,
): StatPack {
  const generatedAt = new Date().toISOString();

  const watchedUniverseFilms = films.filter(isWatchedFilm);
  const watchlistFilms = films.filter((film) => film.inWatchlist);
  const watchedUniverseCurrentRatedFilms = watchedUniverseFilms.filter((film) => film.currentRating !== null);
  const currentRatedFilms = films.filter((film) => film.currentRating !== null);
  const loggedRatedFilms = films.filter((film) => film.loggedRating !== null);
  const currentRatings = currentRatedFilms
    .map((film) => film.currentRating)
    .filter((rating): rating is number => rating !== null);
  const loggedRatings = loggedRatedFilms
    .map((film) => film.loggedRating)
    .filter((rating): rating is number => rating !== null);

  const exactWatchDates = watchedUniverseFilms.flatMap((film) => getBestTimelineDates(film).exact);
  const estimatedWatchDates = watchedUniverseFilms.flatMap((film) => getBestTimelineDates(film).estimated);
  const bestWatchDates = watchedUniverseFilms.flatMap((film) => getBestTimelineDates(film).best);

  const exactByDay = countByDay(exactWatchDates);
  const bestByDay = countByDay(bestWatchDates);
  const exactByMonth = countByMonth(exactWatchDates);
  const bestByMonth = countByMonth(bestWatchDates);

  const longestExactStreakDays = computeLongestStreak(exactByDay.map((item) => item.day));
  const longestBestStreakDays = computeLongestStreak(bestByDay.map((item) => item.day));

  const cutoffIso = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const recentWatchedFilms = watchedUniverseFilms.filter((film) => (film.bestWatchedDate || "0000-00-00") >= cutoffIso);
  const recentCurrentRatings = recentWatchedFilms
    .map((film) => film.currentRating)
    .filter((rating): rating is number => rating !== null);

  const reviewTexts = films.flatMap((film) => film.reviewTexts);
  const reviewLengths = reviewTexts.map((review) => review.length);
  const wordCounts = new Map<string, number>();
  for (const review of reviewTexts) {
    for (const word of tokenise(review)) {
      if (STOPWORDS.has(word)) {
        continue;
      }
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }
  const topWords = [...wordCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 25)
    .map(([word, count]) => ({ word, count }));

  const commitmentIndex = watchedUniverseFilms.length
    ? watchedUniverseCurrentRatedFilms.length / watchedUniverseFilms.length
    : 0;
  const tasteVolatilityIndex = stddev(currentRatings);
  const chaosIndex = tasteVolatilityIndex === null ? null : clamp(tasteVolatilityIndex / 1.2, 0, 2);

  let badge = "Mixed";
  if (commitmentIndex > 0.85 && (tasteVolatilityIndex || 0) < 0.9) badge = "Curator";
  else if (commitmentIndex > 0.85 && (tasteVolatilityIndex || 0) >= 0.9) badge = "Sharpshooter";
  else if (commitmentIndex <= 0.6 && (tasteVolatilityIndex || 0) < 0.9) badge = "Wanderer";
  else if (commitmentIndex <= 0.6 && (tasteVolatilityIndex || 0) >= 0.9) badge = "Chaos Gremlin";

  const label = userLabel?.trim() ? userLabel.trim() : "You";
  const currentSummary = makeRatingSummary(currentRatings, "currentRating on unique film records");
  const loggedSummary = makeRatingSummary(loggedRatings, "loggedRating on unique film records");

  const watchedFilmsUnique = summary.coverageSummary.watchedUniverseFilmCount;
  const currentRatedFilmCount = summary.ratingSourceSummary.filmsWithCurrentRating;
  const loggedRatedFilmCount = summary.ratingSourceSummary.filmsWithLoggedRating;
  const reviewRows = summary.tableRowCounts["reviews.csv"] || 0;
  const watchlistFilmCount = summary.coverageSummary.watchlistFilmCount;
  const exactEntries = summary.dateQualitySummary.exactWatchEvents;
  const estimatedEntries = summary.dateQualitySummary.estimatedFallbackRows;
  const watchEntries = exactEntries + estimatedEntries;

  return {
    generatedAt,
    overview: {
      watchedFilmsUnique: {
        value: watchedFilmsUnique,
        basis: "unique film-level watched universe merged from watched/ratings/diary/reviews",
      },
      watchEntries: {
        value: watchEntries,
        exactEntries,
        estimatedEntries,
        basis: "row-level best timeline entries using exact watched date first, watched import date as fallback",
      },
      currentRatedFilms: {
        value: currentRatedFilmCount,
        basis: "unique films with currentRating sourced from ratings.csv",
      },
      currentMeanRating: {
        value: currentSummary.mean,
        basis: "mean of currentRating across unique film records",
      },
      bestStreakDays: {
        value: longestBestStreakDays,
        exactOnlyValue: longestExactStreakDays,
        basis: "streak on bestWatchedDate timeline, preferring exact watched date over estimated fallback",
      },
    },
    quickFacts: {
      unratedWatchedFilmsWithoutCurrentRating: {
        value: watchedFilmsUnique - watchedUniverseCurrentRatedFilms.length,
        basis: "watched-universe films that do not have currentRating",
      },
      loggedRatedFilms: {
        value: loggedRatedFilmCount,
        basis: "unique films with loggedRating sourced from review/diary entries",
      },
      reviewRows: {
        value: reviewRows,
        basis: "raw row count from reviews.csv",
      },
      watchlistFilms: {
        value: watchlistFilmCount,
        basis: "unique film-level watchlist backlog",
      },
      commitmentIndex: {
        value: commitmentIndex,
        basis: "current-rated watched-universe films divided by watched-universe films",
      },
      currentRatingStddev: {
        value: tasteVolatilityIndex,
        basis: "standard deviation of currentRating",
      },
    },
    ratings: {
      current: currentSummary,
      logged: loggedSummary,
    },
    activity: {
      heatmap: {
        byMonth: bestByMonth,
        exactEntries,
        estimatedEntries,
        totalEntries: watchEntries,
        basis: "bestWatchedDate timeline, exact first and watched import fallback only when exact is absent",
      },
      exactByMonth,
      bestByMonth,
      exactByDay,
      bestByDay,
      longestExactStreakDays,
      longestBestStreakDays,
      busiestExactDay: busiestDay(exactByDay),
      busiestBestDay: busiestDay(bestByDay),
      recent90: {
        exactWatchEntries: exactWatchDates.filter((date) => date >= cutoffIso).length,
        bestWatchEntries: bestWatchDates.filter((date) => date >= cutoffIso).length,
        currentRatedFilms: recentWatchedFilms.filter((film) => film.currentRating !== null).length,
        meanCurrentRating: mean(recentCurrentRatings),
      },
    },
    releaseYears: {
      watchedFilms: makeReleaseDistribution(
        watchedUniverseFilms,
        "unique watched-universe film records",
      ),
      watchlistFilms: makeReleaseDistribution(
        watchlistFilms,
        "unique watchlist film records",
      ),
    },
    text: {
      topWords,
      avgReviewLength: mean(reviewLengths),
      medianReviewLength: median(reviewLengths),
    },
    fun: {
      tasteVolatilityIndex,
      commitmentIndex,
      chaosIndex,
      badge,
    },
    shareCard: {
      watchedFilmsUnique,
      currentRatedFilms: currentRatedFilmCount,
      currentMeanRating: currentSummary.mean,
      currentMedianRating: currentSummary.median,
      bestStreakDays: longestBestStreakDays,
      commitmentIndex,
      topWords: topWords.slice(0, 10).map((word) => word.word),
      oneLine:
        `${label}: ${formatInt(watchedFilmsUnique)} watched films, ` +
        `${formatInt(watchEntries)} watch entries, ` +
        `${formatInt(currentRatedFilmCount)} current ratings, ` +
        `mean ${currentSummary.mean === null ? "n/a" : round3(currentSummary.mean)}`,
    },
    shareText: {
      short:
        `${label}: ${formatInt(watchedFilmsUnique)} watched films, ` +
        `${formatInt(watchEntries)} watch entries, ` +
        `${formatInt(currentRatedFilmCount)} current ratings, ` +
        `mean ${currentSummary.mean === null ? "n/a" : round3(currentSummary.mean)}`,
      long:
        `${label} has ${formatInt(watchedFilmsUnique)} watched films and ${formatInt(watchEntries)} watch entries ` +
        `(${formatInt(exactEntries)} exact, ${formatInt(estimatedEntries)} estimated fallback). ` +
        `${formatInt(currentRatedFilmCount)} films have current ratings and ${formatInt(loggedRatedFilmCount)} have logged ratings. ` +
        `Current mean ${currentSummary.mean === null ? "n/a" : round3(currentSummary.mean)}, ` +
        `current median ${currentSummary.median === null ? "n/a" : round1(currentSummary.median)}, ` +
        `best streak ${formatInt(longestBestStreakDays)} days, commitment ${formatPct(commitmentIndex)}. ` +
        `Badge ${badge}.`,
    },
  };
}
