"use client";

import { useEffect, useRef, useState } from "react";
import { useUI } from "@/stores/ui-store";

/**
 * Window-level drop overlay. Catches file drops anywhere on the page and
 * routes them into the upload modal.
 *
 * IMPORTANT: when the upload modal is already open, ALL window-level drag
 * handlers are short-circuited. Otherwise the modal's own drop zone and this
 * overlay both consume the same drop event and the files get added twice
 * (or the modal pops on top of itself). We mirror `uploadOpen` and
 * `currentFolder` into refs (updated post-commit via an effect) so the
 * window listeners read the latest values without re-binding the listeners
 * on every render. Writing to refs during render is disallowed under React
 * 19 concurrent mode, hence the explicit sync effect.
 */
export default function DropOverlay() {
  const [dragging, setDragging] = useState(false);
  const { openUpload, setPendingDroppedFiles, uploadOpen, currentFolder } = useUI();

  // Refs that mirror the latest prop/store values, synced after commit. The
  // window listeners (registered once on mount) read these to short-circuit
  // when the modal is open and to default the destination folder.
  const isOpenRef = useRef(uploadOpen);
  const currentFolderRef = useRef(currentFolder);
  useEffect(() => {
    isOpenRef.current = uploadOpen;
    currentFolderRef.current = currentFolder;
  });

  // Derive the on-screen drag state instead of mutating it from an effect.
  // While the upload modal is open, the overlay must never be visible — even
  // mid-drag — so we mask `dragging` with `!uploadOpen`.
  const effectiveDragging = dragging && !uploadOpen;

  useEffect(() => {
    let count = 0;

    function hasFiles(e: DragEvent) {
      const types = e.dataTransfer?.types;
      if (!types) return false;
      for (let i = 0; i < types.length; i++) {
        if (types[i] === "Files") return true;
      }
      return false;
    }

    function onEnter(e: DragEvent) {
      if (isOpenRef.current) return; // modal handles its own drop zone
      if (!hasFiles(e)) return;
      count++;
      setDragging(true);
    }
    function onLeave(e: DragEvent) {
      if (isOpenRef.current) return;
      if (!hasFiles(e)) return;
      count--;
      if (count <= 0) {
        count = 0;
        setDragging(false);
      }
    }
    function onDrop(e: DragEvent) {
      if (isOpenRef.current) return; // let the modal's own onDrop handle it
      e.preventDefault();
      count = 0;
      setDragging(false);
      const dropped = e.dataTransfer?.files;
      if (!dropped || dropped.length === 0) return;
      const files = Array.from(dropped);
      setPendingDroppedFiles(files);
      // If the user is currently viewing a folder/subfolder page, default
      // the upload destination to that folder. The picker will still show
      // it pre-selected so the user can override if they want.
      openUpload(currentFolderRef.current ?? undefined);
    }
    function onOver(e: DragEvent) {
      if (isOpenRef.current) return;
      if (!hasFiles(e)) return;
      e.preventDefault();
    }

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragover", onOver);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragover", onOver);
    };
  }, [openUpload, setPendingDroppedFiles]);

  return (
    <div className="drop-overlay" style={effectiveDragging ? { display: "flex" } : undefined}>
      {currentFolder
        ? <>drop anywhere — files will land in <em>&ldquo;{currentFolder.folderName}&rdquo;</em></>
        : <>drop anywhere — choose where it goes next</>}
    </div>
  );
}
