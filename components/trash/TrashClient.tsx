"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/stores/ui-store";
import { toast } from "@/stores/toast-store";
import { FILE_ICONS } from "@/lib/icons";
import { formatBytes, formatRelative } from "@/lib/format";

/* ---------- types ---------- */

type RootFolder = {
  id: string;
  name: string;
  parentId: string | null;
  color: string | null;
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string;
  archivedAt: string;
};
type RootFile = {
  id: string;
  name: string;
  folderId: string;
  folderName: string;
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string;
  mime: string;
  sizeBytes: number;
  archivedAt: string;
};

type ChildFolder = {
  id: string;
  name: string;
  color: string | null;
  archivedAt: string | null;
};
type ChildFile = {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  archivedAt: string | null;
  modifiedAt: string;
};
type Crumb = { id: string; name: string };
type DrillResponse = {
  folder: { id: string; name: string; color: string | null; archivedAt: string };
  ancestors: Crumb[];
  subfolders: ChildFolder[];
  files: ChildFile[];
};

/* ---------- helpers ---------- */

function pickIcon(mime: string): keyof typeof FILE_ICONS {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime === "text/html") return "html";
  if (mime === "text/css") return "css";
  if (mime === "application/javascript" || mime === "text/javascript") return "js";
  return "file";
}

/* ---------- component ---------- */

export default function TrashClient({ canSeeAll }: { canSeeAll: boolean }) {
  const router = useRouter();
  const { openConfirm } = useUI();

  // Where we are: null = root view, a folder id = drilled in.
  const [drillId, setDrillId] = useState<string | null>(null);

  // Root view data
  const [rootFolders, setRootFolders] = useState<RootFolder[] | null>(null);
  const [rootFiles, setRootFiles] = useState<RootFile[] | null>(null);

  // Drill-down data
  const [drill, setDrill] = useState<DrillResponse | null>(null);

  // Selection (per view — reset when navigating). Stored as kind:id strings.
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Search query (client-side filter).
  const [query, setQuery] = useState("");

  const [busy, setBusy] = useState(false);

  /* ---------- loaders ---------- */

  const loadRoot = useCallback(async () => {
    const res = await fetch("/api/trash");
    if (!res.ok) {
      toast("Could not load trash");
      return;
    }
    const body = (await res.json()) as { folders: RootFolder[]; files: RootFile[] };
    setRootFolders(body.folders);
    setRootFiles(body.files);
  }, []);

  const loadDrill = useCallback(async (id: string) => {
    const res = await fetch(`/api/trash/${id}`);
    if (!res.ok) {
      toast("Could not open trashed folder");
      setDrillId(null);
      return;
    }
    setDrill((await res.json()) as DrillResponse);
  }, []);

  // Initial load + re-load when drill changes. Canonical fetch-on-mount /
  // dep-change pattern that React 19's set-state-in-effect rule flags
  // overzealously — the setState calls happen inside the async `load*`
  // callbacks, not synchronously in the effect body.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRoot();
  }, [loadRoot]);

  // Reset selection / search / drilldown when the user navigates between root
  // and a drilled-in folder. This is "derived state from a trigger" — the
  // React-recommended alternative is a `key` prop remount, but the trash
  // listing surface depends on too much surrounding context to remount cheaply.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setSelected(new Set());
    setQuery("");
    if (drillId) {
      setDrill(null);
      void loadDrill(drillId);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [drillId, loadDrill]);

  /* ---------- selection ---------- */

  function toggleOne(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAll(keys: string[]) {
    setSelected(new Set(keys));
  }
  function clearSelection() {
    setSelected(new Set());
  }

  function selectionSplit(): { folderIds: string[]; fileIds: string[] } {
    const folderIds: string[] = [];
    const fileIds: string[] = [];
    for (const key of selected) {
      const [kind, id] = key.split(":");
      if (kind === "f") folderIds.push(id);
      else if (kind === "x") fileIds.push(id);
    }
    return { folderIds, fileIds };
  }

  /* ---------- single-item actions ---------- */

  async function restoreOne(kind: "folder" | "file", id: string, name: string) {
    setBusy(true);
    const url = kind === "folder" ? `/api/folders/${id}/restore` : `/api/files/${id}/restore`;
    const res = await fetch(url, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast(body.error ?? `Could not restore ${name}`);
      return;
    }
    toast(`Restored "${name}"`);
    await refresh();
    router.refresh();
  }

  function purgeOne(kind: "folder" | "file", id: string, name: string) {
    openConfirm({
      title: `Permanently delete ${kind}?`,
      description:
        kind === "folder"
          ? `"${name}" and everything inside it will be removed forever. This can't be undone.`
          : `"${name}" will be removed forever. This can't be undone.`,
      confirmLabel: "Delete forever",
      danger: true,
      onConfirm: async () => {
        setBusy(true);
        const url = kind === "folder" ? `/api/folders/${id}/purge` : `/api/files/${id}/purge`;
        const res = await fetch(url, { method: "POST" });
        setBusy(false);
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          toast(body.error ?? `Could not delete ${name}`);
          return;
        }
        toast(`Deleted "${name}" forever`);
        await refresh();
        router.refresh();
      },
    });
  }

  function downloadFile(id: string, name: string) {
    const url = `/api/files/${id}?from=trash`;
    // Use window.open so the browser surface attaches the download / preview
    // headers from the response. Pass `download` via an invisible anchor so
    // the browser saves with the original name when content-disposition is
    // inline.
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------- bulk actions ---------- */

  async function bulkRestore() {
    const { folderIds, fileIds } = selectionSplit();
    if (folderIds.length === 0 && fileIds.length === 0) return;
    setBusy(true);
    const res = await fetch("/api/trash/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folders: folderIds, files: fileIds }),
    });
    setBusy(false);
    if (!res.ok) {
      toast("Could not restore selection");
      return;
    }
    const body = (await res.json()) as { restoredFolders: number; restoredFiles: number };
    const total = body.restoredFolders + body.restoredFiles;
    toast(total === 1 ? "Restored 1 item" : `Restored ${total} items`);
    clearSelection();
    await refresh();
    router.refresh();
  }

  function bulkPurge() {
    const { folderIds, fileIds } = selectionSplit();
    if (folderIds.length === 0 && fileIds.length === 0) return;
    const count = folderIds.length + fileIds.length;
    openConfirm({
      title: `Permanently delete ${count} item${count === 1 ? "" : "s"}?`,
      description: "Selected items and any nested contents will be removed forever. This can't be undone.",
      confirmLabel: "Delete forever",
      danger: true,
      onConfirm: async () => {
        setBusy(true);
        const res = await fetch("/api/trash/purge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folders: folderIds, files: fileIds }),
        });
        setBusy(false);
        if (!res.ok) {
          toast("Could not delete selection");
          return;
        }
        const body = (await res.json()) as { purgedFolders: number; purgedFiles: number };
        const total = body.purgedFolders + body.purgedFiles;
        toast(total === 1 ? "Deleted 1 item forever" : `Deleted ${total} items forever`);
        clearSelection();
        await refresh();
        router.refresh();
      },
    });
  }

  async function refresh() {
    if (drillId) {
      await loadDrill(drillId);
    } else {
      await loadRoot();
    }
  }

  /* ---------- view models ---------- */

  // ROOT VIEW filtered items
  const filteredRoot = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fs = (rootFolders ?? []).filter((f) => !q || f.name.toLowerCase().includes(q));
    const xs = (rootFiles ?? []).filter((x) => !q || x.name.toLowerCase().includes(q));
    return { folders: fs, files: xs };
  }, [rootFolders, rootFiles, query]);

  // DRILL VIEW filtered items
  const filteredDrill = useMemo(() => {
    if (!drill) return { folders: [] as ChildFolder[], files: [] as ChildFile[] };
    const q = query.trim().toLowerCase();
    const fs = drill.subfolders.filter((f) => !q || f.name.toLowerCase().includes(q));
    const xs = drill.files.filter((x) => !q || x.name.toLowerCase().includes(q));
    return { folders: fs, files: xs };
  }, [drill, query]);

  const isRoot = drillId === null;
  const loading = isRoot
    ? rootFolders === null || rootFiles === null
    : drill === null;
  const totalSelected = selected.size;

  // Keys of currently visible items (for "Select all").
  const visibleKeys = useMemo(() => {
    const out: string[] = [];
    const fs = isRoot ? filteredRoot.folders : filteredDrill.folders;
    const xs = isRoot ? filteredRoot.files : filteredDrill.files;
    for (const f of fs) out.push("f:" + f.id);
    for (const x of xs) out.push("x:" + x.id);
    return out;
  }, [isRoot, filteredRoot, filteredDrill]);

  const allSelected = visibleKeys.length > 0 && visibleKeys.every((k) => selected.has(k));
  const someSelected = visibleKeys.some((k) => selected.has(k));

  /* ---------- render ---------- */

  return (
    <main className="page">
      <div className="trash-head">
        <div>
          <h1 className="trash-title">Trash</h1>
          <p className="trash-sub">
            {canSeeAll
              ? "Restore or permanently delete anything in the workspace. Admins can manage everyone's items."
              : "Restore or permanently delete your own items."}
          </p>
        </div>
      </div>

      {/* Toolbar: breadcrumbs (when drilled in) + search + bulk-action bar */}
      <div className="trash-toolbar">
        {isRoot ? (
          <div className="trash-crumbs">
            <span className="here">Trash</span>
          </div>
        ) : (
          <nav className="trash-crumbs" aria-label="Trash path">
            <button type="button" className="trash-crumb-btn" onClick={() => setDrillId(null)}>
              Trash
            </button>
            {drill?.ancestors.map((a) => (
              <span key={a.id} className="trash-crumb-segment">
                <span className="sep">/</span>
                <button type="button" className="trash-crumb-btn" onClick={() => setDrillId(a.id)}>
                  {a.name}
                </button>
              </span>
            ))}
            <span className="sep">/</span>
            <span className="here">{drill?.folder.name ?? "…"}</span>
          </nav>
        )}

        <div className="trash-toolbar-right">
          <input
            type="text"
            className="trash-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in trash…"
            spellCheck={false}
          />
        </div>
      </div>

      {/* Bulk action bar */}
      {totalSelected > 0 ? (
        <div className="trash-bulkbar">
          <span className="trash-bulkbar-count">
            {totalSelected} selected
          </span>
          <button type="button" className="btn" onClick={clearSelection} disabled={busy}>
            Clear
          </button>
          <button type="button" className="btn" onClick={bulkRestore} disabled={busy}>
            Restore
          </button>
          <button type="button" className="btn btn-danger" onClick={bulkPurge} disabled={busy}>
            Delete forever
          </button>
        </div>
      ) : null}

      {/* Content */}
      {loading ? (
        <div className="trash-loading">Loading…</div>
      ) : isRoot ? (
        <RootView
          folders={filteredRoot.folders}
          files={filteredRoot.files}
          canSeeAll={canSeeAll}
          selected={selected}
          onToggleOne={toggleOne}
          onSelectAll={() => (allSelected ? clearSelection() : selectAll(visibleKeys))}
          allSelected={allSelected}
          someSelected={someSelected}
          onOpenFolder={(id) => setDrillId(id)}
          onRestoreOne={(kind, id, name) => restoreOne(kind, id, name)}
          onPurgeOne={(kind, id, name) => purgeOne(kind, id, name)}
          onDownloadFile={downloadFile}
          busy={busy}
        />
      ) : drill ? (
        <DrillView
          drill={drill}
          folders={filteredDrill.folders}
          files={filteredDrill.files}
          selected={selected}
          onToggleOne={toggleOne}
          onSelectAll={() => (allSelected ? clearSelection() : selectAll(visibleKeys))}
          allSelected={allSelected}
          someSelected={someSelected}
          onOpenFolder={(id) => setDrillId(id)}
          onRestoreOne={(kind, id, name) => restoreOne(kind, id, name)}
          onPurgeOne={(kind, id, name) => purgeOne(kind, id, name)}
          onDownloadFile={downloadFile}
          busy={busy}
        />
      ) : null}

      {/* Empty states */}
      {!loading && totalSelected === 0 && (
        (isRoot && filteredRoot.folders.length === 0 && filteredRoot.files.length === 0) ||
        (!isRoot && filteredDrill.folders.length === 0 && filteredDrill.files.length === 0)
      ) ? (
        <div className="empty-state" style={{ marginTop: 12 }}>
          <div className="empty-title">
            {query ? "No matches" : isRoot ? "The recycle bin is empty" : "This folder is empty"}
          </div>
          <div className="empty-desc">
            {query
              ? `Nothing in trash matches “${query}”.`
              : isRoot
                ? "Deleted folders and files will show up here."
                : "Nothing was inside this folder when it was deleted."}
          </div>
        </div>
      ) : null}
    </main>
  );
}

/* ====== Root view ====== */

function RootView(props: {
  folders: RootFolder[];
  files: RootFile[];
  canSeeAll: boolean;
  selected: Set<string>;
  onToggleOne: (key: string) => void;
  onSelectAll: () => void;
  allSelected: boolean;
  someSelected: boolean;
  onOpenFolder: (id: string) => void;
  onRestoreOne: (kind: "folder" | "file", id: string, name: string) => void;
  onPurgeOne: (kind: "folder" | "file", id: string, name: string) => void;
  onDownloadFile: (id: string, name: string) => void;
  busy: boolean;
}) {
  const {
    folders,
    files,
    canSeeAll,
    selected,
    onToggleOne,
    onSelectAll,
    allSelected,
    someSelected,
    onOpenFolder,
    onRestoreOne,
    onPurgeOne,
    onDownloadFile,
    busy,
  } = props;

  return (
    <>
      {(folders.length > 0 || files.length > 0) && (
        <div className="trash-selectall">
          <Checkbox
            checked={allSelected}
            indeterminate={!allSelected && someSelected}
            onChange={onSelectAll}
            label={allSelected ? "Deselect all" : "Select all visible"}
          />
        </div>
      )}

      {folders.length > 0 && (
        <section className="trash-section">
          <div className="subhead">
            Folders <span className="subhead-meta">{folders.length}</span>
          </div>
          <div className="list">
            {folders.map((f) => {
              const key = "f:" + f.id;
              return (
                <div key={f.id} className="row row-quiet trash-row" data-folder-color={f.color ?? undefined}>
                  <div className="row-name">
                    <Checkbox checked={selected.has(key)} onChange={() => onToggleOne(key)} />
                    <button
                      type="button"
                      className="trash-name-btn"
                      onClick={() => onOpenFolder(f.id)}
                      title="Open in trash"
                    >
                      <div className="row-icon folder">{FILE_ICONS.folder}</div>
                      <div className="trash-info">
                        <div className="row-title">{f.name}</div>
                        <div className="trash-meta">
                          {canSeeAll ? <span>{f.ownerName ?? f.ownerEmail} · </span> : null}
                          Deleted {formatRelative(new Date(f.archivedAt))}
                        </div>
                      </div>
                    </button>
                  </div>
                  <div className="trash-actions">
                    <button
                      className="btn"
                      type="button"
                      disabled={busy}
                      onClick={() => onRestoreOne("folder", f.id, f.name)}
                    >
                      Restore
                    </button>
                    <button
                      className="btn btn-danger"
                      type="button"
                      disabled={busy}
                      onClick={() => onPurgeOne("folder", f.id, f.name)}
                    >
                      Delete forever
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {files.length > 0 && (
        <section className="trash-section">
          <div className="subhead">
            Files <span className="subhead-meta">{files.length}</span>
          </div>
          <div className="list">
            {files.map((f) => {
              const key = "x:" + f.id;
              return (
                <div key={f.id} className="row row-quiet trash-row">
                  <div className="row-name">
                    <Checkbox checked={selected.has(key)} onChange={() => onToggleOne(key)} />
                    <div className="row-icon">{FILE_ICONS[pickIcon(f.mime)]}</div>
                    <div className="trash-info">
                      <div className="row-title">{f.name}</div>
                      <div className="trash-meta">
                        {canSeeAll ? <span>{f.ownerName ?? f.ownerEmail} · </span> : null}
                        From {f.folderName} · {formatBytes(f.sizeBytes)} · Deleted {formatRelative(new Date(f.archivedAt))}
                      </div>
                    </div>
                  </div>
                  <div className="trash-actions">
                    <button
                      className="btn"
                      type="button"
                      disabled={busy}
                      onClick={() => onDownloadFile(f.id, f.name)}
                    >
                      Download
                    </button>
                    <button
                      className="btn"
                      type="button"
                      disabled={busy}
                      onClick={() => onRestoreOne("file", f.id, f.name)}
                    >
                      Restore
                    </button>
                    <button
                      className="btn btn-danger"
                      type="button"
                      disabled={busy}
                      onClick={() => onPurgeOne("file", f.id, f.name)}
                    >
                      Delete forever
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

/* ====== Drill view (inside a trashed folder) ====== */

function DrillView(props: {
  drill: DrillResponse;
  folders: ChildFolder[];
  files: ChildFile[];
  selected: Set<string>;
  onToggleOne: (key: string) => void;
  onSelectAll: () => void;
  allSelected: boolean;
  someSelected: boolean;
  onOpenFolder: (id: string) => void;
  onRestoreOne: (kind: "folder" | "file", id: string, name: string) => void;
  onPurgeOne: (kind: "folder" | "file", id: string, name: string) => void;
  onDownloadFile: (id: string, name: string) => void;
  busy: boolean;
}) {
  const {
    folders,
    files,
    selected,
    onToggleOne,
    onSelectAll,
    allSelected,
    someSelected,
    onOpenFolder,
    onRestoreOne,
    onPurgeOne,
    onDownloadFile,
    busy,
  } = props;

  return (
    <>
      {(folders.length > 0 || files.length > 0) && (
        <div className="trash-selectall">
          <Checkbox
            checked={allSelected}
            indeterminate={!allSelected && someSelected}
            onChange={onSelectAll}
            label={allSelected ? "Deselect all" : "Select all visible"}
          />
        </div>
      )}

      {folders.length > 0 && (
        <section className="trash-section">
          <div className="subhead">
            Subfolders <span className="subhead-meta">{folders.length}</span>
          </div>
          <div className="list">
            {folders.map((f) => {
              const key = "f:" + f.id;
              return (
                <div key={f.id} className="row row-quiet trash-row" data-folder-color={f.color ?? undefined}>
                  <div className="row-name">
                    <Checkbox checked={selected.has(key)} onChange={() => onToggleOne(key)} />
                    <button
                      type="button"
                      className="trash-name-btn"
                      onClick={() => onOpenFolder(f.id)}
                      title="Open in trash"
                    >
                      <div className="row-icon folder">{FILE_ICONS.folder}</div>
                      <div className="trash-info">
                        <div className="row-title">{f.name}</div>
                        <div className="trash-meta">
                          {f.archivedAt
                            ? `Deleted ${formatRelative(new Date(f.archivedAt))}`
                            : "Inherited from parent"}
                        </div>
                      </div>
                    </button>
                  </div>
                  <div className="trash-actions">
                    <button
                      className="btn"
                      type="button"
                      disabled={busy || !f.archivedAt}
                      onClick={() => onRestoreOne("folder", f.id, f.name)}
                      title={
                        f.archivedAt
                          ? undefined
                          : "Restore the parent folder first"
                      }
                    >
                      Restore
                    </button>
                    <button
                      className="btn btn-danger"
                      type="button"
                      disabled={busy || !f.archivedAt}
                      onClick={() => onPurgeOne("folder", f.id, f.name)}
                      title={
                        f.archivedAt
                          ? undefined
                          : "Restore or purge from the parent's level"
                      }
                    >
                      Delete forever
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {files.length > 0 && (
        <section className="trash-section">
          <div className="subhead">
            Files <span className="subhead-meta">{files.length}</span>
          </div>
          <div className="list">
            {files.map((f) => {
              const key = "x:" + f.id;
              return (
                <div key={f.id} className="row row-quiet trash-row">
                  <div className="row-name">
                    <Checkbox checked={selected.has(key)} onChange={() => onToggleOne(key)} />
                    <div className="row-icon">{FILE_ICONS[pickIcon(f.mime)]}</div>
                    <div className="trash-info">
                      <div className="row-title">{f.name}</div>
                      <div className="trash-meta">
                        {formatBytes(f.sizeBytes)}
                        {f.archivedAt
                          ? ` · Deleted ${formatRelative(new Date(f.archivedAt))}`
                          : " · Inside trashed folder"}
                      </div>
                    </div>
                  </div>
                  <div className="trash-actions">
                    <button
                      className="btn"
                      type="button"
                      disabled={busy}
                      onClick={() => onDownloadFile(f.id, f.name)}
                    >
                      Download
                    </button>
                    <button
                      className="btn"
                      type="button"
                      disabled={busy || !f.archivedAt}
                      onClick={() => onRestoreOne("file", f.id, f.name)}
                      title={
                        f.archivedAt
                          ? undefined
                          : "Restore the parent folder first"
                      }
                    >
                      Restore
                    </button>
                    <button
                      className="btn btn-danger"
                      type="button"
                      disabled={busy || !f.archivedAt}
                      onClick={() => onPurgeOne("file", f.id, f.name)}
                      title={
                        f.archivedAt
                          ? undefined
                          : "Restore or purge from the parent's level"
                      }
                    >
                      Delete forever
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

/* ====== Reusable checkbox ====== */

function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label?: string;
}) {
  return (
    <label className="trash-checkbox" onClick={(e) => e.stopPropagation()}>
      <input
        type="checkbox"
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        onChange={onChange}
      />
      <span className="trash-checkbox-box" aria-hidden="true">
        {checked ? (
          <svg viewBox="0 0 12 12" width="10" height="10" fill="none">
            <path d="M2.5 6.4l2.4 2.4 4.6-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : indeterminate ? (
          <svg viewBox="0 0 12 12" width="10" height="10" fill="none">
            <path d="M3 6h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ) : null}
      </span>
      {label ? <span className="trash-checkbox-label">{label}</span> : null}
    </label>
  );
}
