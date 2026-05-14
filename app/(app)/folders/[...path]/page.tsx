import { notFound } from "next/navigation";
import { canCreate, requireSessionUser } from "@/lib/auth-helpers";
import {
  ancestorChain,
  countSubfoldersAndFiles,
  getFolderById,
  listAllAccessibleFolders,
  listChildren,
  listFiles,
} from "@/lib/data/folders";
import FolderDetail from "@/components/folder/FolderDetail";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const me = await requireSessionUser();
  if (!me) return notFound();

  const { path } = await params;
  const folderId = path[path.length - 1];
  const folder = await getFolderById(folderId, me.id);
  if (!folder) return notFound();

  const [chain, children, files, counts, allFolders] = await Promise.all([
    ancestorChain(folder.id),
    listChildren(folder.id),
    listFiles(folder.id),
    countSubfoldersAndFiles(folder.id),
    listAllAccessibleFolders(me.id),
  ]);

  return (
    <FolderDetail
      folder={folder}
      ancestors={chain.slice(0, -1)}
      subfolders={children}
      files={files}
      counts={counts}
      allFolders={allFolders}
      isOwner={folder.ownerId === me.id}
      canCreate={canCreate(me.workspaceRole)}
    />
  );
}
