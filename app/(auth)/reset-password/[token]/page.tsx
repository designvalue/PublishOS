"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import BrandWordmark from "@/components/shell/BrandWordmark";

type TokenState =
  | { phase: "loading" }
  | { phase: "valid"; email: string; name: string | null }
  | { phase: "invalid"; reason: string };

export default function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  // Next.js 16: params is a Promise; unwrap with React.use.
  const { token } = use(params);
  const router = useRouter();

  const [state, setState] = useState<TokenState>({ phase: "loading" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Validate the token up-front so we can render a tailored error if it's
  // expired before the user types anything.
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/auth/reset-password?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          email?: string;
          name?: string | null;
          error?: string;
        };
        if (aborted) return;
        if (res.ok && body.ok) {
          setState({ phase: "valid", email: body.email ?? "", name: body.name ?? null });
        } else {
          setState({
            phase: "invalid",
            reason: body.error ?? "This reset link is invalid or has expired.",
          });
        }
      } catch {
        if (aborted) return;
        setState({
          phase: "invalid",
          reason: "We couldn't verify this reset link. Check your connection and try again.",
        });
      }
    })();
    return () => {
      aborted = true;
    };
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (password !== confirm) {
      setSubmitError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setSubmitError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setSubmitError(body.error ?? "Could not reset password. Try requesting a new link.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 2500);
  }

  if (done) {
    return (
      <main className="login-view">
        <div className="login-card">
          <div className="login-mark">
            <BrandWordmark size="lg" />
          </div>
          <h1 className="login-title">Password updated</h1>
          <p className="login-tagline">
            Your password has been changed. Redirecting you to sign in…
          </p>
          <Link href="/login" className="btn btn-primary login-btn">
            Sign in now
          </Link>
        </div>
      </main>
    );
  }

  if (state.phase === "loading") {
    return (
      <main className="login-view">
        <div className="login-card">
          <div className="login-mark">
            <BrandWordmark size="lg" />
          </div>
          <p className="login-tagline">Verifying reset link…</p>
        </div>
      </main>
    );
  }

  if (state.phase === "invalid") {
    return (
      <main className="login-view">
        <div className="login-card">
          <div className="login-mark">
            <BrandWordmark size="lg" />
          </div>
          <h1 className="login-title">Link not valid</h1>
          <p className="login-tagline">{state.reason}</p>
          <div className="login-actions-stack">
            <Link href="/forgot-password" className="btn btn-primary login-btn">
              Request a new link
            </Link>
            <Link href="/login" className="btn">
              Back to sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="login-view">
      <div className="login-card">
        <div className="login-mark">
          <BrandWordmark size="lg" />
        </div>
        <h1 className="login-title">Choose a new password</h1>
        <p className="login-tagline">
          You&apos;re resetting the password for <strong>{state.email}</strong>.
        </p>

        <form className="login-form" onSubmit={onSubmit}>
          <label>
            <span>New password</span>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              autoFocus
            />
          </label>
          <label>
            <span>Confirm new password</span>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Type it again"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>
          <label className="login-row">
            <span className="check">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />{" "}
              Show passwords
            </span>
          </label>
          {submitError && <div className="login-error">{submitError}</div>}
          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={submitting || !password || !confirm}
          >
            {submitting ? "Updating…" : "Update password"}
          </button>
        </form>

        <div className="login-foot">
          <Link href="/login">Back to sign in</Link>
        </div>
      </div>
    </main>
  );
}
