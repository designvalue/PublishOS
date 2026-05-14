"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUI, type NewFolderTarget } from "@/stores/ui-store";
import { toast } from "@/stores/toast-store";
import { Close } from "@/lib/icons";

type Role = "editor" | "viewer";
type AccessKey = "private" | "shared";
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

type Member = { userId: string; role: Role; name: string | null; email: string };
type TeamGrant = { teamId: string; role: Role; name: string; initial: string | null; gradient: string | null };
type WorkspaceUser = { id: string; name: string | null; email: string };
type WorkspaceTeam = { id: string; name: string; initial: string | null; gradient: string | null; memberCount: number };
type FolderOption = { id: string; name: string; parentId: string | null };

function initialsOf(name: string | null, email: string): string {
  const src = (name && name.trim()) || email;
  const parts = src.replace(/@.*/, "").split(/[ ._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function NewFolderModal() {
  const { newFolderOpen, newFolderParent, closeNewFolder } = useUI();

  // ESC closes.
  useEffect(() => {
    if (!newFolderOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeNewFolder();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [newFolderOpen, closeNewFolder]);

  return (
    <>
      <div className={`modal-backdrop${newFolderOpen ? " open" : ""}`} onClick={closeNewFolder} />
      <div
        className={`modal share-modal${newFolderOpen ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {newFolderOpen && (
          <NewFolderBody
            key="open"
            parent={newFolderParent}
            closeNewFolder={closeNewFolder}
          />
        )}
      </div>
    </>
  );
}

function NewFolderBody({
  parent,
  closeNewFolder,
}: {
  parent: NewFolderTarget;
  closeNewFolder: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Default parent: explicit prop wins; else infer from the current URL
  // (in /folders/<id>, drop into that folder; else workspace root).
  const inferredParentId = useMemo(() => {
    if (parent) return parent.parentId;
    if (pathname?.startsWith("/folders/")) {
      const segs = pathname.split("/").filter(Boolean);
      return segs[segs.length - 1] ?? null;
    }
    return null;
  }, [parent, pathname]);

  const [name, setName] = useState("");
  const [color, setColor] = useState<FolderColor | null>(null);
  const [access, setAccess] = useState<AccessKey>("private");
  const [parentId, setParentId] = useState<string | null>(inferredParentId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For the Where picker and the Manage-access invite typeahead.
  const [folders, setFolders] = useState<FolderOption[] | null>(null);
  const [allUsers, setAllUsers] = useState<WorkspaceUser[]>([]);
  const [allTeams, setAllTeams] = useState<WorkspaceTeam[]>([]);

  const [members, setMembers] = useState<Member[]>([]);
  const [teamGrants, setTeamGrants] = useState<TeamGrant[]>([]);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("editor");

  // Auto-focus the folder name input. Tiny delay so it lands after the modal
  // entrance animation finishes.
  useEffect(() => {
    const id = window.setTimeout(() => nameInputRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, []);

  // Preload folders (for the Where picker) + users/teams (for invites).
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/folders?scope=all", { credentials: "include" }).then((r) => (r.ok ? r.json() : { folders: [] })),
      fetch("/api/users", { credentials: "include" }).then((r) => (r.ok ? r.json() : { users: [] })),
      fetch("/api/teams", { credentials: "include" }).then((r) => (r.ok ? r.json() : { teams: [] })),
    ]).then(([fBody, uBody, tBody]) => {
      if (cancelled) return;
      setFolders(fBody.folders ?? []);
      setAllUsers(uBody.users ?? []);
      setAllTeams(tBody.teams ?? []);
    });
    return () => { cancelled = true; };
  }, []);

  const folderTree = useMemo(() => {
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

  const parentName = useMemo(() => {
    if (parentId === null) return "Workspace root";
    return folders?.find((f) => f.id === parentId)?.name ?? (parent?.parentName ?? "…");
  }, [parentId, folders, parent]);

  // Render the folder tree depth-first.
  function renderTreeNode(folder: FolderOption, depth: number): React.ReactNode {
    const children = folderTree.get(folder.id) ?? [];
    return (
      <div key={folder.id}>
        <button
          type="button"
          className={`where-picker-item${parentId === folder.id ? " is-selected" : ""}`}
          style={{ paddingLeft: 10 + depth * 14 }}
          onClick={() => {
            setParentId(folder.id);
            setPickerOpen(false);
          }}
        >
          <svg viewBox="0 0 18 18" width="13" height="13" fill="none" aria-hidden="true">
            <path
              d="M2 5.5A1.5 1.5 0 013.5 4h3l1.5 1.5h6A1.5 1.5 0 0115.5 7v6.5A1.5 1.5 0 0114 15H4a1.5 1.5 0 01-1.5-1.5v-8z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
          <span>{folder.name}</span>
        </button>
        {children.map((c) => renderTreeNode(c, depth + 1))}
      </div>
    );
  }

  // Invite suggestions
  const suggestions = useMemo(() => {
    const q = inviteQuery.trim().toLowerCase();
    if (!q) return [] as Array<{ kind: "user"; user: WorkspaceUser } | { kind: "team"; team: WorkspaceTeam }>;
    const taken = new Set([
      ...members.map((m) => "u:" + m.userId),
      ...teamGrants.map((t) => "t:" + t.teamId),
    ]);
    const us = allUsers
      .filter((u) => !taken.has("u:" + u.id) && (
        (u.name && u.name.toLowerCase().includes(q)) || u.email.toLowerCase().includes(q)
      ))
      .slice(0, 6)
      .map((user) => ({ kind: "user" as const, user }));
    const ts = allTeams
      .filter((t) => !taken.has("t:" + t.id) && t.name.toLowerCase().includes(q))
      .slice(0, 4)
      .map((team) => ({ kind: "team" as const, team }));
    return [...ts, ...us];
  }, [inviteQuery, allUsers, allTeams, members, teamGrants]);

  function addUser(u: WorkspaceUser) {
    setMembers((prev) => prev.find((m) => m.userId === u.id)
      ? prev
      : [...prev, { userId: u.id, role: inviteRole, name: u.name, email: u.email }]);
    setInviteQuery("");
  }
  function addTeam(t: WorkspaceTeam) {
    setTeamGrants((prev) => prev.find((g) => g.teamId === t.id)
      ? prev
      : [...prev, { teamId: t.id, role: inviteRole, name: t.name, initial: t.initial, gradient: t.gradient }]);
    setInviteQuery("");
  }
  function removeUser(userId: string) { setMembers((prev) => prev.filter((m) => m.userId !== userId)); }
  function removeTeam(teamId: string) { setTeamGrants((prev) => prev.filter((t) => t.teamId !== teamId)); }
  function setUserRole(userId: string, role: Role) { setMembers((prev) => prev.map((m) => m.userId === userId ? { ...m, role } : m)); }
  function setTeamRole(teamId: string, role: Role) { setTeamGrants((prev) => prev.map((t) => t.teamId === teamId ? { ...t, role } : t)); }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Folder name is required.");
      nameInputRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setError(null);

    const createRes = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: trimmed, parentId, visibility: access, color }),
    });
    if (!createRes.ok) {
      const body = (await createRes.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not create the folder.");
      setSubmitting(false);
      return;
    }
    const { folder } = (await createRes.json()) as { folder: { id: string; name: string } };

    // If Shared and there are invites, set the access payload after creation.
    if (access === "shared" && (members.length > 0 || teamGrants.length > 0)) {
      const accessRes = await fetch(`/api/folders/${folder.id}/access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          visibility: "shared",
          members: members.map((m) => ({ userId: m.userId, role: m.role })),
          teams: teamGrants.map((t) => ({ teamId: t.teamId, role: t.role })),
        }),
      });
      if (!accessRes.ok) {
        // Folder is created; access update failed. Toast and continue.
        toast(`Created "${folder.name}", but access settings failed to save.`);
      }
    }

    setSubmitting(false);
    closeNewFolder();
    router.refresh();
    toast(`Created "${folder.name}"`, "Open", () => router.push(`/folders/${folder.id}`));
  }

  return (
    <>
      <div className="modal-head">
        <div>
          <div className="modal-title">New folder</div>
          <div className="modal-sub">Where it lives, what it&rsquo;s called, who can see it.</div>
        </div>
        <button className="modal-close" onClick={closeNewFolder}>
          {Close}
        </button>
      </div>

      <div className="modal-body">
        {/* Where */}
        <div className="field">
          <label>Where</label>
          <div className="where-picker">
            <button
              type="button"
              className="where-picker-button"
              onClick={() => setPickerOpen((v) => !v)}
              disabled={submitting}
              aria-expanded={pickerOpen}
            >
              <svg className="where-picker-folder" viewBox="0 0 18 18" width="15" height="15" fill="none" aria-hidden="true">
                <path
                  d="M2 5.5A1.5 1.5 0 013.5 4h3l1.5 1.5h6A1.5 1.5 0 0115.5 7v6.5A1.5 1.5 0 0114 15H4a1.5 1.5 0 01-1.5-1.5v-8z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="where-picker-label">{parentName}</span>
              <svg
                className={`where-picker-caret${pickerOpen ? " is-open" : ""}`}
                viewBox="0 0 12 12"
                width="11"
                height="11"
                fill="none"
                aria-hidden="true"
              >
                <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {pickerOpen && (
              <div className="where-picker-tree">
                <button
                  type="button"
                  className={`where-picker-item${parentId === null ? " is-selected" : ""}`}
                  onClick={() => { setParentId(null); setPickerOpen(false); }}
                >
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
                    <path d="M2.5 7.5L8 3l5.5 4.5V13a1 1 0 01-1 1H3.5a1 1 0 01-1-1V7.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  </svg>
                  <span>Workspace root</span>
                </button>
                {(folderTree.get(null) ?? []).map((f) => renderTreeNode(f, 0))}
                {(folderTree.get(null) ?? []).length === 0 && folders !== null ? (
                  <div className="field-hint" style={{ padding: "8px 10px" }}>No other folders yet.</div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Folder name */}
        <div className="field">
          <label htmlFor="new-folder-name">Folder name</label>
          <input
            id="new-folder-name"
            ref={nameInputRef}
            type="text"
            className="field-input"
            placeholder="e.g. Q3 launch"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
            }}
            autoComplete="off"
            spellCheck={false}
            disabled={submitting}
          />

          {/* Folder colour swatches — 12 Finder-style tags plus a "none"
              option so the user can clear back to the default. */}
          <div className="folder-color-row" role="radiogroup" aria-label="Folder colour">
            <button
              type="button"
              className={`color-swatch color-none${color === null ? " is-selected" : ""}`}
              onClick={() => setColor(null)}
              aria-pressed={color === null}
              aria-label="No colour"
              disabled={submitting}
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
                disabled={submitting}
              />
            ))}
          </div>
        </div>

        {/* Initial access */}
        <div className="field">
          <label>Initial access</label>
          <div className="radio-row" role="radiogroup" aria-label="Initial access">
            <label className={`radio-option${access === "private" ? " is-selected" : ""}`} data-tint="neutral">
              <input
                type="radio"
                name="new-folder-access"
                value="private"
                checked={access === "private"}
                onChange={() => setAccess("private")}
              />
              <span className="radio-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
                  <rect x="3.5" y="7" width="9" height="6.5" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <span className="radio-info">
                <span className="radio-label">Private</span>
                <span className="radio-desc">Only you can open or edit this folder.</span>
              </span>
              <span className="radio-check" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                  <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </label>
            <label className={`radio-option${access === "shared" ? " is-selected" : ""}`} data-tint="blue">
              <input
                type="radio"
                name="new-folder-access"
                value="shared"
                checked={access === "shared"}
                onChange={() => setAccess("shared")}
              />
              <span className="radio-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
                  <circle cx="6" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="11" cy="7" r="1.7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M2 13c.4-1.7 2-2.7 4-2.7s3.6 1 4 2.7M9.5 13c.3-1.2 1.2-1.9 2.5-1.9s2.2.7 2.5 1.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <span className="radio-info">
                <span className="radio-label">
                  Shared
                  {access === "shared" && (members.length + teamGrants.length > 0) ? (
                    <span className="radio-count">{members.length + teamGrants.length}</span>
                  ) : null}
                </span>
                <span className="radio-desc">Invite specific people or teams from your workspace.</span>
              </span>
              <span className="radio-check" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                  <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </label>
          </div>
        </div>

        {/* Manage access — only when Shared */}
        {access === "shared" && (
          <div className="field">
            <div className="member-add" style={{ position: "relative" }}>
              <input
                placeholder="Type a name, email, or team…"
                value={inviteQuery}
                onChange={(e) => setInviteQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (suggestions[0]) {
                      if (suggestions[0].kind === "user") addUser(suggestions[0].user);
                      else addTeam(suggestions[0].team);
                    }
                  }
                }}
                disabled={submitting}
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                disabled={submitting}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  if (suggestions[0]) {
                    if (suggestions[0].kind === "user") addUser(suggestions[0].user);
                    else addTeam(suggestions[0].team);
                  }
                }}
                disabled={submitting}
              >
                Invite
              </button>

              {suggestions.length > 0 && (
                <div className="invite-suggestions">
                  {suggestions.map((s) =>
                    s.kind === "user" ? (
                      <button
                        key={"u-" + s.user.id}
                        type="button"
                        className="invite-suggestion"
                        onClick={() => addUser(s.user)}
                      >
                        <span className="av">{initialsOf(s.user.name, s.user.email)}</span>
                        <span className="invite-info">
                          <span className="invite-name">{s.user.name || s.user.email}</span>
                          {s.user.name ? <span className="invite-mail">{s.user.email}</span> : null}
                        </span>
                        <span className="invite-kind">Person</span>
                      </button>
                    ) : (
                      <button
                        key={"t-" + s.team.id}
                        type="button"
                        className="invite-suggestion"
                        onClick={() => addTeam(s.team)}
                      >
                        <span className="team-badge" style={{ width: 28, height: 28, fontSize: 11 }}>
                          <span style={{ background: s.team.gradient || "linear-gradient(135deg, var(--violet) 0%, var(--blue) 100%)" }} />
                          {s.team.initial || s.team.name[0]}
                        </span>
                        <span className="invite-info">
                          <span className="invite-name">{s.team.name}</span>
                          <span className="invite-mail">
                            {s.team.memberCount} member{s.team.memberCount === 1 ? "" : "s"}
                          </span>
                        </span>
                        <span className="invite-kind">Team</span>
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>

            {(members.length === 0 && teamGrants.length === 0) ? (
              <div className="access-empty">No one added yet.</div>
            ) : (
              <div className="member-list" style={{ marginTop: 8 }}>
                {teamGrants.map((t) => (
                  <div key={"t-" + t.teamId} className="member-item">
                    <div className="team-badge" style={{ width: 28, height: 28, fontSize: 11 }}>
                      <span style={{ background: t.gradient || "linear-gradient(135deg, var(--blue) 0%, var(--violet) 100%)" }} />
                      {t.initial || t.name[0]}
                    </div>
                    <div className="member-info">
                      <div className="name">{t.name}</div>
                    </div>
                    <select
                      className="member-role-select"
                      value={t.role}
                      onChange={(e) => setTeamRole(t.teamId, e.target.value as Role)}
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      type="button"
                      className="member-remove"
                      onClick={() => removeTeam(t.teamId)}
                      aria-label={`Remove ${t.name}`}
                    >
                      {Close}
                    </button>
                  </div>
                ))}
                {members.map((m) => (
                  <div key={"u-" + m.userId} className="member-item">
                    <div className="av">{initialsOf(m.name, m.email)}</div>
                    <div className="member-info">
                      <div className="name">{m.name || m.email}</div>
                      {m.name ? <div className="mail">{m.email}</div> : null}
                    </div>
                    <select
                      className="member-role-select"
                      value={m.role}
                      onChange={(e) => setUserRole(m.userId, e.target.value as Role)}
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      type="button"
                      className="member-remove"
                      onClick={() => removeUser(m.userId)}
                      aria-label={`Remove ${m.name || m.email}`}
                    >
                      {Close}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <div className="login-error">{error}</div>}
      </div>

      <div className="modal-footer">
        <span className="left">Cmd+↵ to create</span>
        <div className="right">
          <button className="btn" onClick={closeNewFolder} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? "Creating…" : "Create folder"}
          </button>
        </div>
      </div>
    </>
  );
}
