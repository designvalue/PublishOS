"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUI, type ShareTarget } from "@/stores/ui-store";
import { toast } from "@/stores/toast-store";
import { Close } from "@/lib/icons";

type AccessKey = "private" | "shared";
type PublishKey = "off" | "public" | "password";
type Role = "editor" | "viewer";

type Member = { userId: string; role: Role; name: string | null; email: string };
type TeamGrant = { teamId: string; role: Role; name: string; initial: string | null; gradient: string | null };
type WorkspaceUser = { id: string; name: string | null; email: string };
type WorkspaceTeam = { id: string; name: string; initial: string | null; gradient: string | null; memberCount: number };

function visToInitial(vis: "private" | "shared" | "public" | "protected"): {
  access: AccessKey;
  publish: PublishKey;
} {
  if (vis === "private") return { access: "private", publish: "off" };
  if (vis === "shared") return { access: "shared", publish: "off" };
  if (vis === "public") return { access: "shared", publish: "public" };
  return { access: "shared", publish: "password" }; // protected
}

function initialsOf(name: string | null, email: string): string {
  const src = (name && name.trim()) || email;
  const parts = src.replace(/@.*/, "").split(/[ ._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase() || "?";
}

/**
 * sessionStorage key for the per-file plaintext password cache. The server
 * only retains a one-way hash, so without this cache the password input
 * would start blank every time the publish popup is opened.
 *
 * Scope: per-tab (cleared on tab close), per-file. The user is reading their
 * own password in their own browser — same trust boundary as any saved
 * password manager autofill.
 */
function pwCacheKey(fileId: string): string {
  return `publishos:pwcache:${fileId}`;
}

export default function ShareDrawer() {
  const { share, closeShare } = useUI();

  // ESC closes.
  useEffect(() => {
    if (!share) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeShare();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [share, closeShare]);

  if (!share) return null;
  return (
    <>
      <div className="modal-backdrop open" onClick={closeShare} />
      <div className="modal share-modal open" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <ShareBody key={share.folderId} share={share} closeShare={closeShare} />
      </div>
    </>
  );
}

function ShareBody({ share, closeShare }: { share: ShareTarget | null; closeShare: () => void }) {
  const router = useRouter();
  const initial = share ? visToInitial(share.vis) : { access: "shared" as AccessKey, publish: "off" as PublishKey };
  // Folder = access (people & teams). File = publishing (public URL).
  const isFile = share?.kind === "file";
  // Tab is fixed by the entity kind today (file → publish, folder → access);
  // the setter exists only because useState destructures both — kept as a
  // single-element binding to avoid an "unused" lint warning.
  const [tab] = useState<"access" | "publish">(isFile ? "publish" : "access");
  const [access, setAccess] = useState<AccessKey>(initial.access);
  const [publish, setPublish] = useState<PublishKey>(initial.publish);
  const [indexInSearch, setIndexInSearch] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [hasExistingPassword, setHasExistingPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  // Slug editing
  const [slugInput, setSlugInput] = useState("");
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const slugSegment = slugInput.trim() || share?.folderId || "";
  const slugInvalid = slugInput !== "" && !/^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/.test(slugInput);

  // Real public URL derived from the current origin so it works in dev, preview, prod.
  // Lazy initializer keeps this out of useEffect (React 19's
  // set-state-in-effect rule), and SSR-safely defaults to "".
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : "",
  );
  const publicUrl = origin
    ? `${origin}/c/${slugSegment}`
    : `/c/${slugSegment}`;

  // Real state (loaded from server)
  const [members, setMembers] = useState<Member[]>([]);
  const [teamGrants, setTeamGrants] = useState<TeamGrant[]>([]);
  const [allUsers, setAllUsers] = useState<WorkspaceUser[]>([]);
  const [allTeams, setAllTeams] = useState<WorkspaceTeam[]>([]);
  const [loading, setLoading] = useState(false);

  // Invite form state
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("editor");

  // Fetch share state when the drawer opens. setLoading() and the subsequent
  // setX() calls inside the async branches are all canonical "fetch on mount /
  // dep change" — flagged by React 19's set-state-in-effect rule, but this is
  // exactly the use case effects are intended for (sync from external system).
  useEffect(() => {
    if (!share?.folderId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (async () => {
      try {
        if (isFile) {
          // File mode: only publishing state.
          const res = await fetch(`/api/files/${share.folderId}/publishing`);
          if (cancelled) return;
          if (res.ok) {
            const body = (await res.json()) as {
              file?: {
                publishMode: PublishKey;
                indexable: boolean;
                publishPasswordHash: string | null;
                publicSlug: string | null;
              };
            };
            if (body.file) {
              setPublish(body.file.publishMode);
              setIndexInSearch(!!body.file.indexable);
              setHasExistingPassword(!!body.file.publishPasswordHash);
              setSavedSlug(body.file.publicSlug);
              setSlugInput(body.file.publicSlug ?? "");

              // Restore the cached plaintext password (set on the previous
              // save, scoped to this tab via sessionStorage). The server only
              // stores a one-way hash so this is the only way to keep the
              // input populated across popup open/close within a session.
              if (body.file.publishPasswordHash) {
                try {
                  const cached = sessionStorage.getItem(pwCacheKey(share.folderId));
                  if (cached) setPassword(cached);
                } catch {
                  /* sessionStorage unavailable (e.g. private mode) — fall back to mask placeholder */
                }
              }
            }
          }
          return;
        }

        // Folder mode: access (members + teams).
        const [accessRes, usersRes, teamsRes] = await Promise.all([
          fetch(`/api/folders/${share.folderId}/access`),
          fetch("/api/users"),
          fetch("/api/teams"),
        ]);
        if (cancelled) return;
        if (accessRes.ok) {
          const body = (await accessRes.json()) as {
            visibility: "private" | "shared";
            members: Member[];
            teams: TeamGrant[];
          };
          setMembers(body.members ?? []);
          setTeamGrants(body.teams ?? []);
          setAccess(body.visibility);
        }
        if (usersRes.ok) {
          const body = (await usersRes.json()) as { users: WorkspaceUser[] };
          setAllUsers(body.users ?? []);
        }
        if (teamsRes.ok) {
          const body = (await teamsRes.json()) as { teams: WorkspaceTeam[] };
          setAllTeams(body.teams ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [share?.folderId, isFile]);

  // Suggestions for the invite typeahead
  const suggestions = useMemo(() => {
    const q = inviteQuery.trim().toLowerCase();
    if (!q) return [] as Array<{ kind: "user"; user: WorkspaceUser } | { kind: "team"; team: WorkspaceTeam }>;
    const taken = new Set([
      ...members.map((m) => "u:" + m.userId),
      ...teamGrants.map((t) => "t:" + t.teamId),
    ]);
    const users = allUsers
      .filter(
        (u) =>
          !taken.has("u:" + u.id) &&
          ((u.name && u.name.toLowerCase().includes(q)) || u.email.toLowerCase().includes(q)),
      )
      .slice(0, 6)
      .map((user) => ({ kind: "user" as const, user }));
    const tms = allTeams
      .filter((t) => !taken.has("t:" + t.id) && t.name.toLowerCase().includes(q))
      .slice(0, 4)
      .map((team) => ({ kind: "team" as const, team }));
    return [...tms, ...users];
  }, [inviteQuery, allUsers, allTeams, members, teamGrants]);

  function addUser(user: WorkspaceUser) {
    setMembers((prev) =>
      prev.find((m) => m.userId === user.id)
        ? prev
        : [...prev, { userId: user.id, role: inviteRole, name: user.name, email: user.email }],
    );
    setInviteQuery("");
  }

  function addTeam(team: WorkspaceTeam) {
    setTeamGrants((prev) =>
      prev.find((t) => t.teamId === team.id)
        ? prev
        : [
            ...prev,
            {
              teamId: team.id,
              role: inviteRole,
              name: team.name,
              initial: team.initial,
              gradient: team.gradient,
            },
          ],
    );
    setInviteQuery("");
  }

  function inviteByEmail() {
    const email = inviteQuery.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast("Type an email or pick a team/person from the list");
      return;
    }
    const user = allUsers.find((u) => u.email.toLowerCase() === email);
    if (!user) {
      toast(`No workspace member with email ${email}`);
      return;
    }
    addUser(user);
  }

  function removeMember(userId: string) {
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  }
  function removeTeam(teamId: string) {
    setTeamGrants((prev) => prev.filter((t) => t.teamId !== teamId));
  }
  function changeMemberRole(userId: string, role: Role) {
    setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role } : m)));
  }
  function changeTeamRole(teamId: string, role: Role) {
    setTeamGrants((prev) => prev.map((t) => (t.teamId === teamId ? { ...t, role } : t)));
  }

  async function applyAndClose() {
    if (!share) {
      closeShare();
      return;
    }
    setSaving(true);
    try {
      if (isFile) {
        // File: publishing only. Folders aren't public.
        const publishingPayload: Record<string, unknown> = {
          mode: publish,
          indexable: indexInSearch,
        };
        if (publish === "password") {
          if (!password && !hasExistingPassword) {
            toast("Set a password before publishing.");
            setSaving(false);
            return;
          }
          if (password && password.length < 8) {
            toast("Password must be at least 8 characters.");
            setSaving(false);
            return;
          }
          if (password) publishingPayload.password = password;
        }
        const trimmedSlug = slugInput.trim();
        if (trimmedSlug !== (savedSlug ?? "")) {
          publishingPayload.publicSlug = trimmedSlug === "" ? null : trimmedSlug;
        }
        const res = await fetch(`/api/files/${share.folderId}/publishing`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(publishingPayload),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          toast(body.error ?? "Could not save publishing settings");
          setSaving(false);
          return;
        }

        // Persist the plaintext locally so reopening the popup later in the
        // same tab shows the saved password instead of starting blank. Hashes
        // are one-way on the server, so this is the only path. Scoped per
        // file id, lives only for the tab.
        try {
          const key = pwCacheKey(share.folderId);
          if (publish === "password" && password) {
            sessionStorage.setItem(key, password);
          } else if (publish === "off") {
            sessionStorage.removeItem(key);
          }
        } catch {
          /* sessionStorage unavailable — non-fatal */
        }

        toast("Publishing updated");
        router.refresh();
        closeShare();
        return;
      }

      // Folder: access (members + teams) only.
      const accessRes = await fetch(`/api/folders/${share.folderId}/access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibility: access,
          members: members.map((m) => ({ userId: m.userId, role: m.role })),
          teams: teamGrants.map((t) => ({ teamId: t.teamId, role: t.role })),
        }),
      });
      if (!accessRes.ok) {
        const body = (await accessRes.json().catch(() => ({}))) as { error?: string };
        toast(body.error ?? "Could not save access settings");
        setSaving(false);
        return;
      }
      toast("Access updated");
      router.refresh();
      closeShare();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="modal-head">
        <div>
          <div className="modal-title">{isFile ? "Publish file" : "Manage access"}</div>
          <div className="modal-sub">{share?.name ?? (isFile ? "File" : "Folder")}</div>
        </div>
        <button className="modal-close" onClick={closeShare}>
          {Close}
        </button>
      </div>

      <div className="modal-body">
        {!isFile && tab === "access" && (
          <div className="share-pane active">
            <div className="radio-row" role="radiogroup" aria-label="Folder visibility">
              <label className={`radio-option${access === "private" ? " is-selected" : ""}`} data-tint="neutral">
                <input
                  type="radio"
                  name="folder-access"
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
                  name="folder-access"
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
                  <span className="radio-desc">
                    {access === "shared" && (members.length + teamGrants.length > 0)
                      ? `${members.length} ${members.length === 1 ? "person" : "people"}${teamGrants.length ? ` and ${teamGrants.length} ${teamGrants.length === 1 ? "team" : "teams"}` : ""} with access.`
                      : "Invite specific people or teams from your workspace."}
                  </span>
                </span>
                <span className="radio-check" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                    <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </label>
            </div>

            {access === "shared" && (
              <div>
                {/* Workspace share URL — anyone you've invited can land on this
                    link and access the folder (they'll need to sign in to the
                    workspace first). */}
                <div className="link-card" style={{ marginBottom: 14 }}>
                  <span className="link-url">{`${origin}/folders/${share?.folderId ?? ""}`}</span>
                  <div className="link-actions">
                    <button
                      className="link-btn"
                      type="button"
                      onClick={async () => {
                        const url = `${origin}/folders/${share?.folderId ?? ""}`;
                        try {
                          await navigator.clipboard.writeText(url);
                          toast("Link copied");
                        } catch {
                          toast("Could not copy link");
                        }
                      }}
                    >
                      Copy link
                    </button>
                  </div>
                </div>

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
                        } else {
                          inviteByEmail();
                        }
                      }
                    }}
                  />
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (suggestions[0]) {
                        if (suggestions[0].kind === "user") addUser(suggestions[0].user);
                        else addTeam(suggestions[0].team);
                      } else {
                        inviteByEmail();
                      }
                    }}
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
                              <span className="invite-mail">{s.team.memberCount} member{s.team.memberCount === 1 ? "" : "s"}</span>
                            </span>
                            <span className="invite-kind">Team</span>
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </div>

                {loading ? (
                  <div className="pane-sub" style={{ marginTop: 14 }}>Loading…</div>
                ) : members.length === 0 && teamGrants.length === 0 ? (
                  <div className="access-empty">No one added yet.</div>
                ) : (
                  <div className="member-list" style={{ marginTop: 14 }}>
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
                          onChange={(e) => changeTeamRole(t.teamId, e.target.value as Role)}
                        >
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                              </select>
                        <button
                          className="member-remove"
                          type="button"
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
                          onChange={(e) => changeMemberRole(m.userId, e.target.value as Role)}
                        >
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                              </select>
                        <button
                          className="member-remove"
                          type="button"
                          onClick={() => removeMember(m.userId)}
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
          </div>
        )}

        {isFile && tab === "publish" && (
          <div className="share-pane active">
            <div className="radio-row" role="radiogroup" aria-label="Publish mode">
              <label className={`radio-option${publish === "off" ? " is-selected" : ""}`} data-tint="neutral">
                <input
                  type="radio"
                  name="publish-mode"
                  value="off"
                  checked={publish === "off"}
                  onChange={() => setPublish("off")}
                />
                <span className="radio-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
                    <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="radio-info">
                  <span className="radio-label">Not published</span>
                  <span className="radio-desc">Off the web. Stays in your workspace.</span>
                </span>
                <span className="radio-check" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                    <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </label>
              <label className={`radio-option${publish === "public" ? " is-selected" : ""}`} data-tint="green">
                <input
                  type="radio"
                  name="publish-mode"
                  value="public"
                  checked={publish === "public"}
                  onChange={() => setPublish("public")}
                />
                <span className="radio-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
                    <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M2.5 8h11M8 2.5c1.7 1.5 2.5 3.5 2.5 5.5s-.8 4-2.5 5.5C6.3 12 5.5 10 5.5 8s.8-4 2.5-5.5z" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </span>
                <span className="radio-info">
                  <span className="radio-label">
                    Public
                    {publish === "public" ? <span className="radio-pill is-live">Live</span> : null}
                  </span>
                  <span className="radio-desc">Anyone with the link can view. No login.</span>
                </span>
                <span className="radio-check" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                    <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </label>
              <label className={`radio-option${publish === "password" ? " is-selected" : ""}`} data-tint="amber">
                <input
                  type="radio"
                  name="publish-mode"
                  value="password"
                  checked={publish === "password"}
                  onChange={() => setPublish("password")}
                />
                <span className="radio-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
                    <rect x="3.5" y="7" width="9" height="6.5" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="radio-info">
                  <span className="radio-label">
                    Password
                    {publish === "password" && hasExistingPassword ? <span className="radio-pill">Set</span> : null}
                  </span>
                  <span className="radio-desc">Visitors enter a passphrase you set.</span>
                </span>
                <span className="radio-check" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                    <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </label>
            </div>

            {(publish === "public" || publish === "password") && (
              <div style={{ marginTop: 18 }}>
                <div className="link-card">
                  <span className="link-url">{publicUrl}</span>
                  <div className="link-actions">
                    <button
                      className="link-btn"
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(publicUrl);
                          toast("Link copied");
                        } catch {
                          toast("Could not copy link");
                        }
                      }}
                    >
                      Copy
                    </button>
                    <button
                      className="link-btn"
                      type="button"
                      onClick={() => window.open(publicUrl, "_blank", "noopener,noreferrer")}
                    >
                      Open ↗
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="slug-input-row">
                    <span className="slug-prefix">
                      {(origin || "").replace(/^https?:\/\//, "") || "this-site"}/c/
                    </span>
                    <input
                      type="text"
                      className="slug-input"
                      value={slugInput}
                      onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      placeholder="custom-slug"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={64}
                    />
                  </div>
                  {slugInvalid ? (
                    <div className="meta-desc" style={{ marginTop: 6, color: "var(--coral)" }}>
                      3–64 lowercase letters, numbers, or hyphens.
                    </div>
                  ) : null}
                </div>

                <div className="toggle-row" style={{ marginTop: 14 }}>
                  <div className="meta-title">Index in search engines</div>
                  <button
                    type="button"
                    className={`toggle${indexInSearch ? " on" : ""}`}
                    onClick={() => setIndexInSearch((v) => !v)}
                  />
                </div>
              </div>
            )}

            {publish === "password" && (
              <div className="pw-block">
                <label className="pw-label" htmlFor="pw-input">
                  Password
                  <span className="pw-label-hint">
                    {hasExistingPassword
                      ? password
                        ? "Saved. Edit to change it."
                        : "Type a new one to replace, or leave blank to keep the current."
                      : "Choose your own, or use Generate for a memorable one."}
                  </span>
                </label>

                <div className="pw-input-row">
                  <input
                    id="pw-input"
                    type={showPassword ? "text" : "password"}
                    className="pw-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={hasExistingPassword ? "Leave blank to keep current" : "Type your password"}
                    autoComplete="new-password"
                    spellCheck={false}
                    minLength={8}
                    aria-describedby="pw-strength"
                  />
                  <button
                    type="button"
                    className="pw-eye"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M2 8s2-4.5 6-4.5S14 8 14 8s-2 4.5-6 4.5S2 8 2 8z" stroke="currentColor" strokeWidth="1.4" />
                        <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.4" />
                        <path d="M2.5 2.5l11 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M2 8s2-4.5 6-4.5S14 8 14 8s-2 4.5-6 4.5S2 8 2 8z" stroke="currentColor" strokeWidth="1.4" />
                        <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.4" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Strength meter + helper text */}
                <PasswordStrength
                  value={password}
                  hasExisting={hasExistingPassword}
                />

                <div className="pw-actions">
                  <button
                    type="button"
                    className="pw-action"
                    onClick={() => {
                      // Generate a memorable passphrase: 2 words + 2-digit suffix.
                      const words = [
                        "amber","river","cedar","quartz","willow","beacon","cobalt","ivory",
                        "lichen","topaz","violet","saffron","granite","fern","onyx","poppy",
                      ];
                      const w1 = words[Math.floor(Math.random() * words.length)];
                      const w2 = words[Math.floor(Math.random() * words.length)];
                      const n = Math.floor(10 + Math.random() * 89);
                      setPassword(`${w1}-${w2}-${n}`);
                      setShowPassword(true);
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M2 8a6 6 0 0110-4.5M14 8a6 6 0 01-10 4.5M14 2v3.5h-3.5M2 14v-3.5h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Generate
                  </button>
                  <button
                    type="button"
                    className="pw-action"
                    disabled={!password}
                    onClick={async () => {
                      if (!password) return;
                      try {
                        await navigator.clipboard.writeText(password);
                        toast("Password copied");
                      } catch {
                        toast("Could not copy password");
                      }
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <rect x="4.5" y="2.5" width="8" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M3 5.5v7A1.5 1.5 0 004.5 14H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    Copy
                  </button>
                  {password ? (
                    <button
                      type="button"
                      className="pw-action"
                      onClick={() => {
                        setPassword("");
                        setShowPassword(false);
                        // Clear the cached plaintext too so the next open of
                        // this file's popup doesn't reinstate it.
                        if (share?.folderId) {
                          try { sessionStorage.removeItem(pwCacheKey(share.folderId)); } catch { /* ignore */ }
                        }
                      }}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="modal-footer">
        <span className="left" />
        <div className="right">
          <button className="btn" onClick={closeShare} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={applyAndClose}
            disabled={saving || slugInvalid}
            title={slugInvalid ? "Fix the URL slug first" : undefined}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ---------- Password strength meter ----------
   A simple 0–4 score driven by length + character classes. Not a substitute
   for an entropy estimator, but enough to nudge users away from "1234".
   When the user hasn't typed anything AND there's already a stored hash, we
   show a "current password kept" affordance instead of a strength warning. */
function PasswordStrength({
  value,
  hasExisting,
}: {
  value: string;
  hasExisting: boolean;
}) {
  if (!value && hasExisting) {
    return (
      <div className="pw-strength is-kept" id="pw-strength">
        Current password kept — leave blank to keep it, or type a new one to replace.
      </div>
    );
  }
  if (!value) {
    return (
      <div className="pw-strength is-empty" id="pw-strength">
        At least 8 characters. Use a mix of letters, numbers and symbols.
      </div>
    );
  }

  const len = value.length;
  let score = 0;
  if (len >= 8) score += 1;
  if (len >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  // Cap at 4
  score = Math.min(4, score);

  const label =
    len < 8 ? "Too short" :
    score <= 1 ? "Weak" :
    score === 2 ? "Fair" :
    score === 3 ? "Good" :
    "Strong";
  const cls =
    len < 8 ? "is-tooshort" :
    score <= 1 ? "is-weak" :
    score === 2 ? "is-fair" :
    score === 3 ? "is-good" :
    "is-strong";

  return (
    <div className={`pw-strength ${cls}`} id="pw-strength">
      <div className="pw-strength-bars" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`pw-strength-seg${i < score ? " is-on" : ""}`} />
        ))}
      </div>
      <span className="pw-strength-label">
        {label} · {len} char{len === 1 ? "" : "s"}
      </span>
    </div>
  );
}
