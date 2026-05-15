"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import BrandWordmark from "@/components/shell/BrandWordmark";
import {
  DEMO_LOGIN_EMAIL,
  DEMO_LOGIN_PASSWORD,
  isDemoLoginDeployment,
} from "@/lib/demo-login";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="login-view" />}>
      <LoginForm />
    </Suspense>
  );
}

function DemoLoginHint({ onFill }: { onFill: () => void }) {
  return (
    <p className="login-demo-hint">
      <button type="button" className="login-demo-link" onClick={onFill}>
        Sign in with demo account
      </button>
    </p>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDemoNote, setShowDemoNote] = useState(false);

  useEffect(() => {
    setShowDemoNote(isDemoLoginDeployment(window.location.hostname));
  }, []);

  const googleEnabled = !!process.env.NEXT_PUBLIC_GOOGLE_ENABLED;

  function fillDemoCredentials() {
    setEmail(DEMO_LOGIN_EMAIL);
    setPassword(DEMO_LOGIN_PASSWORD);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <main className="login-view">
      <div className="login-card">
        <div className="login-mark">
          <BrandWordmark size="lg" />
        </div>
        <p className="login-tagline">Your folders, files, and sites — on the web in seconds.</p>

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
            />
          </label>
          <label>
            <span>Password</span>
            <div className="login-pw-wrap">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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
          <div className="login-row">
            <span className="check">
              <input type="checkbox" defaultChecked /> Keep me signed in
            </span>
            <Link href="/forgot-password" className="login-row-link">
              Forgot password?
            </Link>
          </div>
          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? "Signing in…" : "Sign in to PublishOS"}
          </button>
          {showDemoNote && <DemoLoginHint onFill={fillDemoCredentials} />}
        </form>

        {googleEnabled && (
          <>
            <div className="login-divider">
              <span>or</span>
            </div>
            <button
              className="btn login-social"
              type="button"
              onClick={() => signIn("google", { callbackUrl })}
            >
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                <path d="M16.5 9.2c0-.6 0-1.1-.1-1.6H9v3h4.2c-.2 1-.7 1.8-1.5 2.4v2h2.4c1.4-1.3 2.2-3.2 2.2-5.4z" fill="#4285F4" />
                <path d="M9 17c2 0 3.7-.7 5-1.8l-2.4-2c-.7.5-1.5.8-2.6.8-2 0-3.7-1.4-4.3-3.2H2.2v2.1C3.5 15.5 6 17 9 17z" fill="#34A853" />
                <path d="M4.7 10.8c-.2-.5-.3-1-.3-1.6s.1-1.1.3-1.6V5.5H2.2C1.6 6.6 1.3 7.8 1.3 9.2s.3 2.6.9 3.7l2.5-2.1z" fill="#FBBC05" />
                <path d="M9 4c1.1 0 2.1.4 2.9 1.1L14 3c-1.3-1.2-3-2-5-2C6 1 3.5 2.5 2.2 4.5l2.5 2.1C5.3 4.8 7 4 9 4z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>
          </>
        )}

        <div className="login-foot">
          <span>New here?</span>
          <Link href="/register">Create a workspace</Link>
          <span>·</span>
          <a>Privacy</a>
        </div>
      </div>
    </main>
  );
}
