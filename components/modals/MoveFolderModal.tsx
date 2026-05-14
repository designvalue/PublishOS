"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/stores/ui-store";
import { toast } from "@/stores/toast-store";
import { Close } from "@/lib/icons";

type FolderOption = {
  id: string;
  name: string;
  parentId: string | null;
};

export default function MoveFolderModal() {
  const { moveTarget, closeMove } = useUI();
  return (
    <>
      <div className={`modal-backdrop${moveTarget ? " open" : ""}`} onClick={closeMove} />
      <div className={`modal modal-wide${moveTarget ? " open" : ""}`} role="dialog" aria-modal="true">
        {moveTarget && <MoveBody key={moveTarget.folderId} target={moveTarget} closeMove={closeMove} />}
      </div>
    </>
  );
}

function MoveBody({
  target,
  closeMove,
}: {
  target: { folderId: string; folderName: string; kind?: "folder" | "file" };
  closeMove: () => void;
}) {
  const router = useRouter();
  const kind = target.kind ?? "folder";

  const [folders, setFolders] = useState<FolderOption[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [originParentId, setOriginParentId] = useState<string | null | undefined>(undefined);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/folders?scope=all", { credentials: "include" }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      // Load the source so we can highlight its current parent + skip itself
      // (and, for folders, all descendants) in the destination tree.
      kind === "folder"
        ? fetch(`/api/folders/${target.folderId}`, { credentials: "include" }).then((r) => (r.ok ? r.json() : null))
        : fetch(`/api/files/${target.folderId}/publishing`, { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([listBody, srcBody]) => {
        if (cancelled) return;
        const list = (listBody.folders ?? []) as FolderOption[];
        setFolders(list);

        if (kind === "folder") {
          const src = srcBody?.folder as { parentId: string | null } | undefined;
          setOriginParentId(src?.parentId ?? null);
        } else {
          // For files, we need the parent folder id. Pull it from the all-folders
          // list by finding any folder whose id matches the file's folderId — but
          // we don't have it from the publishing payload. Hit /api/files/[id]/publishing
          // doesn't include folderId; we'll resolve by file row directly.
          fetch(`/api/files/${target.folderId}`, { method: "HEAD", credentials: "include" }).catch(() => undefined);
          setOriginParentId(undefined);
        }

        // Auto-expand the ancestors of the source so the relevant branch is open.
        const byId = new Map(list.map((f) => [f.id, f]));
        const initial = new Set<string>();
        const startId = kind === "folder" ? target.folderId : null;
        if (startId) {
          let cursor = byId.get(startId)?.parentId ?? null;
          while (cursor) {
            initial.add(cursor);
            cursor = byId.get(cursor)?.parentId ?? null;
          }
        }
        setExpanded(initial);
      })
      .catch(() => {
        if (!cancelled) setFolders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [target.folderId, kind]);

  // Build parent→children map.
  const tree = useMemo(() => {
    const map = new Map<string | null, FolderOption[]>();
    for (const f of folders ?? []) {
      const key = f.parentId ?? null;
      const list = map.get(key) ?? [];
      list.push(f);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [folders]);

  // For folder moves: compute the set of descendants of the source to exclude.
  const blockedIds = useMemo(() => {
    const out = new Set<string>();
    if (kind !== "folder" || !folders) return out;
    out.add(target.folderId);
    const queue = [target.folderId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      for (const child of tree.get(id) ?? []) {
        out.add(child.id);
        queue.push(child.id);
      }
    }
    return out;
  }, [tree, folders, kind, target.folderId]);

  // Filter via search — flatten to all matching nodes, but keep their ancestors expanded.
  const filterLower = query.trim().toLowerCase();
  const visibleIds = useMemo(() => {
    if (!filterLower || !folders) return null; // null = use tree mode
    const byId = new Map(folders.map((f) => [f.id, f]));
    const visible = new Set<string>();
    for (const f of folders) {
      if (f.name.toLowerCase().includes(filterLower)) {
        // Include the match + all its ancestors so the path is visible.
        let cursor: string | null = f.id;
        while (cursor) {
          visible.add(cursor);
          cursor = byId.get(cursor)?.parentId ?? null;
        }
      }
    }
    return visible;
  }, [filterLower, folders]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderNode(folder: FolderOption, depth: number): React.ReactNode {
    if (visibleIds && !visibleIds.has(folder.id)) return null;
    const children = tree.get(folder.id) ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(folder.id) || !!visibleIds;
    const disabled = blockedIds.has(folder.id);
    const isSelected = selected === folder.id;
    const isCurrent = originParentId === folder.id;
    return (
      <div key={folder.id}>
        <div
          className={[
            "move-tree-row",
            isSelected ? "is-selected" : "",
            disabled ? "is-disabled" : "",
            isCurrent ? "is-current" : "",
          ].filter(Boolean).join(" ")}
          style={{ paddingLeft: 10 + depth * 16 }}
        >
          {hasChildren ? (
            <button
              type="button"
              className={`move-tree-caret${isExpanded ? " is-open" : ""}`}
              onClick={() => toggle(folder.id)}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              <svg viewBox="0 0 12 12" width="10" height="10" fill="none">
                <path d="M4 3l4 3-4 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <span className="move-tree-caret is-leaf" />
          )}
          <button
            type="button"
            className="move-tree-link"
            onClick={() => !disabled && setSelected(folder.id)}
            disabled={disabled}
          >
            <svg viewBox="0 0 18 18" width="14" height="14" fill="none" className="move-tree-icon">
              <path d="M2 5.5A1.5 1.5 0 013.5 4h3l1.5 1.5h6A1.5 1.5 0 0115.5 7v6.5A1.5 1.5 0 0114 15H4a1.5 1.5 0 01-1.5-1.5v-8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
            <span className="move-tree-name">{folder.name}</span>
            {isCurrent ? <span className="move-tree-pill">Current</span> : null}
          </button>
        </div>
        {hasChildren && isExpanded ? (
          <div className="move-tree-children">
            {children.map((c) => renderNode(c, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  }

  const roots = tree.get(null) ?? [];
  const destinationName = useMemo(() => {
    if (selected === null) return "Workspace root";
    return folders?.find((f) => f.id === selected)?.name ?? "destination";
  }, [selected, folders]);

  async function commit() {
    setMoving(true);
    setError(null);
    try {
      if (kind === "file") {
        if (selected === null) {
          setError("Pick a destination folder for the file.");
          setMoving(false);
          return;
        }
        const res = await fetch(`/api/files/${target.folderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ folderId: selected }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? "Could not move file");
          setMoving(false);
          return;
        }
      } else {
        const res = await fetch(`/api/folders/${target.folderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ parentId: selected }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? "Could not move folder");
          setMoving(false);
          return;
        }
      }
      toast(`Moved "${target.folderName}" to ${destinationName}`);
      router.refresh();
      closeMove();
    } finally {
      setMoving(false);
    }
  }

  const canMoveToRoot = kind === "folder";
  const noChange = kind === "folder" && selected === (originParentId ?? null);

  return (
    <>
      <div className="modal-head">
        <div>
          <div className="modal-title">Move {kind}</div>
          <div className="modal-sub">
            Pick where “{target.folderName}” should live. Browse any depth or search.
          </div>
        </div>
        <button className="modal-close" onClick={closeMove}>
          {Close}
        </button>
      </div>
      <div className="modal-body">
        <input
          type="text"
          className="move-search"
          placeholder="Search folders…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="move-tree" role="tree">
          {canMoveToRoot && (!filterLower || "workspace root".includes(filterLower)) && (
            <div
              className={`move-tree-row${selected === null ? " is-selected" : ""}${originParentId === null ? " is-current" : ""}`}
            >
              <span className="move-tree-caret is-leaf" />
              <button type="button" className="move-tree-link" onClick={() => setSelected(null)}>
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" className="move-tree-icon">
                  <path d="M2.5 7.5L8 3l5.5 4.5V13a1 1 0 01-1 1H3.5a1 1 0 01-1-1V7.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
                <span className="move-tree-name">Workspace root</span>
                {originParentId === null ? <span className="move-tree-pill">Current</span> : null}
              </button>
            </div>
          )}
          {folders === null ? (
            <div className="field-hint" style={{ padding: "12px 10px" }}>Loading…</div>
          ) : roots.length === 0 ? (
            <div className="field-hint" style={{ padding: "12px 10px" }}>No folders yet.</div>
          ) : (
            roots.map((r) => renderNode(r, 0))
          )}
          {filterLower && visibleIds && visibleIds.size === 0 ? (
            <div className="field-hint" style={{ padding: "12px 10px" }}>No matches for “{query}”.</div>
          ) : null}
        </div>
        {error && <div className="login-error" style={{ marginTop: 10 }}>{error}</div>}
      </div>
      <div className="modal-footer">
        <span className="left" style={{ minWidth: 0 }}>
          Moving to: <strong>{destinationName}</strong>
        </span>
        <div className="right">
          <button className="btn" onClick={closeMove} disabled={moving}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={commit}
            disabled={moving || noChange || (kind === "file" && selected === null)}
            title={noChange ? "Pick a different destination" : undefined}
          >
            {moving ? "Moving…" : "Move here"}
          </button>
        </div>
      </div>
    </>
  );
}
