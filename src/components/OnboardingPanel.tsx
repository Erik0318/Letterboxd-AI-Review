import React from "react";

type HelpState = "expanded" | "collapsed" | "dismissed";

const CONCEPTS = [
  {
    label: "Watched films",
    text: "Unique films in your watched universe. This stays film-level unless a panel explicitly says rows or events.",
  },
  {
    label: "Watched rows",
    text: "Raw watched.csv rows. These can be higher than watched films when the same film appears more than once.",
  },
  {
    label: "Current rating",
    text: "Your current ratings.csv snapshot for a film right now.",
  },
  {
    label: "Logged rating",
    text: "The rating recorded on the diary/review entry when that watch was logged.",
  },
  {
    label: "Exact watched date",
    text: "A diary/review watched date that can safely power timelines, heatmaps, and streaks.",
  },
  {
    label: "Watched films without exact date",
    text: "Watched films that still count as watched, but stay out of default watched-time charts because no exact date is present.",
  },
  {
    label: "Watchlist activity",
    text: "A separate backlog dataset from watchlist.csv. Watchlist add activity does not change watched totals.",
  },
];

export default function OnboardingPanel({
  className,
  state,
  onExpand,
  onCollapse,
  onDismiss,
}: {
  className?: string;
  state: HelpState;
  onExpand: () => void;
  onCollapse: () => void;
  onDismiss: () => void;
}) {
  if (state === "dismissed") {
    return null;
  }

  if (state === "collapsed") {
    return (
      <div className={`card${className ? ` ${className}` : ""}`}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2>How to read this report</h2>
            <div className="small">
              Short explainers for watched films vs rows, rating layers, exact watched dates, and separate watchlist activity.
            </div>
          </div>
          <div className="row">
            <button className="btn primary" type="button" onClick={onExpand}>Expand help</button>
            <button className="btn" type="button" onClick={onDismiss}>Dismiss</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card${className ? ` ${className}` : ""}`}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2>How this report reads your export</h2>
          <div className="small">
            The dashboard keeps film-level totals, row-level counts, exact-date activity, and separate watchlist backlog behavior distinct. Open only the pieces you need.
          </div>
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={onCollapse}>Collapse</button>
          <button className="btn" type="button" onClick={onDismiss}>Dismiss</button>
        </div>
      </div>

      <div className="onboardingGrid">
        {CONCEPTS.map((concept) => (
          <div className="onboardingItem" key={concept.label}>
            <div className="onboardingLabel">{concept.label}</div>
            <div className="small">{concept.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
