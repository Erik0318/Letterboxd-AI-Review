import React, { useMemo } from "react";
import { ParsedListFile } from "../lib/letterboxd";
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
  lists,
  title = "Lists & Archive",
  subtitle,
  onListClick,
}: {
  archives: StatPack["archives"];
  lists: ParsedListFile[];
  title?: string;
  subtitle?: string;
  onListClick?: (list: ParsedListFile, sourceElement: HTMLElement | null) => void;
}) {
  const visibleLists = useMemo(
    () => lists
      .filter((list) => list.scope !== "deleted")
      .sort((left, right) =>
        left.scope.localeCompare(right.scope)
        || (left.metadata.title || "").localeCompare(right.metadata.title || "")
        || left.path.localeCompare(right.path)),
    [lists],
  );

  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="small">
        {subtitle || "Read-only context from parsed lists and archive files. Missing files just stay at zero."}
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <span className="badge">Deleted diary rows: {formatInt(archives.summary.deletedDiaryRows.value)}</span>
        <span className="badge">Deleted review rows: {formatInt(archives.summary.deletedReviewRows.value)}</span>
        <span className="badge">Orphaned diary rows: {formatInt(archives.summary.orphanedDiaryRows.value)}</span>
        <span className="badge">Orphaned review rows: {formatInt(archives.summary.orphanedReviewRows.value)}</span>
        <span className="badge">Active lists: {formatInt(archives.summary.activeLists.value)}</span>
        <span className="badge">Archived lists: {formatInt(archives.summary.archivedLists.value)}</span>
      </div>

      <div className="archiveLayout">
        <div className="archiveBlock">
          <div className="small" style={{ marginTop: 12 }}>Archive summary</div>
          <div className="archiveScopeGrid">
            {archives.archiveScopes.map((scope) => (
              <div className="archiveScopeCard" key={scope.scope}>
                <div className="archiveScopeHeader">
                  <div>
                    <div className="archiveScopeTitle">{formatScope(scope.scope)}</div>
                    <div className="small">Rows and files found in this archive slice.</div>
                  </div>
                  <span className="badge">{formatInt(scope.uniqueFilmCount)} films</span>
                </div>

                <div className="archiveStatGrid">
                  <div className="archiveStatCard">
                    <div className="small">Diary rows</div>
                    <div className="archiveStatValue">{formatInt(scope.diaryRows)}</div>
                  </div>
                  <div className="archiveStatCard">
                    <div className="small">Review rows</div>
                    <div className="archiveStatValue">{formatInt(scope.reviewRows)}</div>
                  </div>
                  <div className="archiveStatCard">
                    <div className="small">Comment rows</div>
                    <div className="archiveStatValue">{formatInt(scope.commentRows)}</div>
                  </div>
                  <div className="archiveStatCard">
                    <div className="small">List files</div>
                    <div className="archiveStatValue">{formatInt(scope.listFiles)}</div>
                  </div>
                  <div className="archiveStatCard">
                    <div className="small">Unique films</div>
                    <div className="archiveStatValue">{formatInt(scope.uniqueFilmCount)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="archiveBlock">
          <div className="small" style={{ marginTop: 12 }}>Parsed lists</div>
          {visibleLists.length === 0 ? (
            <p>No visible list exports found.</p>
          ) : (
            <div className="archiveListStack">
              {visibleLists.slice(0, 12).map((list) => {
                const metadataBits = [
                  list.metadata.createdDate ? `created ${list.metadata.createdDate}` : null,
                  list.metadata.exportedDate ? `exported ${list.metadata.exportedDate}` : null,
                ].filter(Boolean) as string[];

                return (
                  <button
                    type="button"
                    className={`archiveListCard archiveListCardButton${onListClick ? " isInteractive" : ""}`}
                    key={list.path}
                    onClick={(event) => onListClick?.(list, event.currentTarget)}
                    disabled={!onListClick}
                  >
                    <div className="archiveListHeader">
                      <div className="archiveListTitleBlock">
                        <div className="archiveListTitle">{list.metadata.title || list.path}</div>
                        {list.metadata.title && <div className="archiveListPath">{list.path}</div>}
                      </div>

                      <span className="badge">{formatScope(list.scope)}</span>

                      <div className="archiveListCount">
                        <div className="small">Items</div>
                        <div className="archiveListCountValue">{formatInt(list.items.length)}</div>
                      </div>
                    </div>

                    <div className="archiveListMeta">
                      {metadataBits.length > 0 ? metadataBits.map((bit) => (
                        <span className="badge" key={`${list.path}:${bit}`}>{bit}</span>
                      )) : <span className="small">No export metadata</span>}
                      {list.metadata.tags.length > 0 && (
                        <div className="archiveMetaText">tags: {list.metadata.tags.join(", ")}</div>
                      )}
                      {list.parseError && (
                        <div className="archiveMetaText">parse issue: {list.parseError}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
