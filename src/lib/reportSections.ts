export type ReportSectionId =
  | "overview"
  | "watched-activity"
  | "ratings"
  | "reviews"
  | "release"
  | "watchlist"
  | "archives"
  | "data-quality"
  | "ai";

export type ReportMenuMetric = {
  label: string;
  value: string;
};

export type ReportSectionDefinition = {
  id: ReportSectionId;
  anchorId: string;
  shortTitle: string;
  title: string;
  purpose: string;
  description: string;
  whatsInside: string[];
  defaultCollapsed: boolean;
};

export type ReportSectionCollapseState = Record<ReportSectionId, boolean>;

export type ReportMenuEntry = ReportSectionDefinition & {
  metrics: ReportMenuMetric[];
};

export const REPORT_SECTIONS: ReportSectionDefinition[] = [
  {
    id: "overview",
    anchorId: "section-overview",
    shortTitle: "Overview",
    title: "Overview",
    purpose: "Start here for the high-level shape of the current report.",
    description: "A quick read on watched volume, ratings, coverage, and share/export context before you dive deeper.",
    whatsInside: ["core KPIs", "coverage facts", "share and export tools"],
    defaultCollapsed: false,
  },
  {
    id: "watched-activity",
    anchorId: "section-watched-activity",
    shortTitle: "Activity",
    title: "Watched Activity",
    purpose: "Explore exact-date watch behaviour, streaks, gaps, and busy periods.",
    description: "This section stays exact-date only, so films without an exact watched date remain out of the default watch-time visuals.",
    whatsInside: ["heatmap", "streaks and gaps", "exact-event drilldowns"],
    defaultCollapsed: false,
  },
  {
    id: "ratings",
    anchorId: "section-ratings",
    shortTitle: "Ratings",
    title: "Ratings",
    purpose: "Scan your current rating shape and where ratings drifted over time.",
    description: "Current ratings and logged ratings stay semantically distinct, with drift kept explicit about comparable coverage.",
    whatsInside: ["current histogram", "drift summary", "case drilldowns"],
    defaultCollapsed: false,
  },
  {
    id: "reviews",
    anchorId: "section-reviews",
    shortTitle: "Reviews",
    title: "Reviews",
    purpose: "Check review coverage, writing volume, and notable long-form entries.",
    description: "Review rows remain row-level while reviewed-film coverage stays separate and clearly labeled.",
    whatsInside: ["review rate", "length buckets", "longest reviews"],
    defaultCollapsed: true,
  },
  {
    id: "release",
    anchorId: "section-release",
    shortTitle: "Release",
    title: "Release Analytics",
    purpose: "See the eras and decades that dominate your watched selection.",
    description: "Release-year analysis stays film-level, and rating averages only use films that actually have the relevant rating source.",
    whatsInside: ["top years", "decade spread", "rated-decade tables"],
    defaultCollapsed: true,
  },
  {
    id: "watchlist",
    anchorId: "section-watchlist",
    shortTitle: "Watchlist",
    title: "Watchlist / Backlog",
    purpose: "Inspect the separate backlog dataset without mixing it into watched totals.",
    description: "Watchlist add activity remains a separate backlog surface, distinct from watched-film analytics.",
    whatsInside: ["backlog counts", "add timeline", "watchlist decades"],
    defaultCollapsed: true,
  },
  {
    id: "archives",
    anchorId: "section-archives",
    shortTitle: "Archives",
    title: "Archives / Lists",
    purpose: "Review parsed lists and archived export surfaces without cluttering the main report.",
    description: "Archive visibility stays additive and read-only, separate from the core watched/reporting surface.",
    whatsInside: ["archive counts", "active lists", "archived list metadata"],
    defaultCollapsed: true,
  },
  {
    id: "data-quality",
    anchorId: "section-data-quality",
    shortTitle: "Quality",
    title: "Data Quality",
    purpose: "Audit what the export can and cannot support across report modules.",
    description: "Coverage, missing fields, optional tables, and debug state stay aligned with the same canonical selectors as the page.",
    whatsInside: ["coverage audit", "module readiness", "debug summary"],
    defaultCollapsed: true,
  },
  {
    id: "ai",
    anchorId: "section-ai",
    shortTitle: "AI",
    title: "AI",
    purpose: "Generate optional AI commentary from the same factual report foundation.",
    description: "The AI layer is additive only; it reads the report context without changing any underlying analytics.",
    whatsInside: ["provider settings", "prompt context", "generated commentary"],
    defaultCollapsed: true,
  },
];

export function getReportSectionDefinition(sectionId: ReportSectionId): ReportSectionDefinition {
  return REPORT_SECTIONS.find((section) => section.id === sectionId) || REPORT_SECTIONS[0];
}

export function getReportSectionAnchorId(sectionId: ReportSectionId): string {
  return getReportSectionDefinition(sectionId).anchorId;
}

export function getReportSectionTitle(sectionId: ReportSectionId): string {
  return getReportSectionDefinition(sectionId).title;
}

export function buildReportSectionHash(sectionId: ReportSectionId): string {
  return `#${getReportSectionAnchorId(sectionId)}`;
}

export function parseReportSectionHash(hash: string | null | undefined): ReportSectionId | null {
  if (!hash) {
    return null;
  }
  const normalized = hash.replace(/^#/, "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const match = REPORT_SECTIONS.find((section) =>
    section.anchorId.toLowerCase() === normalized
    || section.id.toLowerCase() === normalized
    || section.anchorId.toLowerCase().replace(/^section-/, "") === normalized,
  );
  return match?.id || null;
}

export function buildDefaultCollapsedSections(
  activeSectionId: ReportSectionId = "overview",
): ReportSectionCollapseState {
  const state = REPORT_SECTIONS.reduce((acc, section) => {
    acc[section.id] = section.defaultCollapsed;
    return acc;
  }, {} as ReportSectionCollapseState);
  state.overview = false;
  state[activeSectionId] = false;
  return state;
}

export function normaliseCollapsedSections(
  value: Partial<Record<ReportSectionId, boolean>> | null | undefined,
  activeSectionId: ReportSectionId = "overview",
): ReportSectionCollapseState {
  const next = buildDefaultCollapsedSections(activeSectionId);
  for (const section of REPORT_SECTIONS) {
    const raw = value?.[section.id];
    if (typeof raw === "boolean") {
      next[section.id] = raw;
    }
  }
  next.overview = false;
  next[activeSectionId] = false;
  return next;
}

export function serializeCollapsedSections(
  value: ReportSectionCollapseState,
): string {
  return JSON.stringify(normaliseCollapsedSections(value));
}

export function parseCollapsedSections(
  raw: string | null,
  activeSectionId: ReportSectionId = "overview",
): ReportSectionCollapseState {
  if (!raw) {
    return buildDefaultCollapsedSections(activeSectionId);
  }
  try {
    const parsed = JSON.parse(raw) as Partial<Record<ReportSectionId, boolean>>;
    return normaliseCollapsedSections(parsed, activeSectionId);
  } catch {
    return buildDefaultCollapsedSections(activeSectionId);
  }
}

export function buildReportMenuEntries(
  previews: Partial<Record<ReportSectionId, ReportMenuMetric[]>>,
): ReportMenuEntry[] {
  return REPORT_SECTIONS.map((section) => ({
    ...section,
    metrics: (previews[section.id] || []).filter((metric) => metric.value.trim()).slice(0, 2),
  }));
}

export function inferExplorerSectionId(route: string | null): ReportSectionId | null {
  if (!route) {
    return null;
  }
  const [kind, source] = route.split("|");
  if (kind === "films") {
    return "overview";
  }
  if (kind === "histogram" || kind === "driftCategory" || kind === "driftCase") {
    return "ratings";
  }
  if (kind === "longestReview") {
    return "reviews";
  }
  if (kind === "activityAll" || kind === "activityMonth" || kind === "activityYear" || kind === "activityDay" || kind === "activityGap" || kind === "activityStreak") {
    return "watched-activity";
  }
  if (kind === "releaseYear" || kind === "releaseDecade") {
    return source === "watchlist" ? "watchlist" : "release";
  }
  if (kind === "releaseAnalyticsDecade") {
    return "release";
  }
  return null;
}

export function buildDrilldownContextTrail({
  activeScope,
  sectionId,
  drilldownSource,
  drilldownTitle,
}: {
  activeScope: string;
  sectionId: ReportSectionId | null;
  drilldownSource: string;
  drilldownTitle: string;
}): Array<{ label: string; value: string }> {
  const items = [
    { label: "Scope", value: activeScope },
  ];
  if (sectionId) {
    items.push({ label: "Section", value: getReportSectionTitle(sectionId) });
  }
  items.push({ label: "Source", value: drilldownSource });
  items.push({ label: "Drilldown", value: drilldownTitle });
  return items;
}
