"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUI, type ActionMenuKind } from "@/stores/ui-store";
import { toast } from "@/stores/toast-store";

type Action = {
  key: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  danger?: boolean;
};
type Item = Action | { divider: true };

const I = {
  open: (
    <svg className="ico" viewBox="0 0 16 16" fill="none">
      <path d="M3 12h10M9 7l4 5-4 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  stats: (
    <svg className="ico" viewBox="0 0 16 16" fill="none">
      <path d="M2 13h12M4.5 11V8M8 11V5M11.5 11V7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  share: (
    <svg className="ico" viewBox="0 0 16 16" fill="none">
      <circle cx="4" cy="8" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="12" cy="4" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="12" cy="12" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 7l5-2.3M5.5 9l5 2.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  download: (
    <svg className="ico" viewBox="0 0 16 16" fill="none">
      <path d="M8 2v9m0 0l-3-3m3 3l3-3M3 14h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  rename: (
    <svg className="ico" viewBox="0 0 16 16" fill="none">
      <path d="M2 12.5L11 3.5l2.5 2.5L4.5 15H2v-2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  duplicate: (
    <svg className="ico" viewBox="0 0 16 16" fill="none">
      <rect x="5" y="5" width="9" height="9" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11 5V3.5A1.5 1.5 0 009.5 2H3.5A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  move: (
    <svg className="ico" viewBox="0 0 16 16" fill="none">
      <path d="M2 4.5A1.5 1.5 0 013.5 3h2.5l1.5 1.5h5A1.5 1.5 0 0114 6v6.5A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-8z" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  archive: (
    <svg className="ico" viewBox="0 0 16 16" fill="none">
      <path d="M3 5h10v2H3zM4 7v6h8V7" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6 10h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  trash: (
    <svg className="ico" viewBox="0 0 16 16" fill="none">
      <path d="M3 4h10M6 4V2.5h4V4M5 4l1 9h4l1-9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  publish: (
    <svg className="ico" viewBox="0 0 16 16" fill="none">
      <path d="M3 13l5-9 5 9H3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  // "Take to site" — external link arrow.
  visitSite: (
    <svg className="ico" viewBox="0 0 16 16" fill="none">
      <path d="M9 3h4v4M13 3l-6 6M11 8v4.5A1.5 1.5 0 019.5 14h-6A1.5 1.5 0 012 12.5v-6A1.5 1.5 0 013.5 5H8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  // "Copy public URL" — link/chain glyph.
  copyUrl: (
    <svg className="ico" viewBox="0 0 16 16" fill="none">
      <path d="M9.5 6.5l-3 3M5 11l-1.4 1.4a2.5 2.5 0 01-3.5-3.5L1.5 7.5a2.5 2.5 0 013.5 0M11 5l1.4-1.4a2.5 2.5 0 013.5 3.5L14.5 8.5a2.5 2.5 0 01-3.5 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  // "Extract" — folder splitting/expanding outward.
  extract: (
    <svg className="ico" viewBox="0 0 16 16" fill="none">
      <path d="M2 5.5A1.5 1.5 0 013.5 4h3l1.5 1.5h6A1.5 1.5 0 0115.5 7v6.5A1.5 1.5 0 0114 15H4a1.5 1.5 0 01-1.5-1.5v-8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M9 9v-3M9 6l-1.5 1.5M9 6l1.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

// Folders are private, workspace-only containers — no Share / no Stats.
const FOLDER_ITEMS: Item[] = [
  { key: "open", label: "Open", icon: I.open, shortcut: "↵" },
  { key: "share", label: "Manage access…", icon: I.share },
  { key: "download", label: "Download as zip", icon: I.download },
  { key: "rename", label: "Rename", icon: I.rename },
  { key: "duplicate", label: "Duplicate", icon: I.duplicate },
  { key: "move", label: "Move to…", icon: I.move },
  { divider: true },
  { key: "delete", label: "Delete", icon: I.trash, danger: true },
];

// Subfolders mirror the folder menu — same actions, same order, same labels.
// A subfolder IS a folder; the only behavioural difference is the parent
// context, which the action handlers already account for.
const SUBFOLDER_ITEMS: Item[] = [
  { key: "open", label: "Open", icon: I.open, shortcut: "↵" },
  { key: "share", label: "Manage access…", icon: I.share },
  { key: "download", label: "Download as zip", icon: I.download },
  { key: "rename", label: "Rename", icon: I.rename },
  { key: "duplicate", label: "Duplicate", icon: I.duplicate },
  { key: "move", label: "Move to…", icon: I.move },
  { divider: true },
  { key: "delete", label: "Delete", icon: I.trash, danger: true },
];

// Files own publishing + stats now. When the file is actually published —
// `publishMode !== "off"` AND there's a slug — we prepend two actions at the
// top so the user can jump to the live site or copy the URL without opening
// the publish dialog.
const FILE_ITEMS: Item[] = [
  { key: "publish", label: "Publish…", icon: I.publish },
  { key: "stats", label: "View stats", icon: I.stats },
  { key: "download", label: "Download", icon: I.download, shortcut: "⌘D" },
  { key: "rename", label: "Rename", icon: I.rename },
  { key: "move", label: "Move to…", icon: I.move },
  { divider: true },
  { key: "delete", label: "Delete", icon: I.trash, danger: true },
];

const FILE_LIVE_ITEMS: Item[] = [
  { key: "open-live", label: "Open live link", icon: I.visitSite },
  { key: "copy-link", label: "Copy link", icon: I.copyUrl },
  { divider: true },
];

// Surfaced only when the file is a zip — drops a folder of extracted entries
// next to the archive.
const FILE_ZIP_ITEM: Item = { key: "extract", label: "Extract here", icon: I.extract };

function isZipLike(name: string | undefined, mime: string | undefined): boolean {
  if (!name && !mime) return false;
  if (mime === "application/zip" || mime === "application/x-zip-compressed") return true;
  return (name ?? "").toLowerCase().endsWith(".zip");
}

function itemsFor(
  kind: ActionMenuKind,
  opts: {
    publishMode?: "off" | "public" | "password";
    publicSlug?: string | null;
    name?: string;
    mime?: string;
  } = {},
): Item[] {
  if (kind === "subfolder") return SUBFOLDER_ITEMS;
  if (kind === "file") {
    // Any published file has a live URL — slug-based when one is set,
    // file-id-based otherwise. Both resolve via the /c/* route.
    const isLive = !!opts.publishMode && opts.publishMode !== "off";
    const zip = isZipLike(opts.name, opts.mime);
    const head: Item[] = isLive ? [...FILE_LIVE_ITEMS] : [];
    // Insert "Extract here" right after Publish, before Stats — most natural
    // spot for an archive-specific action.
    const base = FILE_ITEMS.slice();
    if (zip) {
      const publishIdx = base.findIndex((it) => "key" in it && it.key === "publish");
      base.splice(publishIdx + 1, 0, FILE_ZIP_ITEM);
    }
    return [...head, ...base];
  }
  return FOLDER_ITEMS;
}

async function deleteSubject(kind: ActionMenuKind, id: string): Promise<{ ok: boolean; error?: string }> {
  if (!id) return { ok: false, error: "Missing target" };
  const url = kind === "file" ? `/api/files/${id}` : `/api/folders/${id}`;
  const res = await fetch(url, { method: "DELETE" });
  if (res.ok) return { ok: true };
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: false, error: body.error ?? `Delete failed (${res.status})` };
}

export default function ActionMenu() {
  const { actionMenu, closeActionMenu, openShare, openMove, openConfirm, openRename } = useUI();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!actionMenu) return;
      if (ref.current && !ref.current.contains(e.target as Node)) closeActionMenu();
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [actionMenu, closeActionMenu]);

  if (!actionMenu) return null;

  const items = itemsFor(actionMenu.kind, {
    publishMode: actionMenu.publishMode,
    publicSlug: actionMenu.publicSlug,
    name: actionMenu.name,
    mime: actionMenu.mime,
  });
  const subject = actionMenu.name || (actionMenu.kind === "file" ? "file" : "folder");

  /**
   * Build the public URL for a published file. Prefers a custom slug when
   * one is set; otherwise falls back to the file id. Both forms resolve to
   * the same content via the /c/[id] route handler.
   */
  function publicUrlFor(opts: { slug?: string | null; id?: string }): string {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const seg = opts.slug && opts.slug.trim() ? opts.slug : opts.id;
    return seg ? `${origin}/c/${seg}` : "";
  }

  async function copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch {
        return false;
      }
    }
  }

  async function run(key: string) {
    if (!actionMenu) return;
    const ctx = actionMenu;
    closeActionMenu();
    switch (key) {
      case "open":
        if (ctx.id) router.push(`/folders/${ctx.id}`);
        break;
      case "stats":
        // Stats live on files only now.
        if (ctx.kind === "file" && ctx.id) {
          router.push(`/files/${ctx.id}/stats`);
        }
        break;
      case "share":
        // Folder share = access (people & teams). Files don't use this path.
        if (ctx.kind !== "file" && ctx.id) {
          openShare({ folderId: ctx.id, name: subject, vis: "shared", kind: "folder" });
        }
        break;
      case "publish":
        // File publishing: opens the same drawer but in file mode.
        if (ctx.kind === "file" && ctx.id) {
          openShare({ folderId: ctx.id, name: subject, vis: "private", kind: "file" });
        }
        break;
      case "download":
        if (ctx.kind === "file" && ctx.id) {
          window.open(`/api/files/${ctx.id}`, "_blank");
        } else if (ctx.id) {
          window.open(`/api/folders/${ctx.id}/download`, "_blank");
        }
        break;
      case "open-live": {
        // Open the published page directly in a new tab. Bypasses the in-app
        // publish drawer entirely — pure "go to the live URL".
        const url = publicUrlFor({ slug: ctx.publicSlug, id: ctx.id });
        if (!url) {
          toast("This file isn't published yet.");
          break;
        }
        window.open(url, "_blank", "noopener,noreferrer");
        break;
      }
      case "copy-link": {
        const url = publicUrlFor({ slug: ctx.publicSlug, id: ctx.id });
        if (!url) {
          toast("This file isn't published yet.");
          break;
        }
        const ok = await copyToClipboard(url);
        toast(ok ? "Link copied" : "Could not copy link");
        break;
      }
      case "extract": {
        if (!ctx.id) {
          toast("Nothing to extract.");
          break;
        }
        toast(`Extracting "${subject}"…`);
        try {
          const res = await fetch(`/api/files/${ctx.id}/extract`, { method: "POST" });
          const body = (await res.json().catch(() => ({}))) as {
            ok?: boolean;
            folderId?: string;
            folderName?: string;
            extracted?: number;
            encryptedSkipped?: number;
            error?: string;
          };
          if (!res.ok || !body.ok) {
            toast(body.error ?? `Could not extract (${res.status})`);
            break;
          }
          const tail = body.encryptedSkipped && body.encryptedSkipped > 0
            ? ` (${body.encryptedSkipped} encrypted skipped)`
            : "";
          toast(`Extracted ${body.extracted} file${body.extracted === 1 ? "" : "s"}${tail}`);
          // Navigate into the new folder so the user sees the result.
          if (body.folderId) router.push(`/folders/${body.folderId}`);
          else router.refresh();
        } catch {
          toast("Could not extract — network error.");
        }
        break;
      }
      case "move":
        if (!ctx.id) {
          toast("Nothing to move.");
          return;
        }
        // Move works for files, folders, and subfolders alike.
        openMove({
          folderId: ctx.id,
          folderName: ctx.name,
          kind: ctx.kind === "file" ? "file" : "folder",
        });
        break;
      case "rename":
        if (!ctx.id) {
          toast("Nothing to rename.");
          return;
        }
        openRename({
          kind: ctx.kind === "file" ? "file" : "folder",
          id: ctx.id,
          currentName: ctx.name,
        });
        break;
      case "duplicate":
        if (!ctx.id) {
          toast("Nothing to duplicate.");
          return;
        }
        try {
          const url =
            ctx.kind === "file"
              ? `/api/files/${ctx.id}/duplicate`
              : `/api/folders/${ctx.id}/duplicate`;
          const res = await fetch(url, { method: "POST" });
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            toast(body.error ?? "Could not duplicate");
            return;
          }
          toast(`Duplicated ${subject}.`);
          router.refresh();
        } catch {
          toast("Could not duplicate");
        }
        break;
      case "delete": {
        if (!ctx.id) {
          toast("Nothing to delete.");
          return;
        }
        const noun =
          ctx.kind === "file" ? "file" : ctx.kind === "subfolder" ? "subfolder" : "folder";
        const subjectId = ctx.id;
        const subjectKind = ctx.kind;
        const subjectName = subject;
        openConfirm({
          title: `Delete this ${noun}?`,
          description:
            ctx.kind === "file"
              ? `"${subjectName}" will be permanently deleted. This can't be undone.`
              : `"${subjectName}" and everything inside it will be removed. This can't be undone.`,
          confirmLabel: "Delete",
          danger: true,
          onConfirm: async () => {
            const result = await deleteSubject(subjectKind, subjectId);
            if (!result.ok) {
              toast(result.error ?? `Could not delete ${subjectName}.`);
              return;
            }
            toast(`Deleted ${subjectName}.`);
            if (
              subjectKind !== "file" &&
              typeof window !== "undefined" &&
              window.location.pathname.includes(subjectId)
            ) {
              router.push("/");
            } else {
              router.refresh();
            }
          },
        });
        break;
      }
      default:
        toast(`${key} on ${subject}`);
    }
  }

  return (
    <div ref={ref} className="action-menu open" role="menu" style={{ left: actionMenu.x, top: actionMenu.y }}>
      {items.map((it, i) =>
        "divider" in it ? (
          <div key={`d-${i}`} className="action-divider" />
        ) : (
          <button key={it.key} type="button" className={`action-item${it.danger ? " danger" : ""}`} onClick={() => run(it.key)}>
            {it.icon}
            {it.label}
            {it.shortcut ? <span className="shortcut">{it.shortcut}</span> : null}
          </button>
        )
      )}
    </div>
  );
}
