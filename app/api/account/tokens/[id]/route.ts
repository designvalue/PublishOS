import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth-helpers";
import { revokeApiToken } from "@/lib/data/api-tokens";
import { withLogging } from "@/lib/logged-handler";

/**
 * DELETE /api/account/tokens/[id] — revoke a token belonging to the
 * current user. Soft-revoke (sets revokedAt). 404 if the token doesn't
 * belong to the caller — same shape so other users' token ids can't be
 * probed.
 */
async function _delete(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ok = await revokeApiToken(id, me.id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export const DELETE = withLogging(_delete);
