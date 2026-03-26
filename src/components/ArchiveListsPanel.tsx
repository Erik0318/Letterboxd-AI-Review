import React from "react";
import { StatPack } from "../lib/stats";
import { formatInt } from "../lib/utils";

function formatScope(scope: "active" | "deleted" | "orphaned"): string {
  if (scope === "active") {
    return "Active";
  }
  if (scope === "deleted") {
    return "Archived / deleted";
  }
  return "Archived / orphaned";
}

export default function ArchiveListsPanel({
  archives,
  title = "Archive + lists",
  subtitle,
}: {
  archives: StatPack["archives"];
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="small">
        {subtitle || "Read-only visibility into deleted/orphaned exports and parsed list files. Missing archive files simply stay at zero."}
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <span className="badge">Deleted diary rows: {formatInt(archives.summary.deletedDiaryRows.value)}</span>
        <span className="badge">Deleted review rows: {formatInt(archives.summary.deletedReviewRows.value)}</span>
        <span className="badge">Orphaned diary rows: {formatInt(archives.summary.orphanedDiaryRows.value)}</span>
        <span className="badge">Orphaned review rows: {formatInt(archives.summary.orphanedReviewRows.value)}</span>
        <span className="badge">Active lists: {formatInt(archives.summary.activeLists.value)}</span>
        <span className="badge">Archived lists: {formatInt(archives.summary.archivedLists.value)}</span>
      </div>

      <div className="moduleSplit">
        <div>
          <div className="small" style={{ marginTop: 12 }}>Archive summary</div>
          <div className="dataTableWrap">
            <div className="dataTable">
              <div className="dataTableHead dataTableArchive">
                <div>Scope</div>
                <div>Diary rows</div>
                <div>Review rows</div>
                <div>Comment rows</div>
                <div>List files</div>
                <div>Unique films</div>
              </div>
              {archives.archiveScopes.map((scope) => (
                <div className="dataTableRow dataTableArchive" key={scope.scope}>
                  <div>{scope.scope}</div>
                  <div>{formatInt(scope.diaryRows)}</div>
                  <div>{formatInt(scope.reviewRows)}</div>
                  <div>{formatInt(scope.commentRows)}</div>
                  <div>{formatInt(scope.listFiles)}</div>
                  <div>{formatInt(scope.uniqueFilmCount)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="small" style={{ marginTop: 12 }}>Parsed lists</div>
          {archives.lists.length === 0 ? (
            <p>No list exports found.</p>
          ) : (
            <div className="dataTableWrap">
              <div className="dataTable">
                <div className="dataTableHead dataTableLists">
                  <div>List</div>
                  <div>Status</div>
                  <div>Items</div>
                  <div>Metadata</div>
                </div>
                {archives.lists.slice(0, 12).map((list) => (
                  <div className="dataTableRow dataTableLists" key={list.path}>
                    <div className="dataEllipsis">{list.title || list.path}</div>
                    <div>{formatScope(list.scope)}</div>
                    <div>{formatInt(list.itemCount)}</div>
                    <div className="dataEllipsis">
                      {[
                        list.createdDate ? `created ${list.createdDate}` : null,
                        list.exportedDate ? `exported ${list.exportedDate}` : null,
                        list.tags.length ? `tags: ${list.tags.join(", ")}` : null,
                        list.parseError ? `parse issue: ${list.parseError}` : null,
                      ].filter(Boolean).join(" | ") || "n/a"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
