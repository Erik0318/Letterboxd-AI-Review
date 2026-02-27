import React from "react";
import { StatPack } from "../lib/stats";
import { formatInt, formatPct, round1 } from "../lib/utils";

export default function ShareCard({
  stats,
  label
}: {
  stats: StatPack;
  label: string;
}) {
  const mean = stats.ratings.mean === null ? "n/a" : round1(stats.ratings.mean);
  const med = stats.ratings.median === null ? "n/a" : round1(stats.ratings.median);

  return (
    <div className="shareCard" id="shareCard">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h3>{label} taste report</h3>
          <div className="small">Generated {new Date(stats.generatedAt).toLocaleString("en-GB")}</div>
        </div>
        <div className="badge">Badge: {stats.fun.badge}</div>
      </div>

      <div className="shareGrid">
        <div className="shareTile">
          <div className="t">Watched</div>
          <div className="v">{formatInt(stats.totals.filmsWatched)}</div>
        </div>
        <div className="shareTile">
          <div className="t">Rated</div>
          <div className="v">{formatInt(stats.totals.filmsRated)}</div>
        </div>
        <div className="shareTile">
          <div className="t">Mean rating</div>
          <div className="v">{mean}</div>
        </div>
        <div className="shareTile">
          <div className="t">Median</div>
          <div className="v">{med}</div>
        </div>
        <div className="shareTile">
          <div className="t">Longest streak</div>
          <div className="v">{formatInt(stats.activity.longestStreakDays)}</div>
        </div>
        <div className="shareTile">
          <div className="t">Commitment</div>
          <div className="v">{formatPct(stats.fun.commitmentIndex)}</div>
        </div>
        <div className="shareTile" style={{ gridColumn: "span 6" }}>
          <div className="t">Top words</div>
          <div className="v" style={{ fontSize: 14, lineHeight: 1.35, marginTop: 8 }}>
            {stats.text.topWords.slice(0, 10).map(w => w.word).join(", ") || "n/a"}
          </div>
        </div>
        <div className="shareTile" style={{ gridColumn: "span 6" }}>
          <div className="t">One line</div>
          <div className="v" style={{ fontSize: 14, lineHeight: 1.35, marginTop: 8 }}>
            {stats.shareText.short}
          </div>
        </div>
      </div>
    </div>
  );
}
