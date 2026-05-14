import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth-helpers";
import { getLiveFeed } from "@/lib/data/live-feed";
import { withLogging } from "@/lib/logged-handler";

/**
 * GET /api/live-feed → `{ items: LiveFeedItem[] }`
 *
 * Aggregates a rotating set of workspace facts (file counts, storage, live
 * visitors, unread notifications, recent uploads) so the home page can show
 * a real live ticker instead of placeholder marketing text.
 */
async function _get() {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await getLiveFeed(me.id);
  return NextResponse.json({ items });
}

export const GET = withLogging(_get);
