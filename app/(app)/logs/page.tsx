import { isSuperAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { getRequestsLastMinute, listAccessLogs, maybePrune } from "@/lib/access-log";
import LogsClient from "@/components/logs/LogsClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const me = await requireSessionUser();
  if (!me) redirect("/login");
  if (!isSuperAdmin(me.workspaceRole)) redirect("/");

  // Lazily prune anything older than 90 days, then fetch the most recent.
  await maybePrune();
  const [initial, perMinute] = await Promise.all([
    listAccessLogs({ limit: 100 }),
    getRequestsLastMinute(),
  ]);

  return <LogsClient initial={initial} initialPerMinute={perMinute} />;
}
