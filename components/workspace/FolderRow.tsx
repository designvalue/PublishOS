"use client";

import Link from "next/link";
import type { FolderRow as FolderRowType } from "@/lib/data/folders";
import { useUI } from "@/stores/ui-store";
import { FILE_ICONS, Kebab } from "@/lib/icons";
import { formatRelative } from "@/lib/format";

// Folders are private organisational containers. Their only visibility states
// are Private (just owner + workspace defaults) or Shared (members/teams).
function visForFolder(f: FolderRowType): "shared" | "private" {
  return f.visibility === "shared" ? "shared" : "private";
}

function visLabel(v: string) {
  return v === "shared" ? "Shared" : "Private";
}

function Row({ folder, currentUserId }: { folder: FolderRowType; currentUserId: string | null }) {
  const { openShare, openActionMenu } = useUI();
  const vis = visForFolder(folder);
  const isOwner = folder.ownerId === currentUserId;

  return (
    <Link
      href={`/folders/${folder.id}`}
      className="row"
      data-folder-color={folder.color ?? undefined}
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest("button")) e.preventDefault();
      }}
    >
      <div className="row-name">
        <div className="row-icon folder">{FILE_ICONS.folder}</div>
        <div>
          <div className="row-title">
            {folder.name}
            {!isOwner ? <span className="from-pill">Shared</span> : null}
          </div>
          <div className="row-sub">Updated {formatRelative(folder.modifiedAt)}</div>
        </div>
      </div>
      <span className={`row-vis ${vis}`}>
        <span className="dot" />
        {visLabel(vis)}
      </span>
      <span className="row-quick">
        <button
          className="share-quick"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openShare({ folderId: folder.id, name: folder.name, vis, kind: "folder" });
          }}
        >
          Share
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            openActionMenu({
              kind: "folder",
              name: folder.name,
              id: folder.id,
              x: Math.max(8, r.right - 200),
              y: r.bottom + 6,
            });
          }}
        >
          {Kebab}
        </button>
      </span>
    </Link>
  );
}

export default function FolderList({
  folders,
  currentUserId,
}: {
  folders: FolderRowType[];
  currentUserId: string | null;
}) {
  if (folders.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-title">No folders yet</div>
        <div className="empty-desc">
          Drop a file above or create a new folder to begin. Any file can be published with its own URL.
        </div>
      </div>
    );
  }
  return (
    <div className="list">
      {folders.map((f) => (
        <Row key={f.id} folder={f} currentUserId={currentUserId} />
      ))}
    </div>
  );
}
