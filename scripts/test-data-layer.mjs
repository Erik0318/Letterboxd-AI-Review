import { computeStats } from "../.verify/stats.js";
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
assertThat(stats.overview.currentRatedFilms.value === merged.summary.ratingSourceSummary.filmsWithCurrentRating, "current rated overview should match dataset summary");
assertThat(stats.quickFacts.loggedRatedFilms.value === merged.summary.ratingSourceSummary.filmsWithLoggedRating, "logged rated quick fact should match dataset summary");
assertThat(stats.quickFacts.reviewRows.value === merged.summary.tableRowCounts["reviews.csv"], "review rows quick fact should match dataset summary");
assertThat(stats.overview.watchEntries.value === stats.overview.watchEntries.exactEntries + stats.overview.watchEntries.estimatedEntries, "watch entry totals should split into exact + estimated");
assertThat(stats.overview.watchEntries.exactEntries === merged.summary.dateQualitySummary.exactWatchEvents, "exact watch entries should match dataset summary");
assertThat(stats.overview.watchEntries.estimatedEntries === merged.summary.dateQualitySummary.estimatedFallbackRows, "estimated watch entries should match dataset summary");
assertThat(merged.summary.tableUniqueFilmCounts["watched.csv"] === 2, "dataset summary should distinguish watched unique films");
assertThat(merged.summary.archiveSummary.deleted.diaryRows === 1, "deleted rows should flow into archive summary");
assertThat(merged.summary.archiveSummary.likes.reviewRows === 1, "likes rows should flow into archive summary");
assertThat(merged.summary.listSummary.activeListCount === 1 && merged.summary.listSummary.activeListItemCount === 2, "list summaries should include parsed active lists");
assertThat(merged.summary.overlapSummary.watchlistOnly === 1, "overlap summary should track watchlist-only films");
assertThat(merged.summary.ratingSourceSummary.changed === 1, "rating source summary should surface current vs logged changes");
assertThat(onlyWatched.exactWatchedDate === null && onlyWatched.estimatedWatchedDate === "2024-02-10", "estimated-only watched dates should remain distinct");

console.log("Synthetic data-layer tests passed.");
