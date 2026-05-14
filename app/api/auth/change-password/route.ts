import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getUserById, setPasswordHash } from "@/lib/data/users";
import { hashPassword, verifyPassword } from "@/lib/password";
import { withLogging } from "@/lib/logged-handler";

const Schema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8).max(200),
  });

async function _post(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const user = await getUserById(session.user.id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // If the user has a password set and isn't in a forced-reset state, require the current password.
  if (user.passwordHash && !user.mustChangePassword) {
    if (!parsed.data.currentPassword) {
      return NextResponse.json({ error: "Current password required" }, { status: 400 });
    }
    const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await setPasswordHash(user.id, passwordHash, /* mustChange */ false);
  return NextResponse.json({ ok: true });
}

export const POST = withLogging(_post);
