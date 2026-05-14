import { requireSessionUser } from "@/lib/auth-helpers";
import { listAllUsers } from "@/lib/data/users";
import { listPendingInvitations } from "@/lib/data/invitations";
import { ensureDefaultTeam, listTeams } from "@/lib/data/teams";
import PeopleClient from "@/components/people/PeopleClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await requireSessionUser();
  if (!me) redirect("/login");

  // First request after the column was added: create the Organisation team
  // and reconcile membership for every existing user. Idempotent thereafter.
  await ensureDefaultTeam();

  const [members, invitations, teams] = await Promise.all([
    listAllUsers(),
    listPendingInvitations(),
    listTeams(),
  ]);

  const sp = await searchParams;

  return (
    <PeopleClient
      me={me}
      members={members}
      invitations={invitations}
      teams={teams}
      initialTab={sp.tab === "teams" ? "teams" : "people"}
    />
  );
}
