import { readFile } from 'node:fs/promises';
import { readLetterboxdExportZip, mergeTablesToFilms } from '../.verify/letterboxd.js';

function assertThat(condition, message) {
  if (!condition) throw new Error(message);
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
  importSpikeDetected: merged.anomaly.importSpikeDetected,
  largestSingleDayImportCount: merged.anomaly.largestSingleDayImportCount,
  largestSingleDayImportDate: merged.anomaly.largestSingleDayImportDate,
  watchedDateSpanYears: merged.anomaly.watchedDateSpanYears,
  diaryEntrySpanYears: merged.anomaly.diaryEntrySpanYears,
  samples: merged.debug.randomFilmSamples
}, null, 2));

assertThat(tables.reviews.length > 0, 'reviews.csv should be loaded');
assertThat(tables.comments.length === 0, 'comments.csv exists but must not be treated as reviews');
const onlyInRatings = merged.films.filter((f) => f.sources.includes('ratings') && !f.sources.includes('watched')).length;
const onlyInReviews = merged.films.filter((f) => f.sources.includes('reviews') && !f.sources.includes('watched')).length;
assertThat(onlyInRatings === merged.debug.onlyInRatingsNotInWatched, 'only-in-ratings debug counter mismatch');
assertThat(onlyInReviews === merged.debug.onlyInReviewsNotInWatched, 'only-in-reviews debug counter mismatch');
assertThat(merged.films.every((f) => f.reviewTextSamples.length === 0 || f.sources.includes('reviews')), 'reviews must come from reviews.csv');
assertThat(merged.films.every((f) => f.rating === null || f.sources.includes('ratings')), 'ratings must come from ratings.csv');
assertThat(merged.films.every((f) => f.watchedDates.length === 0 || f.sources.includes('diary')), 'time series must use diary watched_at/logged_at only');

console.log('All sample assertions passed.');
