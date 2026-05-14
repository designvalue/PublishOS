import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { folders, folderMembers, folderTeamGrants, users, teams } from "@/lib/db/schema";
import { withLogging } from "@/lib/logged-handler";

const SetAccess = z.object({
  visibility: z.enum(["private", "shared"]),
  members: z
    .array(
      z.object({
        userId: z.string(),
        role: z.enum(["editor", "viewer"]),
      }),
    )
    .default([]),
  teams: z
    .array(
      z.object({
        teamId: z.string().uuid(),
        role: z.enum(["editor", "viewer"]),
      }),
    )
    .default([]),
});

async function _get(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [folder] = await db
    .select({ id: folders.id, visibility: folders.visibility, ownerId: folders.ownerId })
    .from(folders)
    .where(and(eq(folders.id, id), eq(folders.ownerId, session.user.id)))
    .limit(1);
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const memberRows = await db
    .select({
      userId: folderMembers.userId,
      role: folderMembers.role,
      name: users.name,
      email: users.email,
    })
    .from(folderMembers)
    .innerJoin(users, eq(users.id, folderMembers.userId))
    .where(eq(folderMembers.folderId, id));

  const teamRows = await db
    .select({
      teamId: folderTeamGrants.teamId,
      role: folderTeamGrants.role,
      name: teams.name,
      initial: teams.initial,
      gradient: teams.gradient,
    })
    .from(folderTeamGrants)
    .innerJoin(teams, eq(teams.id, folderTeamGrants.teamId))
    .where(eq(folderTeamGrants.folderId, id));

  return NextResponse.json({
    visibility: folder.visibility,
    members: memberRows,
    teams: teamRows,
  });
}

async function _patch(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = SetAccess.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Verify ownership
  const [owned] = await db
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.id, id), eq(folders.ownerId, session.user.id)))
    .limit(1);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { visibility, members, teams: teamsPayload } = parsed.data;

  // better-sqlite3 transactions are sync; we execute the updates sequentially in
  // WAL mode (each statement is its own atomic commit, which is good enough here).
  await db.update(folders).set({ visibility, modifiedAt: new Date() }).where(eq(folders.id, id));
  await db.delete(folderMembers).where(eq(folderMembers.folderId, id));
  await db.delete(folderTeamGrants).where(eq(folderTeamGrants.folderId, id));
  if (members.length > 0) {
    await db.insert(folderMembers).values(members.map((m) => ({ folderId: id, ...m })));
  }
  if (teamsPayload.length > 0) {
    await db.insert(folderTeamGrants).values(teamsPayload.map((t) => ({ folderId: id, ...t })));
  }

  return NextResponse.json({ ok: true });
}

export const GET = withLogging(_get);
export const PATCH = withLogging(_patch);
