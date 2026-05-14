"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/stores/toast-store";

export default function ChangePasswordForm({ mustChange }: { mustChange: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: mustChange ? undefined : currentPassword,
        newPassword,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not change password.");
      return;
    }
    toast("Password changed");
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 420 }}>
      {!mustChange && (
        <div className="field">
          <label>Current password</label>
          <input
            className="field-input"
            type={reveal ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
      )}
      <div className="field">
        <label>New password</label>
        <input
          className="field-input"
          type={reveal ? "text" : "password"}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>
      <div className="field">
        <label>Confirm new password</label>
        <input
          className="field-input"
          type={reveal ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-2)" }}>
        <input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} />
        Show passwords
      </label>

      {error && (
        <div className="login-error" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Saving…" : "Change password"}
        </button>
      </div>
    </form>
  );
}
