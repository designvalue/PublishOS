import { NextResponse } from "next/server";
import { z } from "zod";
import { isSuperAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { getApiAccessEnabled, updateApiAccessSetting } from "@/lib/data/settings";
import { notifyByRole } from "@/lib/data/notifications";
import { withLogging } from "@/lib/logged-handler";

/**
 * GET   /api/settings/api-access — read the workspace-wide API access flag.
 * PATCH /api/settings/api-access — flip it (Super Admin only).
 *
 * When the flag is OFF:
 *   - /api/v1/sites returns 503
 *   - The "API access" card on every profile page is hidden
 *   - Existing tokens stay in the DB but are inert until flipped back on
 */

const Body = z.object({ enabled: z.boolean() });

async function _get() {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(me.workspaceRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const enabled = await getApiAccessEnabled();
  return NextResponse.json({ apiAccess: { enabled } });
}

async function _patch(req: Request) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(me.workspaceRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const next = await updateApiAccessSetting(parsed.data.enabled);
  void notifyByRole(["owner", "admin"], {
    kind: next.enabled ? "info" : "warning",
    event: "settings.api_access.updated",
    title: next.enabled ? "API access enabled workspace-wide" : "API access disabled workspace-wide",
    body: next.enabled
      ? `${me.name ?? me.email} turned on programmatic API access for everyone.`
      : `${me.name ?? me.email} turned off programmatic API access — all v1 endpoints now return 503.`,
    link: "/settings",
    data: { enabled: next.enabled },
  });
  return NextResponse.json({ apiAccess: next });
}

export const GET = withLogging(_get);
export const PATCH = withLogging(_patch);
