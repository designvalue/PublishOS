import "server-only";
import { getAppSettings } from "@/lib/data/settings";
import { createLocalBackend } from "./local";
import { createS3Backend } from "./s3";
import type { StorageBackend } from "./types";

export type { StorageBackend } from "./types";

/** Returns the active storage backend based on app_settings. Falls back to local. */
export async function getStorage(): Promise<StorageBackend> {
  const settings = await getAppSettings();

  if (settings.storageBackend === "s3") {
    if (
      !settings.s3Bucket ||
      !settings.s3Region ||
      !settings.s3Endpoint ||
      !settings.s3AccessKeyId ||
      !settings.s3SecretAccessKey
    ) {
      // Misconfigured S3 — fall back to local rather than throwing during a write.
      // The settings page surfaces the misconfiguration to the user.
      return createLocalBackend(settings.storageRoot);
    }
    return createS3Backend({
      bucket: settings.s3Bucket,
      region: settings.s3Region,
      endpoint: settings.s3Endpoint,
      accessKeyId: settings.s3AccessKeyId,
      secretAccessKey: settings.s3SecretAccessKey,
      publicUrl: settings.s3PublicUrl,
    });
  }

  return createLocalBackend(settings.storageRoot);
}
