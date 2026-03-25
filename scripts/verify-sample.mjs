import { readFile } from "node:fs/promises";
import { computeScopedView, computeStats } from "../.verify/stats.js";
import { mergeTablesToFilms, readLetterboxdExportZip } from "../.verify/letterboxd.js";

function assertThat(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const zip = await readFile("public/sample_data.zip");
const arrayBuffer = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength);
const tables = await readLetterboxdExportZip(arrayBuffer);
const merged = mergeTablesToFilms(tables);
const stats = computeStats(merged.films, merged.summary, "Sample");
const changed2010sScope = computeScopedView(merged.films, {
  basis: "changedDriftFilms",
  releaseDecade: "2010s",
  releaseYearMin: null,
  releaseYearMax: null,
  currentRatingMin: null,
  currentRatingMax: null,
  loggedRatingMin: null,
  loggedRatingMax: null,
  reviewPresence: "all",
}, "Sample");

console.log("Sample dataset summary:");
console.log(JSON.stringify({
  recognizedFiles: merged.summary.recognizedFiles,
  tableRowCounts: merged.summary.tableRowCounts,
  tableUniqueFilmCounts: merged.summary.tableUniqueFilmCounts,
  coverageSummary: merged.summary.coverageSummary,
  dateQualitySummary: merged.summary.dateQualitySummary,
  ratingSourceSummary: merged.summary.ratingSourceSummary,
  importSpikeSummary: merged.summary.importSpikeSummary,
  listSummary: merged.summary.listSummary,
  archiveSummary: merged.summary.archiveSummary,
  sampleFilms: merged.summary.samples,
  overview: stats.overview,
  quickFacts: stats.quickFacts,
  ratingDrift: {
    summary: stats.ratingDrift.summary,
    semantics: stats.ratingDrift.semantics,
    topCases: {
      biggestDowngrade: stats.ratingDrift.lists.biggestDowngrade.slice(0, 10),
      biggestUpgrade: stats.ratingDrift.lists.biggestUpgrade.slice(0, 10),
      largestAbsoluteChange: stats.ratingDrift.lists.largestAbsoluteChange.slice(0, 10),
    },
  },
  backlog: stats.backlog,
  reviews: {
    summary: stats.reviews.summary,
    lengthBuckets: stats.reviews.lengthBuckets,
    longestReviews: stats.reviews.longestReviews.slice(0, 10),
    topWords: stats.reviews.topWords,
  },
  releaseAnalytics: stats.releaseAnalytics,
  archives: stats.archives,
  shareText: stats.shareText,
  scopedSample: {
    scope: changed2010sScope.scope,
    overview: changed2010sScope.overview,
    shareText: changed2010sScope.shareText,
    filmRows: changed2010sScope.filmRows.slice(0, 10),
    reviewRows: changed2010sScope.reviewRows.slice(0, 10),
  },
}, null, 2));

assertThat(merged.summary.recognizedFiles.includes("deleted/diary.csv"), "deleted/diary.csv should be recognized");
assertThat(merged.summary.recognizedFiles.includes("likes/reviews.csv"), "likes/reviews.csv should be recognized");
assertThat(merged.summary.listSummary.activeListCount > 0, "lists/*.csv should be parsed");
assertThat(merged.summary.archiveSummary.deleted.diaryRows > 0, "deleted rows should be summarized");
assertThat(merged.summary.archiveSummary.likes.reviewRows > 0, "likes rows should be summarized");
assertThat(merged.summary.dateQualitySummary.exactWatchEvents > 0, "sample should have exact watch events");
assertThat(merged.summary.dateQualitySummary.watchedRowsWithoutExactDate > 0, "sample should expose watched rows without exact dates");
assertThat(merged.summary.ratingSourceSummary.filmsWithCurrentRating > 0, "sample should have current ratings");
assertThat(merged.summary.ratingSourceSummary.filmsWithLoggedRating > 0, "sample should have logged ratings");
assertThat(stats.overview.watchedFilmsUnique.value === merged.summary.coverageSummary.watchedUniverseFilmCount, "overview watched films should match dataset summary");
assertThat(stats.overview.exactDatedWatchedFilms.value === merged.summary.dateQualitySummary.exactDatedWatchedFilms, "overview exact-dated watched films should match dataset summary");
assertThat(stats.overview.watchedFilmsWithoutExactDate.value === merged.summary.dateQualitySummary.watchedFilmsWithoutExactDate, "overview watched films without exact date should match dataset summary");
assertThat(stats.overview.currentRatedFilms.value === merged.summary.ratingSourceSummary.filmsWithCurrentRating, "overview current rated should match dataset summary");
assertThat(stats.quickFacts.watchedRows.value === merged.summary.tableRowCounts["watched.csv"], "quick facts watched rows should match dataset summary");
assertThat(stats.quickFacts.loggedRatedFilms.value === merged.summary.ratingSourceSummary.filmsWithLoggedRating, "quick facts logged-rated should match dataset summary");
assertThat(stats.quickFacts.reviewRows.value === merged.summary.tableRowCounts["reviews.csv"], "quick facts review rows should match dataset summary");
assertThat(stats.quickFacts.watchlistFilms.value === merged.summary.coverageSummary.watchlistFilmCount, "quick facts watchlist films should match dataset summary");
assertThat(stats.ratingDrift.summary.comparableFilms.value === merged.summary.ratingSourceSummary.both, "rating drift comparable films should match dataset summary overlap");
assertThat(stats.ratingDrift.summary.changed.value === merged.summary.ratingSourceSummary.changed, "rating drift changed count should match dataset summary");
assertThat(stats.ratingDrift.summary.upgraded.value === merged.summary.ratingSourceSummary.upgraded, "rating drift upgraded count should match dataset summary");
assertThat(stats.ratingDrift.summary.downgraded.value === merged.summary.ratingSourceSummary.downgraded, "rating drift downgraded count should match dataset summary");
assertThat(stats.backlog.summary.watchlistFilms.value === merged.summary.coverageSummary.watchlistFilmCount, "backlog watchlist films should match dataset summary");
assertThat(stats.backlog.summary.watchlistRows.value === merged.summary.tableRowCounts["watchlist.csv"], "backlog watchlist rows should match dataset summary");
assertThat(stats.reviews.summary.reviewRows.value === merged.summary.tableRowCounts["reviews.csv"], "review stats review rows should match dataset summary");
assertThat(stats.reviews.summary.reviewedFilms.value === merged.summary.coverageSummary.reviewFilmCount, "review stats reviewed films should match dataset summary");
assertThat(stats.archives.summary.activeLists.value === merged.summary.listSummary.activeListCount, "archive stats active lists should match dataset summary");
assertThat(stats.archives.summary.archivedLists.value === merged.summary.listSummary.archivedListCount, "archive stats archived lists should match dataset summary");
assertThat(stats.archives.summary.deletedDiaryRows.value === merged.summary.archiveSummary.deleted.diaryRows, "archive stats deleted diary rows should match dataset summary");
assertThat(stats.archives.summary.orphanedReviewRows.value === merged.summary.archiveSummary.orphaned.reviewRows, "archive stats orphaned review rows should match dataset summary");
assertThat(stats.activity.heatmap.exactWatchEvents === merged.summary.dateQualitySummary.exactWatchEvents, "heatmap should use exact watch events only");
assertThat(stats.activity.longestStreakDays === stats.overview.bestStreakDays.value, "best streak should use exact-only activity stats");
assertThat(stats.releaseAnalytics.decadeRatings.every((row) => row.currentMeanRating === null || row.currentRatedFilms > 0), "release analytics current mean should only exist when current-rated films are present");
assertThat(stats.releaseAnalytics.decadeRatings.every((row) => row.loggedMeanRating === null || row.loggedRatedFilms > 0), "release analytics logged mean should only exist when logged-rated films are present");
assertThat(merged.films.some((film) => film.filmUri && film.reviewEntryUris.length > 0 && !film.reviewEntryUris.includes(film.filmUri)), "film URI and review entry URI layers should remain separate");
assertThat(stats.dataQuality.moduleCoverage.length === 4, "data quality audit should expose module coverage guidance");
assertThat(changed2010sScope.scope.isActive, "fixture scope should register as active");
assertThat(changed2010sScope.scope.counts.matchingFilms === changed2010sScope.filmRows.length, "scoped film rows should match scoped counts");
assertThat(changed2010sScope.filmRows.every((row) => row.year !== null && row.year >= 2010 && row.year <= 2019), "scoped release decade filters should stay aligned with explorer rows");
assertThat(changed2010sScope.filmRows.every((row) => row.delta !== null && Math.abs(row.delta) > 1e-9), "changed-drift scope should only keep changed comparable films");
assertThat(!changed2010sScope.shareText.short.includes("Â"), "scoped share text should use clean ASCII separators");

console.log("Sample verification passed.");
