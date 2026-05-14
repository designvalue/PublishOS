import { NextResponse } from "next/server";
import { z } from "zod";
import { isSuperAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { getAppSettings, updateStorageSettings } from "@/lib/data/settings";
import { notifyByRole } from "@/lib/data/notifications";
import { withLogging } from "@/lib/logged-handler";

const Patch = z.discriminatedUnion("backend", [
  z.object({
    backend: z.literal("local"),
    storageRoot: z.string().min(1).max(200).optional(),
  }),
  z.object({
    backend: z.literal("s3"),
    s3: z.object({
      bucket: z.string().min(1),
      region: z.string().min(1),
      endpoint: z.string().url(),
      accessKeyId: z.string().min(1),
      secretAccessKey: z.string().min(1),
      publicUrl: z.string().url().optional().nullable(),
    }),
  }),
]);

async function _get() {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(me.workspaceRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const settings = await getAppSettings();
  // Don't leak the secret access key.
  const { s3SecretAccessKey, ...safe } = settings;
  void s3SecretAccessKey;
  return NextResponse.json({ ...safe, hasS3Secret: !!s3SecretAccessKey });
}

async function _patch(req: Request) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(me.workspaceRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const updated =
    parsed.data.backend === "local"
      ? await updateStorageSettings({
          backend: "local",
          storageRoot: parsed.data.storageRoot,
        })
      : await updateStorageSettings({ backend: "s3", s3: parsed.data.s3 });

  // Storage backend changes are infrastructure-level — every super admin should know.
  void notifyByRole(["owner"], {
    kind: "warning",
    event: "settings.storage.updated",
    title:
      updated.storageBackend === "s3"
        ? "Storage switched to S3-compatible bucket"
        : "Storage switched to local filesystem",
    body: `${me.name ?? me.email} changed the storage backend. Existing files are not migrated automatically.`,
    link: "/settings",
    data: {
      backend: updated.storageBackend,
      bucket: updated.s3Bucket,
      endpoint: updated.s3Endpoint,
      storageRoot: updated.storageRoot,
    },
  });

  const { s3SecretAccessKey, ...safe } = updated;
  void s3SecretAccessKey;
  return NextResponse.json({ ...safe, hasS3Secret: !!s3SecretAccessKey });
}

export const GET = withLogging(_get);
export const PATCH = withLogging(_patch);
