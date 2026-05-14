import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { invitations, users } from "@/lib/db/schema";

export type InvitationRow = typeof invitations.$inferSelect;
export type InviteRole = InvitationRow["role"];

export type InvitationListEntry = InvitationRow & { invitedByName: string | null; invitedByEmail: string };

const DEFAULT_TTL_DAYS = 7;

function generateToken(): string {
  // 32 bytes of randomness, base64url
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

export async function listPendingInvitations(): Promise<InvitationListEntry[]> {
  const rows = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      token: invitations.token,
      invitedByUserId: invitations.invitedByUserId,
      invitedAt: invitations.invitedAt,
      expiresAt: invitations.expiresAt,
      acceptedAt: invitations.acceptedAt,
      acceptedByUserId: invitations.acceptedByUserId,
      revokedAt: invitations.revokedAt,
      invitedByName: users.name,
      invitedByEmail: users.email,
    })
    .from(invitations)
    .leftJoin(users, eq(users.id, invitations.invitedByUserId))
    .where(and(isNull(invitations.acceptedAt), isNull(invitations.revokedAt)))
    .orderBy(desc(invitations.invitedAt));

  return rows.map((r) => ({
    ...r,
    invitedByEmail: r.invitedByEmail ?? "",
  }));
}

export async function createInvitation(input: {
  email: string;
  role: InviteRole;
  invitedByUserId: string;
}): Promise<InvitationRow> {
  const email = input.email.toLowerCase().trim();
  // Revoke any existing pending invite for the same email so links don't double up.
  await db
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(invitations.email, email),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
      ),
    );

  const expiresAt = new Date(Date.now() + DEFAULT_TTL_DAYS * 24 * 3600 * 1000);
  const [created] = await db
    .insert(invitations)
    .values({
      email,
      role: input.role,
      token: generateToken(),
      invitedByUserId: input.invitedByUserId,
      expiresAt,
    })
    .returning();
  return created;
}

export async function revokeInvitation(id: string): Promise<void> {
  await db.update(invitations).set({ revokedAt: new Date() }).where(eq(invitations.id, id));
}

export async function getInvitationByToken(token: string): Promise<InvitationRow | null> {
  const [row] = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
  if (!row) return null;
  if (row.acceptedAt || row.revokedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

export async function markInvitationAccepted(id: string, userId: string): Promise<void> {
  await db
    .update(invitations)
    .set({ acceptedAt: new Date(), acceptedByUserId: userId })
    .where(eq(invitations.id, id));
}

export async function countPendingInvitations(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(invitations)
    .where(and(isNull(invitations.acceptedAt), isNull(invitations.revokedAt)));
  return Number(row?.n ?? 0);
}
