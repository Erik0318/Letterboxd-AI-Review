import React from "react";
import { ExactWatchActivity, ExactWatchGap, ExactWatchStreak } from "../lib/watchActivity";
import { formatInt } from "../lib/utils";
import { BarList } from "./BarList";
import { Heatmap } from "./Heatmap";

export default function WatchActivityPanel({
  activity,
  title,
  subtitle,
  onOpenAll,
  onMonthClick,
  onYearClick,
  onDayClick,
  onGapClick,
  onStreakClick,
}: {
  activity: ExactWatchActivity;
  title: string;
  subtitle?: string;
  onOpenAll: () => void;
  onMonthClick: (month: string) => void;
  onYearClick: (year: string) => void;
  onDayClick: (day: string) => void;
  onGapClick: (gap: ExactWatchGap) => void;
  onStreakClick: (streak: ExactWatchStreak) => void;
}) {
  const longestGap = activity.longestGaps[0] || null;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2>{title}</h2>
          <div className="small">
            {subtitle || "Exact-date only. Explorer rows in this section are exact watch events, while film counts stay film-level and are labeled that way."}
          </div>
        </div>
        <button className="btn primary" type="button" onClick={onOpenAll}>Open all exact watch events</button>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <span className="badge">Exact watch events: {formatInt(activity.exactWatchEvents)}</span>
        <span className="badge">Exact-dated watched films: {formatInt(activity.exactDatedWatchedFilms)}</span>
        <span className="badge">Explorer basis: row-level exact watch events</span>
        {activity.busiestDay && (
          <button type="button" className="badgeButton isInteractive" onClick={() => onDayClick(activity.busiestDay!.label)}>
            Busiest day: {activity.busiestDay.label} ({formatInt(activity.busiestDay.count)})
          </button>
        )}
        {activity.bestStreak && (
          <button type="button" className="badgeButton isInteractive" onClick={() => onStreakClick(activity.bestStreak!)}>
            Best streak: {formatInt(activity.bestStreak.days)} days
          </button>
        )}
        {longestGap && (
          <button type="button" className="badgeButton isInteractive" onClick={() => onGapClick(longestGap)}>
            Longest gap: {formatInt(longestGap.gapDays)} days
          </button>
        )}
      </div>

      <div className="watchActivityGrid">
        <div>
          <Heatmap
            byMonth={activity.heatmapByMonth}
            title="Watch activity heatmap"
            subtitle="Click a month to inspect the exact watch events that landed there."
            emptyText="No exact watched dates found in the current view."
            footerText="Exact watched dates only. Films without an exact watched date stay out of this activity module."
            onCellClick={onMonthClick}
          />
        </div>
        <div className="watchActivitySummaryColumn">
          <div className="watchActivityMiniCard">
            <div className="small">Best exact-date streak</div>
            {activity.bestStreak ? (
              <>
                <div className="watchActivityMiniValue">{formatInt(activity.bestStreak.days)} days</div>
                <div className="small">{activity.bestStreak.startDate} to {activity.bestStreak.endDate}</div>
                <div className="small">{formatInt(activity.bestStreak.exactWatchEvents)} events across {formatInt(activity.bestStreak.uniqueFilms)} films</div>
                <button className="btn" type="button" style={{ marginTop: 8 }} onClick={() => onStreakClick(activity.bestStreak!)}>
                  Open streak drilldown
                </button>
              </>
            ) : (
              <p>No exact-date streaks found yet.</p>
            )}
          </div>

          <div className="watchActivityMiniCard">
            <div className="small">Longest exact-date gap</div>
            {longestGap ? (
              <>
                <div className="watchActivityMiniValue">{formatInt(longestGap.gapDays)} days</div>
                <div className="small">{longestGap.startDate} to {longestGap.endDate}</div>
                <button className="btn" type="button" style={{ marginTop: 8 }} onClick={() => onGapClick(longestGap)}>
                  Open gap context
                </button>
              </>
            ) : (
              <p>No gaps detected between exact watch days.</p>
            )}
          </div>
        </div>
      </div>

      <div className="moduleSplit" style={{ marginTop: 12 }}>
        <BarList
          title="Busiest exact-watch months"
          subtitle="Row-level exact watch events grouped by month."
          items={activity.busiestMonths.map((item) => ({ label: item.label, value: item.count }))}
          emptyText="No exact watch months found."
          onItemClick={(item) => onMonthClick(item.label)}
        />
        <BarList
          title="Busiest exact-watch years"
          subtitle="Row-level exact watch events grouped by year."
          items={activity.busiestYears.map((item) => ({ label: item.label, value: item.count }))}
          emptyText="No exact watch years found."
          onItemClick={(item) => onYearClick(item.label)}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="small">Longest gaps between exact watch days</div>
        {activity.longestGaps.length === 0 ? (
          <p>No gaps found between exact watch days.</p>
        ) : (
          <div className="dataTableWrap">
            <div className="dataTable">
              <div className="dataTableHead dataTableActivityGaps">
                <div>From</div>
                <div>To</div>
                <div>Gap days</div>
              </div>
              {activity.longestGaps.map((gap) => (
                <button
                  type="button"
                  className="dataTableRow dataTableActivityGaps dataTableRowButton"
                  key={gap.id}
                  onClick={() => onGapClick(gap)}
                >
                  <div>{gap.startDate}</div>
                  <div>{gap.endDate}</div>
                  <div>{formatInt(gap.gapDays)}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
