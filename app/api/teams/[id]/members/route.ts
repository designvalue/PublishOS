import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { isAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { addTeamMember, removeTeamMember } from "@/lib/data/teams";
import { withLogging } from "@/lib/logged-handler";

const Add = z.object({ userId: z.string() });
const Remove = z.object({ userId: z.string() });

async function _post(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me.workspaceRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = Add.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  await addTeamMember(id, parsed.data.userId);
  return NextResponse.json({ ok: true });
}

async function _delete(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me.workspaceRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = Remove.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const [team] = await db.select({ isDefault: teams.isDefault }).from(teams).where(eq(teams.id, id)).limit(1);
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (team.isDefault) {
    return NextResponse.json(
      { error: "Everyone in the workspace is part of the Organisation team. You can't remove members from it." },
      { status: 400 },
    );
  }

  await removeTeamMember(id, parsed.data.userId);
  return NextResponse.json({ ok: true });
}

export const POST = withLogging(_post);
export const DELETE = withLogging(_delete);
