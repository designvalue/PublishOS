import { redirect } from "next/navigation";
import { isAdmin, requireSessionUser } from "@/lib/auth-helpers";
import StatsClient from "@/components/stats/StatsClient";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const me = await requireSessionUser();
  if (!me) redirect("/login");
  return <StatsClient canSeeAll={isAdmin(me.workspaceRole)} />;
}
