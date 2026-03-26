import React from "react";
import { ShareCardSummary } from "../lib/stats";
import { formatInt, formatPct, round1, round3 } from "../lib/utils";

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
  generatedAt,
  badgeText,
  shareCard,
  label,
  labels,
  contextItems,
}: {
  generatedAt: string;
  badgeText: string;
  shareCard: ShareCardSummary;
  label: string;
  labels: ShareCardLabels;
  contextItems?: Array<{ label: string; value: string }>;
}) {
  const mean = shareCard.currentMeanRating === null ? labels.na : round3(shareCard.currentMeanRating);
  const med = shareCard.currentMedianRating === null ? labels.na : round1(shareCard.currentMedianRating);

  return (
    <div className="shareCard" id="shareCard">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h3>{label || " "} {labels.titleSuffix}</h3>
          <div className="small">{labels.generated} {new Date(generatedAt).toLocaleString("en-GB")}</div>
          {contextItems && contextItems.length > 0 && (
            <div className="shareContextList">
              {contextItems.slice(0, 3).map((item) => (
                <div className="small" key={`${item.label}:${item.value}`}>{item.label}: {item.value}</div>
              ))}
            </div>
          )}
        </div>
        <div className="badge">{labels.badge}: {badgeText}</div>
      </div>

      <div className="shareGrid">
        <div className="shareTile">
          <div className="t">{labels.watched}</div>
          <div className="v">{formatInt(shareCard.watchedFilmsUnique)}</div>
        </div>
        <div className="shareTile">
          <div className="t">{labels.rated}</div>
          <div className="v">{formatInt(shareCard.currentRatedFilms)}</div>
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
          <div className="v">{formatInt(shareCard.bestStreakDays)}</div>
        </div>
        <div className="shareTile">
          <div className="t">{labels.commitment}</div>
          <div className="v">{formatPct(shareCard.commitmentIndex)}</div>
        </div>
        <div className="shareTile" style={{ gridColumn: "span 6" }}>
          <div className="t">{labels.topWords}</div>
          <div className="v" style={{ fontSize: 14, lineHeight: 1.35, marginTop: 8 }}>
            {shareCard.topWords.join(", ") || labels.na}
          </div>
        </div>
        <div className="shareTile" style={{ gridColumn: "span 6" }}>
          <div className="t">{labels.oneLine}</div>
          <div className="v" style={{ fontSize: 14, lineHeight: 1.35, marginTop: 8 }}>
            {shareCard.oneLine}
          </div>
        </div>
      </div>
    </div>
  );
}
