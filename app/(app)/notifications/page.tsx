import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth-helpers";
import { listNotifications } from "@/lib/data/notifications";
import NotificationsClient from "@/components/notifications/NotificationsClient";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const me = await requireSessionUser();
  if (!me) redirect("/login");

  const initial = await listNotifications(me.id, { limit: 50 });
  // Server-Component-safe payload — pre-serialise dates so the client receives
  // plain JSON-compatible primitives.
  return (
    <NotificationsClient
      initial={{
        items: initial.items.map((n) => ({
          id: n.id,
          kind: n.kind,
          event: n.event,
          title: n.title,
          body: n.body,
          link: n.link,
          data: n.data,
          readAt: n.readAt ? n.readAt.toISOString() : null,
          createdAt: n.createdAt.toISOString(),
        })),
        unread: initial.unread,
        total: initial.total,
      }}
    />
  );
}
