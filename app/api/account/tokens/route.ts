import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser } from "@/lib/auth-helpers";
import { createApiToken, listApiTokens } from "@/lib/data/api-tokens";
import { getApiAccessEnabled } from "@/lib/data/settings";
import { withLogging } from "@/lib/logged-handler";

/**
 * Per-user API token management. Session-authenticated — these endpoints
 * are called from the Profile UI, NOT by external API clients.
 *
 * GET  /api/account/tokens          → list current user's tokens (no plaintext)
 * POST /api/account/tokens { name } → mint a new token (plaintext returned ONCE)
 */

const NewBody = z.object({
  name: z.string().trim().min(1, "Give the token a name").max(80),
});

async function _get() {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tokens = await listApiTokens(me.id);
  return NextResponse.json({ tokens });
}

async function _post(req: Request) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Don't let users mint tokens that won't work — fail loud.
  if (!(await getApiAccessEnabled())) {
    return NextResponse.json(
      {
        error: "API access is disabled workspace-wide. Ask a Super Admin to enable it in Settings.",
      },
      { status: 503 },
    );
  }
  const parsed = NewBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const issued = await createApiToken(me.id, parsed.data.name);
  // The plaintext token is returned ONCE — the UI must surface it
  // immediately and warn the user that it won't be visible again.
  return NextResponse.json(
    {
      id: issued.id,
      name: issued.name,
      prefix: issued.prefix,
      token: issued.token,
      createdAt: issued.createdAt,
    },
    { status: 201 },
  );
}

export const GET = withLogging(_get);
export const POST = withLogging(_post);
