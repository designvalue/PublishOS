import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth-helpers";
import { getProfile } from "@/lib/data/profile";
import { getApiAccessEnabled } from "@/lib/data/settings";
import ProfileView from "@/components/profile/ProfileView";

export const dynamic = "force-dynamic";

export default async function MyProfilePage() {
  const me = await requireSessionUser();
  if (!me) redirect("/login");

  const [profile, apiAccessEnabled] = await Promise.all([
    getProfile(me.id),
    getApiAccessEnabled(),
  ]);
  if (!profile) redirect("/login");

  return (
    <ProfileView
      me={me}
      profile={profile}
      isSelf
      apiAccessEnabled={apiAccessEnabled}
    />
  );
}
