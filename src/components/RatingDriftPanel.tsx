import React from "react";
import {
  RatingDriftCase,
  RatingDriftSortKey,
  StatPack,
} from "../lib/stats";
import { formatInt, round1, round3 } from "../lib/utils";

function formatRating(value: number): string {
  return String(round1(value));
}

function formatDelta(value: number): string {
  const rounded = round1(value);
  if (rounded > 0) {
    return `+${rounded}`;
  }
  return String(rounded);
}

function formatMeanDelta(value: number | null): string {
  if (value === null) {
    return "n/a";
  }
  const rounded = round3(value);
  if (rounded > 0) {
    return `+${rounded}`;
  }
  return String(rounded);
}

function deltaClassName(item: RatingDriftCase): string {
  if (item.delta > 0) {
    return "driftDelta driftUp";
  }
  if (item.delta < 0) {
    return "driftDelta driftDown";
  }
  return "driftDelta driftFlat";
}

const SORT_LABELS: Record<RatingDriftSortKey, string> = {
  biggestDowngrade: "Biggest downgrade",
  biggestUpgrade: "Biggest upgrade",
  largestAbsoluteChange: "Largest absolute change",
};

const EMPTY_MESSAGES: Record<RatingDriftSortKey, string> = {
  biggestDowngrade: "No downgraded films in the comparable set.",
  biggestUpgrade: "No upgraded films in the comparable set.",
  largestAbsoluteChange: "No changed films in the comparable set.",
};

export default function RatingDriftPanel({
  drift,
  sort,
  onSortChange,
  maxItems = 10,
  title = "Rating Drift",
  subtitle,
  onCategoryClick,
  onCaseClick,
}: {
  drift: StatPack["ratingDrift"];
  sort: RatingDriftSortKey;
  onSortChange: (sort: RatingDriftSortKey) => void;
  maxItems?: number;
  title?: string;
  subtitle?: string;
  onCategoryClick?: (category: "comparableFilms" | "unchanged" | "changed" | "upgraded" | "downgraded", sourceElement: HTMLElement | null) => void;
  onCaseClick?: (item: RatingDriftCase, sourceElement: HTMLElement | null) => void;
}) {
  const items = drift.lists[sort].slice(0, maxItems);
  const meanDelta = formatMeanDelta(drift.summary.meanDelta.value);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2>{title}</h2>
          <div className="small">
            {subtitle || <>Logged rating and current rating stay separate. Delta is <code>currentRating - loggedRating</code>.</>}
          </div>
        </div>
        <div>
          <div className="small">Order the sample films</div>
          <select value={sort} onChange={(event) => onSortChange(event.target.value as RatingDriftSortKey)}>
            <option value="biggestDowngrade">{SORT_LABELS.biggestDowngrade}</option>
            <option value="biggestUpgrade">{SORT_LABELS.biggestUpgrade}</option>
            <option value="largestAbsoluteChange">{SORT_LABELS.largestAbsoluteChange}</option>
          </select>
        </div>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <button type="button" className={`badgeButton${onCategoryClick ? " isInteractive" : ""}`} onClick={(event) => onCategoryClick?.("comparableFilms", event.currentTarget)} disabled={!onCategoryClick}>Comparable: {formatInt(drift.summary.comparableFilms.value)}</button>
        <button type="button" className={`badgeButton${onCategoryClick ? " isInteractive" : ""}`} onClick={(event) => onCategoryClick?.("unchanged", event.currentTarget)} disabled={!onCategoryClick}>Unchanged: {formatInt(drift.summary.unchanged.value)}</button>
        <button type="button" className={`badgeButton${onCategoryClick ? " isInteractive" : ""}`} onClick={(event) => onCategoryClick?.("changed", event.currentTarget)} disabled={!onCategoryClick}>Changed: {formatInt(drift.summary.changed.value)}</button>
        <button type="button" className={`badgeButton${onCategoryClick ? " isInteractive" : ""}`} onClick={(event) => onCategoryClick?.("upgraded", event.currentTarget)} disabled={!onCategoryClick}>Raised: {formatInt(drift.summary.upgraded.value)}</button>
        <button type="button" className={`badgeButton${onCategoryClick ? " isInteractive" : ""}`} onClick={(event) => onCategoryClick?.("downgraded", event.currentTarget)} disabled={!onCategoryClick}>Lowered: {formatInt(drift.summary.downgraded.value)}</button>
        <span className="badge">Mean delta: {meanDelta}</span>
      </div>

      <div className="small" style={{ marginTop: 10 }}>
        Sample films for {SORT_LABELS[sort].toLowerCase()}.
      </div>

      {items.length === 0 ? (
        <p>{EMPTY_MESSAGES[sort]}</p>
      ) : (
        <div className="driftTableWrap">
          <div className="driftTable">
            <div className="driftHead">
              <div>Film</div>
              <div>Year</div>
              <div>Logged rating</div>
              <div>Current rating</div>
              <div>Delta</div>
            </div>
            {items.map((item) => (
                <button
                  type="button"
                  className={`driftRow${onCaseClick ? " dataTableRowButton" : ""}`}
                  key={`${sort}:${item.filmKey}`}
                  onClick={(event) => onCaseClick?.(item, event.currentTarget)}
                  disabled={!onCaseClick}
                >
                <div className="driftFilm">
                  <div className="driftFilmTitle">{item.name}</div>
                </div>
                <div className="small">{item.year === null ? "n/a" : String(item.year)}</div>
                <div>{formatRating(item.loggedRating)}</div>
                <div>{formatRating(item.currentRating)}</div>
                <div className={deltaClassName(item)}>{formatDelta(item.delta)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
