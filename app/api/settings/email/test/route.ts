import { NextResponse } from "next/server";
import { z } from "zod";
import { isSuperAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { sendMail, verifySmtp } from "@/lib/mailer";
import { withLogging } from "@/lib/logged-handler";

/**
 * POST /api/settings/email/test
 *
 * Two modes:
 *  - { mode: "verify" }     → handshake only, no message sent
 *  - { mode: "send", to }   → send a small test message to `to`
 *
 * Super-Admin only.
 */
const Body = z.union([
  z.object({ mode: z.literal("verify") }),
  z.object({
    mode: z.literal("send"),
    to: z.string().trim().email("`to` must be a valid email"),
  }),
]);

async function _post(req: Request) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(me.workspaceRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  if (parsed.data.mode === "verify") {
    const r = await verifySmtp();
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 502 });
    return NextResponse.json({ ok: true });
  }

  const r = await sendMail({
    to: parsed.data.to,
    subject: "PublishOS — SMTP test",
    text: `If you're reading this, your PublishOS workspace is configured correctly.

Workspace user: ${me.name ?? me.email}
Time: ${new Date().toISOString()}`,
    html: `<p>If you're reading this, your <strong>PublishOS</strong> workspace is configured correctly.</p>
<p style="color:#6B6962;font-size:13px">
Sent by ${me.name ?? me.email} at ${new Date().toISOString()}.
</p>`,
  });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 502 });
  return NextResponse.json({ ok: true, messageId: r.messageId });
}

export const POST = withLogging(_post, { source: "private" });
export const runtime = "nodejs";
