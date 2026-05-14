"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import BrandWordmark from "@/components/shell/BrandWordmark";

export default function InviteAcceptForm({
  token,
  email,
  role,
}: {
  token: string;
  email: string;
  role: "admin" | "editor" | "viewer";
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, inviteToken: token }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not accept the invitation.");
      setLoading(false);
      return;
    }

    const signInRes = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (signInRes?.error) {
      router.push("/login");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="login-view">
      <div className="login-card">
        <div className="login-mark">
          <BrandWordmark size="lg" />
        </div>
        <h1 className="login-title">Join PublishOS</h1>
        <p className="login-tagline">
          You&apos;ve been invited as a{role === "admin" ? "n" : ""}{" "}
          <strong style={{ color: "var(--text)" }}>{role}</strong>.
        </p>

        <form className="login-form" onSubmit={onSubmit}>
          <label>
            <span>Email</span>
            <input type="email" value={email} disabled />
          </label>
          <label>
            <span>Your name</span>
            <input
              type="text"
              placeholder="Jane Cooper"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </label>
          <label>
            <span>Choose a password</span>
            <input
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? "Joining…" : "Accept invitation"}
          </button>
        </form>

        <div className="login-foot">
          <span>Already have an account?</span>
          <Link href="/login">Sign in</Link>
        </div>
      </div>
    </main>
  );
}
