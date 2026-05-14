"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "@/stores/toast-store";

type StorageBackend = "local" | "s3";

export type StorageSnapshot = {
  storageBackend: StorageBackend;
  storageRoot: string;
  s3Bucket?: string | null;
  s3Region?: string | null;
  s3Endpoint?: string | null;
  s3AccessKeyId?: string | null;
  s3PublicUrl?: string | null;
  hasS3Secret: boolean;
};

export type EmailSnapshot = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  hasPassword: boolean;
  fromName: string;
  fromEmail: string;
};

export type SignupSnapshot = {
  restricted: boolean;
  allowedDomains: string[];
};

export type StorageUsageRow = {
  userId: string;
  name: string | null;
  email: string;
  bytes: number;
  files: number;
};
export type StorageUsageSnapshot = {
  total: { bytes: number; files: number; users: number };
  byUser: StorageUsageRow[];
};

type SectionId = "general" | "signup" | "api" | "storage" | "usage" | "email" | "logs";

const SECTIONS: { id: SectionId; label: string; desc: string }[] = [
  { id: "general", label: "Workspace defaults", desc: "Visibility, downloads, indexing." },
  { id: "signup", label: "Sign-up access", desc: "Who is allowed to self-register." },
  { id: "api", label: "API access", desc: "Programmatic publishing from AI tools and scripts." },
  { id: "storage", label: "Storage", desc: "Where uploaded files live." },
  { id: "usage", label: "Storage usage", desc: "Total bytes used and per-contributor breakdown." },
  { id: "email", label: "Email & notifications", desc: "Outbound SMTP for invites and alerts." },
  { id: "logs", label: "Access logs", desc: "Workspace activity audit trail." },
];

export default function SettingsClient({
  initial,
  email,
  signup,
  usage,
  apiAccess,
  deployedOnVercel = false,
}: {
  initial: StorageSnapshot;
  email: EmailSnapshot;
  signup: SignupSnapshot;
  usage: StorageUsageSnapshot;
  apiAccess: { enabled: boolean };
  deployedOnVercel?: boolean;
}) {
  const [active, setActive] = useState<SectionId>("general");

  return (
    <main className="page settings-page">
      <div className="settings-head">
        <p className="eyebrow">Workspace</p>
        <h1 className="settings-title">
          <span className="it">Settings</span>
        </h1>
        <p className="settings-sub">
          Workspace-wide configuration — folder defaults, where files live, outbound email, and the activity audit log.
          Personal preferences live on your <Link href="/profile" className="settings-sub-link">profile page</Link>.
        </p>
      </div>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`settings-nav-item${active === s.id ? " is-active" : ""}`}
              onClick={() => setActive(s.id)}
              aria-current={active === s.id ? "page" : undefined}
            >
              <span className="settings-nav-label">{s.label}</span>
              <span className="settings-nav-desc">{s.desc}</span>
            </button>
          ))}
        </nav>

        <section className="settings-content">
          {active === "general" && <GeneralSection />}
          {active === "signup" && <SignupSection initial={signup} />}
          {active === "api" && <ApiAccessSection initial={apiAccess} />}
          {active === "storage" && <StorageSection initial={initial} deployedOnVercel={deployedOnVercel} />}
          {active === "usage" && <UsageSection usage={usage} />}
          {active === "email" && <EmailSection initial={email} />}
          {active === "logs" && <LogsSection />}
        </section>
      </div>
    </main>
  );
}

/* ============================================================
   General / Workspace defaults
   ============================================================ */
function GeneralSection() {
  const [t, setT] = useState({ privateDefault: true, allowDownloads: true, indexable: false });
  function flip<K extends keyof typeof t>(k: K) {
    setT((s) => ({ ...s, [k]: !s[k] }));
  }
  return (
    <SectionCard
      title="Workspace defaults"
      sub="Applied when new folders are created. You can override per-folder later."
    >
      <ToggleRow
        title="New folders are private"
        desc="Visibility starts at private until you change it."
        checked={t.privateDefault}
        onChange={() => flip("privateDefault")}
      />
      <ToggleRow
        title="Allow downloads on published files"
        desc="Visitors can save files to their device."
        checked={t.allowDownloads}
        onChange={() => flip("allowDownloads")}
      />
      <ToggleRow
        title="Index public sites in search engines"
        desc="Let Google and others discover URLs."
        checked={t.indexable}
        onChange={() => flip("indexable")}
      />
      <div className="set-actions">
        <button className="btn btn-primary" onClick={() => toast("Workspace defaults saved.")}>
          Save defaults
        </button>
      </div>
    </SectionCard>
  );
}

/* ============================================================
   Access logs (link out)
   ============================================================ */
function LogsSection() {
  return (
    <SectionCard
      title="Access logs"
      sub="Every API call and every public-folder visit is recorded with status, IP, user agent, and timing."
    >
      <div className="set-row">
        <div className="set-row-text">
          <div className="set-title">Open the workspace activity log</div>
          <div className="set-desc">
            Search and filter by user, folder, file, status, or date range. Logs are
            kept for <strong>90 days</strong> and prune automatically.
          </div>
        </div>
        <Link href="/logs" className="btn btn-primary">Open logs →</Link>
      </div>
      <div className="set-row">
        <div className="set-row-text">
          <div className="set-title">Privacy &amp; retention</div>
          <div className="set-desc">
            Visit logs are stored locally with the workspace. They are <strong>not</strong> shared with third parties.
            Owner / Admin / Super Admin can read; Editors and Viewers cannot.
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

/* ============================================================
   Storage (real, with /api/settings/storage)
   ============================================================ */
function StorageSection({
  initial,
  deployedOnVercel,
}: {
  initial: StorageSnapshot;
  deployedOnVercel: boolean;
}) {
  const [backend, setBackend] = useState<StorageBackend>(initial.storageBackend);
  const [storageRoot, setStorageRoot] = useState(initial.storageRoot);
  const [s3Bucket, setS3Bucket] = useState(initial.s3Bucket ?? "");
  const [s3Region, setS3Region] = useState(initial.s3Region ?? "");
  const [s3Endpoint, setS3Endpoint] = useState(initial.s3Endpoint ?? "");
  const [s3AccessKeyId, setS3AccessKeyId] = useState(initial.s3AccessKeyId ?? "");
  const [s3SecretAccessKey, setS3SecretAccessKey] = useState("");
  const [s3PublicUrl, setS3PublicUrl] = useState(initial.s3PublicUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [hasSecret, setHasSecret] = useState(initial.hasS3Secret);

  async function save() {
    setSaving(true);
    let body: unknown;
    if (backend === "local") {
      body = { backend, storageRoot: storageRoot.trim() || "storage" };
    } else {
      if (!s3SecretAccessKey && !hasSecret) {
        toast("Secret access key is required to enable S3.");
        setSaving(false);
        return;
      }
      if (s3SecretAccessKey === "" && hasSecret) {
        toast("Re-enter the secret access key to re-save.");
        setSaving(false);
        return;
      }
      body = {
        backend,
        s3: {
          bucket: s3Bucket.trim(),
          region: s3Region.trim(),
          endpoint: s3Endpoint.trim(),
          accessKeyId: s3AccessKeyId.trim(),
          secretAccessKey: s3SecretAccessKey || undefined,
          publicUrl: s3PublicUrl.trim() || null,
        },
      };
    }

    const res = await fetch("/api/settings/storage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast(err.error ?? "Could not save storage settings.");
      return;
    }
    const next = (await res.json()) as { hasS3Secret: boolean };
    setHasSecret(next.hasS3Secret);
    setS3SecretAccessKey("");
    toast(backend === "local" ? "Storage set to local filesystem." : "Storage set to S3-compatible bucket.");
  }

  return (
    <SectionCard
      title="Storage"
      sub="Choose where uploaded files live. Local keeps everything on this machine; S3-compatible is the production setup."
    >
      {deployedOnVercel && (
        <div className="settings-field-warn" style={{ marginBottom: 16 }}>
          This app is running on <strong>Vercel</strong>. Local filesystem storage is not durable — files can disappear
          between deploys or requests, and <strong>public /c/… links will often show “content unavailable”</strong>. Use{" "}
          <strong>S3 / R2</strong>, set a <strong>Public URL</strong> for your bucket, then re-upload files.
        </div>
      )}
      {/* Backend picker */}
      <div className="storage-pickers">
        <button
          type="button"
          className={`storage-pick${backend === "local" ? " is-active" : ""}`}
          onClick={() => setBackend("local")}
        >
          <span className="storage-pick-name">Local filesystem</span>
          <span className="storage-pick-desc">
            Files live on the same disk as this app under <code>./{storageRoot || "storage"}</code>.
            {deployedOnVercel ? " Not suitable for production on Vercel." : ""}
          </span>
        </button>
        <button
          type="button"
          className={`storage-pick${backend === "s3" ? " is-active" : ""}`}
          onClick={() => setBackend("s3")}
        >
          <span className="storage-pick-name">S3 / R2 bucket</span>
          <span className="storage-pick-desc">
            AWS S3, Cloudflare R2, MinIO, or any S3-compatible store. Required for production.
          </span>
        </button>
      </div>

      {backend === "local" ? (
        <div className="settings-field-block">
          <label className="settings-field">
            <span className="settings-field-label">Storage folder</span>
            <span className="settings-field-hint">
              Path relative to the project root. Files live at <code>./{storageRoot || "storage"}/&lt;userId&gt;/&lt;folderId&gt;/…</code>.
            </span>
            <input
              type="text"
              className="settings-input"
              value={storageRoot}
              onChange={(e) => setStorageRoot(e.target.value)}
              placeholder="storage"
              spellCheck={false}
            />
          </label>
        </div>
      ) : (
        <div className="settings-field-grid">
          <SettingsField
            label="Bucket"
            value={s3Bucket}
            onChange={setS3Bucket}
            placeholder="publishos"
            required
          />
          <SettingsField
            label="Region"
            value={s3Region}
            onChange={setS3Region}
            placeholder="auto"
          />
          <SettingsField
            label="Endpoint"
            value={s3Endpoint}
            onChange={setS3Endpoint}
            placeholder="https://<account>.r2.cloudflarestorage.com"
            required
            wide
          />
          <SettingsField
            label={deployedOnVercel ? "Public URL (recommended on Vercel)" : "Public URL (optional)"}
            value={s3PublicUrl}
            onChange={setS3PublicUrl}
            placeholder="https://files.example.com"
            hint={
              deployedOnVercel
                ? "Use your R2 public dev URL or CDN origin (no trailing slash) so public /c/… links can load from the bucket when this server has no local copy."
                : "Where visitors fetch files. Leave blank to serve only through this app (single long-lived server)."
            }
            wide
          />
          <SettingsField
            label="Access Key ID"
            value={s3AccessKeyId}
            onChange={setS3AccessKeyId}
            placeholder="AKIA…"
            required
          />
          <SettingsField
            label={hasSecret ? "Secret Access Key (re-enter to update)" : "Secret Access Key"}
            value={s3SecretAccessKey}
            onChange={setS3SecretAccessKey}
            placeholder={hasSecret ? "•••••••• (stored)" : "••••••••"}
            type="password"
            required={!hasSecret}
          />
        </div>
      )}

      <div className="set-actions">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : backend === "local" ? "Save" : "Save & switch to S3"}
        </button>
      </div>
    </SectionCard>
  );
}

/* ============================================================
   Sign-up access (real, with /api/settings/signup)
   ============================================================ */
function SignupSection({ initial }: { initial: SignupSnapshot }) {
  const [restricted, setRestricted] = useState(initial.restricted);
  const [domains, setDomains] = useState<string[]>(initial.allowedDomains);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  function addDraft() {
    const tokens = draft
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase().replace(/^@/, "").replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
      .filter(Boolean);
    if (tokens.length === 0) return;

    const next = new Set(domains);
    let firstInvalid: string | null = null;
    for (const t of tokens) {
      if (!isDomainShape(t)) {
        firstInvalid ??= t;
        continue;
      }
      next.add(t);
    }
    setDomains(Array.from(next).sort());
    setDraft("");
    if (firstInvalid) toast(`"${firstInvalid}" doesn't look like a domain. Try "example.com".`);
  }

  function removeDomain(d: string) {
    setDomains((cur) => cur.filter((x) => x !== d));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === " " || e.key === "Tab") {
      if (draft.trim()) {
        e.preventDefault();
        addDraft();
      }
    } else if (e.key === "Backspace" && draft === "" && domains.length > 0) {
      // Quick remove of the last chip.
      setDomains((cur) => cur.slice(0, -1));
    }
  }

  async function save() {
    if (restricted && domains.length === 0) {
      toast("Add at least one allowed domain before turning the restriction on.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/settings/signup", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restricted, allowedDomains: domains }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast(err.error ?? "Could not save sign-up settings.");
      return;
    }
    const next = (await res.json()) as { signup: SignupSnapshot };
    setRestricted(next.signup.restricted);
    setDomains(next.signup.allowedDomains);
    toast(
      next.signup.restricted
        ? "Sign-up is now limited to the listed domains."
        : "Sign-up domain restriction is off.",
    );
  }

  return (
    <SectionCard
      title="Sign-up access"
      sub="Restrict who can create an account by limiting the email domains allowed on the registration page."
    >
      <ToggleRow
        title="Restrict self-signup to specific domains"
        desc="When off, anyone with a valid email can register. When on, only the domains listed below may self-register at /register."
        checked={restricted}
        onChange={() => setRestricted((v) => !v)}
      />

      {restricted && (
        <div className="signup-scope" role="note">
          <div className="signup-scope-head">
            <span className="signup-scope-ico" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 5.2v3.4M8 10.6v.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
            <span>This rule only affects new self-signups. The following are never restricted:</span>
          </div>
          <ul className="signup-scope-list">
            <li>
              <strong>Existing accounts can still sign in.</strong>{" "}
              Users created before the policy — or under a different policy — keep working regardless of their domain.
            </li>
            <li>
              <strong>Admin invitations bypass the rule.</strong>{" "}
              A Super Admin can invite anyone from the{" "}
              <Link href="/people" className="signup-scope-link">People page</Link>{" "}
              — the invitation is the admin&apos;s explicit override.
            </li>
            <li>
              <strong>Only the public <code>/register</code> page is gated.</strong>{" "}
              Password resets, profile changes, and every other account action are unaffected.
            </li>
          </ul>
        </div>
      )}

      <div className="settings-field-block">
        <div className={`settings-field is-wide${restricted ? "" : " is-disabled"}`}>
          <div className="settings-field-label-row">
            <span className="settings-field-label">
              Allowed domains
              {restricted ? <span className="settings-field-req" aria-label="required"> *</span> : null}
            </span>
            {domains.length > 0 && (
              <span className="settings-field-count">
                {domains.length} domain{domains.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <span className="settings-field-hint">
            Type a domain and press <kbd className="kbd-inline">Enter</kbd>,{" "}
            <kbd className="kbd-inline">Tab</kbd>, or <kbd className="kbd-inline">,</kbd>. Paste a comma-separated
            list to add many at once. Use the bare hostname (e.g. <code>acme.corp</code>), not the URL.
          </span>

          <div
            className={`domain-input${restricted ? "" : " is-muted"}${draft ? " has-draft" : ""}`}
            onClick={(e) => {
              // Forward stray clicks on the container to the embedded input.
              if (e.target === e.currentTarget) {
                const el = e.currentTarget.querySelector<HTMLInputElement>(".domain-input-field");
                el?.focus();
              }
            }}
          >
            <span className="domain-input-lead" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
                <path d="M2 8h12M8 2c2 2.4 2 9.6 0 12M8 2C6 4.4 6 11.6 8 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </span>

            <div className="domain-input-chips">
              {domains.map((d) => (
                <span key={d} className="domain-chip" title={d}>
                  <span className="domain-chip-at" aria-hidden="true">@</span>
                  <span className="domain-chip-label">{d}</span>
                  <button
                    type="button"
                    className="domain-chip-x"
                    onClick={() => removeDomain(d)}
                    aria-label={`Remove ${d}`}
                    title={`Remove ${d}`}
                  >
                    <svg viewBox="0 0 12 12" fill="none" width="10" height="10">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  </button>
                </span>
              ))}
              <input
                type="text"
                className="domain-input-field"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                onBlur={() => draft.trim() && addDraft()}
                placeholder={domains.length === 0 ? "example.com" : "Add another domain…"}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                disabled={!restricted}
              />
            </div>

            {draft.trim() && (
              <button
                type="button"
                className="domain-input-add"
                onClick={addDraft}
                title="Add domain"
                aria-label="Add domain"
              >
                <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>

          {restricted && domains.length === 0 && (
            <span className="settings-field-warn">
              You haven&apos;t listed any domains yet. With the restriction on and no domains, every self-signup will be rejected.
            </span>
          )}
        </div>
      </div>

      <div className="set-actions">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save sign-up access"}
        </button>
      </div>
    </SectionCard>
  );
}

const DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
function isDomainShape(d: string): boolean {
  return d.length > 0 && d.length <= 253 && DOMAIN_RE.test(d);
}

/* ============================================================
   API access — workspace-wide kill switch for /api/v1/* and the
   profile-level "API access" card. When OFF, no user can mint or
   use a token, and all ingestion endpoints return 503.
   ============================================================ */
function ApiAccessSection({ initial }: { initial: { enabled: boolean } }) {
  const [enabled, setEnabled] = useState(initial.enabled);

  async function save(next: boolean) {
    const prev = enabled;
    setEnabled(next); // optimistic
    const res = await fetch("/api/settings/api-access", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    if (!res.ok) {
      setEnabled(prev);
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast(body.error ?? "Could not update API access");
      return;
    }
    toast(
      next
        ? "API access enabled — anyone with a token can publish."
        : "API access disabled — all v1 endpoints now return 503.",
    );
  }

  return (
    <SectionCard
      title="API access"
      sub="Workspace-wide control for programmatic publishing. When on, every user can mint a personal API token from their profile and push HTML sites into PublishOS via POST /api/v1/sites — perfect for AI tools, agentic workflows, and CI pipelines."
    >
      <ToggleRow
        title="Allow programmatic API access"
        desc="When off, /api/v1/* returns 503 and the API access section is hidden from every profile page. Existing tokens are not revoked — flip back on to restore them as-is."
        checked={enabled}
        onChange={() => save(!enabled)}
      />

      {enabled ? (
        <div className="set-row" style={{ borderTop: "1px dashed var(--hair)", marginTop: 4 }}>
          <div className="set-row-text">
            <div className="set-title">How it works</div>
            <div className="set-desc">
              Each user opens their <code>/profile</code> page, generates a token in the
              <strong> API access</strong> card, and copies the <code>pos_…</code> value into
              their tool of choice. The token authenticates as that user, so workspace roles
              and per-folder grants still apply on every push.
            </div>
          </div>
        </div>
      ) : (
        <div className="settings-field-warn" style={{ marginTop: 12 }}>
          API access is currently OFF. New tokens can&apos;t be minted, and any existing token
          held by an AI tool or script will get a 503 on its next call. Flip the toggle back
          on whenever you&apos;re ready — no tokens are deleted.
        </div>
      )}
    </SectionCard>
  );
}

/* ============================================================
   Email & notifications (real, with /api/settings/email)
   ============================================================ */
function EmailSection({ initial }: { initial: EmailSnapshot }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [host, setHost] = useState(initial.host);
  const [port, setPort] = useState<number>(initial.port);
  const [secure, setSecure] = useState(initial.secure);
  const [username, setUsername] = useState(initial.username);
  const [password, setPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(initial.hasPassword);
  const [fromName, setFromName] = useState(initial.fromName);
  const [fromEmail, setFromEmail] = useState(initial.fromEmail);

  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [showTest, setShowTest] = useState(false);

  async function save() {
    if (enabled) {
      if (!host.trim()) {
        toast("SMTP host is required.");
        return;
      }
      if (!fromEmail.trim()) {
        toast("From email is required.");
        return;
      }
    }

    setSaving(true);
    const body = {
      enabled,
      host: host.trim(),
      port: Number(port) || 587,
      secure,
      username: username.trim() || null,
      // omit when blank → server keeps existing secret
      ...(password ? { password } : {}),
      fromName: fromName.trim() || null,
      fromEmail: fromEmail.trim(),
    };

    const res = await fetch("/api/settings/email", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast(err.error ?? "Could not save email settings.");
      return;
    }
    const next = (await res.json()) as { smtp: { hasPassword: boolean } };
    setHasPassword(next.smtp.hasPassword);
    setPassword("");
    toast("Email settings saved.");
  }

  async function verify() {
    setVerifying(true);
    const res = await fetch("/api/settings/email/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "verify" }),
    });
    setVerifying(false);
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) {
      toast(json.error ?? "SMTP handshake failed.");
      return;
    }
    toast("SMTP handshake succeeded.");
  }

  async function sendTest() {
    if (!testTo.trim()) {
      toast("Enter a recipient address.");
      return;
    }
    setSending(true);
    const res = await fetch("/api/settings/email/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "send", to: testTo.trim() }),
    });
    setSending(false);
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) {
      toast(json.error ?? "Could not send test email.");
      return;
    }
    toast(`Test email sent to ${testTo.trim()}.`);
    setShowTest(false);
    setTestTo("");
  }

  return (
    <SectionCard
      title="Email & notifications"
      sub="Configure the outbound SMTP server PublishOS uses for invites, share notifications, and password resets."
    >
      <ToggleRow
        title="Enable outbound email"
        desc="When off, the app skips sending mail without surfacing an error. Useful in development."
        checked={enabled}
        onChange={() => setEnabled((v) => !v)}
      />

      <div className="settings-field-grid">
        <SettingsField
          label="SMTP host"
          value={host}
          onChange={setHost}
          placeholder="smtp.example.com"
          required={enabled}
          wide
        />
        <SettingsField
          label="Port"
          value={String(port)}
          onChange={(v) => setPort(Number(v.replace(/\D/g, "")) || 0)}
          placeholder="587"
          required={enabled}
        />
        <label className="settings-field">
          <span className="settings-field-label">Encryption</span>
          <span className="settings-field-hint">
            TLS on connect for port 465; STARTTLS for 587/25.
          </span>
          <div className="set-row" style={{ padding: 0, border: 0 }}>
            <div className="set-row-text">
              <div className="set-title">Use TLS on connect</div>
              <div className="set-desc">
                {secure
                  ? "Direct TLS — typically port 465."
                  : "STARTTLS upgrade — typically port 587 / 25."}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={secure}
              className={`toggle${secure ? " on" : ""}`}
              onClick={() => setSecure((v) => !v)}
            />
          </div>
        </label>
        <SettingsField
          label="Username"
          value={username}
          onChange={setUsername}
          placeholder="apikey or user@example.com"
        />
        <SettingsField
          label={hasPassword ? "Password (leave blank to keep existing)" : "Password"}
          value={password}
          onChange={setPassword}
          placeholder={hasPassword ? "•••••••• (stored)" : "••••••••"}
          type="password"
          required={enabled && !hasPassword}
        />
        <SettingsField
          label="From name"
          value={fromName}
          onChange={setFromName}
          placeholder="PublishOS"
        />
        <SettingsField
          label="From email"
          value={fromEmail}
          onChange={setFromEmail}
          placeholder="no-reply@example.com"
          required={enabled}
          hint="Visible to recipients. Some providers require this address be a verified sender."
          wide
        />
      </div>

      <div className="set-actions" style={{ flexWrap: "wrap", gap: 8 }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save email settings"}
        </button>
        <button
          className="btn"
          onClick={verify}
          disabled={verifying || !enabled}
          title={enabled ? "Open an SMTP connection and run the NOOP handshake." : "Enable email first."}
        >
          {verifying ? "Verifying…" : "Verify connection"}
        </button>
        <button
          className="btn"
          onClick={() => setShowTest((v) => !v)}
          disabled={!enabled}
          title={enabled ? "Send a small test message." : "Enable email first."}
        >
          {showTest ? "Cancel test" : "Send test email…"}
        </button>
      </div>

      {showTest && (
        <div className="settings-field-block">
          <label className="settings-field is-wide">
            <span className="settings-field-label">
              Send test to
              <span className="settings-field-req" aria-label="required"> *</span>
            </span>
            <span className="settings-field-hint">
              We will send a one-line confirmation message to this address using the settings above.
              Save first if you have unsaved changes — the test uses the persisted config.
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="email"
                className="settings-input"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="you@example.com"
                spellCheck={false}
                autoComplete="off"
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={sendTest} disabled={sending}>
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </label>
        </div>
      )}
    </SectionCard>
  );
}

/* ============================================================
   Storage usage section — its own sidebar tab. Wraps the
   aggregate stats + per-user breakdown in a SectionCard.
   ============================================================ */
function UsageSection({ usage }: { usage: StorageUsageSnapshot }) {
  return (
    <SectionCard
      title="Storage usage"
      sub="Total bytes stored across the workspace and a breakdown by contributor. Archived files are excluded so the numbers match what people can still open."
    >
      <StorageUsageBlock usage={usage} />
    </SectionCard>
  );
}

/* ============================================================
   Storage usage block — aggregate + per-user breakdown.
   ============================================================ */

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  // Two sig figs below 10, one above, none for whole-unit B/KB.
  const formatted = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  return `${formatted} ${units[i]}`;
}

function initialsOf(name: string | null, email: string): string {
  const src = (name && name.trim()) || email;
  const parts = src.replace(/@.*$/, "").split(/[\s._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase() || "?";
}

function StorageUsageBlock({ usage }: { usage: StorageUsageSnapshot }) {
  const total = usage.total.bytes;
  if (total === 0) {
    return (
      <div className="usage-block is-empty">
        <div className="usage-empty-title">No files yet</div>
        <div className="usage-empty-desc">
          Once people start uploading, you&apos;ll see total storage used and a per-user breakdown here.
        </div>
      </div>
    );
  }
  return (
    <div className="usage-block">
      {/* Each headline metric gets its own tile. Keeps the eye moving across
          distinct numbers instead of squashing them into one inline row. */}
      <div className="usage-tiles">
        <div className="usage-tile">
          <span className="usage-tile-eyebrow">Storage used</span>
          <span className="usage-tile-value">{formatBytes(total)}</span>
          <span className="usage-tile-sub">
            across {usage.total.files.toLocaleString()} file{usage.total.files === 1 ? "" : "s"}
          </span>
        </div>
        <div className="usage-tile">
          <span className="usage-tile-eyebrow">Contributors</span>
          <span className="usage-tile-value">{usage.total.users.toLocaleString()}</span>
          <span className="usage-tile-sub">
            {usage.total.users === 1 ? "person" : "people"} with uploads
          </span>
        </div>
      </div>

      {usage.byUser.length > 0 && (
        <div className="usage-people">
          <div className="usage-people-head">
            <span>By contributor</span>
            <span>Share</span>
          </div>
          <ul className="usage-people-list">
            {usage.byUser.map((u, i) => {
              const pct = total > 0 ? (u.bytes / total) * 100 : 0;
              return (
                <li key={u.userId} className="usage-person">
                  <span className={`usage-person-avatar pal-${(i % 6) + 1}`} aria-hidden="true">
                    {initialsOf(u.name, u.email)}
                  </span>
                  <div className="usage-person-text">
                    <div className="usage-person-name">{u.name ?? u.email}</div>
                    <div className="usage-person-meta">
                      {formatBytes(u.bytes)} · {u.files.toLocaleString()} file{u.files === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="usage-person-bar" aria-hidden="true">
                    <div className={`usage-person-fill pal-${(i % 6) + 1}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="usage-person-pct">{pct < 1 && pct > 0 ? "<1" : pct.toFixed(0)}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Reusable bits
   ============================================================ */

function SectionCard({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-card">
      <header className="settings-card-head">
        <h2 className="settings-card-title">{title}</h2>
        {sub ? <p className="settings-card-sub">{sub}</p> : null}
      </header>
      <div className="settings-card-body">{children}</div>
    </div>
  );
}

function ToggleRow({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="set-row">
      <div className="set-row-text">
        <div className="set-title">{title}</div>
        <div className="set-desc">{desc}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`toggle${checked ? " on" : ""}`}
        onClick={onChange}
      />
    </div>
  );
}

function SettingsField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  hint,
  wide = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "password";
  required?: boolean;
  hint?: string;
  wide?: boolean;
}) {
  return (
    <label className={`settings-field${wide ? " is-wide" : ""}`}>
      <span className="settings-field-label">
        {label}
        {required ? <span className="settings-field-req" aria-label="required"> *</span> : null}
      </span>
      {hint ? <span className="settings-field-hint">{hint}</span> : null}
      <input
        type={type}
        className="settings-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
      />
    </label>
  );
}
