import { notFound, redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth-helpers";
import { getProfile } from "@/lib/data/profile";
import { getApiAccessEnabled } from "@/lib/data/settings";
import ProfileView from "@/components/profile/ProfileView";

export const dynamic = "force-dynamic";

export default async function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireSessionUser();
  if (!me) redirect("/login");

  const { id } = await params;
  if (id === me.id) redirect("/profile");

  const [profile, apiAccessEnabled] = await Promise.all([
    getProfile(id),
    getApiAccessEnabled(),
  ]);
  if (!profile) notFound();

  return (
    <ProfileView
      me={me}
      profile={profile}
      isSelf={false}
      apiAccessEnabled={apiAccessEnabled}
    />
  );
}
