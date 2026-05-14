import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { passwordResetTokens, users } from "@/lib/db/schema";

/**
 * Self-service password reset tokens.
 *
 * Design:
 *  - The plaintext token is returned ONCE from `createResetToken()`. It is
 *    emailed to the user and never stored — only its sha256 hex digest is
 *    persisted in `token_hash`. A DB leak therefore can't be used to seize
 *    accounts.
 *  - Tokens expire 1 hour after creation and are single-use (`used_at` set
 *    on consumption).
 *  - Best-effort housekeeping: every redeem opportunistically prunes expired
 *    or already-consumed tokens older than 24h. Throttled to once per hour
 *    per process.
 */

const TOKEN_BYTES = 32;
const TTL_MS = 60 * 60 * 1000; // 1 hour
const PRUNE_THROTTLE_MS = 60 * 60 * 1000;
const PRUNE_OLDER_THAN_MS = 24 * 60 * 60 * 1000;

declare global {
  var __pwResetLastPrune: number | undefined;
}

export type ResetTokenIssued = {
  /** Plaintext token. Send via email; never log or persist. */
  token: string;
  /** Token row id; useful only for tracing/logging. */
  id: string;
  expiresAt: Date;
};

function hashToken(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

/**
 * Create a reset token for `userId`. Returns the plaintext token (to email
 * the user) plus the row metadata.
 *
 * Callers should invalidate any prior pending tokens for the same user by
 * calling `invalidatePendingForUser(userId)` first if they want only the
 * latest link to work.
 */
export async function createResetToken(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<ResetTokenIssued> {
  const plain = randomBytes(TOKEN_BYTES).toString("base64url");
  const tokenHash = hashToken(plain);
  const expiresAt = new Date(Date.now() + TTL_MS);

  const [row] = await db
    .insert(passwordResetTokens)
    .values({
      userId,
      tokenHash,
      expiresAt,
      requestedIp: meta.ip ?? null,
      requestedUserAgent: meta.userAgent ?? null,
    })
    .returning({ id: passwordResetTokens.id });

  return { token: plain, id: row.id, expiresAt };
}

/** Mark every pending token for a user as used. Called before issuing a new one. */
export async function invalidatePendingForUser(userId: string): Promise<number> {
  const now = new Date();
  const res = await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(passwordResetTokens.userId, userId),
        isNull(passwordResetTokens.usedAt),
      ),
    )
    .returning({ id: passwordResetTokens.id });
  return res.length;
}

export type ValidToken = {
  id: string;
  userId: string;
  email: string;
  name: string | null;
};

/**
 * Resolve a plaintext token to its row + user. Returns null if the token is
 * unknown, expired, or already used.
 */
export async function findValidToken(plain: string): Promise<ValidToken | null> {
  if (!plain) return null;
  const tokenHash = hashToken(plain);
  const now = new Date();
  const [row] = await db
    .select({
      id: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
      email: users.email,
      name: users.name,
    })
    .from(passwordResetTokens)
    .innerJoin(users, eq(users.id, passwordResetTokens.userId))
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Mark a token as used. Returns true if the row was still consumable. */
export async function consumeToken(id: string): Promise<boolean> {
  const res = await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResetTokens.id, id),
        isNull(passwordResetTokens.usedAt),
      ),
    )
    .returning({ id: passwordResetTokens.id });
  return res.length > 0;
}

/** Best-effort cleanup of stale tokens. Throttled to once per hour. */
export async function maybePruneResetTokens(): Promise<void> {
  const last = globalThis.__pwResetLastPrune ?? 0;
  if (Date.now() - last < PRUNE_THROTTLE_MS) return;
  globalThis.__pwResetLastPrune = Date.now();
  try {
    const cutoff = new Date(Date.now() - PRUNE_OLDER_THAN_MS);
    await db
      .delete(passwordResetTokens)
      .where(lt(passwordResetTokens.expiresAt, cutoff));
  } catch (err) {
    console.warn("[password-reset] prune failed", err);
  }
}
