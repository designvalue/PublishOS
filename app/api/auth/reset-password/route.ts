import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeToken, findValidToken } from "@/lib/data/password-reset";
import { setPasswordHash } from "@/lib/data/users";
import { hashPassword } from "@/lib/password";
import { notify } from "@/lib/data/notifications";
import { withLogging } from "@/lib/logged-handler";

/**
 * GET  /api/auth/reset-password?token=…  → 200 if the token is valid + unused.
 * POST /api/auth/reset-password  { token, password } → updates the password.
 *
 * Both arms intentionally return generic errors on failure ("This reset link
 * is invalid or has expired"). We don't distinguish between unknown / expired
 * / already-used so a stolen token can't probe state.
 *
 * On success, the user's `mustChangePassword` flag is cleared and a
 * notification is emitted so the account-owner has a visible audit trail.
 */

const GetQuery = z.object({ token: z.string().min(10) });
const PostBody = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

async function _get(req: Request) {
  const url = new URL(req.url);
  const parsed = GetQuery.safeParse({ token: url.searchParams.get("token") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: GENERIC_INVALID }, { status: 400 });
  }
  const token = await findValidToken(parsed.data.token);
  if (!token) {
    return NextResponse.json({ ok: false, error: GENERIC_INVALID }, { status: 400 });
  }
  return NextResponse.json({ ok: true, email: token.email, name: token.name });
}

async function _post(req: Request) {
  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // For password-too-short, return the real message so the UI can show it.
    if (issue?.path?.[0] === "password") {
      return NextResponse.json({ ok: false, error: issue.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: GENERIC_INVALID }, { status: 400 });
  }

  const valid = await findValidToken(parsed.data.token);
  if (!valid) {
    return NextResponse.json({ ok: false, error: GENERIC_INVALID }, { status: 400 });
  }

  // Atomically consume the token before touching the password. If two
  // requests race, only one wins the consume; the other gets the generic
  // invalid response.
  const consumed = await consumeToken(valid.id);
  if (!consumed) {
    return NextResponse.json({ ok: false, error: GENERIC_INVALID }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await setPasswordHash(valid.userId, passwordHash, /* mustChange */ false);

  // In-app notification — visible audit trail of the reset.
  void notify({
    userId: valid.userId,
    kind: "success",
    event: "account.password.resetByUser",
    title: "Your password was changed",
    body: "If this wasn't you, contact a Super Admin right away.",
    link: "/profile",
    data: { via: "self-service-reset" },
  });

  return NextResponse.json({ ok: true });
}

const GENERIC_INVALID = "This reset link is invalid or has expired. Please request a new one.";

export const GET = withLogging(_get, { source: "api" });
export const POST = withLogging(_post, { source: "api" });
export const runtime = "nodejs";
