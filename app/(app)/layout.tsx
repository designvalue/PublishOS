import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserById, touchLastActive } from "@/lib/data/users";
import Header from "@/components/shell/Header";
import Footer from "@/components/shell/Footer";
import KeyboardShortcuts from "@/components/shell/KeyboardShortcuts";
import Toast from "@/components/shell/Toast";
import DropOverlay from "@/components/shell/DropOverlay";
import ShareDrawer from "@/components/share/ShareDrawer";
import SearchPalette from "@/components/search/SearchPalette";
import ActionMenu from "@/components/menus/ActionMenu";
import SortMenu from "@/components/menus/SortMenu";
import NewFolderModal from "@/components/modals/NewFolderModal";
import UploadModal from "@/components/modals/UploadModal";
import MoveFolderModal from "@/components/modals/MoveFolderModal";
import ConfirmDialog from "@/components/modals/ConfirmDialog";
import RenameDialog from "@/components/modals/RenameDialog";
import MustChangePasswordBanner from "@/components/shell/MustChangePasswordBanner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const me = await getUserById(session.user.id);
  if (!me) redirect("/login");

  // Fire-and-forget last-active timestamp bump.
  void touchLastActive(me.id);

  return (
    <>
      <Header workspaceRole={me.workspaceRole} />
      {me.mustChangePassword ? <MustChangePasswordBanner /> : null}
      {children}
      <Footer />
      <DropOverlay />
      <ShareDrawer />
      <SearchPalette />
      <ActionMenu />
      <SortMenu />
      <NewFolderModal />
      <UploadModal />
      <MoveFolderModal />
      <RenameDialog />
      <ConfirmDialog />
      <Toast />
      <KeyboardShortcuts />
    </>
  );
}
