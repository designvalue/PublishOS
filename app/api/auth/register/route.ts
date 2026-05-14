import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/password";
import { countUsers } from "@/lib/data/users";
import {
  getInvitationByToken,
  markInvitationAccepted,
} from "@/lib/data/invitations";
import { addUserToDefaultTeam } from "@/lib/data/teams";
import { isEmailAllowedForSignup } from "@/lib/data/settings";
import { notify, notifyByRole } from "@/lib/data/notifications";
import { withLogging } from "@/lib/logged-handler";

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  inviteToken: z.string().optional(),
});

async function _post(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { name, email, password, inviteToken } = parsed.data;
  const normalisedEmail = email.toLowerCase();

  // Existing-account check fires BEFORE the domain allowlist below. That order
  // matters: users created under an older policy (or via admin invite) keep
  // working forever, regardless of their email domain. They just see "account
  // already exists" if they fumble onto /register — never a domain block.
  // Login is handled by the Credentials provider in lib/auth.ts and never
  // consults the allowlist, so existing users sign in normally.
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalisedEmail))
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  // Decide the workspace role.
  // 1. First user ever → owner.
  // 2. Has a valid invite for this email → role from invite.
  // 3. Otherwise → editor.
  const total = await countUsers();
  let workspaceRole: "owner" | "admin" | "editor" | "viewer" = total === 0 ? "owner" : "editor";
  let acceptingInvitationId: string | null = null;
  let acceptingInviterUserId: string | null = null;

  if (inviteToken) {
    const invite = await getInvitationByToken(inviteToken);
    if (!invite) {
      return NextResponse.json({ error: "Invitation is invalid or expired" }, { status: 400 });
    }
    if (invite.email !== normalisedEmail) {
      return NextResponse.json({ error: "This invitation is for a different email" }, { status: 400 });
    }
    workspaceRole = invite.role;
    acceptingInvitationId = invite.id;
    acceptingInviterUserId = invite.invitedByUserId;
  } else if (total > 0) {
    // No invite + not the first user → enforce the workspace domain allowlist.
    // The very first signup is always allowed so a workspace can bootstrap
    // itself before any admin exists to configure the allowlist.
    const gate = await isEmailAllowedForSignup(normalisedEmail);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.reason }, { status: 403 });
    }
  }

  const passwordHash = await hashPassword(password);
  const [created] = await db
    .insert(users)
    .values({ name, email: normalisedEmail, passwordHash, workspaceRole })
    .returning({ id: users.id, email: users.email, name: users.name, workspaceRole: users.workspaceRole });

  if (acceptingInvitationId) {
    await markInvitationAccepted(acceptingInvitationId, created.id);
  }

  // Every new user is auto-added to the default Organisation team.
  await addUserToDefaultTeam(created.id);

  // Production notifications — best-effort, never block the signup response.
  if (acceptingInvitationId && acceptingInviterUserId) {
    // Tell the person who sent the invite that it was accepted.
    void notify({
      userId: acceptingInviterUserId,
      kind: "success",
      event: "invite.accepted",
      title: `${created.name ?? created.email} accepted your invitation`,
      body: `They joined as ${created.workspaceRole}.`,
      link: "/people",
      data: { newUserId: created.id, email: created.email, role: created.workspaceRole },
    });
  }
  if (total > 0) {
    // Tell every admin/super-admin that a new account joined the workspace.
    // Skip on the very first signup — that user is the bootstrap owner and the
    // only admin in existence, so notifying themselves would be noise.
    void notifyByRole(["owner", "admin"], {
      kind: "info",
      event: "user.joined",
      title: `${created.name ?? created.email} joined the workspace`,
      body: acceptingInvitationId
        ? `Accepted invitation. Joined as ${created.workspaceRole}.`
        : `Self-registered. Joined as ${created.workspaceRole}.`,
      link: "/people",
      data: { newUserId: created.id, email: created.email, role: created.workspaceRole, viaInvite: !!acceptingInvitationId },
    });
  }

  return NextResponse.json({ user: created }, { status: 201 });
}

export const POST = withLogging(_post);
