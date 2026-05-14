import { redirect } from "next/navigation";
import { isSuperAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { getApiAccessEnabled, getAppSettings, getSignupSettings } from "@/lib/data/settings";
import { getStorageUsage } from "@/lib/data/storage-usage";
import SettingsClient from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await requireSessionUser();
  if (!me) redirect("/login");
  if (!isSuperAdmin(me.workspaceRole)) redirect("/");

  const [settings, signup, usage, apiAccessEnabled] = await Promise.all([
    getAppSettings(),
    getSignupSettings(),
    getStorageUsage(),
    getApiAccessEnabled(),
  ]);
  return (
    <SettingsClient
      signup={signup}
      usage={usage}
      apiAccess={{ enabled: apiAccessEnabled }}
      deployedOnVercel={process.env.VERCEL === "1"}
      initial={{
        storageBackend: settings.storageBackend,
        storageRoot: settings.storageRoot,
        s3Bucket: settings.s3Bucket,
        s3Region: settings.s3Region,
        s3Endpoint: settings.s3Endpoint,
        s3AccessKeyId: settings.s3AccessKeyId,
        s3PublicUrl: settings.s3PublicUrl,
        hasS3Secret: !!settings.s3SecretAccessKey,
      }}
      email={{
        enabled: !!settings.smtpEnabled,
        host: settings.smtpHost ?? "",
        port: settings.smtpPort ?? 587,
        secure: !!settings.smtpSecure,
        username: settings.smtpUsername ?? "",
        hasPassword: !!settings.smtpPassword,
        fromName: settings.smtpFromName ?? "",
        fromEmail: settings.smtpFromEmail ?? "",
      }}
    />
  );
}
