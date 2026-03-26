import React from "react";
import { ShareCardSummary } from "../lib/stats";
import { CurrentViewSummary } from "../lib/viewState";
import { formatInt } from "../lib/utils";
import ShareCard, { ShareCardLabels } from "./ShareCard";

export default function ShareExportPanel({
  className,
  summary,
  generatedAt,
  badgeText,
  shareCard,
  label,
  labels,
  shareContextItems,
  onCopySummary,
  onDownloadShareCard,
  onExportFilmList,
  onExportDrilldown,
  onExportSavedViewSummary,
  onPrint,
}: {
  className?: string;
  summary: CurrentViewSummary;
  generatedAt: string;
  badgeText: string;
  shareCard: ShareCardSummary;
  label: string;
  labels: ShareCardLabels;
  shareContextItems: Array<{ label: string; value: string }>;
  onCopySummary: () => void;
  onDownloadShareCard: () => void;
  onExportFilmList: () => void;
  onExportDrilldown?: (() => void) | null;
  onExportSavedViewSummary?: (() => void) | null;
  onPrint: () => void;
}) {
  return (
    <div className={`card${className ? ` ${className}` : ""}`}>
      <h2>Share / export</h2>
      <div className="small">{summary.description}</div>

      <div className="viewSummaryBlock">
        <div className="viewSummaryContext">
          {summary.contextItems.map((item) => (
            <div className="viewSummaryRow" key={`${item.label}:${item.value}`}>
              <div className="small">{item.label}</div>
              <div>{item.value}</div>
            </div>
          ))}
        </div>
        <div className="viewSummaryBadges">
          {summary.badges.map((item) => (
            <span className="badge" key={`${item.label}:${item.value}`}>
              {item.label}: {formatInt(Number(item.value))}
            </span>
          ))}
        </div>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" type="button" onClick={onCopySummary}>Copy current view summary</button>
        <button className="btn" type="button" onClick={onExportFilmList}>Export current film list CSV</button>
        {onExportDrilldown && <button className="btn" type="button" onClick={onExportDrilldown}>Export current drilldown CSV</button>}
        {onExportSavedViewSummary && <button className="btn" type="button" onClick={onExportSavedViewSummary}>Export saved view summary</button>}
        <button className="btn primary" type="button" onClick={onDownloadShareCard}>Download report share card PNG</button>
        <button className="btn" type="button" onClick={onPrint}>Print current view</button>
      </div>

      <div style={{ marginTop: 12 }}>
        <ShareCard
          generatedAt={generatedAt}
          badgeText={badgeText}
          shareCard={shareCard}
          label={label}
          labels={labels}
          contextItems={shareContextItems}
        />
      </div>
    </div>
  );
}
