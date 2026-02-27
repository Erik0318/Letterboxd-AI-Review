import { StatPack } from "./stats";
import { round1 } from "./utils";

export type ProfileSummary = {
  label: string;
  generatedAt: string;
  totals: StatPack["totals"];
  ratings: StatPack["ratings"];
  activity: StatPack["activity"];
  releaseYears: StatPack["releaseYears"];
  text: StatPack["text"];
  anomaly: StatPack["anomaly"];
};

export function toProfileSummary(stats: StatPack, label: string): ProfileSummary {
  return {
    label,
    generatedAt: stats.generatedAt,
    totals: stats.totals,
    ratings: stats.ratings,
    activity: stats.activity,
    releaseYears: stats.releaseYears,
    text: stats.text,
    anomaly: stats.anomaly
  };
}

export function summaryToText(s: ProfileSummary): string {
  return [
    `Label: ${s.label}`,
    `Watched films: ${s.totals.filmsWatched}`,
    `Rated films: ${s.totals.filmsRated}`,
    `Mean rating: ${s.ratings.mean === null ? "n/a" : String(round1(s.ratings.mean))}`,
    `Longest streak: ${s.activity.longestStreakDays}`,
    `Exploration index: ${Math.round(s.releaseYears.explorationIndex * 100)}%`,
    `Persona: ${s.text.persona.type}`,
    `Import spike detected: ${String(s.anomaly.importSpikeDetected)}`
  ].join("\n");
}
