import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, teamMembers, folderTeamGrants, users } from "@/lib/db/schema";

const DEFAULT_TEAM_NAME = "Organisation";
const DEFAULT_TEAM_GRADIENT = "linear-gradient(135deg, var(--violet) 0%, var(--coral) 100%)";

export type TeamRow = typeof teams.$inferSelect;

export type TeamWithStats = {
  id: string;
  name: string;
  description: string | null;
  gradient: string | null;
  initial: string;
  isDefault: boolean;
  memberCount: number;
  folderCount: number;
  members: { userId: string; name: string | null; email: string }[];
};

export type TeamDetail = TeamWithStats & {
  createdAt: Date;
};

export async function listTeams(): Promise<TeamWithStats[]> {
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
      gradient: teams.gradient,
      initial: teams.initial,
      isDefault: teams.isDefault,
      memberCount: sql<number>`(
        select count(*) from ${teamMembers} tm where tm.team_id = ${teams.id}
      )`,
      folderCount: sql<number>`(
        select count(*) from ${folderTeamGrants} g where g.team_id = ${teams.id}
      )`,
    })
    .from(teams)
    // Default team first, then alphabetical.
    .orderBy(sql`${teams.isDefault} desc`, asc(teams.name));

  if (rows.length === 0) return [];

  const memberRows = await db
    .select({
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      name: users.name,
      email: users.email,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId));

  const grouped = new Map<string, TeamWithStats["members"]>();
  for (const m of memberRows) {
    const list = grouped.get(m.teamId) ?? [];
    list.push({ userId: m.userId, name: m.name, email: m.email });
    grouped.set(m.teamId, list);
  }

  return rows.map((r) => ({
    ...r,
    isDefault: !!r.isDefault,
    memberCount: Number(r.memberCount),
    folderCount: Number(r.folderCount),
    members: (grouped.get(r.id) ?? []).slice(0, 5),
  }));
}

/**
 * Returns the workspace's default "Organisation" team, creating it on first call.
 * Also reconciles membership so that every user is part of the team.
 */
export async function ensureDefaultTeam(): Promise<TeamRow> {
  let [team] = await db.select().from(teams).where(eq(teams.isDefault, true)).limit(1);
  if (!team) {
    [team] = await db
      .insert(teams)
      .values({
        name: DEFAULT_TEAM_NAME,
        description: "Everyone in this workspace.",
        gradient: DEFAULT_TEAM_GRADIENT,
        initial: "O",
        isDefault: true,
      })
      .returning();
  }
  await syncDefaultTeamMembers(team.id);
  return team;
}

/** Make sure every user is a member of the default team. */
export async function syncDefaultTeamMembers(teamId: string): Promise<void> {
  const allUsers = await db.select({ id: users.id }).from(users);
  if (allUsers.length === 0) return;
  // Insert any missing memberships; ignore conflicts on existing pairs.
  await db
    .insert(teamMembers)
    .values(allUsers.map((u) => ({ teamId, userId: u.id, role: "member" })))
    .onConflictDoNothing();
}

/** Add a user to the default team, creating the team if it doesn't exist yet. */
export async function addUserToDefaultTeam(userId: string): Promise<void> {
  const team = await ensureDefaultTeam();
  await db
    .insert(teamMembers)
    .values({ teamId: team.id, userId, role: "member" })
    .onConflictDoNothing();
}

export async function getTeamWithMembers(teamId: string): Promise<
  | (TeamRow & { members: { userId: string; name: string | null; email: string }[] })
  | null
> {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) return null;
  const members = await db
    .select({ userId: teamMembers.userId, name: users.name, email: users.email })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, teamId));
  return { ...team, members };
}

export async function createTeam(input: {
  name: string;
  description?: string;
  gradient?: string;
  memberIds?: string[];
}): Promise<TeamRow> {
  const initial = (input.name.trim()[0] ?? "?").toUpperCase();
  const [team] = await db
    .insert(teams)
    .values({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      gradient: input.gradient ?? null,
      initial,
    })
    .returning();

  if (input.memberIds && input.memberIds.length > 0) {
    await db
      .insert(teamMembers)
      .values(input.memberIds.map((userId) => ({ teamId: team.id, userId })));
  }

  return team;
}

export async function updateTeam(
  id: string,
  patch: Partial<{ name: string; description: string | null; gradient: string | null }>,
): Promise<TeamRow | null> {
  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    set.name = patch.name.trim();
    set.initial = (patch.name.trim()[0] ?? "?").toUpperCase();
  }
  if (patch.description !== undefined) set.description = patch.description?.trim() || null;
  if (patch.gradient !== undefined) set.gradient = patch.gradient;
  if (Object.keys(set).length === 0) return null;

  const [updated] = await db.update(teams).set(set).where(eq(teams.id, id)).returning();
  return updated ?? null;
}

export async function deleteTeam(id: string): Promise<void> {
  await db.delete(teams).where(eq(teams.id, id));
}

export async function addTeamMember(teamId: string, userId: string): Promise<void> {
  await db
    .insert(teamMembers)
    .values({ teamId, userId, role: "member" })
    .onConflictDoNothing();
}

export async function removeTeamMember(teamId: string, userId: string): Promise<void> {
  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
}
