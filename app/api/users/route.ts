import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth-helpers";
import { listAllUsers } from "@/lib/data/users";
import { withLogging } from "@/lib/logged-handler";

async function _get() {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const users = await listAllUsers();
  return NextResponse.json({ users });
}

export const GET = withLogging(_get);
