"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUI, type UploadTarget } from "@/stores/ui-store";
import { toast } from "@/stores/toast-store";
import { Close } from "@/lib/icons";
import { formatBytes } from "@/lib/format";

/**
 * Upload modal — files-first flow.
 *
 *   1. User drops or picks files.
 *   2. User picks a destination folder (or creates one inline).
 *   3. User clicks the primary CTA to start the upload.
 *
 * Everything happens on a single screen with progressive disclosure — the
 * destination picker is only revealed once at least one file exists, and the
 * "Upload N files" CTA is only enabled once a destination is chosen.
 *
 * The `uploadTarget` initial value (set when opening the modal from a folder
 * page) is still honoured — it pre-fills the destination so the user only
 * needs to drop files.
 */

type UploadItem = {
  id: string;
  file: File;
  iconKind: "image" | "html" | "pdf" | "file";
  state: "queued" | "uploading" | "done" | "error";
  progress: number;
  message?: string;
};

type Folder = { id: string; name: string; parentId?: string | null };

const ICONS = {
  image: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="5.5" cy="6.5" r="1.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 11l2.5-2.5 3.5 3.5 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  html: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M5 6l-2 3 2 3M13 6l2 3-2 3M11 4l-4 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  pdf: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M4 2.5A1 1 0 015 1.5h5l4 4V15a1 1 0 01-1 1H5a1 1 0 01-1-1V2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M10 1.5V5h4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  file: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M4 2.5A1 1 0 015 1.5h5l4 4V15a1 1 0 01-1 1H5a1 1 0 01-1-1V2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
};

function pickIcon(file: File): UploadItem["iconKind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "text/html" || file.name.toLowerCase().endsWith(".html")) return "html";
  return "file";
}

function makeItemsFromFiles(files: File[]): UploadItem[] {
  return files.map((file) => ({
    id: crypto.randomUUID(),
    file,
    iconKind: pickIcon(file),
    state: "queued" as const,
    progress: 0,
  }));
}

export default function UploadModal() {
  const { uploadOpen, uploadTarget, closeUpload, pendingDroppedFiles, setPendingDroppedFiles } = useUI();
  return (
    <>
      <div className={`modal-backdrop${uploadOpen ? " open" : ""}`} onClick={closeUpload} />
      <div className={`modal upload-modal${uploadOpen ? " open" : ""}`} role="dialog" aria-modal="true">
        <UploadFlow
          key={uploadOpen ? "open" : "closed"}
          initialTarget={uploadTarget}
          droppedFiles={pendingDroppedFiles}
          consumeDropped={() => setPendingDroppedFiles([])}
          closeUpload={closeUpload}
        />
      </div>
    </>
  );
}

function UploadFlow({
  initialTarget,
  droppedFiles,
  consumeDropped,
  closeUpload,
}: {
  initialTarget: UploadTarget;
  droppedFiles: File[];
  consumeDropped: () => void;
  closeUpload: () => void;
}) {
  const router = useRouter();
  // Seed the items list lazily so files dropped via the window-level overlay
  // (passed in as `droppedFiles`) are present on first render. Putting this
  // in the useState initializer — rather than a useEffect that calls
  // setItems — is what prevents React Strict Mode's intentional double-mount
  // from adding the same files twice. (A useEffect + functional updater
  // appends; a lazy initializer is replayed per mount but the first mount's
  // state is thrown away, so only one set of items survives.)
  const [items, setItems] = useState<UploadItem[]>(() =>
    droppedFiles.length > 0 ? makeItemsFromFiles(droppedFiles) : [],
  );
  const [target, setTarget] = useState<UploadTarget | null>(initialTarget);
  const [phase, setPhase] = useState<"pick" | "uploading" | "finished">("pick");
  const [dragOver, setDragOver] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const activeXhr = useRef<XMLHttpRequest | null>(null);

  // Clear the pending-files slot in the store now that we've absorbed them
  // into local state. Idempotent — Strict Mode's double-invoke is harmless
  // here because consumeDropped() just sets the slot to an empty array.
  useEffect(() => {
    if (droppedFiles.length > 0) consumeDropped();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Abort in-flight upload on unmount.
  useEffect(() => () => activeXhr.current?.abort(), []);

  function addFiles(picked: FileList | File[] | null) {
    if (!picked || picked.length === 0) return;
    setItems((prev) => [...prev, ...makeItemsFromFiles(Array.from(picked))]);
  }

  function removeItem(id: string) {
    if (phase !== "pick") return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function clearAll() {
    if (phase !== "pick") return;
    setItems([]);
  }

  function uploadOne(item: UploadItem, folderId: string): Promise<void> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      activeXhr.current = xhr;
      xhr.open("POST", "/api/files/upload");

      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, progress: pct, state: "uploading" } : it)));
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, progress: 100, state: "done" } : it)));
        } else {
          let message = `Upload failed (${xhr.status})`;
          try {
            const body = JSON.parse(xhr.responseText) as { error?: string };
            if (body.error) message = body.error;
          } catch {
            /* ignore */
          }
          setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, state: "error", message } : it)));
        }
        resolve();
      };

      xhr.onerror = () => {
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, state: "error", message: "Network error" } : it)),
        );
        resolve();
      };

      const form = new FormData();
      form.append("folderId", folderId);
      form.append("file", item.file);
      xhr.send(form);
    });
  }

  async function startUpload() {
    if (!target || items.length === 0) return;
    setPhase("uploading");
    for (const item of items) {
      if (item.state === "done" || item.state === "uploading") continue;
      await uploadOne(item, target.folderId);
    }
    setPhase("finished");
    router.refresh();
  }

  function finishAndClose() {
    const totalDone = items.filter((i) => i.state === "done").length;
    closeUpload();
    if (totalDone > 0) toast(`${totalDone} file${totalDone === 1 ? "" : "s"} uploaded`);
  }

  // -------------- derived state --------------
  const totalDone = items.filter((i) => i.state === "done").length;
  const totalError = items.filter((i) => i.state === "error").length;
  const totalSize = useMemo(
    () => items.reduce((sum, it) => sum + it.file.size, 0),
    [items],
  );
  const canUpload = phase === "pick" && items.length > 0 && !!target;

  // -------------- drag handlers for in-modal drop --------------
  function onDragOver(e: React.DragEvent) {
    if (phase !== "pick") return;
    e.preventDefault();
    setDragOver(true);
  }
  function onDragLeave() {
    setDragOver(false);
  }
  function onDrop(e: React.DragEvent) {
    if (phase !== "pick") return;
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  }

  return (
    <>
      <div className="modal-head">
        <div>
          <div className="modal-title">
            {phase === "uploading"
              ? "Uploading…"
              : phase === "finished"
                ? totalError > 0
                  ? "Finished with some errors"
                  : "Upload complete"
                : "Upload files"}
          </div>
          <div className="modal-sub">
            {phase === "uploading"
              ? `Sending ${items.length} file${items.length === 1 ? "" : "s"} to ${target?.folderName}…`
              : phase === "finished"
                ? `${totalDone} of ${items.length} uploaded${totalError > 0 ? ` · ${totalError} failed` : ""}.`
                : items.length === 0
                  ? "Drop files first — we'll ask where they should live."
                  : "Pick a destination, then start the upload."}
          </div>
        </div>
        <button className="modal-close" onClick={closeUpload} aria-label="Close">
          {Close}
        </button>
      </div>

      <div className="modal-body upload-body">
        {/* ============ DROP ZONE / FILE PICKER ============ */}
        {phase === "pick" && (
          <div
            className={`up-drop${items.length === 0 ? " is-empty" : " is-compact"}${dragOver ? " is-over" : ""}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
          >
            {items.length === 0 ? (
              <>
                <div className="up-drop-icon" aria-hidden="true">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <path d="M16 6v14m0 0l-6-6m6 6l6-6M6 26h20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="up-drop-title">Drop files to upload</div>
                <div className="up-drop-sub">
                  or <span className="up-drop-link">browse from your computer</span> — up to 1 GB per file.
                </div>
              </>
            ) : (
              <div className="up-drop-row">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <span>Add more files</span>
                <span className="up-drop-row-hint">or drop them here</span>
              </div>
            )}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {/* ============ FILE LIST ============ */}
        {items.length > 0 && (
          <div className="up-files">
            <div className="up-files-head">
              <span className="up-files-title">
                {items.length} file{items.length === 1 ? "" : "s"}
                <span className="up-files-size"> · {formatBytes(totalSize)}</span>
              </span>
              {phase === "pick" && items.length > 1 && (
                <button type="button" className="up-link" onClick={clearAll}>
                  Clear all
                </button>
              )}
            </div>
            <div className="up-files-list">
              {items.map((it) => (
                <FileRow key={it.id} item={it} canRemove={phase === "pick"} onRemove={() => removeItem(it.id)} />
              ))}
            </div>
          </div>
        )}

        {/* ============ DESTINATION ============ */}
        {phase === "pick" && items.length > 0 && (
          <DestinationPicker target={target} onChange={setTarget} />
        )}
      </div>

      {/* ============ FOOTER CTA ============ */}
      <div className="modal-footer upload-footer">
        <span className="left">
          {phase === "pick"
            ? items.length === 0
              ? "Drop files to begin"
              : !target
                ? "Pick a destination next"
                : `Ready to upload to “${target.folderName}”`
            : phase === "uploading"
              ? `${totalDone} of ${items.length} done…`
              : `${totalDone} of ${items.length} done${totalError > 0 ? ` · ${totalError} failed` : ""}`}
        </span>
        <div className="right">
          {phase === "pick" && (
            <>
              <button className="btn" onClick={closeUpload} type="button">
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={startUpload}
                disabled={!canUpload}
                type="button"
              >
                {items.length > 0
                  ? `Upload ${items.length} file${items.length === 1 ? "" : "s"}${target ? "" : "…"}`
                  : "Upload"}
              </button>
            </>
          )}
          {phase === "uploading" && (
            <button className="btn btn-primary" disabled type="button">
              Uploading…
            </button>
          )}
          {phase === "finished" && (
            <button className="btn btn-primary" onClick={finishAndClose} type="button">
              Done
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/* ============================================================
   File row
   ============================================================ */
function FileRow({
  item,
  canRemove,
  onRemove,
}: {
  item: UploadItem;
  canRemove: boolean;
  onRemove: () => void;
}) {
  return (
    <div className={`up-row state-${item.state}`}>
      <span className={`up-row-icon ${item.iconKind === "file" ? "" : item.iconKind}`} aria-hidden="true">
        {ICONS[item.iconKind]}
      </span>
      <div className="up-row-main">
        <div className="up-row-name" title={item.file.name}>
          {item.file.name}
        </div>
        <div className="up-row-meta">
          <span>{formatBytes(item.file.size)}</span>
          {item.state === "uploading" && <span>· {item.progress}%</span>}
          {item.state === "error" && item.message && (
            <span className="up-row-error" title={item.message}>· {item.message}</span>
          )}
          {item.state === "done" && <span className="up-row-done">· Uploaded</span>}
        </div>
        {(item.state === "uploading" || item.state === "done") && (
          <div className="up-row-progress">
            <div className="up-row-progress-fill" style={{ width: `${item.progress}%` }} />
          </div>
        )}
      </div>
      <div className="up-row-end">
        {item.state === "done" ? (
          <span className="up-row-check" aria-label="Uploaded">
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
              <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        ) : item.state === "error" ? (
          <span className="up-row-x" aria-label="Failed">
            <svg viewBox="0 0 16 16" width="11" height="11" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
        ) : canRemove ? (
          <button type="button" className="up-row-remove" onClick={onRemove} aria-label="Remove file" title="Remove">
            <svg viewBox="0 0 16 16" width="11" height="11" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ============================================================
   Destination picker — tree navigation across folders + subfolders.
   ============================================================ */
function DestinationPicker({
  target,
  onChange,
}: {
  target: UploadTarget | null;
  onChange: (t: UploadTarget) => void;
}) {
  const router = useRouter();
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Tree navigation cursor. `null` = root. The user clicks the chevron on a
  // folder card to descend; the breadcrumb clicks back up.
  const [cursor, setCursor] = useState<string | null>(null);
  // Track whether we've auto-positioned the cursor based on the initial
  // target — only the first folder load should trigger it.
  const initialAlignedRef = useRef(false);

  // Fetch the full tree so subfolders are reachable.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/folders?scope=all")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((body: { folders: Folder[] }) => {
        if (!cancelled) setFolders(body.folders);
      })
      .catch(() => {
        if (!cancelled) setFolders([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Build derived structures.
  const byId = useMemo(() => {
    const m = new Map<string, Folder>();
    if (folders) for (const f of folders) m.set(f.id, f);
    return m;
  }, [folders]);

  const childrenOf = useMemo(() => {
    const m = new Map<string | null, Folder[]>();
    if (!folders) return m;
    for (const f of folders) {
      const key = (f.parentId ?? null) as string | null;
      const list = m.get(key);
      if (list) list.push(f);
      else m.set(key, [f]);
    }
    for (const list of m.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return m;
  }, [folders]);

  // Once folders load AND there's an initial target, position the cursor at
  // the target's parent so the target shows in the current listing — already
  // selected. This makes "upload from inside subfolder X" land you with X
  // pre-picked without an extra click. The `initialAlignedRef` flag ensures
  // this only fires once even though the effect deps may change again — so
  // the React 19 set-state-in-effect concern about cascading renders doesn't
  // apply here.
  useEffect(() => {
    if (initialAlignedRef.current) return;
    if (!folders || folders.length === 0) return;
    if (!target) {
      initialAlignedRef.current = true;
      return;
    }
    const f = byId.get(target.folderId);
    if (f) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCursor(f.parentId ?? null);
    }
    initialAlignedRef.current = true;
  }, [folders, byId, target]);

  // Folders displayed in the current pane.
  const visible = useMemo(() => {
    if (!folders) return [];
    const q = query.trim().toLowerCase();
    if (q) {
      // Search collapses the tree — show flat results with parent paths.
      return folders.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 30);
    }
    return childrenOf.get(cursor) ?? [];
  }, [folders, query, childrenOf, cursor]);

  // Breadcrumb: trace from cursor up to root.
  const crumbs = useMemo(() => {
    const trail: Folder[] = [];
    let id: string | null = cursor;
    while (id) {
      const f = byId.get(id);
      if (!f) break;
      trail.unshift(f);
      id = f.parentId ?? null;
    }
    return trail;
  }, [cursor, byId]);

  // For search results: rebuild a parent path string for context.
  function pathOf(folder: Folder): string {
    const parts: string[] = [];
    let id: string | null = folder.parentId ?? null;
    let safety = 32;
    while (id && safety-- > 0) {
      const p = byId.get(id);
      if (!p) break;
      parts.unshift(p.name);
      id = p.parentId ?? null;
    }
    return parts.join(" / ");
  }

  const createAndPick = useCallback(async () => {
    const name = newName.trim();
    if (!name) {
      setCreateError("Folder name is required");
      return;
    }
    setCreating(true);
    setCreateError(null);
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId: cursor, visibility: "private" }),
    });
    setCreating(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setCreateError(body.error ?? "Could not create folder");
      return;
    }
    const { folder } = (await res.json()) as { folder: Folder };
    router.refresh();
    onChange({ folderId: folder.id, folderName: folder.name });
    setFolders((cur) => (cur ? [folder, ...cur] : [folder]));
    setShowCreate(false);
    setNewName("");
  }, [newName, router, onChange, cursor]);

  const isSearching = query.trim().length > 0;
  const cursorFolder = cursor ? byId.get(cursor) : null;
  // Parent of the cursor — where the Back button jumps to.
  const parentOfCursor: string | null = cursorFolder?.parentId ?? null;

  return (
    <div className="up-dest">
      <div className="up-dest-title-row">
        <span className="up-dest-title">Destination</span>
      </div>

      <div className="up-dest-panel">
        {/* Unified nav strip — Back · current path · search */}
        <div className="up-dest-nav">
          {!isSearching && cursor !== null && (
            <button
              type="button"
              className="up-dest-back"
              onClick={() => setCursor(parentOfCursor)}
              aria-label="Back to parent folder"
              title={parentOfCursor ? `Back to ${byId.get(parentOfCursor)?.name ?? "parent"}` : "Back to all folders"}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Back</span>
            </button>
          )}

          {!isSearching ? (
            <div className="up-dest-path" aria-label="Current folder path">
              <button
                type="button"
                className={`up-dest-path-seg${cursor === null ? " is-current" : ""}`}
                onClick={() => setCursor(null)}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2 7l6-4 6 4v6.5A1.5 1.5 0 0112.5 15H10v-4H6v4H3.5A1.5 1.5 0 012 13.5V7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
                <span>All folders</span>
              </button>
              {crumbs.map((c, i) => (
                <span key={c.id} className="up-dest-path-row">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="up-dest-path-sep">
                    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <button
                    type="button"
                    className={`up-dest-path-seg${i === crumbs.length - 1 ? " is-current" : ""}`}
                    onClick={() => setCursor(c.id)}
                    title={c.name}
                  >
                    {c.name}
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="up-dest-path is-searching">
              <span>Searching across all folders…</span>
            </div>
          )}

          <input
            type="search"
            className="up-dest-search"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            spellCheck={false}
            aria-label="Search folders"
          />
        </div>

      {/* "Upload here" hero — only shown when inside a folder + not searching */}
      {!isSearching && cursorFolder && (
        <button
          type="button"
          className={`up-dest-here${target?.folderId === cursorFolder.id ? " is-selected" : ""}`}
          onClick={() => onChange({ folderId: cursorFolder.id, folderName: cursorFolder.name })}
        >
          <span className="up-dest-here-ico" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M2 5.5A1.5 1.5 0 013.5 4h3l1.5 1.5h6A1.5 1.5 0 0115.5 7v6.5A1.5 1.5 0 0114 15H4a1.5 1.5 0 01-1.5-1.5v-8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="up-dest-here-text">
            <span className="up-dest-here-label">Upload to</span>
            <span className="up-dest-here-name">{cursorFolder.name}</span>
          </span>
          {target?.folderId === cursorFolder.id && (
            <span className="up-dest-card-check" aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}
        </button>
      )}

      <div className="up-dest-grid">
        {!isSearching && (
          <button
            type="button"
            className={`up-dest-new${showCreate ? " is-open" : ""}`}
            onClick={() => setShowCreate((v) => !v)}
            title={cursor ? `Create a subfolder inside ${cursorFolder?.name ?? ""}` : "Create a new folder"}
          >
            <span className="up-dest-new-ico" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
            <span className="up-dest-new-label">
              {cursor ? "New subfolder" : "New folder"}
            </span>
          </button>
        )}

        {folders === null ? (
          <div className="up-dest-loading">Loading folders…</div>
        ) : visible.length === 0 ? (
          <div className="up-dest-empty">
            {isSearching
              ? "No folders match."
              : cursor
                ? "No subfolders here yet."
                : "No folders yet — create one above."}
          </div>
        ) : (
          visible.map((f) => {
            const selected = target?.folderId === f.id;
            const childCount = childrenOf.get(f.id)?.length ?? 0;
            const hasChildren = childCount > 0;
            const path = isSearching ? pathOf(f) : "";
            return (
              <div
                key={f.id}
                className={`up-dest-card${selected ? " is-selected" : ""}${hasChildren ? " has-children" : ""}`}
              >
                <button
                  type="button"
                  className="up-dest-card-body"
                  onClick={() => onChange({ folderId: f.id, folderName: f.name })}
                  onDoubleClick={() => {
                    if (hasChildren) {
                      setCursor(f.id);
                      setQuery("");
                    }
                  }}
                  title={hasChildren ? `Select ${f.name} (double-click to open)` : `Select ${f.name}`}
                >
                  <span className={`up-dest-card-ico${selected ? " is-selected" : ""}`} aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                      <path d="M2 5.5A1.5 1.5 0 013.5 4h3l1.5 1.5h6A1.5 1.5 0 0115.5 7v6.5A1.5 1.5 0 0114 15H4a1.5 1.5 0 01-1.5-1.5v-8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="up-dest-card-text">
                    <span className="up-dest-card-name">{f.name}</span>
                    {path && <span className="up-dest-card-sub">in {path}</span>}
                  </span>
                  {selected && (
                    <span className="up-dest-card-check" aria-hidden="true">
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </button>
                {hasChildren && (
                  <button
                    type="button"
                    className="up-dest-card-into"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCursor(f.id);
                      setQuery("");
                    }}
                    aria-label={`Open ${f.name}`}
                    title={`Open ${f.name}`}
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })
        )}
        </div>
      </div>

      {showCreate && (
        <div className="up-dest-create">
          <input
            type="text"
            className="up-dest-create-input"
            placeholder={cursor ? `New folder inside ${cursorFolder?.name ?? ""}` : "New folder name"}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void createAndPick();
              }
              if (e.key === "Escape") {
                setShowCreate(false);
                setNewName("");
              }
            }}
            autoFocus
            spellCheck={false}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={createAndPick}
            disabled={creating || !newName.trim()}
          >
            {creating ? "Creating…" : "Create & select"}
          </button>
          {createError && <div className="up-dest-create-err">{createError}</div>}
        </div>
      )}
    </div>
  );
}
