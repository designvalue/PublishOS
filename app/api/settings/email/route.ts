import { NextResponse } from "next/server";
import { z } from "zod";
import { isSuperAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { getAppSettings, updateSmtpSettings } from "@/lib/data/settings";
import { notifyByRole } from "@/lib/data/notifications";
import { withLogging } from "@/lib/logged-handler";

/**
 * GET  /api/settings/email — read current SMTP config. Password is never
 *                            returned; only a `hasPassword` boolean.
 * PATCH /api/settings/email — write SMTP config.
 *
 * Super-Admin only — workspace-wide config.
 */

const SmtpInput = z.object({
  enabled: z.boolean(),
  host: z.string().trim().min(1, "Host is required"),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().trim().nullable().optional(),
  password: z.string().nullable().optional(),
  fromName: z.string().trim().nullable().optional(),
  fromEmail: z.string().trim().email("From must be a valid email"),
});

async function _get() {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(me.workspaceRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const s = await getAppSettings();
  return NextResponse.json({
    smtp: {
      enabled: !!s.smtpEnabled,
      host: s.smtpHost ?? "",
      port: s.smtpPort ?? 587,
      secure: !!s.smtpSecure,
      username: s.smtpUsername ?? "",
      hasPassword: !!s.smtpPassword,
      fromName: s.smtpFromName ?? "",
      fromEmail: s.smtpFromEmail ?? "",
    },
  });
}

async function _patch(req: Request) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(me.workspaceRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = SmtpInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const out = await updateSmtpSettings(parsed.data);

  // Broadcast to fellow super admins so SMTP changes don't slip past anyone.
  void notifyByRole(["owner"], {
    kind: "info",
    event: "settings.smtp.updated",
    title: out.smtpEnabled ? "Outbound email enabled" : "Outbound email disabled",
    body: `${me.name ?? me.email} updated SMTP settings.`,
    link: "/settings",
    data: { host: out.smtpHost, fromEmail: out.smtpFromEmail, enabled: !!out.smtpEnabled },
  });

  return NextResponse.json({
    smtp: {
      enabled: !!out.smtpEnabled,
      host: out.smtpHost ?? "",
      port: out.smtpPort ?? 587,
      secure: !!out.smtpSecure,
      username: out.smtpUsername ?? "",
      hasPassword: !!out.smtpPassword,
      fromName: out.smtpFromName ?? "",
      fromEmail: out.smtpFromEmail ?? "",
    },
  });
}

export const GET = withLogging(_get);
export const PATCH = withLogging(_patch);
