import React from "react";
import { SavedViewPreset, SavedViewRecord } from "../lib/savedViews";

type ViewLike = SavedViewPreset | SavedViewRecord;

function viewTimestamp(view: SavedViewRecord): string {
  return `Updated ${new Date(view.updatedAt).toLocaleString("en-GB")}`;
}

export default function SavedViewsPanel({
  className,
  draftName,
  onDraftNameChange,
  onSaveCurrent,
  presets,
  savedViews,
  activeViewId,
  onLoad,
  onRename,
  onDelete,
  onExportSummary,
}: {
  className?: string;
  draftName: string;
  onDraftNameChange: (value: string) => void;
  onSaveCurrent: () => void;
  presets: SavedViewPreset[];
  savedViews: SavedViewRecord[];
  activeViewId: string | null;
  onLoad: (view: ViewLike) => void;
  onRename: (view: SavedViewRecord) => void;
  onDelete: (view: SavedViewRecord) => void;
  onExportSummary: (view: ViewLike) => void;
}) {
  return (
    <div className={`card${className ? ` ${className}` : ""}`}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2>Saved views</h2>
          <div className="small">
            Keep a filter set or detail view around and come back to it later.
          </div>
        </div>
        <div className="savedViewSave">
          <input
            value={draftName}
            onChange={(event) => onDraftNameChange(event.target.value)}
            placeholder="Name this view"
          />
          <button className="btn primary" type="button" onClick={onSaveCurrent}>Save view</button>
        </div>
      </div>

      <div className="savedViewsColumns">
        <div>
          <div className="small" style={{ marginBottom: 8 }}>Built-ins</div>
          <div className="savedViewList">
            {presets.map((view) => (
              <div className={`savedViewItem isPreset${activeViewId === view.id ? " isActive" : ""}`} key={view.id}>
                <div>
                  <div className="row">
                    <span className="badge">Preset</span>
                    {activeViewId === view.id && <span className="badge">Active</span>}
                  </div>
                  <div className="savedViewName">{view.name}</div>
                  <div className="small">{view.description}</div>
                </div>
                <div className="row">
                  <button className="btn primary" type="button" onClick={() => onLoad(view)}>Open</button>
                  <button className="btn" type="button" onClick={() => onExportSummary(view)}>Export note</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="small" style={{ marginBottom: 8 }}>Your saved views</div>
          {savedViews.length === 0 ? (
            <p>No saved views yet.</p>
          ) : (
            <div className="savedViewList">
              {savedViews.map((view) => (
                <div className={`savedViewItem${activeViewId === view.id ? " isActive" : ""}`} key={view.id}>
                  <div>
                    <div className="row">
                      <span className="badge">Saved</span>
                      {activeViewId === view.id && <span className="badge">Active</span>}
                    </div>
                    <div className="savedViewName">{view.name}</div>
                    <div className="small">{viewTimestamp(view)}</div>
                  </div>
                  <div className="row">
                    <button className="btn primary" type="button" onClick={() => onLoad(view)}>Open</button>
                    <button className="btn" type="button" onClick={() => onExportSummary(view)}>Export note</button>
                    <button className="btn" type="button" onClick={() => onRename(view)}>Rename</button>
                    <button className="btn danger" type="button" onClick={() => onDelete(view)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
