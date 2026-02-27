import { StatPack } from "./stats";

export type ProfileSummary = {
  label: string;
  generatedAt: string;
  totals: StatPack["totals"];
  anomaly: StatPack["anomaly"];
};

export function toProfileSummary(stats: StatPack, label: string): ProfileSummary {
  return { label, generatedAt: stats.generatedAt, totals: stats.totals, anomaly: stats.anomaly };
}

export function summaryToText(s: ProfileSummary): string {
  return [
    `Label: ${s.label}`,
    `Watched films: ${s.totals.filmsWatched}`,
    `Rated films: ${s.totals.filmsRated}`,
    `Import spike: ${s.anomaly.importSpikeDetected}`
  ].join("\n");
}
