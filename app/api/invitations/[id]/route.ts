import { NextResponse } from "next/server";
import { isAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { revokeInvitation } from "@/lib/data/invitations";
import { withLogging } from "@/lib/logged-handler";

async function _delete(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me.workspaceRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await revokeInvitation(id);
  return NextResponse.json({ ok: true });
}

export const DELETE = withLogging(_delete);
