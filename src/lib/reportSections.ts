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
    purpose: "The quick read before the deeper cuts.",
    description: "Headline counts, coverage notes, and share tools in one place.",
    whatsInside: ["headline counts", "coverage notes", "share tools"],
    defaultCollapsed: false,
  },
  {
    id: "watched-activity",
    anchorId: "section-watched-activity",
    shortTitle: "Activity",
    title: "Watched Activity",
    purpose: "Where the exact watch dates hold.",
    description: "Timeline, heatmap, and streaks only use exact watch dates.",
    whatsInside: ["heatmap", "streaks", "watch-date detail"],
    defaultCollapsed: false,
  },
  {
    id: "ratings",
    anchorId: "section-ratings",
    shortTitle: "Ratings",
    title: "Ratings",
    purpose: "Current ratings on one side, logged ratings on the other.",
    description: "Drift only shows up where both rating layers exist.",
    whatsInside: ["current histogram", "drift summary", "film detail"],
    defaultCollapsed: false,
  },
  {
    id: "reviews",
    anchorId: "section-reviews",
    shortTitle: "Reviews",
    title: "Reviews",
    purpose: "How often you wrote, and how much.",
    description: "Review rows and reviewed films stay separate.",
    whatsInside: ["coverage", "length bands", "longest pieces"],
    defaultCollapsed: true,
  },
  {
    id: "release",
    anchorId: "section-release",
    shortTitle: "Release",
    title: "Release Analytics",
    purpose: "The eras your watched films keep returning to.",
    description: "Counts stay film-level. Means only use films with the matching rating source.",
    whatsInside: ["top years", "decades", "rated-decade table"],
    defaultCollapsed: true,
  },
  {
    id: "watchlist",
    anchorId: "section-watchlist",
    shortTitle: "Watchlist",
    title: "Watchlist / Backlog",
    purpose: "The backlog, kept separate from watched totals.",
    description: "Watchlist add dates shape this section, not your watch history.",
    whatsInside: ["watchlist counts", "add timeline", "watchlist decades"],
    defaultCollapsed: true,
  },
  {
    id: "archives",
    anchorId: "section-archives",
    shortTitle: "Archives",
    title: "Archives / Lists",
    purpose: "Lists, deleted logs, and other side material.",
    description: "Read-only context from parsed lists and archive files.",
    whatsInside: ["archive counts", "lists", "file notes"],
    defaultCollapsed: true,
  },
  {
    id: "data-quality",
    anchorId: "section-data-quality",
    shortTitle: "Quality",
    title: "Data Quality",
    purpose: "Where the export is strong, and where it goes soft.",
    description: "Missing dates, optional files, and coverage notes for the whole report.",
    whatsInside: ["coverage notes", "section readiness", "debug state"],
    defaultCollapsed: true,
  },
  {
    id: "ai",
    anchorId: "section-ai",
    shortTitle: "AI",
    title: "AI Notes",
    purpose: "Optional writing from the same report.",
    description: "It reads the report as-is. It does not change the numbers.",
    whatsInside: ["settings", "context", "draft"],
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
  if (kind === "archiveList") {
    return "archives";
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
    { label: "View", value: activeScope },
  ];
  if (sectionId) {
    items.push({ label: "Section", value: getReportSectionTitle(sectionId) });
  }
  items.push({ label: "Opened from", value: drilldownSource });
  items.push({ label: "Detail", value: drilldownTitle });
  return items;
}
