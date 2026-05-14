"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "@/stores/toast-store";
import { formatRelative } from "@/lib/format";
import { roleDisplay } from "@/lib/roles";
import type { Profile } from "@/lib/data/profile";
import type { SessionUser } from "@/lib/auth-helpers";
import ApiTokensCard from "@/components/profile/ApiTokensCard";

/**
 * Profile page — redesigned with:
 *  - a gradient-ring avatar hero with inline name editing
 *  - a 4-tile stats strip beneath the hero (role / folders / teams /
 *    member-since)
 *  - polished section cards (teams, API access, folders)
 *  - workspace-wide API-access gate so the API section disappears
 *    when the Super Admin has turned the kill switch off
 */

function initials(value: string | null | undefined): string {
  const s = (value ?? "").trim();
  if (!s) return "·";
  const parts = s.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (s.split("@")[0] ?? s).slice(0, 2).toUpperCase();
}

function roleLabel(role: string): string {
  return roleDisplay(role);
}

function roleAccent(role: string): string {
  switch (role) {
    case "owner": return "is-owner";
    case "admin": return "is-admin";
    case "editor": return "is-editor";
    default: return "is-viewer";
  }
}

export default function ProfileView({
  me,
  profile,
  isSelf,
  apiAccessEnabled = true,
}: {
  me: SessionUser;
  profile: Profile;
  isSelf: boolean;
  apiAccessEnabled?: boolean;
}) {
  const router = useRouter();
  const isAdmin = me.workspaceRole === "owner" || me.workspaceRole === "admin";
  const canEditProfile = isSelf || isAdmin;

  const [name, setName] = useState(profile.name ?? "");
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function saveName() {
    const trimmed = name.trim();
    if (trimmed === (profile.name ?? "")) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    const res = await fetch(`/api/users/${profile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    setSavingName(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast(body.error ?? "Could not save name");
      return;
    }
    toast("Profile updated");
    setEditingName(false);
    router.refresh();
  }

  function pickFile() {
    fileRef.current?.click();
  }

  async function uploadAvatar(file: File) {
    if (!file.type.startsWith("image/")) {
      toast("Pick an image file (PNG, JPEG, WebP, or GIF).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast("Image must be under 5 MB.");
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/account/avatar", { method: "POST", body: form });
    setUploading(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast(body.error ?? "Could not upload photo");
      return;
    }
    toast("Photo updated");
    router.refresh();
  }

  async function removeAvatar() {
    if (!confirm("Remove your profile photo?")) return;
    const res = await fetch("/api/account/avatar", { method: "DELETE" });
    if (!res.ok) {
      toast("Could not remove photo");
      return;
    }
    toast("Photo removed");
    router.refresh();
  }

  const showInitials = !profile.avatarUrl;
  const memberSinceShort = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : "—";
  const memberSinceLong = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "—";

  const displayName = profile.name ?? profile.email.split("@")[0];

  return (
    <main className="page profile-page profile-page-v2">
      <div className="crumbs">
        <Link href="/people">People</Link>
        <span className="sep"> / </span>
        <span className="here">{displayName}</span>
      </div>

      {/* ============ HERO ============ */}
      <section className="profile-hero-v2">
        <div className="profile-hero-aura" aria-hidden="true" />

        <div className="profile-hero-avatar">
          <div className={`profile-avatar-ring ${roleAccent(profile.workspaceRole)}`}>
            <div className="profile-avatar-inner">
              {showInitials ? (
                <span className="profile-avatar-initials">{initials(profile.name ?? profile.email)}</span>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={profile.avatarUrl!} alt={`${displayName} avatar`} />
              )}
            </div>
            {isSelf && (
              <button
                type="button"
                className="profile-avatar-camera"
                onClick={pickFile}
                title={profile.avatarUrl ? "Replace photo" : "Upload photo"}
                aria-label="Change profile photo"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 5.5A1.5 1.5 0 013.5 4h2L6.5 3h3l1 1h2A1.5 1.5 0 0114 5.5v6A1.5 1.5 0 0112.5 13h-9A1.5 1.5 0 012 11.5v-6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  <circle cx="8" cy="8.5" r="2.4" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadAvatar(file);
              e.target.value = "";
            }}
          />
          {isSelf && profile.avatarUrl && (
            <button type="button" className="profile-avatar-remove" onClick={removeAvatar}>
              Remove photo
            </button>
          )}
          {isSelf && !profile.avatarUrl && (
            <button type="button" className="profile-avatar-remove" onClick={pickFile} disabled={uploading}>
              {uploading ? "Uploading…" : "Add photo"}
            </button>
          )}
        </div>

        <div className="profile-hero-text">
          {editingName && canEditProfile ? (
            <div className="profile-name-edit">
              <input
                autoFocus
                className="profile-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveName();
                  if (e.key === "Escape") {
                    setName(profile.name ?? "");
                    setEditingName(false);
                  }
                }}
                onBlur={() => { if (!savingName) void saveName(); }}
                placeholder={profile.email.split("@")[0]}
                maxLength={120}
              />
              {savingName && <span className="profile-name-saving">Saving…</span>}
            </div>
          ) : (
            <h1 className="profile-name-v2">
              {displayName}
              {canEditProfile && (
                <button
                  type="button"
                  className="profile-name-pencil"
                  onClick={() => setEditingName(true)}
                  aria-label="Edit name"
                  title="Edit name"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M3 12.5L11 4.5l2 2-8 8H3v-2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </h1>
          )}
          <p className="profile-email-v2">{profile.email}</p>

          <div className="profile-chips-v2">
            <span className={`profile-chip-v2 ${roleAccent(profile.workspaceRole)}`}>
              <span className="profile-chip-dot" aria-hidden="true" />
              {roleLabel(profile.workspaceRole)}
            </span>
            <span className="profile-chip-v2">
              {profile.lastActiveAt ? `Active ${formatRelative(profile.lastActiveAt)}` : "Hasn't signed in yet"}
            </span>
            <span className="profile-chip-v2">Joined {memberSinceShort}</span>
          </div>
        </div>

        {isSelf && (
          <div className="profile-hero-actions-v2">
            <Link href="/account/password" className="btn">
              <svg viewBox="0 0 16 16" fill="none" width="13" height="13" aria-hidden="true">
                <rect x="3" y="7" width="10" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              Change password
            </Link>
            <button className="btn" onClick={() => signOut({ callbackUrl: "/login" })}>
              <svg viewBox="0 0 16 16" fill="none" width="13" height="13" aria-hidden="true">
                <path d="M10 5V3a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h5a1 1 0 001-1v-2M7 8h7m0 0l-2.5-2.5M14 8l-2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sign out
            </button>
          </div>
        )}
      </section>

      {/* ============ STATS STRIP ============ */}
      <section className="profile-stats" aria-label="Workspace stats">
        <div className="profile-stat">
          <span className="profile-stat-label">Folders</span>
          <span className="profile-stat-value">{profile.folders.length.toLocaleString()}</span>
          <span className="profile-stat-foot">
            {profile.folders.filter((f) => f.role === "owner").length} owned
          </span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-label">Teams</span>
          <span className="profile-stat-value">{profile.teams.length.toLocaleString()}</span>
          <span className="profile-stat-foot">
            {profile.teams.filter((t) => t.isDefault).length > 0 ? "incl. organisation" : "—"}
          </span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-label">Role</span>
          <span className={`profile-stat-value role-text ${roleAccent(profile.workspaceRole)}`}>
            {roleLabel(profile.workspaceRole)}
          </span>
          <span className="profile-stat-foot">workspace permission</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-label">Member since</span>
          <span className="profile-stat-value">{memberSinceShort}</span>
          <span className="profile-stat-foot">{memberSinceLong}</span>
        </div>
      </section>

      {/* ============ TEAMS ============ */}
      <section className="profile-card-v2">
        <header className="profile-card-head-v2">
          <div>
            <h2>
              Teams
              <span className="profile-card-pill">{profile.teams.length}</span>
            </h2>
            <p>{isSelf ? "Groups you belong to." : `Groups ${profile.name ?? "they belong"} to.`}</p>
          </div>
        </header>
        <div className="profile-card-body-v2">
          {profile.teams.length === 0 ? (
            <div className="profile-empty-v2">
              <div className="profile-empty-ico">
                <svg viewBox="0 0 16 16" fill="none" width="18" height="18">
                  <circle cx="5.5" cy="6" r="2" stroke="currentColor" strokeWidth="1.4" />
                  <circle cx="11" cy="6" r="2" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M2 12.5c.5-1.6 2-2.5 3.5-2.5s3 .9 3.5 2.5M8.5 12.5c.5-1.6 2-2.5 3.5-2.5s3 .9 3.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <strong>Not on any team yet</strong>
                <span>Teams group people for per-folder access grants.</span>
              </div>
            </div>
          ) : (
            <div className="profile-team-grid-v2">
              {profile.teams.map((t) => (
                <Link
                  key={t.id}
                  href="/people?tab=teams"
                  className="profile-team-card-v2"
                >
                  <div
                    className="profile-team-badge-v2"
                    style={{
                      background: t.gradient ?? "linear-gradient(135deg, var(--blue), var(--violet))",
                    }}
                  >
                    {t.initial ?? t.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="profile-team-name-v2">{t.name}</div>
                    <div className="profile-team-sub-v2">
                      {t.isDefault ? "Everyone in this workspace" : "Workspace team"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ============ API ACCESS ============ */}
      {isSelf && apiAccessEnabled && <ApiTokensCard />}

      {/* ============ FOLDERS ============ */}
      <section className="profile-card-v2">
        <header className="profile-card-head-v2">
          <div>
            <h2>
              Folders
              <span className="profile-card-pill">{profile.folders.length}</span>
            </h2>
            <p>{isSelf ? "Folders you own or have been added to." : "Folders this member has access to."}</p>
          </div>
        </header>
        <div className="profile-card-body-v2">
          {profile.folders.length === 0 ? (
            <div className="profile-empty-v2">
              <div className="profile-empty-ico">
                <svg viewBox="0 0 16 16" fill="none" width="18" height="18">
                  <path d="M2 5.5A1.5 1.5 0 013.5 4h3l1.5 1.5h6A1.5 1.5 0 0115.5 7v6.5A1.5 1.5 0 0114 15H4a1.5 1.5 0 01-1.5-1.5v-8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <strong>No folders yet</strong>
                <span>{isSelf ? "Create one from the home page to begin." : "This member hasn't been added to any folder."}</span>
              </div>
            </div>
          ) : (
            <ul className="profile-folder-list-v2">
              {profile.folders.map((f) => (
                <li key={f.id + f.role}>
                  <Link href={`/folders/${f.id}`} className="profile-folder-row-v2">
                    <div className="profile-folder-icon">
                      <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                        <path
                          d="M2 5.5A1.5 1.5 0 013.5 4h3l1.5 1.5h6A1.5 1.5 0 0115.5 7v6.5A1.5 1.5 0 0114 15H4a1.5 1.5 0 01-1.5-1.5v-8z"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div className="profile-folder-meta-v2">
                      <div className="profile-folder-name-v2">{f.name}</div>
                      <div className="profile-folder-sub-v2">/{f.slug}</div>
                    </div>
                    <span className={`profile-folder-role-v2 role-${f.role}`}>
                      {f.role === "owner" ? "Owner" : "Member"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
