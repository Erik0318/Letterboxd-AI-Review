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
    { label: "Report", value: "Current Letterboxd export" },
    { label: "View", value: input.scopeIsActive ? input.scopeSummary : "Full report" },
  ];
  if (input.activeSavedViewName) {
    contextItems.push({ label: "Saved view", value: input.activeSavedViewName });
  }
  if (input.drilldown) {
    contextItems.push({ label: "Detail", value: `${input.drilldown.title} (${input.drilldown.rowBasis})` });
    contextItems.push({ label: "Opened from", value: input.drilldown.source });
  }

  const heading = mode === "drilldown"
    ? "Open detail"
    : mode === "scoped"
      ? "Filtered view"
      : "Full report";

  const description = mode === "drilldown"
    ? "Copy and export use the open detail. The share card stays at report level."
    : mode === "scoped"
      ? "Copy and export follow the current filters."
      : "Copy and export use the full report.";

  const badges = [
    { label: "Watched", value: String(input.majorCounts.watchedFilms) },
    { label: "Current ratings", value: String(input.majorCounts.currentRatedFilms) },
    { label: "Exact watch dates", value: String(input.majorCounts.exactDatedWatchedFilms) },
    { label: "Missing exact watch dates", value: String(input.majorCounts.watchedFilmsWithoutExactDate) },
  ];
  if (input.drilldown) {
    badges.push({ label: "Rows", value: String(input.drilldown.rowCount) });
  }

  const textParts = [input.shareTextLong];
  if (input.activeSavedViewName) {
    textParts.push(`Saved view: ${input.activeSavedViewName}.`);
  }
  if (input.drilldown) {
    textParts.push(
      `Open detail: ${input.drilldown.title}. ` +
      `Opened from: ${input.drilldown.source}. ` +
      `Counted as: ${input.drilldown.rowBasis}. ` +
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
