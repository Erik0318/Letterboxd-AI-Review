import React from "react";
import { StatPack } from "../lib/stats";
import { formatInt, formatPct, round1 } from "../lib/utils";

export type ShareCardLabels = {
  generated: string;
  badge: string;
  watched: string;
  rated: string;
  meanRating: string;
  median: string;
  longestStreak: string;
  commitment: string;
  topWords: string;
  oneLine: string;
  na: string;
  titleSuffix: string;
};

export default function ShareCard({
  stats,
  label,
  labels
}: {
  stats: StatPack;
  label: string;
  labels: ShareCardLabels;
}) {
  const mean = stats.ratings.mean === null ? labels.na : round1(stats.ratings.mean);
  const med = stats.ratings.median === null ? labels.na : round1(stats.ratings.median);

  return (
    <div className="shareCard" id="shareCard">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h3>{label || " "} {labels.titleSuffix}</h3>
          <div className="small">{labels.generated} {new Date(stats.generatedAt).toLocaleString("en-GB")}</div>
        </div>
        <div className="badge">{labels.badge}: {stats.fun.badge}</div>
      </div>

      <div className="shareGrid">
        <div className="shareTile">
          <div className="t">{labels.watched}</div>
          <div className="v">{formatInt(stats.totals.filmsWatched)}</div>
        </div>
        <div className="shareTile">
          <div className="t">{labels.rated}</div>
          <div className="v">{formatInt(stats.totals.filmsRated)}</div>
        </div>
        <div className="shareTile">
          <div className="t">{labels.meanRating}</div>
          <div className="v">{mean}</div>
        </div>
        <div className="shareTile">
          <div className="t">{labels.median}</div>
          <div className="v">{med}</div>
        </div>
        <div className="shareTile">
          <div className="t">{labels.longestStreak}</div>
          <div className="v">{formatInt(stats.activity.longestStreakDays)}</div>
        </div>
        <div className="shareTile">
          <div className="t">{labels.commitment}</div>
          <div className="v">{formatPct(stats.fun.commitmentIndex)}</div>
        </div>
        <div className="shareTile" style={{ gridColumn: "span 6" }}>
          <div className="t">{labels.topWords}</div>
          <div className="v" style={{ fontSize: 14, lineHeight: 1.35, marginTop: 8 }}>
            {stats.text.topWords.slice(0, 10).map(w => w.word).join(", ") || labels.na}
          </div>
        </div>
        <div className="shareTile" style={{ gridColumn: "span 6" }}>
          <div className="t">{labels.oneLine}</div>
          <div className="v" style={{ fontSize: 14, lineHeight: 1.35, marginTop: 8 }}>
            {stats.shareText.short}
          </div>
        </div>
      </div>
    </div>
  );
}
