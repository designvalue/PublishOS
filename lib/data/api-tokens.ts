import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiTokens, users } from "@/lib/db/schema";

/**
 * Per-user API tokens for programmatic workspace access from AI tools,
 * scripts, and CI pipelines.
 *
 * Issued token format: `pos_<32 base64url chars>` (~44 chars total).
 *
 * Storage model:
 *  - The plaintext token is returned ONCE from `createApiToken()` and
 *    immediately forgotten by the server. Only sha256(token) is persisted.
 *  - A 12-char `prefix` (the visible start of the plaintext) is kept so
 *    users can recognise their tokens in a list ("pos_xK8n…" + name).
 *  - Revoke is soft (sets `revokedAt`) so audit logs still resolve old
 *    token ids; rows can be pruned later.
 */

const TOKEN_BYTES = 32;
const TOKEN_PREFIX_VISIBLE_CHARS = 12;

export type ApiTokenRow = typeof apiTokens.$inferSelect;

export type IssuedApiToken = {
  /** Plaintext token — show once, never re-issue. */
  token: string;
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
};

export type ApiTokenListEntry = {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  lastUsedIp: string | null;
  revokedAt: Date | null;
};

function hashToken(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

function generateToken(): { plain: string; prefix: string } {
  const raw = randomBytes(TOKEN_BYTES).toString("base64url");
  const plain = `pos_${raw}`;
  const prefix = plain.slice(0, TOKEN_PREFIX_VISIBLE_CHARS);
  return { plain, prefix };
}

/** Issue a new token for `userId`. Returns plaintext exactly once. */
export async function createApiToken(
  userId: string,
  name: string,
): Promise<IssuedApiToken> {
  const trimmed = name.trim() || "Untitled token";
  const { plain, prefix } = generateToken();
  const tokenHash = hashToken(plain);

  const [row] = await db
    .insert(apiTokens)
    .values({
      userId,
      name: trimmed,
      tokenHash,
      prefix,
    })
    .returning();

  return {
    token: plain,
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    createdAt: row.createdAt,
  };
}

/** Resolve a plaintext token to a valid (non-revoked) row + user. */
export type ResolvedApiToken = {
  tokenId: string;
  userId: string;
  userEmail: string;
  userName: string | null;
};

export async function findValidApiToken(plain: string): Promise<ResolvedApiToken | null> {
  if (!plain || !plain.startsWith("pos_")) return null;
  const tokenHash = hashToken(plain);

  const [row] = await db
    .select({
      tokenId: apiTokens.id,
      userId: apiTokens.userId,
      revokedAt: apiTokens.revokedAt,
      userEmail: users.email,
      userName: users.name,
    })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .where(eq(apiTokens.tokenHash, tokenHash))
    .limit(1);

  if (!row) return null;
  if (row.revokedAt) return null;

  return {
    tokenId: row.tokenId,
    userId: row.userId,
    userEmail: row.userEmail,
    userName: row.userName,
  };
}

/** Best-effort update of last-used timestamp + caller IP after auth. */
export async function touchApiToken(tokenId: string, ip: string | null): Promise<void> {
  try {
    await db
      .update(apiTokens)
      .set({ lastUsedAt: new Date(), lastUsedIp: ip ?? null })
      .where(eq(apiTokens.id, tokenId));
  } catch (err) {
    console.warn("[api-tokens] touch failed", err);
  }
}

/** All tokens belonging to `userId`, newest first. Plaintext NOT returned. */
export async function listApiTokens(userId: string): Promise<ApiTokenListEntry[]> {
  return db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      prefix: apiTokens.prefix,
      createdAt: apiTokens.createdAt,
      lastUsedAt: apiTokens.lastUsedAt,
      lastUsedIp: apiTokens.lastUsedIp,
      revokedAt: apiTokens.revokedAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(desc(apiTokens.createdAt));
}

/** Soft-revoke. Returns true if the row belonged to `userId`. */
export async function revokeApiToken(id: string, userId: string): Promise<boolean> {
  const res = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
    .returning({ id: apiTokens.id });
  return res.length > 0;
}
