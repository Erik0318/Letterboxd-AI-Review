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

export default function ShareCard({ stats, label, labels }: { stats: StatPack; label: string; labels: ShareCardLabels }) {
  const mean = stats.totals.ratingMean === null ? labels.na : round1(stats.totals.ratingMean);
  return (
    <div className="shareCard" id="shareCard">
      <h3>{label || " "} {labels.titleSuffix}</h3>
      <div className="small">{labels.generated} {new Date(stats.generatedAt).toLocaleString("en-GB")}</div>
      <div className="shareGrid">
        <div className="shareTile"><div className="t">{labels.watched}</div><div className="v">{formatInt(stats.totals.filmsWatched)}</div></div>
        <div className="shareTile"><div className="t">{labels.rated}</div><div className="v">{formatInt(stats.totals.filmsRated)}</div></div>
        <div className="shareTile"><div className="t">{labels.meanRating}</div><div className="v">{mean}</div></div>
        <div className="shareTile"><div className="t">{labels.commitment}</div><div className="v">{formatPct(stats.totals.filmsRated / Math.max(1, stats.totals.filmsWatched))}</div></div>
        <div className="shareTile" style={{ gridColumn: "span 6" }}><div className="t">{labels.oneLine}</div><div className="v" style={{ fontSize: 14 }}>{stats.shareText.short}</div></div>
      </div>
    </div>
  );
}
