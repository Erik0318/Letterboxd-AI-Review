import React from "react";
import { StatPack } from "../lib/stats";
import { clamp, formatInt, formatPct } from "../lib/utils";

export default function ReviewStatsPanel({
  reviews,
  title = "Reviews",
  subtitle,
  onLongestReviewClick,
}: {
  reviews: StatPack["reviews"];
  title?: string;
  subtitle?: string;
  onLongestReviewClick?: (row: StatPack["reviews"]["longestReviews"][number], sourceElement: HTMLElement | null) => void;
}) {
  const maxBucket = Math.max(1, ...reviews.lengthBuckets.map((bucket) => bucket.count));

  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="small">
        {subtitle || <>Review rows and reviewed films stay separate. Length stats use rows with actual review text.</>}
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <span className="badge">Review rows: {formatInt(reviews.summary.reviewRows.value)}</span>
        <span className="badge">Rows with text: {formatInt(reviews.summary.reviewTextRows.value)}</span>
        <span className="badge">Reviewed films: {formatInt(reviews.summary.reviewedFilms.value)}</span>
        <span className="badge">{reviews.summary.reviewRate.label}: {formatPct(reviews.summary.reviewRate.value)}</span>
        <span className="badge">Average length: {reviews.summary.averageReviewLength.value === null ? "n/a" : formatInt(Math.round(reviews.summary.averageReviewLength.value))}</span>
        <span className="badge">Median length: {reviews.summary.medianReviewLength.value === null ? "n/a" : formatInt(Math.round(reviews.summary.medianReviewLength.value))}</span>
        <span className="badge">Longest piece: {formatInt(reviews.summary.longestReviewLength.value)}</span>
      </div>

      <div className="moduleSplit">
        <div>
          <div className="small" style={{ marginTop: 12 }}>Length bands</div>
          {reviews.lengthBuckets.every((bucket) => bucket.count === 0) ? (
            <p>No review text yet.</p>
          ) : (
            <div style={{ marginTop: 6 }}>
              {reviews.lengthBuckets.map((bucket) => {
                const pct = clamp((bucket.count / maxBucket) * 100, 0, 100);
                return (
                  <div key={bucket.bucket} className="barRow">
                    <div className="small">{bucket.bucket}</div>
                    <div className="bar"><div style={{ width: `${pct}%` }} /></div>
                    <div className="small" style={{ textAlign: "right" }}>{formatInt(bucket.count)}</div>
                  </div>
                );
              })}
            </div>
          )}

          {reviews.topWords.length > 0 && (
            <>
              <div className="small" style={{ marginTop: 12 }}>Top words</div>
              <div className="row" style={{ marginTop: 8 }}>
                {reviews.topWords.map((word) => (
                  <span className="badge" key={word.word}>
                    {word.word}: {formatInt(word.count)}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <div className="small" style={{ marginTop: 12 }}>Longest pieces</div>
          {reviews.longestReviews.length === 0 ? (
            <p>No review text yet.</p>
          ) : (
            <div className="dataTableWrap">
              <div className="dataTable">
                <div className="dataTableHead dataTableReviews">
                  <div>Film</div>
                  <div>Year</div>
                  <div>Length</div>
                </div>
                {reviews.longestReviews.slice(0, 10).map((row) => (
                  <button
                    type="button"
                    className={`dataTableRow dataTableReviews${onLongestReviewClick ? " dataTableRowButton" : ""}`}
                    key={row.id}
                    onClick={(event) => onLongestReviewClick?.(row, event.currentTarget)}
                    disabled={!onLongestReviewClick}
                  >
                    <div className="dataEllipsis">{row.name}</div>
                    <div>{row.year === null ? "n/a" : String(row.year)}</div>
                    <div>{formatInt(row.length)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
