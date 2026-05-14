"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/stores/toast-store";
import { Close } from "@/lib/icons";
import type { UserListEntry } from "@/lib/data/users";

function initials(value: string | null | undefined): string {
  const s = (value ?? "").trim();
  if (!s) return "·";
  const parts = s.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (s.split("@")[0] ?? s).slice(0, 2).toUpperCase();
}

type TeamMember = { userId: string; name: string | null; email: string };

export default function EditTeamModal({
  teamId,
  initialName,
  initialDescription,
  isDefault,
  members,
  onClose,
}: {
  teamId: string;
  initialName: string;
  initialDescription: string | null;
  isDefault: boolean;
  members: UserListEntry[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [currentMembers, setCurrentMembers] = useState<TeamMember[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/teams/${teamId}`);
      if (!res.ok) {
        if (!cancelled) {
          setError("Could not load team");
          setLoading(false);
        }
        return;
      }
      const body = (await res.json()) as { team: { members: TeamMember[] } };
      if (!cancelled) {
        setCurrentMembers(body.team.members);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const memberSet = new Set((currentMembers ?? []).map((m) => m.userId));

  async function addMember(userId: string) {
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      toast("Could not add member");
      return;
    }
    const m = members.find((x) => x.id === userId);
    if (m) {
      setCurrentMembers((prev) => [...(prev ?? []), { userId, name: m.name, email: m.email }]);
    }
  }

  async function removeMember(userId: string) {
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      toast("Could not remove member");
      return;
    }
    setCurrentMembers((prev) => (prev ?? []).filter((m) => m.userId !== userId));
  }

  async function saveDetails() {
    setError(null);
    const patch: Record<string, unknown> = {};
    if (name.trim() !== initialName) patch.name = name.trim();
    if (description.trim() !== (initialDescription ?? "")) {
      patch.description = description.trim() || null;
    }
    if (Object.keys(patch).length === 0) {
      router.refresh();
      onClose();
      return;
    }
    const res = await fetch(`/api/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not save team");
      return;
    }
    toast("Team updated");
    router.refresh();
    onClose();
  }

  return (
    <>
      <div className="modal-backdrop open" onClick={onClose} />
      <div className="modal open" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="modal-title">Edit team</div>
            <div className="modal-sub">Rename, change description, add or remove members.</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            {Close}
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Team name</label>
            <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Description</label>
            <input
              className="field-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this team do?"
            />
          </div>
          <div className="field">
            <label>Members</label>
            {isDefault ? (
              <div className="field-hint">
                Everyone in the workspace is automatically a member of the Organisation team. Membership can&apos;t be edited
                here — it&apos;s kept in sync as people join or leave.
              </div>
            ) : null}
            {loading ? (
              <div className="field-hint">Loading…</div>
            ) : (
              <div className="member-picker">
                {members.length === 0 ? (
                  <div className="field-hint">No workspace members to add.</div>
                ) : (
                  members.map((m) => {
                    const isMember = memberSet.has(m.id);
                    return (
                      <label key={m.id} className="member-pick">
                        <input
                          type="checkbox"
                          checked={isMember}
                          onChange={() => (isMember ? removeMember(m.id) : addMember(m.id))}
                          disabled={isDefault}
                        />
                        <div className="av av-sm">{initials(m.name ?? m.email)}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name ?? m.email.split("@")[0]}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>{m.email}</div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>
          {error && <div className="login-error">{error}</div>}
        </div>
        <div className="modal-footer">
          <span className="left">{(currentMembers ?? []).length} member{(currentMembers ?? []).length === 1 ? "" : "s"}</span>
          <div className="right">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={saveDetails}>
              Save changes
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
