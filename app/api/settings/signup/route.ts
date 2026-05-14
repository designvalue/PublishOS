import { NextResponse } from "next/server";
import { z } from "zod";
import { isSuperAdmin, requireSessionUser } from "@/lib/auth-helpers";
import {
  getSignupSettings,
  isValidDomain,
  normaliseDomain,
  updateSignupSettings,
} from "@/lib/data/settings";
import { notifyByRole } from "@/lib/data/notifications";
import { withLogging } from "@/lib/logged-handler";

/**
 * GET   /api/settings/signup — read the sign-up domain allowlist.
 * PATCH /api/settings/signup — update it.
 *
 * Super-Admin only. When `restricted` is true, only emails whose domain is
 * listed in `allowedDomains` may self-register via /register. Invited users
 * (via /api/invitations) are always allowed — the invitation itself is the
 * admin's explicit override.
 */

const Body = z.object({
  restricted: z.boolean(),
  allowedDomains: z.array(z.string().trim()).max(50),
});

async function _get() {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(me.workspaceRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const signup = await getSignupSettings();
  return NextResponse.json({ signup });
}

async function _patch(req: Request) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(me.workspaceRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // Surface any malformed-domain entries before the data layer silently strips them.
  const cleaned = parsed.data.allowedDomains.map(normaliseDomain).filter(Boolean);
  const invalid = cleaned.find((d) => !isValidDomain(d));
  if (invalid) {
    return NextResponse.json(
      { error: `"${invalid}" is not a valid domain. Use a host like example.com.` },
      { status: 400 },
    );
  }
  if (parsed.data.restricted && cleaned.length === 0) {
    return NextResponse.json(
      { error: "Add at least one allowed domain before enabling the restriction." },
      { status: 400 },
    );
  }

  const next = await updateSignupSettings({
    restricted: parsed.data.restricted,
    allowedDomains: cleaned,
  });

  // Broadcast to other super-admins.
  void notifyByRole(["owner"], {
    kind: "info",
    event: "settings.signup.updated",
    title: next.restricted ? "Sign-up restricted to allowed domains" : "Sign-up domain restriction removed",
    body: next.restricted
      ? `Allowed domains: ${next.allowedDomains.join(", ") || "(none)"}.`
      : "Anyone with a valid email can now self-register.",
    link: "/settings",
    data: { restricted: next.restricted, allowedDomains: next.allowedDomains },
  });

  return NextResponse.json({ signup: next });
}

export const GET = withLogging(_get);
export const PATCH = withLogging(_patch);
