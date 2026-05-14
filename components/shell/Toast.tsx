"use client";

import { useToast } from "@/stores/toast-store";

export default function Toast() {
  const { open, message, actionLabel, onAction, hide } = useToast();
  return (
    <div className={`toast${open ? " open" : ""}`}>
      <span className="toast-dot" />
      <span className="toast-msg">{message}</span>
      {actionLabel && onAction ? (
        <span
          className="toast-action"
          onClick={() => {
            onAction();
            hide();
          }}
        >
          {actionLabel}
        </span>
      ) : null}
    </div>
  );
}
