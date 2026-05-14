import { canCreate, requireSessionUser } from "@/lib/auth-helpers";
import { listVisibleFolders } from "@/lib/data/folders";
import Greeting from "@/components/home/Greeting";
import LiveStatus from "@/components/home/LiveStatus";
import DropZone from "@/components/home/DropZone";
import WorkspaceSection from "@/components/workspace/WorkspaceSection";

export default async function HomePage() {
  const me = await requireSessionUser();
  const folders = me ? await listVisibleFolders(me.id) : [];
  const allowCreate = me ? canCreate(me.workspaceRole) : false;

  return (
    <main className="page">
      <div className="home-hero">
        <Greeting />
        <LiveStatus />
        <DropZone canCreate={allowCreate} />
      </div>
      <WorkspaceSection folders={folders} currentUserId={me?.id ?? null} canCreate={allowCreate} />
    </main>
  );
}
