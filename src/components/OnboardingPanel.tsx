import React from "react";

type HelpState = "expanded" | "collapsed" | "dismissed";

const CONCEPTS = [
  {
    label: "Watched films",
    text: "Unique films in the watched set. This stays film-level unless a panel says rows or events.",
  },
  {
    label: "Watched rows",
    text: "Raw watched.csv rows. They can run higher than watched films when a title appears more than once.",
  },
  {
    label: "Current rating",
    text: "The rating sitting in ratings.csv right now.",
  },
  {
    label: "Logged rating",
    text: "The rating captured on the diary or review row when the watch was logged.",
  },
  {
    label: "Exact watched date",
    text: "A diary or review watch date solid enough for the timeline, heatmap, and streaks.",
  },
  {
    label: "Watched films without exact date",
    text: "They still count as watched films, but they stay out of the default timeline because no exact date is present.",
  },
  {
    label: "Watchlist activity",
    text: "A separate backlog dataset from watchlist.csv. It does not change watched totals.",
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
            <h2>Read this once</h2>
            <div className="small">
              Short notes on films vs rows, rating layers, exact watch dates, and the separate watchlist.
            </div>
          </div>
          <div className="row">
            <button className="btn primary" type="button" onClick={onExpand}>Open notes</button>
            <button className="btn" type="button" onClick={onDismiss}>Hide</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card${className ? ` ${className}` : ""}`}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2>How the report reads your export</h2>
          <div className="small">
            Film totals, row counts, exact watch dates, and watchlist backlog all stay separate. Keep this close if you need a quick reminder.
          </div>
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={onCollapse}>Fold</button>
          <button className="btn" type="button" onClick={onDismiss}>Hide</button>
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
