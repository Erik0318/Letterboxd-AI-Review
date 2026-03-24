import { StatPack } from "./stats";
import { round1 } from "./utils";

export type ProfileSummary = {
  label: string;
  generatedAt: string;
  overview: StatPack["overview"];
  quickFacts: StatPack["quickFacts"];
  ratings: StatPack["ratings"];
  activity: StatPack["activity"];
  releaseYears: StatPack["releaseYears"];
  text: StatPack["text"];
  fun: StatPack["fun"];
  shareCard: StatPack["shareCard"];
};

export function toProfileSummary(stats: StatPack, label: string): ProfileSummary {
  return {
    label,
    generatedAt: stats.generatedAt,
    overview: stats.overview,
    quickFacts: stats.quickFacts,
    ratings: stats.ratings,
    activity: stats.activity,
    releaseYears: stats.releaseYears,
    text: stats.text,
    fun: stats.fun,
    shareCard: stats.shareCard,
  };
}

export function summaryToText(summary: ProfileSummary): string {
  const currentMean = summary.ratings.current.mean === null ? "n/a" : String(round1(summary.ratings.current.mean));
  const currentMedian = summary.ratings.current.median === null ? "n/a" : String(round1(summary.ratings.current.median));
  const loggedMean = summary.ratings.logged.mean === null ? "n/a" : String(round1(summary.ratings.logged.mean));
  const busiest = summary.activity.busiestBestDay
    ? `${summary.activity.busiestBestDay.day} (${summary.activity.busiestBestDay.count})`
    : "n/a";
  const watchedSpan =
    summary.releaseYears.watchedFilms.span.min !== null && summary.releaseYears.watchedFilms.span.max !== null
      ? `${summary.releaseYears.watchedFilms.span.min} to ${summary.releaseYears.watchedFilms.span.max}`
      : "n/a";

  return [
    `Label: ${summary.label}`,
    `Watched films: ${summary.overview.watchedFilmsUnique.value}`,
    `Watch entries: ${summary.overview.watchEntries.value}`,
    `Exact watch entries: ${summary.overview.watchEntries.exactEntries}`,
    `Estimated fallback entries: ${summary.overview.watchEntries.estimatedEntries}`,
    `Current-rated films: ${summary.overview.currentRatedFilms.value}`,
    `Logged-rated films: ${summary.quickFacts.loggedRatedFilms.value}`,
    `Watchlist films: ${summary.quickFacts.watchlistFilms.value}`,
    `Review rows: ${summary.quickFacts.reviewRows.value}`,
    `Current mean rating: ${currentMean}`,
    `Current median rating: ${currentMedian}`,
    `Logged mean rating: ${loggedMean}`,
    `Best streak (days): ${summary.overview.bestStreakDays.value}`,
    `Busiest best-timeline day: ${busiest}`,
    `Recent 90 days watch entries: ${summary.activity.recent90.bestWatchEntries}`,
    `Recent 90 days current mean: ${summary.activity.recent90.meanCurrentRating === null ? "n/a" : String(round1(summary.activity.recent90.meanCurrentRating))}`,
    `Watched release year span: ${watchedSpan}`,
    `Watched decades: ${summary.releaseYears.watchedFilms.decadeBuckets.map((bucket) => `${bucket.decade}:${bucket.count}`).slice(0, 10).join(", ")}`,
    `Watchlist decades: ${summary.releaseYears.watchlistFilms.decadeBuckets.map((bucket) => `${bucket.decade}:${bucket.count}`).slice(0, 10).join(", ")}`,
    `Top words: ${summary.text.topWords.map((word) => `${word.word}:${word.count}`).slice(0, 15).join(", ")}`,
    `Badge: ${summary.fun.badge}`,
    `Commitment: ${Math.round(summary.quickFacts.commitmentIndex.value * 100)}%`,
  ].join("\n");
}
