import { notFound } from "next/navigation";
import { isAdmin, requireSessionUser } from "@/lib/auth-helpers";
import TrashClient from "@/components/trash/TrashClient";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const me = await requireSessionUser();
  if (!me) return notFound();
  return <TrashClient canSeeAll={isAdmin(me.workspaceRole)} />;
}
