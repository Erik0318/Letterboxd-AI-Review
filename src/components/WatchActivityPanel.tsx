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
  onOpenAll: (sourceElement: HTMLElement | null) => void;
  onMonthClick: (month: string, sourceElement: HTMLElement | null) => void;
  onYearClick: (year: string, sourceElement: HTMLElement | null) => void;
  onDayClick: (day: string, sourceElement: HTMLElement | null) => void;
  onGapClick: (gap: ExactWatchGap, sourceElement: HTMLElement | null) => void;
  onStreakClick: (streak: ExactWatchStreak, sourceElement: HTMLElement | null) => void;
}) {
  const longestGap = activity.longestGaps[0] || null;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2>{title}</h2>
          <div className="small">
            {subtitle || "Exact watch dates only. Detail rows here are watch events; film totals stay film-level."}
          </div>
        </div>
        <button className="btn primary" type="button" onClick={(event) => onOpenAll(event.currentTarget)}>Open all watch dates</button>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <span className="badge">Exact watch rows: {formatInt(activity.exactWatchEvents)}</span>
        <span className="badge">Films with exact watch dates: {formatInt(activity.exactDatedWatchedFilms)}</span>
        <span className="badge">Detail rows: exact watch events</span>
        {activity.busiestDay && (
          <button type="button" className="badgeButton isInteractive" onClick={(event) => onDayClick(activity.busiestDay!.label, event.currentTarget)}>
            Busiest day: {activity.busiestDay.label} ({formatInt(activity.busiestDay.count)})
          </button>
        )}
        {activity.bestStreak && (
          <button type="button" className="badgeButton isInteractive" onClick={(event) => onStreakClick(activity.bestStreak!, event.currentTarget)}>
            Best streak: {formatInt(activity.bestStreak.days)} days
          </button>
        )}
        {longestGap && (
          <button type="button" className="badgeButton isInteractive" onClick={(event) => onGapClick(longestGap, event.currentTarget)}>
            Longest gap: {formatInt(longestGap.gapDays)} days
          </button>
        )}
      </div>

      <div className="watchActivityGrid">
        <div>
          <Heatmap
            byMonth={activity.heatmapByMonth}
            title="Watch-date heatmap"
            subtitle="Open a month to see the watch rows behind it."
            emptyText="No exact watch dates in this view."
            footerText="Exact watch dates only. Films without one stay out of this section."
            onCellClick={onMonthClick}
          />
        </div>
        <div className="watchActivitySummaryColumn">
          <div className="watchActivityMiniCard">
            <div className="small">Best streak</div>
            {activity.bestStreak ? (
              <>
                <div className="watchActivityMiniValue">{formatInt(activity.bestStreak.days)} days</div>
                <div className="small">{activity.bestStreak.startDate} to {activity.bestStreak.endDate}</div>
                <div className="small">{formatInt(activity.bestStreak.exactWatchEvents)} events across {formatInt(activity.bestStreak.uniqueFilms)} films</div>
                <button className="btn" type="button" style={{ marginTop: 8 }} onClick={(event) => onStreakClick(activity.bestStreak!, event.currentTarget)}>
                  Open the films behind this
                </button>
              </>
            ) : (
              <p>No streaks yet.</p>
            )}
          </div>

          <div className="watchActivityMiniCard">
            <div className="small">Longest gap</div>
            {longestGap ? (
              <>
                <div className="watchActivityMiniValue">{formatInt(longestGap.gapDays)} days</div>
                <div className="small">{longestGap.startDate} to {longestGap.endDate}</div>
                <button className="btn" type="button" style={{ marginTop: 8 }} onClick={(event) => onGapClick(longestGap, event.currentTarget)}>
                  Open the films around it
                </button>
              </>
            ) : (
              <p>No gaps between exact watch days.</p>
            )}
          </div>
        </div>
      </div>

      <div className="moduleSplit" style={{ marginTop: 12 }}>
        <BarList
          title="Busiest months"
          subtitle="Exact watch rows grouped by month."
          items={activity.busiestMonths.map((item) => ({ label: item.label, value: item.count }))}
          emptyText="No months yet."
          onItemClick={(item, sourceElement) => onMonthClick(item.label, sourceElement)}
        />
        <BarList
          title="Busiest years"
          subtitle="Exact watch rows grouped by year."
          items={activity.busiestYears.map((item) => ({ label: item.label, value: item.count }))}
          emptyText="No years yet."
          onItemClick={(item, sourceElement) => onYearClick(item.label, sourceElement)}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="small">Longest gaps between exact watch days</div>
        {activity.longestGaps.length === 0 ? (
          <p>No gaps between exact watch days.</p>
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
                  onClick={(event) => onGapClick(gap, event.currentTarget)}
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
