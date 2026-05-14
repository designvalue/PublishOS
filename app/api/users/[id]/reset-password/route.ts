import { NextResponse } from "next/server";
import { isAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { getUserById, setPasswordHash } from "@/lib/data/users";
import { hashPassword } from "@/lib/password";
import { notify } from "@/lib/data/notifications";
import { withLogging } from "@/lib/logged-handler";

const WORDS = [
  "river", "willow", "kestrel", "amber", "indigo", "marlow", "rivulet", "cinder",
  "harbor", "wren", "violet", "hollow", "ember", "lattice", "north", "thistle",
];

function generateTempPassword(): string {
  const a = WORDS[Math.floor(Math.random() * WORDS.length)];
  const b = WORDS[Math.floor(Math.random() * WORDS.length)];
  const n = String(Math.floor(Math.random() * 90 + 10));
  return `${a}-${b}-${n}`;
}

async function _post(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me.workspaceRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const target = await getUserById(id);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Only a Super Admin can reset another Super Admin's password.
  if (target.workspaceRole === "owner" && me.workspaceRole !== "owner") {
    return NextResponse.json({ error: "Only a Super Admin can reset another Super Admin's password" }, { status: 403 });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  await setPasswordHash(target.id, passwordHash, /* mustChange */ true);

  // Notify the affected user so they know their password was rotated.
  void notify({
    userId: target.id,
    kind: "warning",
    event: "account.password.reset",
    title: "Your password was reset",
    body: `${me.name ?? me.email} reset your password. You'll be asked to set a new one at sign-in.`,
    link: "/profile",
    data: { byUserId: me.id },
  });

  return NextResponse.json({
    ok: true,
    tempPassword,
    note: "Share this password with the user. They will be required to change it on next sign-in.",
  });
}

export const POST = withLogging(_post);
