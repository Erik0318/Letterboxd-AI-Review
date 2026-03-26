import { DatasetSummary, FilmRecord } from "./letterboxd";
import { formatInt, formatPct } from "./utils";

export type DataQualitySectionItem = {
  id: string;
  label: string;
  valueLabel: string;
  basis: string;
  whatThisAffects: string;
  jumpTarget: string | null;
  jumpLabel: string | null;
};

export type DataQualitySection = {
  id: "dates" | "ratings" | "reviews" | "optionalTables" | "importArtifacts";
  title: string;
  description: string;
  items: DataQualitySectionItem[];
};

function ratioLabel(covered: number, total: number): string {
  if (!total) {
    return `${formatInt(covered)} / ${formatInt(total)}`;
  }
  return `${formatInt(covered)} / ${formatInt(total)} (${formatPct(covered / total)})`;
}

export function buildGroupedDataQuality(
  films: FilmRecord[],
  summary: DatasetSummary,
): DataQualitySection[] {
  const reviewTextRows = films.reduce((count, film) => count + film.reviewTexts.length, 0);
  const reviewRows = summary.tableRowCounts["reviews.csv"] || 0;
  const ratingUniverse = summary.ratingSourceSummary.both
    + summary.ratingSourceSummary.currentOnly
    + summary.ratingSourceSummary.loggedOnly;
  const watchlistFilmsWithAddDate = films.filter((film) => film.inWatchlist && film.watchlistAddedDates.length > 0).length;
  const watchlistFilmCount = summary.coverageSummary.watchlistFilmCount;

  return [
    {
      id: "dates",
      title: "Watch Dates",
      description: "Exact watch dates drive the timeline, heatmap, and streaks.",
      items: [
        {
          id: "exact_dated_coverage",
          label: "Films with exact watch dates",
          valueLabel: ratioLabel(
            summary.dateQualitySummary.exactDatedWatchedFilms,
            summary.coverageSummary.watchedUniverseFilmCount,
          ),
          basis: "watched films with at least one exact diary or review watch date",
          whatThisAffects: "Shows up in the timeline, heatmap, busiest months, and streaks.",
          jumpTarget: "section-watched-activity",
          jumpLabel: "Watched Activity",
        },
        {
          id: "without_exact_date",
          label: "Films missing exact watch dates",
          valueLabel: formatInt(summary.dateQualitySummary.watchedFilmsWithoutExactDate),
          basis: "watched films left out of default watch-time surfaces because no exact date is present",
          whatThisAffects: "Missing watch dates affect streaks, the heatmap, and the timeline.",
          jumpTarget: "section-watched-activity",
          jumpLabel: "Watched Activity",
        },
        {
          id: "watched_rows_beyond_unique_films",
          label: "Extra watched rows",
          valueLabel: formatInt(Math.max(
            0,
            (summary.tableRowCounts["watched.csv"] || 0) - (summary.tableUniqueFilmCounts["watched.csv"] || 0),
          )),
          basis: "extra watched.csv rows beyond unique watched films",
          whatThisAffects: "Useful when row counts run higher than film counts.",
          jumpTarget: "section-overview",
          jumpLabel: "Overview",
        },
      ],
    },
    {
      id: "ratings",
      title: "Ratings",
      description: "Current vs logged comparisons only work where both rating layers exist.",
      items: [
        {
          id: "comparable_drift_coverage",
          label: "Comparable films",
          valueLabel: ratioLabel(summary.ratingSourceSummary.both, ratingUniverse),
          basis: "films that have both currentRating and loggedRating",
          whatThisAffects: "This is the part of the library that can take part in drift.",
          jumpTarget: "section-ratings",
          jumpLabel: "Ratings",
        },
        {
          id: "current_only_rated_films",
          label: "Current-only ratings",
          valueLabel: formatInt(summary.ratingSourceSummary.currentOnly),
          basis: "films with currentRating but no loggedRating",
          whatThisAffects: "These show up in current-rating views, but not in drift.",
          jumpTarget: "section-ratings",
          jumpLabel: "Ratings",
        },
        {
          id: "logged_only_rated_films",
          label: "Logged-only ratings",
          valueLabel: formatInt(summary.ratingSourceSummary.loggedOnly),
          basis: "films with loggedRating but no currentRating",
          whatThisAffects: "These keep the older log rating, but they do not overlap with the current snapshot.",
          jumpTarget: "section-ratings",
          jumpLabel: "Ratings",
        },
        {
          id: "rating_rows_beyond_unique_films",
          label: "Extra rating rows",
          valueLabel: formatInt(Math.max(
            0,
            (summary.tableRowCounts["ratings.csv"] || 0) - (summary.tableUniqueFilmCounts["ratings.csv"] || 0),
          )),
          basis: "extra ratings.csv rows beyond unique rated films",
          whatThisAffects: "Useful when row activity runs higher than film coverage.",
          jumpTarget: "section-ratings",
          jumpLabel: "Ratings",
        },
      ],
    },
    {
      id: "reviews",
      title: "Reviews",
      description: "Review summaries get sharper as more rows contain actual text.",
      items: [
        {
          id: "review_text_coverage",
          label: "Rows with review text",
          valueLabel: ratioLabel(reviewTextRows, reviewRows),
          basis: "review rows with non-empty text compared with all review rows",
          whatThisAffects: "Shows up in top words, longest reviews, and text-based detail views.",
          jumpTarget: "section-reviews",
          jumpLabel: "Reviews",
        },
        {
          id: "reviewed_films",
          label: "Reviewed films",
          valueLabel: ratioLabel(
            summary.coverageSummary.reviewFilmCount,
            summary.coverageSummary.watchedUniverseFilmCount,
          ),
          basis: "unique watched films that have at least one review row",
          whatThisAffects: "This sets review coverage across the watched library.",
          jumpTarget: "section-reviews",
          jumpLabel: "Reviews",
        },
        {
          id: "review_rows_beyond_unique_films",
          label: "Extra review rows",
          valueLabel: formatInt(Math.max(
            0,
            (summary.tableRowCounts["reviews.csv"] || 0) - (summary.tableUniqueFilmCounts["reviews.csv"] || 0),
          )),
          basis: "extra reviews.csv rows beyond unique reviewed films",
          whatThisAffects: "Useful when row totals run higher than reviewed-film counts.",
          jumpTarget: "section-reviews",
          jumpLabel: "Reviews",
        },
      ],
    },
    {
      id: "optionalTables",
      title: "Extras",
      description: "Optional files add watchlist, list, archive, comment, and like context when they are present.",
      items: [
        {
          id: "watchlist_add_date_coverage",
          label: "Watchlist films with add dates",
          valueLabel: ratioLabel(watchlistFilmsWithAddDate, watchlistFilmCount),
          basis: "unique watchlist films that have at least one add date in watchlist.csv",
          whatThisAffects: "This shapes the watchlist timeline and backlog activity notes.",
          jumpTarget: "section-watchlist",
          jumpLabel: "Watchlist",
        },
        {
          id: "lists_and_archives",
          label: "Lists and archive files",
          valueLabel: `${formatInt(summary.listSummary.activeListCount)} active lists, ${formatInt(summary.listSummary.archivedListCount)} archived lists`,
          basis: "parsed lists/*.csv plus archived deleted/orphaned list exports",
          whatThisAffects: "This adds list inventory and archive context.",
          jumpTarget: "section-archives",
          jumpLabel: "Archives",
        },
        {
          id: "comments_and_likes",
          label: "Comments and likes",
          valueLabel: `${formatInt(summary.tableRowCounts["comments.csv"] || 0)} comments, ${formatInt(summary.archiveSummary.likes.filmRows + summary.archiveSummary.likes.reviewRows + summary.archiveSummary.likes.listRows)} likes`,
          basis: "root comments.csv plus likes/* exports when present",
          whatThisAffects: "Adds side context only; missing rows here do not affect the core watched or rating totals.",
          jumpTarget: "section-archives",
          jumpLabel: "Archives",
        },
      ],
    },
    {
      id: "importArtifacts",
      title: "Import Notes",
      description: "watched.csv log patterns can describe imports, not real watch activity.",
      items: [
        {
          id: "top_import_day",
          label: "Largest import day",
          valueLabel: summary.importSpikeSummary.largestSingleDayImportDate
            ? `${summary.importSpikeSummary.largestSingleDayImportDate} (${formatInt(summary.importSpikeSummary.largestSingleDayImportCount)})`
            : "n/a",
          basis: "largest single-day count from watched.csv Date values",
          whatThisAffects: "Useful when import bursts might be mistaken for real watch activity.",
          jumpTarget: "section-data-quality",
          jumpLabel: "Data Quality",
        },
        {
          id: "import_spike_detected",
          label: "Import spike detected",
          valueLabel: summary.importSpikeSummary.importSpikeDetected ? "Yes" : "No",
          basis: "heuristic flag derived from watched.csv import/log dates",
          whatThisAffects: "A reminder that watched.csv spikes are not the same thing as exact watch streaks.",
          jumpTarget: "section-data-quality",
          jumpLabel: "Data Quality",
        },
      ],
    },
  ];
}
