export type CurrentViewSummaryInput = {
  scopeIsActive: boolean;
  scopeSummary: string;
  shareTextLong: string;
  majorCounts: {
    watchedFilms: number;
    currentRatedFilms: number;
    exactDatedWatchedFilms: number;
    watchedFilmsWithoutExactDate: number;
  };
  drilldown: {
    title: string;
    source: string;
    rowBasis: string;
    rowCount: number;
  } | null;
  activeSavedViewName: string | null;
};

export type CurrentViewSummary = {
  mode: "global" | "scoped" | "drilldown";
  heading: string;
  description: string;
  contextItems: Array<{ label: string; value: string }>;
  badges: Array<{ label: string; value: string }>;
  text: string;
};

export function buildCurrentViewSummary(input: CurrentViewSummaryInput): CurrentViewSummary {
  const mode = input.drilldown ? "drilldown" : input.scopeIsActive ? "scoped" : "global";
  const contextItems: CurrentViewSummary["contextItems"] = [
    { label: "Global context", value: "Current imported Letterboxd export" },
    { label: "Active scope", value: input.scopeIsActive ? input.scopeSummary : "Global default view" },
  ];
  if (input.activeSavedViewName) {
    contextItems.push({ label: "Saved view", value: input.activeSavedViewName });
  }
  if (input.drilldown) {
    contextItems.push({ label: "Drilldown", value: `${input.drilldown.title} (${input.drilldown.rowBasis})` });
    contextItems.push({ label: "Drilldown source", value: input.drilldown.source });
  }

  const heading = mode === "drilldown"
    ? "Current drilldown subset"
    : mode === "scoped"
      ? "Current scoped view"
      : "Current global report";

  const description = mode === "drilldown"
    ? "Export and copy actions below reflect the open drilldown subset. The share card remains a report-level summary."
    : mode === "scoped"
      ? "Share and export actions below reflect the active scope."
      : "Share and export actions below reflect the full imported report.";

  const badges = [
    { label: "Watched films", value: String(input.majorCounts.watchedFilms) },
    { label: "Current rated films", value: String(input.majorCounts.currentRatedFilms) },
    { label: "Exact-dated watched films", value: String(input.majorCounts.exactDatedWatchedFilms) },
    { label: "Watched films without exact date", value: String(input.majorCounts.watchedFilmsWithoutExactDate) },
  ];
  if (input.drilldown) {
    badges.push({ label: "Drilldown rows", value: String(input.drilldown.rowCount) });
  }

  const textParts = [input.shareTextLong];
  if (input.activeSavedViewName) {
    textParts.push(`Saved view: ${input.activeSavedViewName}.`);
  }
  if (input.drilldown) {
    textParts.push(
      `Open drilldown: ${input.drilldown.title}. ` +
      `Source: ${input.drilldown.source}. ` +
      `Row basis: ${input.drilldown.rowBasis}. ` +
      `Rows: ${input.drilldown.rowCount}.`,
    );
  }

  return {
    mode,
    heading,
    description,
    contextItems,
    badges,
    text: textParts.join(" "),
  };
}
