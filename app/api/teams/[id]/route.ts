import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { deleteTeam, getTeamWithMembers, updateTeam } from "@/lib/data/teams";
import { withLogging } from "@/lib/logged-handler";

const Patch = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(280).nullable().optional(),
  gradient: z.string().max(200).nullable().optional(),
});

async function _get(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const team = await getTeamWithMembers(id);
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ team });
}

async function _patch(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me.workspaceRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const team = await updateTeam(id, parsed.data);
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ team });
}

async function _delete(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me.workspaceRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const [team] = await db.select({ isDefault: teams.isDefault }).from(teams).where(eq(teams.id, id)).limit(1);
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (team.isDefault) {
    return NextResponse.json({ error: "The Organisation team can't be deleted" }, { status: 400 });
  }
  await deleteTeam(id);
  return NextResponse.json({ ok: true });
}

export const GET = withLogging(_get);
export const PATCH = withLogging(_patch);
export const DELETE = withLogging(_delete);
