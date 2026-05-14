"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/stores/toast-store";

/**
 * Per-user API access panel — drops into ProfileView when the viewer is
 * looking at their own profile. Issues, lists, and revokes API tokens
 * used by external clients (scripts, integrations, and automated agents) to
 * push content into the workspace via POST /api/v1/sites.
 */

type TokenRow = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string | number | Date;
  lastUsedAt: string | number | Date | null;
  lastUsedIp: string | null;
  revokedAt: string | number | Date | null;
};

type IssuedToken = {
  id: string;
  name: string;
  prefix: string;
  token: string;
  createdAt: string | number | Date;
};

function fmtRel(t: string | number | Date | null): string {
  if (!t) return "never";
  const d = t instanceof Date ? t : new Date(t);
  const ms = Date.now() - d.getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}

export default function ApiTokensCard() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [issued, setIssued] = useState<IssuedToken | null>(null);
  const [showDocs, setShowDocs] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/account/tokens", { cache: "no-store" });
      if (res.ok) {
        const body = (await res.json()) as { tokens: TokenRow[] };
        setTokens(body.tokens ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch tokens on mount. Canonical fetch-on-mount pattern that React 19's
  // set-state-in-effect rule flags overzealously — `load` performs the
  // setState inside an async callback, not synchronously in the effect body.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function createToken(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    const res = await fetch("/api/account/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setCreating(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast(body.error ?? "Could not create token");
      return;
    }
    const body = (await res.json()) as IssuedToken;
    setIssued(body);
    setName("");
    void load();
  }

  async function copy(value: string, label = "Copied") {
    try {
      await navigator.clipboard.writeText(value);
      toast(label);
    } catch {
      toast("Could not copy");
    }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/account/tokens/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Could not revoke");
      return;
    }
    toast("Token revoked");
    void load();
  }

  const activeTokens = tokens.filter((t) => !t.revokedAt);

  return (
    <section className="profile-card" id="api">
      <header className="profile-card-head">
        <h2>
          API access
          {activeTokens.length > 0 && (
            <span className="profile-card-count">{activeTokens.length}</span>
          )}
        </h2>
        <p>
          Tokens for AI tools, scripts, and CI to push content into this workspace via{" "}
          <code>POST /api/v1/sites</code>.
        </p>
      </header>

      <div className="profile-card-body">
        {/* Just-minted token reveal */}
        {issued && (
          <div className="api-issued">
            <div className="api-issued-head">
              <strong>New token: {issued.name}</strong>
              <span>Copy it now — we won&apos;t show it again.</span>
            </div>
            <div className="api-issued-row">
              <code className="api-issued-token">{issued.token}</code>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => copy(issued.token, "Token copied to clipboard")}
              >
                Copy
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setIssued(null)}
              >
                I&apos;ve saved it
              </button>
            </div>
          </div>
        )}

        {/* New-token form */}
        <form className="api-new" onSubmit={createToken}>
          <input
            type="text"
            className="api-new-input"
            placeholder="Name this token (e.g. CI deploy)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            spellCheck={false}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!name.trim() || creating}
          >
            {creating ? "Creating…" : "Generate token"}
          </button>
        </form>

        {/* Token list */}
        <div className="api-tokens">
          {loading ? (
            <div className="profile-empty">Loading tokens…</div>
          ) : tokens.length === 0 ? (
            <div className="profile-empty">
              No tokens yet. Generate one above to let external tools publish to this workspace.
            </div>
          ) : (
            <ul className="api-tokens-list">
              {tokens.map((t) => {
                const revoked = !!t.revokedAt;
                return (
                  <li key={t.id} className={`api-token-row${revoked ? " is-revoked" : ""}`}>
                    <div className="api-token-meta">
                      <div className="api-token-name">
                        {t.name}
                        {revoked && <span className="api-token-pill revoked">Revoked</span>}
                      </div>
                      <div className="api-token-sub">
                        <code>{t.prefix}…</code>
                        <span>· Created {fmtRel(t.createdAt)}</span>
                        <span>
                          · {t.lastUsedAt
                            ? `Last used ${fmtRel(t.lastUsedAt)}${t.lastUsedIp ? ` (${t.lastUsedIp})` : ""}`
                            : "Never used"}
                        </span>
                      </div>
                    </div>
                    {!revoked && (
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => revoke(t.id)}
                      >
                        Revoke
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Inline docs */}
        <div className="api-docs">
          <button
            type="button"
            className="api-docs-toggle"
            onClick={() => setShowDocs((v) => !v)}
            aria-expanded={showDocs}
          >
            {showDocs ? "Hide" : "Show"} integration guide
          </button>
          {showDocs && (
            <div className="api-docs-body">
              <p>
                Pass the token as a Bearer header. The endpoint accepts either a single
                HTML payload or a multi-file site.
              </p>
              <h4>Single HTML file</h4>
              <pre>
{`curl -X POST '${typeof window !== "undefined" ? window.location.origin : "https://your-workspace"}/api/v1/sites' \\
  -H 'Authorization: Bearer pos_…your token…' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "Annual review",
    "html": "<!doctype html><html>…</html>",
    "publish": "public",
    "slug": "annual-review"
  }'`}
              </pre>
              <h4>Multi-file site</h4>
              <pre>
{`{
  "name": "Press kit",
  "files": [
    { "path": "index.html", "content": "<!doctype html>…" },
    { "path": "styles.css", "content": "body { … }" },
    { "path": "hero.png",   "content": "<base64>", "encoding": "base64" }
  ],
  "publish": "password",
  "password": "preview-only-2026"
}`}
              </pre>
              <p className="api-docs-note">
                Response includes the new folder id, every created file, and (when
                published) the public URL. The token never appears in the response
                or logs — only sha256 of it lives in the DB.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
