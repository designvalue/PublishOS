"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/stores/toast-store";
import { Close } from "@/lib/icons";
import type { UserListEntry, WorkspaceRole } from "@/lib/data/users";
import type { SessionUser } from "@/lib/auth-helpers";

export default function EditUserModal({
  me,
  user,
  onClose,
  onResetPassword,
}: {
  me: SessionUser;
  user: UserListEntry;
  onClose: () => void;
  onResetPassword: (email: string, password: string) => void;
}) {
  const router = useRouter();
  const isSelf = user.id === me.id;

  const [name, setName] = useState(user.name ?? "");
  const [role, setRole] = useState<WorkspaceRole>(user.workspaceRole);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSaving(true);
    const patch: Record<string, unknown> = {};
    if (name.trim() !== (user.name ?? "")) patch.name = name.trim();
    if (role !== user.workspaceRole) patch.workspaceRole = role;
    if (Object.keys(patch).length === 0) {
      setSaving(false);
      onClose();
      return;
    }
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not save changes");
      return;
    }
    toast("Member updated");
    router.refresh();
    onClose();
  }

  async function resetPassword() {
    if (!confirm(`Reset password for ${user.email}? You'll get a temporary password to share.`)) return;
    const res = await fetch(`/api/users/${user.id}/reset-password`, { method: "POST" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast(body.error ?? "Could not reset password");
      return;
    }
    const body = (await res.json()) as { tempPassword: string };
    onClose();
    onResetPassword(user.email, body.tempPassword);
  }

  async function remove() {
    if (!confirm(`Remove ${user.email} from this workspace?`)) return;
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast(body.error ?? "Could not remove member");
      return;
    }
    toast(`Removed ${user.email}`);
    router.refresh();
    onClose();
  }

  // Any admin can edit non-owners; only an owner can change another owner's role.
  const canEditRole = me.workspaceRole === "owner" || (me.workspaceRole === "admin" && user.workspaceRole !== "owner");
  // Owners can promote anyone to owner — multiple owners are allowed.
  const canPromoteToOwner = me.workspaceRole === "owner";

  return (
    <>
      <div className="modal-backdrop open" onClick={onClose} />
      <div className="modal open" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="modal-title">Edit member</div>
            <div className="modal-sub">{user.email}</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            {Close}
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Display name</label>
            <input
              className="field-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Cooper"
              disabled={!canEditRole && !isSelf}
            />
          </div>
          <div className="field">
            <label>Role</label>
            <select
              className="field-input"
              value={role}
              onChange={(e) => setRole(e.target.value as WorkspaceRole)}
              disabled={!canEditRole}
            >
              {canPromoteToOwner ? <option value="owner">Super Admin — full control</option> : null}
              <option value="admin">Admin — manage people and teams</option>
              <option value="editor">Editor — create folders, upload, share</option>
              <option value="viewer">Viewer — read-only</option>
            </select>
            <div className="field-hint">
              Multiple Super Admins are allowed. The server prevents removing the last one.
            </div>
          </div>

          {(me.workspaceRole === "owner" || me.workspaceRole === "admin") && !isSelf && (
            <div className="field">
              <label>Danger zone</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn" onClick={resetPassword}>
                  Reset password
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ color: "var(--coral)", borderColor: "var(--coral-soft)" }}
                  onClick={remove}
                >
                  Remove from workspace
                </button>
              </div>
            </div>
          )}

          {error && <div className="login-error">{error}</div>}
        </div>
        <div className="modal-footer">
          <span className="left">&nbsp;</span>
          <div className="right">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
