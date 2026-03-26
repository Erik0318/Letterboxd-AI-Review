import React, { forwardRef } from "react";
import { ReportMenuMetric, ReportSectionDefinition } from "../lib/reportSections";

const ReportSection = forwardRef<HTMLElement, {
  section: ReportSectionDefinition;
  index: number;
  active: boolean;
  collapsed: boolean;
  revealed: boolean;
  linkedToExplorer: boolean;
  metrics: ReportMenuMetric[];
  onToggle: () => void;
  onJumpToMenu: () => void;
  children: React.ReactNode;
}>(
  ({
    section,
    index,
    active,
    collapsed,
    revealed,
    linkedToExplorer,
    metrics,
    onToggle,
    onJumpToMenu,
    children,
  }, ref) => (
    <section
      className={`dashboardSection reportSectionShell${active ? " isActive" : ""}${collapsed ? " isCollapsed" : ""}${revealed ? " isVisible" : ""}${linkedToExplorer ? " isLinkedToExplorer" : ""}`}
      id={section.anchorId}
      ref={ref}
      data-section={section.id}
    >
      <div className="reportSectionFrame">
        <header className="reportSectionHeader">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="sectionEyebrow">Section {String(index + 1).padStart(2, "0")}</div>
              <h2>{section.title}</h2>
              <div className="small">{section.description}</div>
            </div>
            <div className="reportSectionActions">
              {active && <span className="badge">Active</span>}
              {linkedToExplorer && <span className="badge">Open drilldown linked</span>}
              <button className="btn" type="button" onClick={onJumpToMenu}>Back to menu</button>
              <button
                className="btn primary"
                type="button"
                onClick={onToggle}
                aria-expanded={!collapsed}
                aria-controls={`${section.anchorId}-body`}
              >
                {collapsed ? "Expand section" : "Collapse section"}
              </button>
            </div>
          </div>

          <div className="reportSectionLanding">
            <div className="reportSectionLandingBlock">
              <div className="small">What this section is for</div>
              <div className="reportSectionPurpose">{section.purpose}</div>
            </div>
            <div className="reportSectionLandingBlock">
              <div className="small">What's inside</div>
              <div className="reportSectionInside">
                {section.whatsInside.map((item) => (
                  <span className="badge" key={`${section.id}:${item}`}>{item}</span>
                ))}
              </div>
            </div>
            <div className="reportSectionLandingBlock">
              <div className="small">Quick preview</div>
              <div className="reportSectionMetrics">
                {metrics.length > 0 ? metrics.map((metric) => (
                  <div className="reportSectionMetric" key={`${section.id}:${metric.label}`}>
                    <div className="small">{metric.label}</div>
                    <div>{metric.value}</div>
                  </div>
                )) : (
                  <div className="reportSectionMetric">
                    <div className="small">Preview</div>
                    <div>Open section</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="reportSectionBodyWrap" id={`${section.anchorId}-body`}>
          <div className="reportSectionBody">
            {!collapsed && (
              <>
                {children}
                <div className="reportSectionFooter">
                  <button className="btn" type="button" onClick={onJumpToMenu}>Back to report map</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  ),
);

ReportSection.displayName = "ReportSection";

export default ReportSection;
