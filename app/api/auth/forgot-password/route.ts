import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  createResetToken,
  invalidatePendingForUser,
  maybePruneResetTokens,
} from "@/lib/data/password-reset";
import { getAppSettings } from "@/lib/data/settings";
import { sendMail } from "@/lib/mailer";
import { withLogging } from "@/lib/logged-handler";

/**
 * POST /api/auth/forgot-password  { email }
 *
 * Always returns 200 with the same generic body, regardless of whether the
 * email matches an account. This avoids leaking which addresses exist in the
 * workspace.
 *
 * If the email DOES match a user, we:
 *   1. Invalidate any previously issued pending tokens for that user.
 *   2. Mint a fresh token (1-hour TTL, sha256-hashed at rest).
 *   3. Send the reset link via SMTP. If SMTP is unconfigured, we still
 *      return 200 — but include `emailDelivery: "unavailable"` so the UI
 *      can soft-warn the user that outbound email isn't set up yet.
 *
 * If the email is plain malformed, we still return the same response —
 * never an error — to keep the response shape identical for enumeration.
 */

const Body = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

function clientInfo(req: Request) {
  const ua = req.headers.get("user-agent") ?? null;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  return { ua, ip };
}

async function _post(req: Request) {
  // Opportunistic cleanup of stale tokens — throttled to once per hour.
  void maybePruneResetTokens();

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    // Generic OK — same response shape as the success branch.
    return NextResponse.json({ ok: true, message: GENERIC_OK });
  }
  const { email } = parsed.data;
  const { ip, ua } = clientInfo(req);

  // Lookup the user. If they don't exist, we still 200 — no enumeration.
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return NextResponse.json({ ok: true, message: GENERIC_OK });
  }

  // Accounts without a password hash (e.g. OAuth-only) can't reset via this flow.
  if (!user.passwordHash) {
    return NextResponse.json({ ok: true, message: GENERIC_OK });
  }

  // Invalidate any earlier pending tokens so only the freshest link works.
  await invalidatePendingForUser(user.id);
  const { token, expiresAt } = await createResetToken(user.id, { ip, userAgent: ua });

  const origin = new URL(req.url).origin;
  const link = `${origin}/reset-password/${encodeURIComponent(token)}`;

  // Try to send the email. SMTP being unconfigured is not an error — the
  // user just gets a generic OK and we surface a soft flag so the UI can
  // hint to the admin that mail isn't set up.
  const settings = await getAppSettings();
  let emailDelivery: "sent" | "unavailable" = "unavailable";
  if (settings.smtpEnabled && settings.smtpFromEmail) {
    const out = await sendMail({
      to: user.email,
      subject: "Reset your PublishOS password",
      text: textTemplate({ link, name: user.name, expiresAt }),
      html: htmlTemplate({ link, name: user.name, expiresAt }),
    });
    if (out.ok) emailDelivery = "sent";
    else console.warn("[forgot-password] email send failed:", out.error);
  } else {
    console.warn("[forgot-password] SMTP not configured — reset link not delivered for", user.email);
  }

  return NextResponse.json({ ok: true, message: GENERIC_OK, emailDelivery });
}

const GENERIC_OK =
  "If an account with that email exists, we'll send a reset link shortly. Check your inbox in a minute.";

function textTemplate({ link, name, expiresAt }: { link: string; name: string | null; expiresAt: Date }): string {
  return `Hi ${name ?? "there"},

We received a request to reset the password for your PublishOS account.

Click the link below to choose a new password. The link is single-use and expires in 1 hour (${expiresAt.toUTCString()}).

${link}

If you didn't request this, you can safely ignore this email — your password won't change.

— PublishOS`;
}

function htmlTemplate({ link, name, expiresAt }: { link: string; name: string | null; expiresAt: Date }): string {
  return `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width:560px; margin:0 auto; padding:32px 24px; color:#14130F; line-height:1.55;">
  <p style="margin:0 0 16px; font-size:14px;">Hi ${escapeHtml(name ?? "there")},</p>
  <p style="margin:0 0 16px; font-size:14px;">
    We received a request to reset the password for your <strong>PublishOS</strong> account.
  </p>
  <p style="margin:24px 0;">
    <a href="${link}" style="display:inline-block; padding:10px 18px; background:#14130F; color:#fff; text-decoration:none; border-radius:8px; font-size:13.5px; font-weight:500;">
      Reset password
    </a>
  </p>
  <p style="margin:0 0 16px; font-size:12.5px; color:#6B6962;">
    The link is single-use and expires in 1 hour (${escapeHtml(expiresAt.toUTCString())}).
  </p>
  <p style="margin:0 0 16px; font-size:12.5px; color:#6B6962;">
    Or copy and paste this URL into your browser:<br>
    <span style="font-family:ui-monospace, SFMono-Regular, Menlo, monospace; word-break:break-all; font-size:11.5px;">${link}</span>
  </p>
  <hr style="border:0; border-top:1px solid #EAE9E3; margin:24px 0;">
  <p style="margin:0; font-size:11.5px; color:#ACAAA2;">
    If you didn't request this, you can safely ignore this email — your password won't change.<br>
    — PublishOS
  </p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const POST = withLogging(_post, { source: "api" });
export const runtime = "nodejs";
