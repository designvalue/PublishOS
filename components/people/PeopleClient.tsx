"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/stores/toast-store";
import { Close, Plus } from "@/lib/icons";
import { formatRelative } from "@/lib/format";
import type { UserListEntry, WorkspaceRole } from "@/lib/data/users";
import type { InvitationListEntry, InviteRole } from "@/lib/data/invitations";
import type { TeamWithStats } from "@/lib/data/teams";
import type { SessionUser } from "@/lib/auth-helpers";
import EditUserModal from "@/components/people/EditUserModal";
import EditTeamModal from "@/components/people/EditTeamModal";
import { roleDisplay } from "@/lib/roles";

function initials(value: string | null | undefined): string {
  const s = (value ?? "").trim();
  if (!s) return "·";
  const parts = s.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (s.split("@")[0] ?? s).slice(0, 2).toUpperCase();
}

function roleLabel(role: WorkspaceRole | InviteRole): string {
  return roleDisplay(role);
}

function isAdminRole(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin";
}

export default function PeopleClient({
  me,
  members,
  invitations,
  teams,
  initialTab,
}: {
  me: SessionUser;
  members: UserListEntry[];
  invitations: InvitationListEntry[];
  teams: TeamWithStats[];
  initialTab: "people" | "teams";
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"people" | "teams">(initialTab);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListEntry | null>(null);
  const [editingTeam, setEditingTeam] = useState<TeamWithStats | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; password: string } | null>(null);
  const isAdmin = isAdminRole(me.workspaceRole);

  const peopleCount = members.length + invitations.length;
  const sub =
    tab === "people"
      ? `${members.length} member${members.length === 1 ? "" : "s"}${invitations.length > 0 ? `, ${invitations.length} pending` : ""}. Invite by email or add someone to a team.`
      : `${teams.length} team${teams.length === 1 ? "" : "s"}. Group people once, share folders with them in one click.`;

  return (
    <main className="page">
      <div className="head">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1 className="title">
            People <span className="it">and teams</span>
          </h1>
          <p className="sub">{sub}</p>
        </div>
        <div className="actions">
          {isAdmin && (
            <>
              <button
                className={`btn${tab === "teams" ? " btn-primary" : ""}`}
                onClick={() => setTeamOpen(true)}
              >
                {Plus}
                New team
              </button>
              <button
                className={`btn${tab === "people" ? " btn-primary" : ""}`}
                onClick={() => setInviteOpen(true)}
              >
                {Plus}
                Invite people
              </button>
            </>
          )}
        </div>
      </div>

      <div className="subnav">
        <button
          type="button"
          className={`subnav-link${tab === "people" ? " active" : ""}`}
          onClick={() => setTab("people")}
        >
          People <span className="subnav-count">{peopleCount}</span>
        </button>
        <button
          type="button"
          className={`subnav-link${tab === "teams" ? " active" : ""}`}
          onClick={() => setTab("teams")}
        >
          Teams <span className="subnav-count">{teams.length}</span>
        </button>
      </div>

      {tab === "people" ? (
        <PeopleList
          me={me}
          members={members}
          invitations={invitations}
          onEditUser={setEditingUser}
        />
      ) : (
        <TeamsList me={me} teams={teams} onEditTeam={setEditingTeam} />
      )}

      {inviteOpen && (
        <InviteModal
          me={me}
          onClose={() => setInviteOpen(false)}
          onDone={() => {
            setInviteOpen(false);
            router.refresh();
          }}
        />
      )}

      {teamOpen && (
        <NewTeamModal
          members={members}
          onClose={() => setTeamOpen(false)}
          onDone={() => {
            setTeamOpen(false);
            router.refresh();
          }}
        />
      )}

      {editingUser && (
        <EditUserModal
          me={me}
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onResetPassword={(email, password) => setResetResult({ email, password })}
        />
      )}

      {editingTeam && (
        <EditTeamModal
          teamId={editingTeam.id}
          initialName={editingTeam.name}
          initialDescription={editingTeam.description}
          isDefault={editingTeam.isDefault}
          members={members}
          onClose={() => setEditingTeam(null)}
        />
      )}

      {resetResult && (
        <ResetPasswordResult
          email={resetResult.email}
          password={resetResult.password}
          onClose={() => setResetResult(null)}
        />
      )}
    </main>
  );
}

/* ------------------- People list ------------------- */

function PeopleList({
  me,
  members,
  invitations,
  onEditUser,
}: {
  me: SessionUser;
  members: UserListEntry[];
  invitations: InvitationListEntry[];
  onEditUser: (user: UserListEntry) => void;
}) {
  const router = useRouter();
  const isAdmin = isAdminRole(me.workspaceRole);

  async function revokeInvite(id: string, email: string) {
    if (!confirm(`Revoke invitation for ${email}?`)) return;
    const res = await fetch(`/api/invitations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Could not revoke");
      return;
    }
    toast("Invitation revoked");
    router.refresh();
  }

  async function copyInvite(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("Invite link copied");
    } catch {
      toast(url);
    }
  }

  return (
    <div className="subview active">
      <div className="list people-row list-actions-visible">
        {members.map((m) => {
          const isSelf = m.id === me.id;
          const canEdit = isAdmin || isSelf;
          const roleClass =
            m.workspaceRole === "owner"
              ? "is-owner"
              : m.workspaceRole === "admin"
                ? "is-admin"
                : "";
          return (
            <div key={m.id} className="row">
              <Link
                href={isSelf ? "/profile" : `/people/${m.id}`}
                className="row-name"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="av">{initials(m.name ?? m.email)}</div>
                <div>
                  <div className="row-title">
                    {m.name ?? m.email.split("@")[0]}
                    {isSelf ? <span className="from-pill" style={{ marginLeft: 8 }}>You</span> : null}
                  </div>
                  <div className="row-sub">{m.email}</div>
                </div>
              </Link>
              <span className={`role-chip ${roleClass}`.trim()}>{roleLabel(m.workspaceRole)}</span>
              <span className="row-meta">
                {m.folderCount} folder{m.folderCount === 1 ? "" : "s"}
              </span>
              <span className="row-meta">{m.lastActiveAt ? formatRelative(m.lastActiveAt) : "Never"}</span>
              <span className="row-quick">
                {canEdit ? <button onClick={() => onEditUser(m)}>Edit</button> : null}
              </span>
            </div>
          );
        })}

        {invitations.map((inv) => (
          <div key={inv.id} className="row is-pending">
            <div className="row-name">
              <div className="av" style={{ background: "var(--hair-soft)", color: "var(--text-3)" }}>·</div>
              <div>
                <div className="row-title muted">{inv.email}</div>
                <div className="row-sub">
                  Pending — invited {formatRelative(inv.invitedAt)} by {inv.invitedByName ?? inv.invitedByEmail}
                </div>
              </div>
            </div>
            <span className="role-chip is-pending">{roleLabel(inv.role)}</span>
            <span className="row-meta muted">—</span>
            <span className="row-meta muted">Expires {formatRelative(inv.expiresAt)}</span>
            <span className="row-quick">
              <button onClick={() => copyInvite(inv.token)}>Copy link</button>
              {isAdmin && <button onClick={() => revokeInvite(inv.id, inv.email)}>Revoke</button>}
            </span>
          </div>
        ))}

        {members.length === 0 && invitations.length === 0 && (
          <div className="empty-state">
            <div className="empty-title">No one here yet</div>
            <div className="empty-desc">Invite a teammate by email to collaborate on folders and sites.</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------- Teams list ------------------- */

function TeamsList({
  me,
  teams,
  onEditTeam,
}: {
  me: SessionUser;
  teams: TeamWithStats[];
  onEditTeam: (team: TeamWithStats) => void;
}) {
  const router = useRouter();
  const isAdmin = isAdminRole(me.workspaceRole);

  async function removeTeam(id: string, name: string) {
    if (!confirm(`Delete the team "${name}"? Folder access grants on this team will be removed.`)) return;
    const res = await fetch(`/api/teams/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Could not delete team");
      return;
    }
    toast(`Deleted ${name}`);
    router.refresh();
  }

  if (teams.length === 0) {
    return (
      <div className="subview active">
        <p className="subview-intro">
          Group people into teams to share folders in one click. A team can be granted access to any folder, with each
          member&apos;s role inherited from the workspace.
        </p>
        <div className="empty-state">
          <div className="empty-title">No teams yet</div>
          <div className="empty-desc">
            {isAdmin ? (
              <>
                Click <strong>New team</strong> above to group members.
              </>
            ) : (
              "An admin can create teams from this page."
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="subview active">
      <p className="subview-intro">
        Group people into teams to share folders in one click. A team can be granted access to any folder, with each
        member&apos;s role inherited from the workspace.
      </p>
      <div className="list teams-list list-actions-visible">
        {teams.map((t) => {
          const gradient = t.gradient ?? "linear-gradient(135deg, var(--blue) 0%, var(--violet) 100%)";
          return (
            <div key={t.id} className="row">
              <div className="team-badge">
                <span style={{ background: gradient }} />
                {t.initial}
              </div>
              <div className="row-name">
                <div>
                  <div className="row-title">
                    {t.name}
                    {t.isDefault ? <span className="from-pill org" style={{ marginLeft: 8 }}>Everyone</span> : null}
                  </div>
                  <div className="row-sub">{t.description ?? "No description"}</div>
                </div>
              </div>
              <div className="team-avs">
                {t.members.slice(0, 4).map((m) => (
                  <div key={m.userId} className="av av-sm">
                    {initials(m.name ?? m.email)}
                  </div>
                ))}
              </div>
              <span className="row-meta">
                {t.memberCount} member{t.memberCount === 1 ? "" : "s"}
              </span>
              <span className="row-meta">
                {t.folderCount} folder{t.folderCount === 1 ? "" : "s"}
              </span>
              <span className="row-quick">
                {isAdmin && (
                  <>
                    <button onClick={() => onEditTeam(t)}>Edit</button>
                    {!t.isDefault && <button onClick={() => removeTeam(t.id, t.name)}>Delete</button>}
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------- Invite modal ------------------- */

function InviteModal({
  me,
  onClose,
  onDone,
}: {
  me: SessionUser;
  onClose: () => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("editor");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  async function invite() {
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not send invite");
      return;
    }
    const body = (await res.json()) as { inviteUrl: string };
    setLink(body.inviteUrl);
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast("Invite link copied");
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <div className="modal-backdrop open" onClick={onClose} />
      <div className="modal open" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="modal-title">Invite to workspace</div>
            <div className="modal-sub">Send them a one-time link to join.</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            {Close}
          </button>
        </div>
        <div className="modal-body">
          {link ? (
            <div>
              <div className="field">
                <label>Share this link with {email}</label>
                <div className="password-block">
                  <input value={link} readOnly />
                  <button onClick={copy}>Copy</button>
                </div>
                <div className="field-hint">The link expires in 7 days.</div>
              </div>
              <button
                className="btn"
                onClick={() => {
                  setLink(null);
                  setEmail("");
                  onDone();
                }}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="field">
                <label>Email</label>
                <input
                  className="field-input"
                  type="email"
                  placeholder="teammate@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Role</label>
                <select className="field-input" value={role} onChange={(e) => setRole(e.target.value as InviteRole)}>
                  {me.workspaceRole === "owner" ? (
                    <option value="admin">Admin — full control of people and teams</option>
                  ) : null}
                  <option value="editor">Editor — create folders, upload, share</option>
                  <option value="viewer">Viewer — read-only</option>
                </select>
              </div>
              {error && <div className="login-error">{error}</div>}
            </>
          )}
        </div>
        {!link && (
          <div className="modal-footer">
            <span className="left">A link is generated; share it manually.</span>
            <div className="right">
              <button className="btn" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={invite} disabled={submitting || !email}>
                {submitting ? "Inviting…" : "Send invite"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ------------------- New team modal ------------------- */

function NewTeamModal({
  members,
  onClose,
  onDone,
}: {
  members: UserListEntry[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Team name is required");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || undefined,
        gradient: "linear-gradient(135deg, var(--blue) 0%, var(--violet) 100%)",
        memberIds: [...selected],
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not create team");
      return;
    }
    toast(`Created "${name.trim()}"`);
    onDone();
  }

  return (
    <>
      <div className="modal-backdrop open" onClick={onClose} />
      <div className="modal open" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="modal-title">New team</div>
            <div className="modal-sub">Group people once, share folders with them in one click.</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            {Close}
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Team name</label>
            <input className="field-input" placeholder="e.g. Marketing" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Description (optional)</label>
            <input
              className="field-input"
              placeholder="Press, brand assets, and launch sites"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Members</label>
            <div className="member-picker">
              {members.length === 0 ? (
                <div className="field-hint">No workspace members yet.</div>
              ) : (
                members.map((m) => (
                  <label key={m.id} className="member-pick">
                    <input
                      type="checkbox"
                      checked={selected.has(m.id)}
                      onChange={() => toggle(m.id)}
                    />
                    <div className="av av-sm">{initials(m.name ?? m.email)}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name ?? m.email.split("@")[0]}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>{m.email}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
          {error && <div className="login-error">{error}</div>}
        </div>
        <div className="modal-footer">
          <span className="left">{selected.size} selected</span>
          <div className="right">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={submitting}>
              {submitting ? "Creating…" : "Create team"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------- Reset password result ------------------- */

function ResetPasswordResult({
  email,
  password,
  onClose,
}: {
  email: string;
  password: string;
  onClose: () => void;
}) {
  const [revealed, setRevealed] = useState(true);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      toast("Password copied");
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <div className="modal-backdrop open" onClick={onClose} />
      <div className="modal open" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="modal-title">Temporary password</div>
            <div className="modal-sub">
              Share this with <strong>{email}</strong>. They&apos;ll be required to change it on the next sign-in.
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            {Close}
          </button>
        </div>
        <div className="modal-body">
          <div className="password-block" style={{ fontSize: 14 }}>
            <input value={revealed ? password : "•".repeat(password.length)} readOnly />
            <button onClick={() => setRevealed((v) => !v)}>{revealed ? "Hide" : "View"}</button>
            <button onClick={copy}>Copy</button>
          </div>
          <div className="field-hint" style={{ marginTop: 10 }}>
            This password will not be shown again. Make sure to copy it now.
          </div>
        </div>
        <div className="modal-footer">
          <span className="left">&nbsp;</span>
          <div className="right">
            <button className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
