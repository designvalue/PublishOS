import "server-only";
import type { WorkspaceRole } from "@/lib/data/users";
import { getUserById } from "@/lib/data/users";
import { findValidApiToken, touchApiToken } from "@/lib/data/api-tokens";

/**
 * Authenticate an incoming HTTP request via a Bearer API token from the
 * `Authorization` header. Returns the resolved workspace user, or null
 * if the token is missing/malformed/revoked/unknown.
 *
 * Side effect: updates the token's `lastUsedAt` + `lastUsedIp` on success.
 *
 * Used by the public ingestion endpoints (`/api/v1/*`). Session-cookie
 * routes (`/api/files/...`, `/api/folders/...`, etc.) keep using
 * `requireSessionUser()` from `auth-helpers.ts`.
 */

export type ApiUser = {
  id: string;
  name: string | null;
  email: string;
  workspaceRole: WorkspaceRole;
  tokenId: string;
};

function clientIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

export async function requireApiUser(req: Request): Promise<ApiUser | null> {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!auth) return null;

  const m = /^Bearer\s+(\S+)\s*$/i.exec(auth);
  if (!m) return null;
  const token = m[1];

  const resolved = await findValidApiToken(token);
  if (!resolved) return null;

  const user = await getUserById(resolved.userId);
  if (!user) return null;

  // Fire-and-forget the usage stamp.
  void touchApiToken(resolved.tokenId, clientIp(req));

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    workspaceRole: user.workspaceRole,
    tokenId: resolved.tokenId,
  };
}
