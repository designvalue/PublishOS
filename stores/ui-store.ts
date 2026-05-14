"use client";

import { create } from "zustand";

export type ShareTarget = {
  // The id of the folder OR file being shared, depending on `kind`.
  folderId: string;
  name: string;
  url?: string;
  vis: "private" | "shared" | "public" | "protected";
  // "folder" opens access (people + teams). "file" opens publishing controls.
  kind?: "folder" | "file";
};

export type ActionMenuKind = "folder" | "subfolder" | "file";
export type ActionMenuTarget = {
  kind: ActionMenuKind;
  name: string;
  id?: string;
  draft?: boolean;
  x: number;
  y: number;
  align?: "right";
  /**
   * Publishing state for files. When `publishMode` is "public" or "password"
   * AND `publicSlug` is set, the action menu surfaces "Visit live site" and
   * "Copy public URL". Folders never publish so these are unused there.
   */
  publishMode?: "off" | "public" | "password";
  publicSlug?: string | null;
  /** File MIME — used to decide whether to surface zip-only actions. */
  mime?: string;
};

export type SortKey = "modified" | "added" | "name" | "size" | "type" | "visits" | "owner";
export type SortDirection = "asc" | "desc";

export type UploadTarget = { folderId: string; folderName: string } | null;
export type NewFolderTarget = { parentId: string; parentName: string } | null;

export type ConfirmRequest = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
};

export type RenameTarget = {
  kind: "folder" | "file";
  id: string;
  currentName: string;
};

type UIState = {
  share: ShareTarget | null;
  newFolderOpen: boolean;
  newFolderParent: NewFolderTarget;
  uploadOpen: boolean;
  uploadTarget: UploadTarget;
  /**
   * The folder page the user is currently viewing. Registered by folder
   * pages on mount and cleared on unmount. Used by the global drop overlay
   * so window-level file drops default to the current folder.
   */
  currentFolder: { folderId: string; folderName: string } | null;
  setCurrentFolder: (f: { folderId: string; folderName: string } | null) => void;
  search: boolean;
  meDropdown: boolean;
  actionMenu: ActionMenuTarget | null;
  sortMenu: { x: number; y: number } | null;
  sortKey: SortKey;
  sortLabel: string;
  sortDir: SortDirection;
  workspaceTab: "all" | "mine" | "shared" | "org";
  openShare: (t: ShareTarget) => void;
  closeShare: () => void;
  openNewFolder: (parent?: NewFolderTarget) => void;
  closeNewFolder: () => void;
  openUpload: (target?: UploadTarget) => void;
  closeUpload: () => void;
  pendingDroppedFiles: File[];
  setPendingDroppedFiles: (files: File[]) => void;
  moveTarget: { folderId: string; folderName: string; kind?: "folder" | "file" } | null;
  openMove: (target: { folderId: string; folderName: string; kind?: "folder" | "file" }) => void;
  closeMove: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  toggleMe: () => void;
  closeMe: () => void;
  openActionMenu: (t: ActionMenuTarget) => void;
  closeActionMenu: () => void;
  openSortMenu: (p: { x: number; y: number }) => void;
  closeSortMenu: () => void;
  setSort: (key: SortKey, label: string) => void;
  setSortDir: (dir: SortDirection) => void;
  setWorkspaceTab: (t: "all" | "mine" | "shared" | "org") => void;
  confirm: ConfirmRequest | null;
  openConfirm: (req: ConfirmRequest) => void;
  closeConfirm: () => void;
  rename: RenameTarget | null;
  openRename: (target: RenameTarget) => void;
  closeRename: () => void;
  closeAll: () => void;
};

export const useUI = create<UIState>((set) => ({
  share: null,
  newFolderOpen: false,
  newFolderParent: null,
  uploadOpen: false,
  uploadTarget: null,
  currentFolder: null,
  setCurrentFolder: (f) => set({ currentFolder: f }),
  search: false,
  meDropdown: false,
  actionMenu: null,
  sortMenu: null,
  sortKey: "modified",
  sortLabel: "Modified",
  sortDir: "desc",
  workspaceTab: "all",

  openShare: (t) => set({ share: t }),
  closeShare: () => set({ share: null }),
  openNewFolder: (parent) => set({ newFolderOpen: true, newFolderParent: parent ?? null }),
  closeNewFolder: () => set({ newFolderOpen: false, newFolderParent: null }),
  openUpload: (target) => set({ uploadOpen: true, uploadTarget: target ?? null }),
  closeUpload: () => set({ uploadOpen: false, pendingDroppedFiles: [] }),
  pendingDroppedFiles: [],
  setPendingDroppedFiles: (files) => set({ pendingDroppedFiles: files }),
  moveTarget: null,
  openMove: (target) => set({ moveTarget: target }),
  closeMove: () => set({ moveTarget: null }),
  openSearch: () => set({ search: true }),
  closeSearch: () => set({ search: false }),
  toggleMe: () => set((s) => ({ meDropdown: !s.meDropdown })),
  closeMe: () => set({ meDropdown: false }),
  openActionMenu: (t) => set({ actionMenu: t }),
  closeActionMenu: () => set({ actionMenu: null }),
  openSortMenu: (p) => set({ sortMenu: p }),
  closeSortMenu: () => set({ sortMenu: null }),
  setSort: (key, label) => set({ sortKey: key, sortLabel: label }),
  setSortDir: (dir) => set({ sortDir: dir }),
  setWorkspaceTab: (t) => set({ workspaceTab: t }),

  confirm: null,
  openConfirm: (req) => set({ confirm: req }),
  closeConfirm: () => set({ confirm: null }),
  rename: null,
  openRename: (target) => set({ rename: target }),
  closeRename: () => set({ rename: null }),

  closeAll: () =>
    set({
      share: null,
      newFolderOpen: false,
      uploadOpen: false,
      search: false,
      meDropdown: false,
      actionMenu: null,
      sortMenu: null,
      moveTarget: null,
      confirm: null,
      rename: null,
    }),
}));
