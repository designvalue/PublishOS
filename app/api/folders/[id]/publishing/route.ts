import { NextResponse } from "next/server";
import { withLogging } from "@/lib/logged-handler";

// Folder-level publishing was removed: folders are organisational containers
// only, and never publicly accessible. Publishing now lives on individual
// files via PATCH /api/files/[id]/publishing.
async function _patch() {
  return NextResponse.json(
    { error: "Folders cannot be published. Publish individual files instead." },
    { status: 410 },
  );
}

export const PATCH = withLogging(_patch);
