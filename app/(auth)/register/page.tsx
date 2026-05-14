"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import BrandWordmark from "@/components/shell/BrandWordmark";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not create account.");
      setLoading(false);
      return;
    }

    const signInRes = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (signInRes?.error) {
      setError("Account created — please sign in.");
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
        <h1 className="login-title">Create your workspace</h1>
        <p className="login-tagline">A folder for everything you publish. Your sites go live in seconds.</p>

        <form className="login-form" onSubmit={onSubmit}>
          <label>
            <span>Your name</span>
            <input
              type="text"
              placeholder="Jane Cooper"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </label>
          <label>
            <span>Email</span>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            <span>Password</span>
            <div className="login-pw-wrap">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />
              <button
                type="button"
                className="login-pw-eye"
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
          </label>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? "Creating workspace…" : "Create workspace"}
          </button>
        </form>

        <div className="login-foot">
          <span>Already have a workspace?</span>
          <Link href="/login">Sign in</Link>
        </div>
      </div>
    </main>
  );
}
