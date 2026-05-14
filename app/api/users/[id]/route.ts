import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { isAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { countOwners, getUserById, removeUser, setWorkspaceRole } from "@/lib/data/users";
import { withLogging } from "@/lib/logged-handler";

const Patch = z.object({
  workspaceRole: z.enum(["owner", "admin", "editor", "viewer"]).optional(),
  name: z.string().min(1).max(120).optional(),
});

async function _patch(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me.workspaceRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (parsed.data.workspaceRole === "owner" && me.workspaceRole !== "owner") {
    return NextResponse.json({ error: "Only a Super Admin can promote a member to Super Admin" }, { status: 403 });
  }

  const target = await getUserById(id);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Block demoting the last remaining Super Admin — would lock the workspace out of admin actions.
  if (
    parsed.data.workspaceRole !== undefined &&
    target.workspaceRole === "owner" &&
    parsed.data.workspaceRole !== "owner"
  ) {
    const owners = await countOwners();
    if (owners <= 1) {
      return NextResponse.json(
        { error: "Promote another member to Super Admin before demoting the last one." },
        { status: 400 },
      );
    }
  }

  if (parsed.data.name !== undefined) {
    await db.update(users).set({ name: parsed.data.name }).where(eq(users.id, id));
  }
  if (parsed.data.workspaceRole) {
    await setWorkspaceRole(id, parsed.data.workspaceRole);
    // Multiple Super Admins are allowed — promoting another user does NOT demote the current one.
  }
  return NextResponse.json({ ok: true });
}

async function _delete(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me.workspaceRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (id === me.id) return NextResponse.json({ error: "You can't remove yourself" }, { status: 400 });

  const target = await getUserById(id);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.workspaceRole === "owner") {
    const owners = await countOwners();
    if (owners <= 1) {
      return NextResponse.json(
        { error: "Can't remove the last Super Admin. Promote another member first." },
        { status: 400 },
      );
    }
  }

  await removeUser(id);
  return NextResponse.json({ ok: true });
}

export const PATCH = withLogging(_patch);
export const DELETE = withLogging(_delete);
