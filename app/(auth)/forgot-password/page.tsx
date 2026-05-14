"use client";

import Link from "next/link";
import { useState } from "react";
import BrandWordmark from "@/components/shell/BrandWordmark";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emailDelivery, setEmailDelivery] = useState<"sent" | "unavailable" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        emailDelivery?: "sent" | "unavailable";
      };
      // We always show the same generic success state regardless of whether
      // the email matched a real account — to avoid leaking which addresses
      // exist in this workspace.
      setSubmitted(true);
      setEmailDelivery(body.emailDelivery ?? null);
    } catch {
      // Network error — surface so the user can retry.
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className="login-view">
        <div className="login-card">
          <div className="login-mark">
            <BrandWordmark size="lg" />
          </div>
          <h1 className="login-title">Check your inbox</h1>
          <p className="login-tagline">
            If an account exists for <strong>{email}</strong>, we&apos;ve sent a single-use reset link.
            The link expires in 1 hour.
          </p>

          {emailDelivery === "unavailable" && (
            <div className="login-warn">
              <strong>Outbound email isn&apos;t configured for this workspace yet.</strong>{" "}
              We accepted your request, but no message could be delivered. Ask a Super Admin to
              configure SMTP in <code>/settings → Email &amp; notifications</code>.
            </div>
          )}

          <div className="login-actions-stack">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setSubmitted(false);
                setEmailDelivery(null);
              }}
            >
              Send another link
            </button>
            <Link href="/login" className="btn btn-primary login-btn">
              Back to sign in
            </Link>
          </div>

          <div className="login-foot">
            <span>Didn&apos;t get the email? Check spam, wait a minute, then try again.</span>
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
        <h1 className="login-title">Forgot password</h1>
        <p className="login-tagline">
          Enter your account email and we&apos;ll send you a one-time link to choose a new password.
        </p>

        <form className="login-form" onSubmit={onSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              autoFocus
            />
          </label>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="btn btn-primary login-btn" disabled={loading || !email}>
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <div className="login-foot">
          <span>Remembered it?</span>
          <Link href="/login">Back to sign in</Link>
        </div>
      </div>
    </main>
  );
}
