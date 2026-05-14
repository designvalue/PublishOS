"use client";

import { useEffect } from "react";
import { useUI } from "@/stores/ui-store";

export default function KeyboardShortcuts() {
  const { openSearch, closeAll } = useUI();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        openSearch();
      }
      if (e.key === "Escape") {
        closeAll();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openSearch, closeAll]);

  return null;
}
