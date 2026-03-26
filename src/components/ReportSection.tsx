import React, { forwardRef } from "react";
import { ReportMenuMetric, ReportSectionDefinition } from "../lib/reportSections";

const ReportSection = forwardRef<HTMLElement, {
  section: ReportSectionDefinition;
  index: number;
  active: boolean;
  collapsed: boolean;
  revealed: boolean;
  linkedToExplorer: boolean;
  attentive: boolean;
  entered: boolean;
  guided: boolean;
  metrics: ReportMenuMetric[];
  onToggle: () => void;
  onJumpToMenu: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  children: React.ReactNode;
}>(
  ({
    section,
    index,
    active,
    collapsed,
    revealed,
    linkedToExplorer,
    attentive,
    entered,
    guided,
    metrics,
    onToggle,
    onJumpToMenu,
    onPointerEnter,
    onPointerLeave,
    children,
  }, ref) => (
    <section
      className={`dashboardSection reportSectionShell${active ? " isActive" : ""}${collapsed ? " isCollapsed" : ""}${revealed ? " isVisible" : ""}${linkedToExplorer ? " isLinkedToExplorer" : ""}${attentive ? " isAttentive" : ""}${entered ? " isEntered" : ""}${guided ? " isGuided" : ""}`}
      id={section.anchorId}
      ref={ref}
      data-section={section.id}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="reportSectionFrame">
        <header className="reportSectionHeader">
          <div className="reportSectionLead">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="sectionEyebrow">Section {String(index + 1).padStart(2, "0")}</div>
                <h2>{section.title}</h2>
                <div className="small">{section.description}</div>
              </div>
              <div className="reportSectionActions">
                {active && <span className="badge">Active</span>}
                {linkedToExplorer && <span className="badge">Detail open</span>}
                <button className="btn" type="button" onClick={onJumpToMenu}>Back to map</button>
                <button
                  className="btn primary"
                  type="button"
                  onClick={onToggle}
                  aria-expanded={!collapsed}
                  aria-controls={`${section.anchorId}-body`}
                >
                  {collapsed ? "Open section" : "Fold section"}
                </button>
              </div>
            </div>
          </div>

          <div className="reportSectionLanding">
            <div className="reportSectionLandingBlock">
              <div className="small">Why it matters</div>
              <div className="reportSectionPurpose">{section.purpose}</div>
            </div>
            <div className="reportSectionLandingBlock">
              <div className="small">Inside</div>
              <div className="reportSectionInside">
                {section.whatsInside.map((item) => (
                  <span className="badge" key={`${section.id}:${item}`}>{item}</span>
                ))}
              </div>
            </div>
            <div className="reportSectionLandingBlock">
              <div className="small">At a glance</div>
              <div className="reportSectionMetrics">
                {metrics.length > 0 ? metrics.map((metric) => (
                  <div className="reportSectionMetric" key={`${section.id}:${metric.label}`}>
                    <div className="small">{metric.label}</div>
                    <div>{metric.value}</div>
                  </div>
                )) : (
                  <div className="reportSectionMetric">
                    <div className="small">Ready</div>
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
                  <button className="btn" type="button" onClick={onJumpToMenu}>Back to map</button>
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
