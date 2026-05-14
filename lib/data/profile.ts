import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  folders,
  folderMembers,
  teamMembers,
  teams,
  users,
} from "@/lib/db/schema";

export type ProfileFolder = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "member";
};

export type ProfileTeam = {
  id: string;
  name: string;
  initial: string;
  gradient: string | null;
  isDefault: boolean;
};

export type Profile = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  avatarUrl: string | null;
  workspaceRole: "owner" | "admin" | "editor" | "viewer";
  lastActiveAt: Date | null;
  createdAt: Date;
  mustChangePassword: boolean;
  folders: ProfileFolder[];
  teams: ProfileTeam[];
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  const owned = await db
    .select({ id: folders.id, name: folders.name, slug: folders.slug })
    .from(folders)
    .where(eq(folders.ownerId, userId));

  const member = await db
    .select({ id: folders.id, name: folders.name, slug: folders.slug })
    .from(folderMembers)
    .innerJoin(folders, eq(folders.id, folderMembers.folderId))
    .where(eq(folderMembers.userId, userId));

  const folderList: ProfileFolder[] = [
    ...owned.map((f) => ({ ...f, role: "owner" as const })),
    ...member.map((f) => ({ ...f, role: "member" as const })),
  ];

  const teamsList = await db
    .select({
      id: teams.id,
      name: teams.name,
      initial: teams.initial,
      gradient: teams.gradient,
      isDefault: teams.isDefault,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, userId));

  const avatarUrl = user.avatarKey
    ? `/api/account/avatar/${user.id}?v=${user.avatarUpdatedAt?.getTime() ?? 0}`
    : null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    avatarUrl,
    workspaceRole: user.workspaceRole,
    lastActiveAt: user.lastActiveAt,
    createdAt: user.createdAt,
    mustChangePassword: user.mustChangePassword,
    folders: folderList,
    teams: teamsList.map((t) => ({ ...t, isDefault: !!t.isDefault })),
  };
}

export async function getProfileStats(userId: string): Promise<{ ownedFolders: number; memberFolders: number; teams: number }> {
  const [owned] = await db
    .select({ n: sql<number>`count(*)` })
    .from(folders)
    .where(eq(folders.ownerId, userId));
  const [member] = await db
    .select({ n: sql<number>`count(*)` })
    .from(folderMembers)
    .where(eq(folderMembers.userId, userId));
  const [tcount] = await db
    .select({ n: sql<number>`count(*)` })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));
  return {
    ownedFolders: Number(owned?.n ?? 0),
    memberFolders: Number(member?.n ?? 0),
    teams: Number(tcount?.n ?? 0),
  };
}
