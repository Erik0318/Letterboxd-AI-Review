import React from "react";
import {
  ANALYSIS_SCOPE_BASIS_LABELS,
  AnalysisScope,
  ScopeFilterChip,
} from "../lib/stats";
import { formatInt } from "../lib/utils";

const BASIS_OPTIONS = [
  "globalDefault",
  "watchedFilms",
  "currentRatedFilms",
  "loggedRatedFilms",
  "reviewedFilms",
  "exactDatedWatchedFilms",
  "comparableDriftFilms",
  "changedDriftFilms",
  "upgradedDriftFilms",
  "downgradedDriftFilms",
] as const;

function parseNullableNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ScopeBar({
  className,
  scope,
  isActive,
  chips,
  basisFilms,
  matchingFilms,
  summary,
  yearSpan,
  availableDecades,
  ratingOptions,
  onChange,
  onReset,
  onOpenExplorer,
  onExport,
  onCopySummary,
}: {
  className?: string;
  scope: AnalysisScope;
  isActive: boolean;
  chips: ScopeFilterChip[];
  basisFilms: number;
  matchingFilms: number;
  summary: string;
  yearSpan: { min: number | null; max: number | null };
  availableDecades: string[];
  ratingOptions: number[];
  onChange: (scope: AnalysisScope) => void;
  onReset: () => void;
  onOpenExplorer: () => void;
  onExport: () => void;
  onCopySummary: () => void;
}) {
  function update(patch: Partial<AnalysisScope>) {
    onChange({ ...scope, ...patch });
  }

  return (
    <div className={`card${className ? ` ${className}` : ""}`}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2>Analysis scope</h2>
          <div className="small">
            Filter the current export into a reusable scoped view. Scope-aware modules update together and stay film-level unless a panel explicitly says rows.
          </div>
        </div>
        <div className="row">
          <button className="btn primary" type="button" onClick={onOpenExplorer}>Open scoped explorer</button>
          <button className="btn" type="button" onClick={onExport}>Export scoped films CSV</button>
          <button className="btn" type="button" onClick={onCopySummary}>Copy current view summary</button>
          <button className="btn danger" type="button" onClick={onReset}>Reset scope</button>
        </div>
      </div>

      <div className="scopeGrid">
        <label>
          <div className="small">Universe / basis</div>
          <select value={scope.basis} onChange={(event) => update({ basis: event.target.value as AnalysisScope["basis"] })}>
            {BASIS_OPTIONS.map((basis) => (
              <option value={basis} key={basis}>{ANALYSIS_SCOPE_BASIS_LABELS[basis]}</option>
            ))}
          </select>
        </label>

        <label>
          <div className="small">Release decade</div>
          <select value={scope.releaseDecade || ""} onChange={(event) => update({ releaseDecade: event.target.value || null })}>
            <option value="">Any</option>
            {availableDecades.map((decade) => (
              <option value={decade} key={decade}>{decade}</option>
            ))}
          </select>
        </label>

        <label>
          <div className="small">Release year min</div>
          <input
            value={scope.releaseYearMin ?? ""}
            placeholder={yearSpan.min === null ? "n/a" : String(yearSpan.min)}
            onChange={(event) => update({ releaseYearMin: parseNullableNumber(event.target.value) })}
          />
        </label>

        <label>
          <div className="small">Release year max</div>
          <input
            value={scope.releaseYearMax ?? ""}
            placeholder={yearSpan.max === null ? "n/a" : String(yearSpan.max)}
            onChange={(event) => update({ releaseYearMax: parseNullableNumber(event.target.value) })}
          />
        </label>

        <label>
          <div className="small">Current rating min</div>
          <select value={scope.currentRatingMin ?? ""} onChange={(event) => update({ currentRatingMin: parseNullableNumber(event.target.value) })}>
            <option value="">Any</option>
            {ratingOptions.map((rating) => (
              <option value={rating} key={`current-min-${rating}`}>{rating}</option>
            ))}
          </select>
        </label>

        <label>
          <div className="small">Current rating max</div>
          <select value={scope.currentRatingMax ?? ""} onChange={(event) => update({ currentRatingMax: parseNullableNumber(event.target.value) })}>
            <option value="">Any</option>
            {ratingOptions.map((rating) => (
              <option value={rating} key={`current-max-${rating}`}>{rating}</option>
            ))}
          </select>
        </label>

        <label>
          <div className="small">Logged rating min</div>
          <select value={scope.loggedRatingMin ?? ""} onChange={(event) => update({ loggedRatingMin: parseNullableNumber(event.target.value) })}>
            <option value="">Any</option>
            {ratingOptions.map((rating) => (
              <option value={rating} key={`logged-min-${rating}`}>{rating}</option>
            ))}
          </select>
        </label>

        <label>
          <div className="small">Logged rating max</div>
          <select value={scope.loggedRatingMax ?? ""} onChange={(event) => update({ loggedRatingMax: parseNullableNumber(event.target.value) })}>
            <option value="">Any</option>
            {ratingOptions.map((rating) => (
              <option value={rating} key={`logged-max-${rating}`}>{rating}</option>
            ))}
          </select>
        </label>

        <label>
          <div className="small">Review presence</div>
          <select value={scope.reviewPresence} onChange={(event) => update({ reviewPresence: event.target.value as AnalysisScope["reviewPresence"] })}>
            <option value="all">All</option>
            <option value="hasReview">Has review</option>
            <option value="noReview">No review</option>
          </select>
        </label>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <span className="badge">{isActive ? "Scoped view" : "Global default view"}</span>
        <span className="badge">Basis films: {formatInt(basisFilms)}</span>
        <span className="badge">Matching films: {formatInt(matchingFilms)}</span>
        <span className="badge">Active filters: {formatInt(chips.length)}</span>
      </div>

      <div className="small" style={{ marginTop: 10 }}>
        {summary}
      </div>

      {chips.length > 0 && (
        <div className="row" style={{ marginTop: 10 }}>
          {chips.map((chip) => (
            <span className="badge" key={`${chip.key}:${chip.value}`}>{chip.label}: {chip.value}</span>
          ))}
        </div>
      )}
    </div>
  );
}
