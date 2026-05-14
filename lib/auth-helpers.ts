import "server-only";
import { auth } from "@/lib/auth";
import { getUserById, type WorkspaceRole } from "@/lib/data/users";

export type SessionUser = {
  id: string;
  name: string | null;
  email: string;
  workspaceRole: WorkspaceRole;
};

/** Returns the current session user with their workspace role, or null. */
export async function requireSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await getUserById(session.user.id);
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    workspaceRole: user.workspaceRole,
  };
}

/**
 * Workspace role permission matrix (internal role → capability):
 *
 *   Super Admin (owner) — full control: workspace settings, ownership transfer,
 *     can reset any password and invite any role including Admin.
 *   Admin               — manage people and teams; can do everything an Editor
 *     can; cannot promote to Super Admin or reset a Super Admin's password.
 *   Editor              — create folders, upload files, share their own work.
 *   Viewer              — read-only across the workspace.
 */

/** Super Admin or Admin. Required for people/team management. */
export function isAdmin(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin";
}

/** Super Admin, Admin, or Editor. Required to create folders or upload files. */
export function canCreate(role: WorkspaceRole): boolean {
  return role !== "viewer";
}

/** Only Super Admin. Required for ownership transfer + Super-Admin-only ops. */
export function isSuperAdmin(role: WorkspaceRole): boolean {
  return role === "owner";
}
