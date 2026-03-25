import {
  buildExplorerFilmRows,
  buildExplorerReviewRows,
  buildRatingDrift,
  computeScopedView,
  computeStats,
} from "../.verify/stats.js";
import {
  createFilmKey,
  mergeTablesToFilms,
  parseLetterboxdListCsv,
} from "../.verify/letterboxd.js";

function assertThat(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function emptyTables() {
  return {
    files: [
      "watched.csv",
      "ratings.csv",
      "diary.csv",
      "reviews.csv",
      "watchlist.csv",
      "profile.csv",
      "comments.csv",
      "deleted/diary.csv",
      "likes/reviews.csv",
      "lists/example.csv",
    ],
    recognizedFiles: [
      "watched.csv",
      "ratings.csv",
      "diary.csv",
      "reviews.csv",
      "watchlist.csv",
      "profile.csv",
      "comments.csv",
      "deleted/diary.csv",
      "likes/reviews.csv",
      "lists/example.csv",
    ],
    unknownFiles: [],
    parseIssues: [],
    detectedCsv: ["watched", "ratings", "diary", "reviews", "watchlist", "profile", "comments"],
    watched: [],
    ratings: [],
    diary: [],
    reviews: [],
    watchlist: [],
    profile: [],
    comments: [],
    deleted: { diary: [], reviews: [], comments: [], lists: [], unknown: {} },
    orphaned: { diary: [], reviews: [], comments: [], lists: [], unknown: {} },
    likes: { films: [], reviews: [], lists: [], unknown: {} },
    lists: [],
    unknown: {},
  };
}

const keyA = createFilmKey("  Ame\u0301lie  ", "2001");
const keyB = createFilmKey("amélie", 2001);
assertThat(keyA === keyB, "film key normalization should unify unicode and whitespace");

const listText = [
  "Letterboxd list export v7",
  "Date,Name,Tags,URL,Description",
  "2026-01-01,Example List,\"one, two\",https://boxd.it/test,hello world",
  "",
  "Position,Name,Year,URL,Description",
  "1,Heat,1995,https://boxd.it/2bg,all timer",
  "2,Amélie,2001,https://boxd.it/2as,comfort watch",
].join("\n");
const parsedList = parseLetterboxdListCsv(listText, "lists/example.csv", "active", "2026-03-24");
assertThat(parsedList.metadata.title === "Example List", "list parser should read metadata title");
assertThat(parsedList.metadata.tags.join("|") === "one|two", "list parser should split tags");
assertThat(parsedList.items.length === 2, "list parser should read items");
assertThat(parsedList.items[0].filmKey === createFilmKey("Heat", 1995), "list parser should assign film keys");

const tables = emptyTables();
tables.lists.push(parsedList);
tables.watched.push(
  { Date: "2024-01-02", Name: "Heat", Year: "1995", "Letterboxd URI": "https://boxd.it/film-heat" },
  { Date: "2024-01-03", Name: "Heat", Year: "1995", "Letterboxd URI": "https://boxd.it/film-heat" },
  { Date: "2024-02-10", Name: "Only Watched", Year: "2020", "Letterboxd URI": "https://boxd.it/film-only" },
);
tables.ratings.push({
  Date: "2024-03-01",
  Name: "Heat",
  Year: "1995",
  "Letterboxd URI": "https://boxd.it/film-heat",
  Rating: "4.5",
});
tables.diary.push({
  Date: "2024-01-05",
  Name: "Heat",
  Year: "1995",
  "Letterboxd URI": "https://boxd.it/entry-heat",
  Rating: "3.5",
  Rewatch: "Yes",
  Tags: "crime, favorite",
  "Watched Date": "2024-01-01",
});
tables.reviews.push({
  Date: "2024-01-05",
  Name: "Heat",
  Year: "1995",
  "Letterboxd URI": "https://boxd.it/entry-heat",
  Rating: "4",
  Rewatch: "Yes",
  Review: "great movie",
  Tags: "crime, favorite",
  "Watched Date": "2024-01-01",
});
tables.watchlist.push({
  Date: "2024-04-01",
  Name: "Watchlist Only",
  Year: "1985",
  "Letterboxd URI": "https://boxd.it/watchlist-only",
});
tables.deleted.diary.push({
  Date: "2023-12-01",
  Name: "Deleted Film",
  Year: "1979",
  "Letterboxd URI": "https://boxd.it/deleted-entry",
  Rating: "2",
  Rewatch: "",
  Tags: "",
  "Watched Date": "2023-11-30",
});
tables.likes.reviews.push({ Date: "2024-05-01", Content: "https://boxd.it/review-like" });

const merged = mergeTablesToFilms(tables);
const stats = computeStats(merged.films, merged.summary, "Synthetic");
const heat = merged.films.find((film) => film.filmKey === createFilmKey("Heat", 1995));
const watchlistOnly = merged.films.find((film) => film.filmKey === createFilmKey("Watchlist Only", 1985));
const onlyWatched = merged.films.find((film) => film.filmKey === createFilmKey("Only Watched", 2020));

assertThat(merged.films.length === 3, "film-level merge should dedupe watched duplicates and keep watchlist-only records separate");
assertThat(heat.watchedRows === 2, "row-level counts should preserve duplicate watched rows");
assertThat(heat.filmUri === "https://boxd.it/film-heat", "filmUri should come from film-level tables");
assertThat(heat.diaryEntryUris[0] === "https://boxd.it/entry-heat", "diary entry URI should stay separate");
assertThat(heat.reviewEntryUris[0] === "https://boxd.it/entry-heat", "review entry URI should stay separate");
assertThat(heat.filmUri !== heat.diaryEntryUris[0], "film URI must not be replaced by entry URI");
assertThat(heat.exactWatchedDate === "2024-01-01", "exact watched date should come from diary/reviews watched date");
assertThat(heat.estimatedWatchedDate === "2024-01-03", "estimated watched date should come from watched.csv");
assertThat(heat.bestWatchedDate === "2024-01-01" && heat.watchedDateIsExact, "best watched date should prefer exact over estimated");
assertThat(heat.currentRating === 4.5, "current rating should come from ratings.csv");
assertThat(heat.loggedRating === 4, "logged rating should prefer review/diary log rating");
assertThat(heat.bestRating === 4.5, "best rating should prefer current rating as fallback");
assertThat(watchlistOnly.inWatchlist && !watchlistOnly.inWatched && !watchlistOnly.inDiary && !watchlistOnly.inReviews && !watchlistOnly.inRatings, "watchlist-only films should stay outside watched stats");
assertThat(stats.quickFacts.watchlistFilms.value === 1, "watchlist stats should be counted independently");
assertThat(stats.overview.watchedFilmsUnique.value === 2, "watchlist-only films must not be counted as watched");
assertThat(stats.overview.exactDatedWatchedFilms.value === 1, "exact-dated watched films should count only films with exact watched dates");
assertThat(stats.overview.watchedFilmsWithoutExactDate.value === 1, "watched films without exact date should remain visible in coverage stats");
assertThat(stats.overview.currentRatedFilms.value === merged.summary.ratingSourceSummary.filmsWithCurrentRating, "current rated overview should match dataset summary");
assertThat(stats.quickFacts.watchedRows.value === merged.summary.tableRowCounts["watched.csv"], "watched rows quick fact should match dataset summary");
assertThat(stats.quickFacts.loggedRatedFilms.value === merged.summary.ratingSourceSummary.filmsWithLoggedRating, "logged rated quick fact should match dataset summary");
assertThat(stats.quickFacts.reviewRows.value === merged.summary.tableRowCounts["reviews.csv"], "review rows quick fact should match dataset summary");
assertThat(stats.ratingDrift.summary.comparableFilms.value === merged.summary.ratingSourceSummary.both, "rating drift comparable count should match dataset summary");
assertThat(stats.ratingDrift.summary.changed.value === merged.summary.ratingSourceSummary.changed, "rating drift changed count should match dataset summary");
assertThat(stats.ratingDrift.summary.upgraded.value === 1, "synthetic dataset should expose one upgraded film");
assertThat(stats.ratingDrift.summary.downgraded.value === 0, "synthetic dataset should expose no downgraded films");
assertThat(stats.backlog.summary.watchlistFilms.value === 1, "backlog summary should keep unique watchlist films");
assertThat(stats.backlog.summary.watchlistRows.value === 1, "backlog summary should keep watchlist rows");
assertThat(stats.backlog.timeline.byMonth.length === 1 && stats.backlog.timeline.byMonth[0].month === "2024-04", "watchlist timeline should use watchlist add dates");
assertThat(stats.backlog.comparison.watchedVsWatchlistByDecade.map((row) => row.decade).join("|") === "1980s|1990s|2020s", "backlog decade comparison should merge watched and watchlist decades");
assertThat(stats.reviews.summary.reviewRows.value === 1, "review stats should keep raw review rows");
assertThat(stats.reviews.summary.reviewTextRows.value === 1, "review stats should count review text rows");
assertThat(stats.reviews.summary.reviewedFilms.value === 1, "review stats should count reviewed films");
assertThat(stats.reviews.summary.reviewRate.value === 0.5, "review rate should be reviewed films divided by watched films");
assertThat(stats.reviews.summary.longestReviewLength.value === 11, "review stats should track longest review length");
assertThat(stats.reviews.longestReviews[0].name === "Heat" && stats.reviews.longestReviews[0].length === 11, "review stats should expose longest review rows");
assertThat(stats.releaseAnalytics.decadeRatings.length === 2, "release analytics should include watched films with release years even when a decade has no ratings");
assertThat(stats.releaseAnalytics.decadeRatings.map((row) => row.decade).join("|") === "1990s|2020s", "release analytics should group watched films by decade");
assertThat(stats.releaseAnalytics.decadeRatings[0].currentMeanRating === 4.5, "release analytics should compute current mean by decade");
assertThat(stats.releaseAnalytics.decadeRatings[0].loggedMeanRating === 4, "release analytics should compute logged mean by decade");
assertThat(stats.releaseAnalytics.decadeRatings[1].currentMeanRating === null && stats.releaseAnalytics.decadeRatings[1].loggedMeanRating === null, "release analytics should leave unrated decades with null means");
assertThat(stats.archives.summary.activeLists.value === 1 && stats.archives.summary.archivedLists.value === 0, "archive/list stats should count active and archived lists");
assertThat(stats.archives.summary.deletedDiaryRows.value === 1 && stats.archives.summary.orphanedDiaryRows.value === 0, "archive/list stats should surface archive row counts");
assertThat(stats.archives.lists.length === 1 && stats.archives.lists[0].title === "Example List", "archive/list stats should expose parsed list metadata");
assertThat(stats.activity.heatmap.exactWatchEvents === merged.summary.dateQualitySummary.exactWatchEvents, "heatmap should use exact watch events only");
assertThat(stats.activity.heatmap.byMonth.length === 1 && stats.activity.heatmap.byMonth[0].month === "2024-01", "watched films without exact date must not enter the exact-only heatmap");
assertThat(stats.overview.bestStreakDays.value === 1, "best streak should be exact-only");
assertThat(merged.summary.tableUniqueFilmCounts["watched.csv"] === 2, "dataset summary should distinguish watched unique films");
assertThat(merged.summary.archiveSummary.deleted.diaryRows === 1, "deleted rows should flow into archive summary");
assertThat(merged.summary.archiveSummary.likes.reviewRows === 1, "likes rows should flow into archive summary");
assertThat(merged.summary.listSummary.activeListCount === 1 && merged.summary.listSummary.activeListItemCount === 2, "list summaries should include parsed active lists");
assertThat(merged.summary.overlapSummary.watchlistOnly === 1, "overlap summary should track watchlist-only films");
assertThat(merged.summary.ratingSourceSummary.changed === 1, "rating source summary should surface current vs logged changes");
assertThat(onlyWatched.exactWatchedDate === null && onlyWatched.estimatedWatchedDate === "2024-02-10", "films without exact date should still retain estimated watched dates internally");
assertThat(stats.dataQuality.moduleCoverage.length === 4, "data quality audit should include module coverage summaries");

const currentRatedHighScope = computeScopedView(merged.films, {
  basis: "currentRatedFilms",
  releaseDecade: null,
  releaseYearMin: null,
  releaseYearMax: null,
  currentRatingMin: 4,
  currentRatingMax: 5,
  loggedRatingMin: null,
  loggedRatingMax: null,
  reviewPresence: "all",
}, "Synthetic");
assertThat(currentRatedHighScope.scope.isActive, "non-default scope should be marked active");
assertThat(currentRatedHighScope.scope.counts.matchingFilms === 1, "current rating range scope should match the expected film");
assertThat(currentRatedHighScope.filmRows.length === 1 && currentRatedHighScope.filmRows[0].title === "Heat", "scoped film explorer rows should stay film-level and scoped");
assertThat(currentRatedHighScope.reviewRows.length === 1 && currentRatedHighScope.reviewRows[0].title === "Heat", "scoped review explorer rows should stay row-level and scoped");
assertThat(currentRatedHighScope.shareText.short.includes("scoped films"), "scoped share text should reflect the scoped view");

const watchedNoReviewScope = computeScopedView(merged.films, {
  basis: "watchedFilms",
  releaseDecade: null,
  releaseYearMin: null,
  releaseYearMax: null,
  currentRatingMin: null,
  currentRatingMax: null,
  loggedRatingMin: null,
  loggedRatingMax: null,
  reviewPresence: "noReview",
}, "Synthetic");
assertThat(watchedNoReviewScope.scope.counts.matchingFilms === 1, "review presence filter should scope watched films correctly");
assertThat(watchedNoReviewScope.filmRows[0].title === "Only Watched", "review presence filter should exclude reviewed films");
assertThat(watchedNoReviewScope.reviewRows.length === 0, "review-row explorer should stay empty when scoped films have no review rows");

const upgradedScope = computeScopedView(merged.films, {
  basis: "upgradedDriftFilms",
  releaseDecade: null,
  releaseYearMin: null,
  releaseYearMax: null,
  currentRatingMin: null,
  currentRatingMax: null,
  loggedRatingMin: null,
  loggedRatingMax: null,
  reviewPresence: "all",
}, "Synthetic");
assertThat(upgradedScope.scope.counts.upgradedDriftFilms === 1, "upgraded drift basis should keep upgraded comparable films");
assertThat(upgradedScope.filmRows.length === 1 && upgradedScope.filmRows[0].delta === 0.5, "upgraded drift scope should preserve film delta in explorer rows");

const watchlistExplorerRows = buildExplorerFilmRows(merged.films.filter((film) => film.inWatchlist));
assertThat(watchlistExplorerRows.length === 1 && watchlistExplorerRows[0].inWatchlist, "film explorer rows should support watchlist drilldowns");

const reviewExplorerRows = buildExplorerReviewRows(merged.films);
assertThat(reviewExplorerRows.length === 1 && reviewExplorerRows[0].reviewLength === 11, "review explorer rows should stay row-level and expose review length");

const drift = buildRatingDrift([
  { filmKey: "aaron::1990", name: "Aaron", year: 1990, loggedRating: 4, currentRating: 2 },
  { filmKey: "beta::1991", name: "Beta", year: 1991, loggedRating: 4.5, currentRating: 2.5 },
  { filmKey: "alpha::1992", name: "Alpha", year: 1992, loggedRating: 4, currentRating: 3 },
  { filmKey: "aardvark::1993", name: "Aardvark", year: 1993, loggedRating: 2, currentRating: 4 },
  { filmKey: "gamma::1994", name: "Gamma", year: 1994, loggedRating: 2.5, currentRating: 4.5 },
  { filmKey: "delta::1995", name: "Delta", year: 1995, loggedRating: 2, currentRating: 3 },
  { filmKey: "zeta::1996", name: "Zeta", year: 1996, loggedRating: 3, currentRating: 3 },
]);

assertThat(drift.summary.comparableFilms.value === 7, "manual drift dataset should count comparable films");
assertThat(drift.summary.unchanged.value === 1, "manual drift dataset should count unchanged films");
assertThat(drift.summary.changed.value === 6, "manual drift dataset should count changed films");
assertThat(drift.summary.upgraded.value === 3, "manual drift dataset should count upgraded films");
assertThat(drift.summary.downgraded.value === 3, "manual drift dataset should count downgraded films");
assertThat(drift.summary.meanDelta.value === 0, "manual drift dataset should compute mean delta across comparable films");
assertThat(drift.lists.biggestDowngrade.map((film) => film.name).join("|") === "Aaron|Beta|Alpha", "biggest downgrade sort should be stable");
assertThat(drift.lists.biggestUpgrade.map((film) => film.name).join("|") === "Aardvark|Gamma|Delta", "biggest upgrade sort should be stable");
assertThat(drift.lists.largestAbsoluteChange.map((film) => film.name).join("|") === "Aardvark|Aaron|Beta|Gamma|Alpha|Delta", "largest absolute change sort should fall back to film name");

console.log("Synthetic data-layer tests passed.");
