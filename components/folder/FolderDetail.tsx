"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { FileRow, FolderRow } from "@/lib/data/folders";
import { useUI } from "@/stores/ui-store";
import { FILE_ICONS, Kebab, Plus, ShareIcon, Upload } from "@/lib/icons";
import { formatBytes, formatRelative } from "@/lib/format";
import FolderNav from "./FolderNav";

// Folders are workspace-only — no public visibility states.
function visForFolder(f: FolderRow): "shared" | "private" {
  return f.visibility === "shared" ? "shared" : "private";
}
function visLabel(v: string) {
  return v === "shared" ? "Shared" : "Private";
}

function pickIcon(mime: string): keyof typeof FILE_ICONS {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime === "text/html") return "html";
  if (mime === "text/css") return "css";
  if (mime === "application/javascript" || mime === "text/javascript") return "js";
  return "file";
}

export default function FolderDetail({
  folder,
  ancestors,
  subfolders,
  files,
  counts,
  allFolders,
  isOwner,
  canCreate = true,
}: {
  folder: FolderRow;
  ancestors: FolderRow[];
  subfolders: FolderRow[];
  files: FileRow[];
  counts: { subfolders: number; files: number; bytes: number };
  allFolders: FolderRow[];
  isOwner: boolean;
  canCreate?: boolean;
}) {
  const { openShare, openNewFolder, openUpload, openActionMenu, setCurrentFolder } = useUI();

  // Register this folder as the "current upload context" while the page is
  // mounted. The window-level DropOverlay reads it so a file dropped anywhere
  // on the page defaults to this folder (or sub-folder) as its destination.
  useEffect(() => {
    setCurrentFolder({ folderId: folder.id, folderName: folder.name });
    return () => setCurrentFolder(null);
  }, [folder.id, folder.name, setCurrentFolder]);

  const isEmpty = files.length === 0 && subfolders.length === 0;
  const vis = visForFolder(folder);

  return (
    <main className="page folder-layout">
      <div className="folder-layout-top">
      <div className="crumbs">
        <Link href="/">Home</Link>
        {ancestors.map((a) => (
          <span key={a.id}>
            <span className="sep"> / </span>
            <Link href={`/folders/${a.id}`}>{a.name}</Link>
          </span>
        ))}
        <span className="sep"> / </span>
        <span className="here">{folder.name}</span>
      </div>

      <div className="detail-head" data-folder-color={folder.color ?? undefined}>
        <div className="detail-icon">
          <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
            <path
              d="M2 5.5A1.5 1.5 0 013.5 4h3l1.5 1.5h6A1.5 1.5 0 0115.5 7v6.5A1.5 1.5 0 0114 15H4a1.5 1.5 0 01-1.5-1.5v-8z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <h1 className="detail-name">{folder.name}</h1>
        </div>
        <div className="actions">
          {isOwner && (
            <button
              className="btn"
              onClick={() => openShare({ folderId: folder.id, name: folder.name, vis, kind: "folder" })}
            >
              {ShareIcon}
              Share
            </button>
          )}
          {isOwner && canCreate && (
            <button
              className="btn"
              onClick={() => openNewFolder({ parentId: folder.id, parentName: folder.name })}
            >
              {Plus}
              New folder
            </button>
          )}
          {isOwner && canCreate && (
            <button
              className="btn btn-primary"
              onClick={() => openUpload({ folderId: folder.id, folderName: folder.name })}
            >
              {Upload}
              Upload files
            </button>
          )}
        </div>
      </div>

      <div className="facts">
        <div className="fact">
          <div className="fact-label">Visibility</div>
          <div className={`fact-value${vis === "shared" ? " shared" : ""}`}>
            {visLabel(vis)}
          </div>
        </div>
        <div className="fact">
          <div className="fact-label">Files</div>
          <div className="fact-value">{counts.files}</div>
        </div>
        <div className="fact">
          <div className="fact-label">Subfolders</div>
          <div className="fact-value">{counts.subfolders}</div>
        </div>
        <div className="fact">
          <div className="fact-label">Size</div>
          <div className="fact-value">{counts.bytes > 0 ? formatBytes(counts.bytes) : "—"}</div>
        </div>
      </div>

      </div>

      <div className="folder-layout-body">
      <FolderNav
        folders={allFolders}
        currentId={folder.id}
        ancestorIds={ancestors.map((a) => a.id)}
      />
      <div className="folder-content">
          {subfolders.length > 0 && (
            <>
              <div className="subhead">
                Subfolders <span className="subhead-meta">{subfolders.length}</span>
              </div>
              <div className="list">
                {subfolders.map((s) => (
                  <Link
                    key={s.id}
                    href={`/folders/${s.id}`}
                    className="row row-quiet"
                    data-folder-color={s.color ?? undefined}
                    onClick={(e) => {
                      const t = e.target as HTMLElement;
                      if (t.closest("button")) e.preventDefault();
                    }}
                  >
                    <div className="row-name">
                      <div className="row-icon folder">{FILE_ICONS.folder}</div>
                      <div className="row-title">{s.name}</div>
                    </div>
                    <span className="row-meta">{formatRelative(s.modifiedAt)}</span>
                    <button
                      className="row-action-kebab"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const r = e.currentTarget.getBoundingClientRect();
                        openActionMenu({
                          kind: "subfolder",
                          name: s.name,
                          id: s.id,
                          x: Math.max(8, r.right - 200),
                          y: r.bottom + 6,
                        });
                      }}
                    >
                      {Kebab}
                    </button>
                  </Link>
                ))}
              </div>
            </>
          )}

          {files.length > 0 && (
            <>
              <div className="subhead">
                Files <span className="subhead-meta">{files.length}</span>
              </div>
              <div className="list">
                {files.map((f) => {
                  const isPublished = f.publishMode !== "off";
                  const isPasswordProtected = f.publishMode === "password";
                  return (
                    <div key={f.id} className="row row-quiet" style={{ cursor: "default" }}>
                      <div className="row-name">
                        <div className="row-icon">{FILE_ICONS[pickIcon(f.mime)]}</div>
                        <div className="row-title">
                          {f.name}
                          {isPublished ? (
                            <span className={`live-pill${isPasswordProtected ? " draft" : ""}`}>
                              {isPasswordProtected ? "Password" : "Public"}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className="row-meta">
                        {formatBytes(f.sizeBytes)} · {formatRelative(f.modifiedAt)}
                      </span>
                      <button
                        className="row-action-kebab"
                        onClick={(e) => {
                          e.stopPropagation();
                          const r = e.currentTarget.getBoundingClientRect();
                          openActionMenu({
                            kind: "file",
                            name: f.name,
                            id: f.id,
                            publishMode: f.publishMode,
                            publicSlug: f.publicSlug,
                            mime: f.mime,
                            x: Math.max(8, r.right - 200),
                            y: r.bottom + 6,
                          });
                        }}
                      >
                        {Kebab}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {isEmpty && (
            <div className="empty-state" style={{ marginTop: 12 }}>
              <div className="empty-title">This folder is empty</div>
              <div className="empty-desc">
                Drop files or create a subfolder to begin. Any file can be published with its own URL.
              </div>
            </div>
          )}
      </div>
      </div>
    </main>
  );
}
