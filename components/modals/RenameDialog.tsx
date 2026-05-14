"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/stores/ui-store";
import { toast } from "@/stores/toast-store";

type FolderColor =
  | "red" | "coral" | "orange" | "amber" | "yellow" | "green"
  | "teal" | "blue" | "indigo" | "violet" | "pink" | "gray";

const FOLDER_COLORS: { value: FolderColor; label: string }[] = [
  { value: "red", label: "Red" },
  { value: "coral", label: "Coral" },
  { value: "orange", label: "Orange" },
  { value: "amber", label: "Amber" },
  { value: "yellow", label: "Yellow" },
  { value: "green", label: "Green" },
  { value: "teal", label: "Teal" },
  { value: "blue", label: "Blue" },
  { value: "indigo", label: "Indigo" },
  { value: "violet", label: "Violet" },
  { value: "pink", label: "Pink" },
  { value: "gray", label: "Gray" },
];

export default function RenameDialog() {
  const { rename, closeRename } = useUI();
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState<FolderColor | null>(null);
  const [originalColor, setOriginalColor] = useState<FolderColor | null>(null);
  const [busy, setBusy] = useState(false);

  // When opening, set the input value and (for folders) pull the current colour
  // so the user can see what's already applied. Reset-on-open is flagged by
  // React 19's set-state-in-effect rule; using a `key` prop to remount would
  // require touching every caller, so we accept the bounded re-render here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!rename) return;
    setName(rename.currentName);
    setColor(null);
    setOriginalColor(null);
    if (rename.kind === "folder") {
      let cancelled = false;
      fetch(`/api/folders/${rename.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((body: { folder?: { color: FolderColor | null } } | null) => {
          if (cancelled) return;
          const c = body?.folder?.color ?? null;
          setColor(c);
          setOriginalColor(c);
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }
  }, [rename]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!rename) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) closeRename();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [rename, busy, closeRename]);

  if (!rename) return null;

  const trimmed = name.trim();
  const nameUnchanged = trimmed === rename.currentName.trim();
  const colorUnchanged = color === originalColor;
  const noChanges = nameUnchanged && colorUnchanged;
  const invalid = trimmed.length === 0;
  const target = rename;
  const isFolder = target.kind === "folder";

  async function submit() {
    if (!target) return;
    if (invalid || noChanges) {
      closeRename();
      return;
    }
    setBusy(true);
    const url = target.kind === "folder" ? `/api/folders/${target.id}` : `/api/files/${target.id}`;
    const payload: Record<string, unknown> = {};
    if (!nameUnchanged) payload.name = trimmed;
    if (isFolder && !colorUnchanged) payload.color = color;
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast(body.error ?? "Could not save changes");
        setBusy(false);
        return;
      }
      toast(nameUnchanged ? "Colour updated" : `Renamed to "${trimmed}"`);
      router.refresh();
      setBusy(false);
      closeRename();
    } catch {
      toast("Could not save changes");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="modal-backdrop open" onClick={() => !busy && closeRename()} />
      <div className="modal open" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Rename {target.kind}</div>
            <div className="modal-sub">
              {isFolder
                ? `Pick a new name and colour for "${target.currentName}".`
                : `Pick a new name for "${target.currentName}".`}
            </div>
          </div>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="rename-input">Name</label>
            <input
              id="rename-input"
              type="text"
              className="field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busy && !invalid && !noChanges) submit();
              }}
              autoFocus
              spellCheck={false}
              placeholder="Name"
            />

            {isFolder && (
              <div className="folder-color-row" role="radiogroup" aria-label="Folder colour">
                <button
                  type="button"
                  className={`color-swatch color-none${color === null ? " is-selected" : ""}`}
                  onClick={() => setColor(null)}
                  aria-pressed={color === null}
                  aria-label="No colour"
                  disabled={busy}
                />
                {FOLDER_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`color-swatch color-${c.value}${color === c.value ? " is-selected" : ""}`}
                    onClick={() => setColor(c.value)}
                    aria-pressed={color === c.value}
                    aria-label={c.label}
                    title={c.label}
                    disabled={busy}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <span className="left" />
          <div className="right">
            <button className="btn" type="button" onClick={closeRename} disabled={busy}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={submit}
              disabled={busy || invalid || noChanges}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
