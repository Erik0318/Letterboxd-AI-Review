import { readFile } from "node:fs/promises";
import { computeStats } from "../.verify/stats.js";
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
  shareText: stats.shareText,
}, null, 2));

assertThat(merged.summary.recognizedFiles.includes("deleted/diary.csv"), "deleted/diary.csv should be recognized");
assertThat(merged.summary.recognizedFiles.includes("likes/reviews.csv"), "likes/reviews.csv should be recognized");
assertThat(merged.summary.listSummary.activeListCount > 0, "lists/*.csv should be parsed");
assertThat(merged.summary.archiveSummary.deleted.diaryRows > 0, "deleted rows should be summarized");
assertThat(merged.summary.archiveSummary.likes.reviewRows > 0, "likes rows should be summarized");
assertThat(merged.summary.dateQualitySummary.exactWatchEvents > 0, "sample should have exact watch events");
assertThat(merged.summary.dateQualitySummary.estimatedFallbackRows > 0, "sample should expose estimated fallback rows");
assertThat(merged.summary.ratingSourceSummary.filmsWithCurrentRating > 0, "sample should have current ratings");
assertThat(merged.summary.ratingSourceSummary.filmsWithLoggedRating > 0, "sample should have logged ratings");
assertThat(stats.overview.watchedFilmsUnique.value === merged.summary.coverageSummary.watchedUniverseFilmCount, "overview watched films should match dataset summary");
assertThat(stats.overview.currentRatedFilms.value === merged.summary.ratingSourceSummary.filmsWithCurrentRating, "overview current rated should match dataset summary");
assertThat(stats.quickFacts.loggedRatedFilms.value === merged.summary.ratingSourceSummary.filmsWithLoggedRating, "quick facts logged-rated should match dataset summary");
assertThat(stats.quickFacts.reviewRows.value === merged.summary.tableRowCounts["reviews.csv"], "quick facts review rows should match dataset summary");
assertThat(stats.quickFacts.watchlistFilms.value === merged.summary.coverageSummary.watchlistFilmCount, "quick facts watchlist films should match dataset summary");
assertThat(stats.overview.watchEntries.value === stats.overview.watchEntries.exactEntries + stats.overview.watchEntries.estimatedEntries, "watch entry totals should split into exact + estimated");
assertThat(stats.overview.watchEntries.exactEntries === merged.summary.dateQualitySummary.exactWatchEvents, "exact watch entry count should match dataset summary");
assertThat(stats.overview.watchEntries.estimatedEntries === merged.summary.dateQualitySummary.estimatedFallbackRows, "estimated watch entry count should match dataset summary");
assertThat(merged.films.some((film) => film.filmUri && film.reviewEntryUris.length > 0 && !film.reviewEntryUris.includes(film.filmUri)), "film URI and review entry URI layers should remain separate");

console.log("Sample verification passed.");
