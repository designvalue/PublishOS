"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FolderRow } from "@/lib/data/folders";

type Props = {
  folders: FolderRow[];
  currentId: string;
  ancestorIds: string[];
};

type NodeRender = { folder: FolderRow; depth: number; childCount: number };

export default function FolderNav({ folders, currentId, ancestorIds }: Props) {
  // Index children by parent id.
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, FolderRow[]>();
    for (const f of folders) {
      const key = f.parentId ?? null;
      const list = map.get(key) ?? [];
      list.push(f);
      map.set(key, list);
    }
    // Sort siblings alphabetically (stable, predictable).
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [folders]);

  // Auto-expand ancestors + the current folder so its children show.
  const initiallyExpanded = useMemo(
    () => new Set<string>([...ancestorIds, currentId]),
    [ancestorIds, currentId],
  );
  const [expanded, setExpanded] = useState<Set<string>>(initiallyExpanded);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Flatten the tree into a render list, respecting expanded state.
  const rendered: NodeRender[] = [];
  const roots = childrenByParent.get(null) ?? [];

  function walk(node: FolderRow, depth: number) {
    const children = childrenByParent.get(node.id) ?? [];
    rendered.push({ folder: node, depth, childCount: children.length });
    if (expanded.has(node.id)) {
      for (const c of children) walk(c, depth + 1);
    }
  }
  for (const r of roots) walk(r, 0);

  return (
    <nav className="folder-nav" aria-label="Folder tree">
      <Link href="/" className="folder-nav-home">All folders</Link>

      {rendered.length === 0 ? (
        <div className="folder-nav-empty">No other folders yet.</div>
      ) : (
        <ul className="folder-nav-list">
          {rendered.map(({ folder, depth, childCount }) => {
            const isCurrent = folder.id === currentId;
            const isOpen = expanded.has(folder.id);
            return (
              <li key={folder.id} className="folder-nav-item">
                <div
                  className={`folder-nav-row${isCurrent ? " is-current" : ""}`}
                  data-folder-color={folder.color ?? undefined}
                  style={{ paddingLeft: 10 + depth * 14 }}
                >
                  {childCount > 0 ? (
                    <button
                      type="button"
                      className={`folder-nav-toggle${isOpen ? " is-open" : ""}`}
                      onClick={() => toggle(folder.id)}
                      aria-label={isOpen ? "Collapse" : "Expand"}
                      aria-expanded={isOpen}
                    >
                      <svg viewBox="0 0 12 12" width="10" height="10" fill="none" aria-hidden="true">
                        <path d="M4 3l4 3-4 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : (
                    <span className="folder-nav-toggle is-leaf" aria-hidden="true" />
                  )}
                  <Link href={`/folders/${folder.id}`} className="folder-nav-link" prefetch={false}>
                    <span className="folder-nav-name">{folder.name}</span>
                    {folder.color ? <span className="folder-nav-color-dot" aria-hidden="true" /> : null}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
