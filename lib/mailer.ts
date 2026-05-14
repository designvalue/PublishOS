import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getAppSettings, type AppSettings } from "@/lib/data/settings";

/**
 * Centralised SMTP-backed mailer.
 *
 * The transport is rebuilt from the current `app_settings` row each time so
 * config changes take effect without a process restart. Callers that need a
 * pre-validated transport can call `getSmtpTransport()` directly; most code
 * should use the higher-level helpers (`sendMail`, `verifySmtp`).
 *
 * If SMTP is not configured (smtpEnabled = false, host missing, etc.) the
 * helpers return a structured `{ ok: false, error }` instead of throwing —
 * making it easy to no-op email side-effects in dev environments.
 */

export type MailMessage = {
  to: string | string[];
  subject: string;
  /** Plain-text body. At least one of text/html is required. */
  text?: string;
  /** HTML body. */
  html?: string;
  /** Override the configured From name/email for this one message. */
  from?: string;
  replyTo?: string;
};

export type MailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

function readyToSend(s: AppSettings): { ok: true; from: string } | { ok: false; error: string } {
  if (!s.smtpEnabled) return { ok: false, error: "SMTP is disabled in workspace settings." };
  if (!s.smtpHost) return { ok: false, error: "SMTP host is not configured." };
  if (!s.smtpPort) return { ok: false, error: "SMTP port is not configured." };
  if (!s.smtpFromEmail) return { ok: false, error: "From email is not configured." };
  const from = s.smtpFromName ? `${s.smtpFromName} <${s.smtpFromEmail}>` : s.smtpFromEmail;
  return { ok: true, from };
}

function buildTransport(s: AppSettings): Transporter {
  return nodemailer.createTransport({
    host: s.smtpHost ?? undefined,
    port: s.smtpPort ?? undefined,
    secure: s.smtpSecure, // true → TLS on connect (typically port 465); false → STARTTLS upgrade (587/25)
    auth: s.smtpUsername
      ? {
          user: s.smtpUsername,
          pass: s.smtpPassword ?? "",
        }
      : undefined,
  });
}

/**
 * Verify the current SMTP config by attempting a NOOP handshake against the
 * server. Doesn't send anything. Used by the "Send test email" button.
 */
export async function verifySmtp(): Promise<MailResult> {
  const s = await getAppSettings();
  const ready = readyToSend(s);
  if (!ready.ok) return ready;
  try {
    const t = buildTransport(s);
    await t.verify();
    return { ok: true, messageId: "verify" };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Send an email. Returns an `ok: false` result instead of throwing so caller
 * code can keep its happy path uncluttered.
 */
export async function sendMail(msg: MailMessage): Promise<MailResult> {
  const s = await getAppSettings();
  const ready = readyToSend(s);
  if (!ready.ok) return ready;
  if (!msg.text && !msg.html) {
    return { ok: false, error: "Email must include a text or html body." };
  }
  try {
    const t = buildTransport(s);
    const info = await t.sendMail({
      from: msg.from ?? ready.from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      replyTo: msg.replyTo,
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
