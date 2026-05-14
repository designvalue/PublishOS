"use client";

import { useUI, type SortKey } from "@/stores/ui-store";
import FolderList from "@/components/workspace/FolderRow";
import type { FolderRow as FolderRowType } from "@/lib/data/folders";
import { Plus, SortIcon, Upload } from "@/lib/icons";

const TABS: { key: "all" | "mine" | "shared" | "org"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mine", label: "Created by me" },
  { key: "shared", label: "Shared with me" },
  { key: "org", label: "Org-wide" },
];

export default function WorkspaceSection({
  folders,
  currentUserId,
  canCreate = true,
}: {
  folders: FolderRowType[];
  currentUserId: string | null;
  canCreate?: boolean;
}) {
  const {
    openNewFolder,
    openUpload,
    workspaceTab,
    setWorkspaceTab,
    openSortMenu,
    sortLabel,
    sortDir,
    sortMenu,
  } = useUI();

  const counts = {
    all: folders.length,
    mine: folders.filter((f) => f.ownerId === currentUserId).length,
    shared: folders.filter((f) => f.ownerId !== currentUserId).length,
    org: 0,
  };

  const filtered = folders.filter((f) => {
    if (workspaceTab === "mine") return f.ownerId === currentUserId;
    if (workspaceTab === "shared") return f.ownerId !== currentUserId;
    return true;
  });

  return (
    <div className="workspace-section">
      <div className="head">
        <div>
          <h2 className="title">
            <span className="it">All</span> folders
          </h2>
          <p className="sub">
            Organise your work into folders, then publish any file with its own public URL — open or password-protected.
          </p>
        </div>
        <div className="actions">
          {canCreate && (
            <>
              <button className="btn" onClick={() => openNewFolder()}>
                {Plus}
                New folder
              </button>
              <button className="btn btn-primary" onClick={() => openUpload()}>
                {Upload}
                Upload files
              </button>
            </>
          )}
        </div>
      </div>

      <div className="toolbar">
        <div className="tabs">
          {TABS.map((t) => (
            <span
              key={t.key}
              className={`tab${workspaceTab === t.key ? " active" : ""}`}
              onClick={() => setWorkspaceTab(t.key)}
            >
              {t.label} <span className="tab-count">{counts[t.key]}</span>
            </span>
          ))}
        </div>
        <div className="toolbar-spacer" />
        <button
          className={`sort${sortMenu ? " open" : ""}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            openSortMenu({ x: Math.max(8, r.right - 200), y: r.bottom + 4 });
          }}
        >
          <span className="sort-label">Sort by</span>
          <span className="sort-value">
            {sortLabel} {sortDir === "asc" ? "↑" : "↓"}
          </span>
          <span className="arrow">{SortIcon}</span>
        </button>
      </div>

      <FolderList folders={filtered} currentUserId={currentUserId} />
    </div>
  );
}

export type { SortKey };
