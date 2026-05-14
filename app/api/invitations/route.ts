import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { createInvitation, listPendingInvitations } from "@/lib/data/invitations";
import { notifyByRole } from "@/lib/data/notifications";
import { withLogging } from "@/lib/logged-handler";

const NewInvite = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]).default("editor"),
});

async function _get() {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const invitations = await listPendingInvitations();
  return NextResponse.json({ invitations });
}

async function _post(req: Request) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me.workspaceRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = NewInvite.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (parsed.data.role === "admin" && me.workspaceRole !== "owner") {
    return NextResponse.json({ error: "Only a Super Admin can invite Admins" }, { status: 403 });
  }

  const invite = await createInvitation({
    email: parsed.data.email,
    role: parsed.data.role,
    invitedByUserId: me.id,
  });

  // Notify other admins/super-admins so they know the workspace is growing.
  void notifyByRole(["owner", "admin"], {
    kind: "info",
    event: "invite.sent",
    title: `Invitation sent to ${parsed.data.email}`,
    body: `${me.name ?? me.email} invited them as ${parsed.data.role}.`,
    link: "/people",
    data: { invitationId: invite.id, email: parsed.data.email, role: parsed.data.role },
  });

  return NextResponse.json({
    invitation: invite,
    inviteUrl: `${new URL(req.url).origin}/invite/${invite.token}`,
  }, { status: 201 });
}

export const GET = withLogging(_get);
export const POST = withLogging(_post);
