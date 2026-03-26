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
      title: "Dates",
      description: "Exact watched dates control the default watch timeline, heatmap, and streak modules.",
      items: [
        {
          id: "exact_dated_coverage",
          label: "Exact-dated watched films",
          valueLabel: ratioLabel(
            summary.dateQualitySummary.exactDatedWatchedFilms,
            summary.coverageSummary.watchedUniverseFilmCount,
          ),
          basis: "watched films that have at least one exact watched date from diary/reviews",
          whatThisAffects: "Affects timeline, heatmap, busiest-month summaries, and streak reliability.",
          jumpTarget: "section-watched-activity",
          jumpLabel: "Watch activity",
        },
        {
          id: "without_exact_date",
          label: "Watched films without exact date",
          valueLabel: formatInt(summary.dateQualitySummary.watchedFilmsWithoutExactDate),
          basis: "watched films that stay out of default watched-time UI because no exact date is present",
          whatThisAffects: "These are excluded from default watch-time charts until an exact diary/review date exists.",
          jumpTarget: "section-watched-activity",
          jumpLabel: "Watch activity",
        },
        {
          id: "watched_rows_beyond_unique_films",
          label: "Watched rows beyond unique films",
          valueLabel: formatInt(Math.max(
            0,
            (summary.tableRowCounts["watched.csv"] || 0) - (summary.tableUniqueFilmCounts["watched.csv"] || 0),
          )),
          basis: "extra watched.csv rows beyond unique watched films",
          whatThisAffects: "Useful for understanding why row-level watch counts can exceed film-level watched counts.",
          jumpTarget: "section-overview",
          jumpLabel: "Overview",
        },
      ],
    },
    {
      id: "ratings",
      title: "Ratings",
      description: "Current vs logged comparisons only work where the export contains both rating layers.",
      items: [
        {
          id: "comparable_drift_coverage",
          label: "Comparable drift films",
          valueLabel: ratioLabel(summary.ratingSourceSummary.both, ratingUniverse),
          basis: "films that have both currentRating and loggedRating",
          whatThisAffects: "Affects drift coverage and how much of the library can be compared across rating layers.",
          jumpTarget: "section-ratings",
          jumpLabel: "Ratings",
        },
        {
          id: "current_only_rated_films",
          label: "Current-only rated films",
          valueLabel: formatInt(summary.ratingSourceSummary.currentOnly),
          basis: "films with currentRating but no loggedRating",
          whatThisAffects: "These appear in current-rating views, but not in comparable drift analysis.",
          jumpTarget: "section-ratings",
          jumpLabel: "Ratings",
        },
        {
          id: "logged_only_rated_films",
          label: "Logged-only rated films",
          valueLabel: formatInt(summary.ratingSourceSummary.loggedOnly),
          basis: "films with loggedRating but no currentRating",
          whatThisAffects: "These preserve historical log ratings, but they reduce overlap with current-rating comparisons.",
          jumpTarget: "section-ratings",
          jumpLabel: "Ratings",
        },
        {
          id: "rating_rows_beyond_unique_films",
          label: "Rating rows beyond unique films",
          valueLabel: formatInt(Math.max(
            0,
            (summary.tableRowCounts["ratings.csv"] || 0) - (summary.tableUniqueFilmCounts["ratings.csv"] || 0),
          )),
          basis: "extra ratings.csv rows beyond unique rated films",
          whatThisAffects: "Helpful when checking how row-level ratings activity differs from film-level rating coverage.",
          jumpTarget: "section-ratings",
          jumpLabel: "Ratings",
        },
      ],
    },
    {
      id: "reviews",
      title: "Reviews",
      description: "Review summaries become more representative as more review rows contain actual text.",
      items: [
        {
          id: "review_text_coverage",
          label: "Review text rows",
          valueLabel: ratioLabel(reviewTextRows, reviewRows),
          basis: "review rows with non-empty text compared with all review rows",
          whatThisAffects: "Affects top-word summaries, longest-review lists, and text-based review exploration.",
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
          whatThisAffects: "Affects reviewed-film coverage and how much of the watched universe can support review-based exploration.",
          jumpTarget: "section-reviews",
          jumpLabel: "Reviews",
        },
        {
          id: "review_rows_beyond_unique_films",
          label: "Review rows beyond unique films",
          valueLabel: formatInt(Math.max(
            0,
            (summary.tableRowCounts["reviews.csv"] || 0) - (summary.tableUniqueFilmCounts["reviews.csv"] || 0),
          )),
          basis: "extra reviews.csv rows beyond unique reviewed films",
          whatThisAffects: "Useful for understanding why row-based review counts can exceed reviewed-film counts.",
          jumpTarget: "section-reviews",
          jumpLabel: "Reviews",
        },
      ],
    },
    {
      id: "optionalTables",
      title: "Optional tables",
      description: "Optional export areas add backlog, lists, archive, comment, and like context when present.",
      items: [
        {
          id: "watchlist_add_date_coverage",
          label: "Watchlist films with add date",
          valueLabel: ratioLabel(watchlistFilmsWithAddDate, watchlistFilmCount),
          basis: "unique watchlist films that have at least one add date in watchlist.csv",
          whatThisAffects: "Affects watchlist timeline reliability and backlog activity summaries.",
          jumpTarget: "section-watchlist",
          jumpLabel: "Watchlist / backlog",
        },
        {
          id: "lists_and_archives",
          label: "Parsed lists / archives",
          valueLabel: `${formatInt(summary.listSummary.activeListCount)} active lists, ${formatInt(summary.listSummary.archivedListCount)} archived lists`,
          basis: "parsed lists/*.csv plus archived deleted/orphaned list exports",
          whatThisAffects: "Affects archive visibility, list inventory, and list-based context in the report.",
          jumpTarget: "section-archives",
          jumpLabel: "Archives / lists",
        },
        {
          id: "comments_and_likes",
          label: "Comment and like rows",
          valueLabel: `${formatInt(summary.tableRowCounts["comments.csv"] || 0)} comments, ${formatInt(summary.archiveSummary.likes.filmRows + summary.archiveSummary.likes.reviewRows + summary.archiveSummary.likes.listRows)} likes`,
          basis: "root comments.csv plus likes/* exports when present",
          whatThisAffects: "Adds archive context, but missing rows here do not affect core watched/rating semantics.",
          jumpTarget: "section-archives",
          jumpLabel: "Archives / lists",
        },
      ],
    },
    {
      id: "importArtifacts",
      title: "Import / log artifacts",
      description: "Import-log patterns describe watched.csv logging behaviour, not exact watch activity.",
      items: [
        {
          id: "top_import_day",
          label: "Top import/log day",
          valueLabel: summary.importSpikeSummary.largestSingleDayImportDate
            ? `${summary.importSpikeSummary.largestSingleDayImportDate} (${formatInt(summary.importSpikeSummary.largestSingleDayImportCount)})`
            : "n/a",
          basis: "largest single-day count from watched.csv Date values",
          whatThisAffects: "Useful when interpreting import bursts separately from exact watched-date activity.",
          jumpTarget: "section-data-quality",
          jumpLabel: "Data quality",
        },
        {
          id: "import_spike_detected",
          label: "Import spike detected",
          valueLabel: summary.importSpikeSummary.importSpikeDetected ? "Yes" : "No",
          basis: "heuristic flag derived from watched.csv import/log dates",
          whatThisAffects: "A reminder that watched.csv spikes are import/log artifacts and should not be read as exact watch streaks.",
          jumpTarget: "section-data-quality",
          jumpLabel: "Data quality",
        },
      ],
    },
  ];
}
