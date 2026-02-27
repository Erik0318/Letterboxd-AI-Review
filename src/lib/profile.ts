import { StatPack } from "./stats";
import { round1 } from "./utils";

export type ProfileSummary = {
  label: string;
  generatedAt: string;

  totals: StatPack["totals"];
  ratings: {
    mean: number | null;
    median: number | null;
    stddev: number | null;
    histogram: Array<{ rating: number; count: number }>;
  };
  activity: StatPack["activity"];
  releaseYears: StatPack["releaseYears"];
  text: StatPack["text"];
  fun: StatPack["fun"];
};

export function toProfileSummary(stats: StatPack, label: string): ProfileSummary {
  return {
    label,
    generatedAt: stats.generatedAt,
    totals: stats.totals,
    ratings: {
      mean: stats.ratings.mean,
      median: stats.ratings.median,
      stddev: stats.ratings.stddev,
      histogram: stats.ratings.histogram
    },
    activity: stats.activity,
    releaseYears: stats.releaseYears,
    text: stats.text,
    fun: stats.fun
  };
}

export function summaryToText(s: ProfileSummary): string {
  const mean = s.ratings.mean === null ? "n/a" : String(round1(s.ratings.mean));
  const med = s.ratings.median === null ? "n/a" : String(round1(s.ratings.median));
  const sd = s.ratings.stddev === null ? "n/a" : String(round1(s.ratings.stddev));
  const busiest = s.activity.busiestDay ? `${s.activity.busiestDay.day} (${s.activity.busiestDay.count})` : "n/a";
  const span = s.releaseYears.span.min && s.releaseYears.span.max ? `${s.releaseYears.span.min} to ${s.releaseYears.span.max}` : "n/a";

  return [
    `Label: ${s.label}`,
    `Watched films: ${s.totals.filmsWatched}`,
    `Rated films: ${s.totals.filmsRated}`,
    `Reviews: ${s.totals.filmsWithReviews}`,
    `Unrated watched: ${s.totals.unratedWatched}`,
    `Mean rating: ${mean}`,
    `Median rating: ${med}`,
    `Rating stddev: ${sd}`,
    `Longest streak (days): ${s.activity.longestStreakDays}`,
    `Busiest day: ${busiest}`,
    `Recent 90 days watched: ${s.activity.recent90.watched}`,
    `Recent 90 days mean rating: ${s.activity.recent90.meanRating === null ? "n/a" : String(round1(s.activity.recent90.meanRating))}`,
    `Release year span: ${span}`,
    `Decades watched: ${s.releaseYears.decadeBuckets.map(d => `${d.decade}:${d.count}`).slice(0, 10).join(", ")}`,
    `Top words: ${s.text.topWords.map(w => `${w.word}:${w.count}`).slice(0, 15).join(", ")}`,
    `Badge: ${s.fun.badge}`,
    `Commitment: ${Math.round(s.fun.commitmentIndex * 100)}%`
  ].join("\n");
}
