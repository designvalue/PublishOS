import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { createTeam, listTeams } from "@/lib/data/teams";
import { withLogging } from "@/lib/logged-handler";

const NewTeam = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(280).optional(),
  gradient: z.string().max(200).optional(),
  memberIds: z.array(z.string()).max(50).optional(),
});

async function _get() {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const teams = await listTeams();
  return NextResponse.json({ teams });
}

async function _post(req: Request) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me.workspaceRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = NewTeam.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const team = await createTeam(parsed.data);
  return NextResponse.json({ team }, { status: 201 });
}

export const GET = withLogging(_get);
export const POST = withLogging(_post);
