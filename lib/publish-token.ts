import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.AUTH_SECRET || "dev-secret-do-not-use-in-prod";
const COOKIE_PREFIX = "pos_pub_";
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Cookie name used to remember that the visitor unlocked a folder. */
export function publishCookieName(folderId: string): string {
  return COOKIE_PREFIX + folderId;
}

/**
 * Returns a string of the form `<expMs>.<hmac>` that proves the bearer knew the
 * folder's current password hash. The HMAC is keyed by AUTH_SECRET and includes
 * the password hash so rotating the password invalidates all outstanding tokens.
 */
export function signPublishToken(folderId: string, passwordHash: string, ttlMs = TTL_MS): string {
  const exp = Date.now() + ttlMs;
  const payload = `${folderId}.${passwordHash}.${exp}`;
  const mac = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${exp}.${mac}`;
}

export function verifyPublishToken(folderId: string, passwordHash: string, token: string | undefined | null): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const exp = Number(token.slice(0, dot));
  const mac = token.slice(dot + 1);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = createHmac("sha256", SECRET).update(`${folderId}.${passwordHash}.${exp}`).digest("base64url");
  if (expected.length !== mac.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(mac));
  } catch {
    return false;
  }
}
