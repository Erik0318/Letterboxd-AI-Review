import { StatPack } from "./stats";
import { round1 } from "./utils";

export type ProfileSummary = {
  label: string;
  generatedAt: string;
  overview: StatPack["overview"];
  quickFacts: StatPack["quickFacts"];
  ratings: StatPack["ratings"];
  ratingDrift: StatPack["ratingDrift"];
  backlog: StatPack["backlog"];
  reviews: StatPack["reviews"];
  releaseAnalytics: StatPack["releaseAnalytics"];
  archives: StatPack["archives"];
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
    ratingDrift: stats.ratingDrift,
    backlog: stats.backlog,
    reviews: stats.reviews,
    releaseAnalytics: stats.releaseAnalytics,
    archives: stats.archives,
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
  const busiest = summary.activity.busiestDay
    ? `${summary.activity.busiestDay.day} (${summary.activity.busiestDay.count})`
    : "n/a";
  const watchedSpan =
    summary.releaseYears.watchedFilms.span.min !== null && summary.releaseYears.watchedFilms.span.max !== null
      ? `${summary.releaseYears.watchedFilms.span.min} to ${summary.releaseYears.watchedFilms.span.max}`
      : "n/a";

  return [
    `Label: ${summary.label}`,
    `Watched films: ${summary.overview.watchedFilmsUnique.value}`,
    `Exact-dated watched films: ${summary.overview.exactDatedWatchedFilms.value}`,
    `Watched films without exact date: ${summary.overview.watchedFilmsWithoutExactDate.value}`,
    `Watched rows: ${summary.quickFacts.watchedRows.value}`,
    `Current rated films: ${summary.overview.currentRatedFilms.value}`,
    `Logged-rated films: ${summary.quickFacts.loggedRatedFilms.value}`,
    `Comparable rating-drift films: ${summary.ratingDrift.summary.comparableFilms.value}`,
    `Changed rating-drift films: ${summary.ratingDrift.summary.changed.value}`,
    `Upgraded films: ${summary.ratingDrift.summary.upgraded.value}`,
    `Downgraded films: ${summary.ratingDrift.summary.downgraded.value}`,
    `Mean rating delta: ${summary.ratingDrift.summary.meanDelta.value === null ? "n/a" : String(round1(summary.ratingDrift.summary.meanDelta.value))}`,
    `Watchlist films: ${summary.backlog.summary.watchlistFilms.value}`,
    `Watchlist films with add date: ${summary.backlog.summary.watchlistFilmsWithAddDate.value}`,
    `Review rows: ${summary.quickFacts.reviewRows.value}`,
    `Review text rows: ${summary.reviews.summary.reviewTextRows.value}`,
    `Reviewed films: ${summary.reviews.summary.reviewedFilms.value}`,
    `Review rate among watched films: ${Math.round(summary.reviews.summary.reviewRate.value * 100)}%`,
    `Average review length: ${summary.reviews.summary.averageReviewLength.value === null ? "n/a" : String(round1(summary.reviews.summary.averageReviewLength.value))}`,
    `Longest review length: ${summary.reviews.summary.longestReviewLength.value}`,
    `Current mean rating: ${currentMean}`,
    `Current median rating: ${currentMedian}`,
    `Logged mean rating: ${loggedMean}`,
    `Best streak (days): ${summary.overview.bestStreakDays.value}`,
    `Busiest exact-dated watch day: ${busiest}`,
    `Recent 90 days exact-dated watches: ${summary.activity.recent90.exactWatchEvents}`,
    `Recent 90 days current mean: ${summary.activity.recent90.meanCurrentRating === null ? "n/a" : String(round1(summary.activity.recent90.meanCurrentRating))}`,
    `Watched release year span: ${watchedSpan}`,
    `Watched decades: ${summary.releaseYears.watchedFilms.decadeBuckets.map((bucket) => `${bucket.decade}:${bucket.count}`).slice(0, 10).join(", ")}`,
    `Watchlist decades: ${summary.releaseYears.watchlistFilms.decadeBuckets.map((bucket) => `${bucket.decade}:${bucket.count}`).slice(0, 10).join(", ")}`,
    `Highest current-rated decade: ${summary.releaseAnalytics.summary.highestCurrentRatedDecade ? `${summary.releaseAnalytics.summary.highestCurrentRatedDecade.decade} (${round1(summary.releaseAnalytics.summary.highestCurrentRatedDecade.meanRating)})` : "n/a"}`,
    `Highest logged-rated decade: ${summary.releaseAnalytics.summary.highestLoggedRatedDecade ? `${summary.releaseAnalytics.summary.highestLoggedRatedDecade.decade} (${round1(summary.releaseAnalytics.summary.highestLoggedRatedDecade.meanRating)})` : "n/a"}`,
    `Active lists: ${summary.archives.summary.activeLists.value}`,
    `Archived lists: ${summary.archives.summary.archivedLists.value}`,
    `Top words: ${summary.text.topWords.map((word) => `${word.word}:${word.count}`).slice(0, 15).join(", ")}`,
    `Badge: ${summary.fun.badge}`,
    `Commitment: ${Math.round(summary.quickFacts.commitmentIndex.value * 100)}%`,
  ].join("\n");
}
