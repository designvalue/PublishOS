"use client";

import { useEffect, useState } from "react";
import { useUI } from "@/stores/ui-store";

export default function ConfirmDialog() {
  const { confirm, closeConfirm } = useUI();
  const [busy, setBusy] = useState(false);

  // Reset the busy flag whenever a fresh confirm is opened. This is the
  // canonical "reset local state when the modal opens with a new payload"
  // pattern — flagged by React 19's set-state-in-effect rule because
  // setState during an effect can cascade, but here the cascade is bounded
  // (one extra render when the dialog opens) and the alternative (key prop
  // remount) would force changes at every call site.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (confirm) setBusy(false);
  }, [confirm]);

  // ESC closes (when not busy).
  useEffect(() => {
    if (!confirm) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) closeConfirm();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirm, busy, closeConfirm]);

  if (!confirm) return null;

  async function run() {
    if (!confirm) return;
    setBusy(true);
    try {
      await confirm.onConfirm();
    } finally {
      setBusy(false);
      closeConfirm();
    }
  }

  return (
    <>
      <div className="modal-backdrop open" onClick={() => !busy && closeConfirm()} />
      <div
        className="modal modal-confirm open"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-confirm-body">
          <h2 className="modal-title">{confirm.title}</h2>
          {confirm.description ? <p className="modal-confirm-desc">{confirm.description}</p> : null}
        </div>
        <div className="modal-footer">
          <span className="left" />
          <div className="right">
            <button className="btn" type="button" onClick={closeConfirm} disabled={busy}>
              {confirm.cancelLabel ?? "Cancel"}
            </button>
            <button
              className={confirm.danger ? "btn btn-danger" : "btn btn-primary"}
              type="button"
              onClick={run}
              disabled={busy}
              autoFocus
            >
              {busy ? "…" : (confirm.confirmLabel ?? "Confirm")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
