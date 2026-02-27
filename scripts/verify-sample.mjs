import { readFile } from 'node:fs/promises';
import { readLetterboxdExportZip, mergeTablesToFilms } from '../.verify/letterboxd.js';

function assertThat(condition, message) {
  if (!condition) throw new Error(message);
}

function dateToEpochDay(iso) {
  return Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / 86400000);
}

function longestStreak(days) {
  const sorted = Array.from(new Set(days)).sort();
  if (!sorted.length) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    if (dateToEpochDay(sorted[i]) === dateToEpochDay(sorted[i - 1]) + 1) cur += 1;
    else cur = 1;
    if (cur > best) best = cur;
  }
  return best;
}

const zip = await readFile('public/sample_data.zip');
const ab = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength);
const tables = await readLetterboxdExportZip(ab);
const merged = mergeTablesToFilms(tables);

console.log('Sample debug summary:');
console.log(JSON.stringify({
  detectedCsv: merged.debug.csvDetected,
  filmTotal: merged.debug.filmTotal,
  watchedTrueCount: merged.debug.watchedTrueCount,
  watchedAtCoverage: merged.debug.watchedAtCoverage,
  ratingsHitRate: merged.debug.ratingsHitRate,
  reviewsHitRate: merged.debug.reviewsHitRate,
  onlyInRatingsNotInWatched: merged.debug.onlyInRatingsNotInWatched,
  onlyInReviewsNotInWatched: merged.debug.onlyInReviewsNotInWatched,
  watchedTrueWithDatesCount: merged.debug.watchedTrueWithDatesCount,
  watchedTrueWithoutDatesCount: merged.debug.watchedTrueWithoutDatesCount,
  diaryRowsTotal: merged.debug.diaryRowsTotal,
  diaryRowsMatchedToWatchedCount: merged.debug.diaryRowsMatchedToWatchedCount,
  reviewsRowsMatchedToWatchedCount: merged.debug.reviewsRowsMatchedToWatchedCount,
  importSpikeDetected: merged.anomaly.importSpikeDetected,
  largestSingleDayImportCount: merged.anomaly.largestSingleDayImportCount,
  largestSingleDayImportDate: merged.anomaly.largestSingleDayImportDate,
  watchedDateSpanYears: merged.anomaly.watchedDateSpanYears,
  longestStreakDays: longestStreak(merged.films.filter((f) => f.watched).flatMap((f) => f.watchedDates)),
  samples: merged.debug.randomFilmSamples
}, null, 2));

assertThat(tables.reviews.length > 0, 'reviews.csv should be loaded');
assertThat(tables.comments.length === 0, 'comments.csv exists but must not be treated as reviews');
assertThat(merged.debug.diaryRowsMatchedToWatchedCount > 0, 'diary rows should match watched baseline by Name+Year');
assertThat(merged.debug.reviewsRowsMatchedToWatchedCount > 0, 'reviews rows should match watched baseline by Name+Year');
assertThat(merged.films.every((f) => f.reviewTextSamples.length === 0 || f.sources.includes('reviews')), 'reviews must come from reviews.csv');
assertThat(merged.films.every((f) => f.rating === null || f.sources.includes('ratings')), 'ratings must come from ratings.csv');
assertThat(merged.films.every((f) => f.watchedDates.length === 0 || f.sources.includes('diary')), 'time series must use diary watched_at/logged_at only');
assertThat(longestStreak(merged.films.filter((f) => f.watched).flatMap((f) => f.watchedDates)) > 0, 'longest streak should be > 0 with sample diary watched dates');

console.log('All sample assertions passed.');
