import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";

export type AppSettings = typeof appSettings.$inferSelect;
export type StorageBackend = "local" | "s3";

export type StorageSettingsInput = {
  backend: StorageBackend;
  storageRoot?: string;
  s3?: {
    bucket: string;
    region: string;
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    publicUrl?: string | null;
  };
};

export async function getAppSettings(): Promise<AppSettings> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  if (row) return row;
  const [created] = await db.insert(appSettings).values({ id: 1 }).returning();
  return created;
}

export async function updateStorageSettings(input: StorageSettingsInput): Promise<AppSettings> {
  const base = await getAppSettings();
  const next = {
    storageBackend: input.backend,
    storageRoot: input.storageRoot?.trim() || base.storageRoot || "storage",
    s3Bucket: input.s3?.bucket ?? null,
    s3Region: input.s3?.region ?? null,
    s3Endpoint: input.s3?.endpoint ?? null,
    s3AccessKeyId: input.s3?.accessKeyId ?? null,
    s3SecretAccessKey: input.s3?.secretAccessKey ?? null,
    s3PublicUrl: input.s3?.publicUrl ?? null,
    updatedAt: new Date(),
  };
  const [updated] = await db.update(appSettings).set(next).where(eq(appSettings.id, 1)).returning();
  return updated;
}

export type SmtpSettingsInput = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username?: string | null;
  /** If empty/undefined and a secret already exists, the existing secret is kept. */
  password?: string | null;
  fromName?: string | null;
  fromEmail: string;
};

/* ---------------- Sign-up domain allowlist ---------------- */

export type SignupSettingsInput = {
  /** When false, anyone with a valid email can sign up. */
  restricted: boolean;
  /** Lowercase domain hostnames — `example.com`, `acme.corp`. */
  allowedDomains: string[];
};

export type SignupSettingsSnapshot = {
  restricted: boolean;
  allowedDomains: string[];
};

/** Normalise + de-duplicate a list of domains. Strips `@`, scheme, paths, etc. */
export function normaliseDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "")
    .replace(/\s+/g, "");
}

const DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

/** True if `d` parses as a plausible DNS hostname (FQDN with at least one dot). */
export function isValidDomain(d: string): boolean {
  if (!d || d.length > 253) return false;
  return DOMAIN_RE.test(d);
}

/** Server-side snapshot for the settings page. */
export async function getSignupSettings(): Promise<SignupSettingsSnapshot> {
  const s = await getAppSettings();
  return {
    restricted: !!s.signupRestricted,
    allowedDomains: parseDomains(s.signupAllowedDomains),
  };
}

/* ---------------- API access kill-switch ---------------- */

export type ApiAccessSnapshot = { enabled: boolean };

/** Read the workspace-wide API access flag. Defaults to `true`. */
export async function getApiAccessEnabled(): Promise<boolean> {
  const s = await getAppSettings();
  return s.apiAccessEnabled !== false;
}

export async function updateApiAccessSetting(enabled: boolean): Promise<ApiAccessSnapshot> {
  const [updated] = await db
    .update(appSettings)
    .set({ apiAccessEnabled: !!enabled, updatedAt: new Date() })
    .where(eq(appSettings.id, 1))
    .returning();
  return { enabled: !!updated.apiAccessEnabled };
}

export async function updateSignupSettings(input: SignupSettingsInput): Promise<SignupSettingsSnapshot> {
  // Normalise + de-dupe + validate. Keep only well-formed hostnames.
  const cleaned = Array.from(
    new Set(input.allowedDomains.map(normaliseDomain).filter((d) => d && isValidDomain(d))),
  ).sort();

  const next = {
    signupRestricted: !!input.restricted,
    signupAllowedDomains: cleaned.length > 0 ? JSON.stringify(cleaned) : null,
    updatedAt: new Date(),
  };
  const [updated] = await db.update(appSettings).set(next).where(eq(appSettings.id, 1)).returning();
  return {
    restricted: !!updated.signupRestricted,
    allowedDomains: parseDomains(updated.signupAllowedDomains),
  };
}

/**
 * Check whether an email may self-register given the current allowlist.
 * Callers should bypass this for invitation-based signups — the invitation
 * itself is the admin's explicit override.
 *
 * Returns `{ ok: true }` if allowed, or `{ ok: false, reason }` otherwise.
 */
export async function isEmailAllowedForSignup(
  email: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const s = await getAppSettings();
  if (!s.signupRestricted) return { ok: true };
  const domains = parseDomains(s.signupAllowedDomains);
  if (domains.length === 0) {
    // Restricted with no domains configured = effectively closed.
    return {
      ok: false,
      reason: "Self-signup is currently disabled for this workspace. Ask an admin for an invitation.",
    };
  }
  const at = email.lastIndexOf("@");
  if (at < 0) return { ok: false, reason: "Invalid email." };
  const domain = email.slice(at + 1).toLowerCase();
  if (domains.includes(domain)) return { ok: true };
  return {
    ok: false,
    reason: `Sign-ups are limited to ${domains.length === 1 ? domains[0] : domains.join(", ")}. Ask an admin for an invitation if you need access.`,
  };
}

function parseDomains(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter((d): d is string => typeof d === "string");
  } catch {
    return [];
  }
}

export async function updateSmtpSettings(input: SmtpSettingsInput): Promise<AppSettings> {
  const base = await getAppSettings();
  // Treat blank password as "keep existing" so users don't have to retype
  // their secret every time they change a non-secret field.
  const nextPassword =
    input.password === undefined || input.password === ""
      ? base.smtpPassword
      : input.password;

  const next = {
    smtpEnabled: input.enabled,
    smtpHost: input.host.trim() || null,
    smtpPort: input.port,
    smtpSecure: input.secure,
    smtpUsername: input.username?.trim() || null,
    smtpPassword: nextPassword ?? null,
    smtpFromName: input.fromName?.trim() || null,
    smtpFromEmail: input.fromEmail.trim() || null,
    updatedAt: new Date(),
  };

  const [updated] = await db.update(appSettings).set(next).where(eq(appSettings.id, 1)).returning();
  return updated;
}
