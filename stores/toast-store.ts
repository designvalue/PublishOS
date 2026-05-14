"use client";

import { create } from "zustand";

type ToastState = {
  open: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  show: (message: string, actionLabel?: string, onAction?: () => void) => void;
  hide: () => void;
};

let timer: ReturnType<typeof setTimeout> | null = null;

export const useToast = create<ToastState>((set) => ({
  open: false,
  message: "",
  show: (message, actionLabel, onAction) => {
    if (timer) clearTimeout(timer);
    set({ open: true, message, actionLabel, onAction });
    timer = setTimeout(() => set({ open: false }), 3500);
  },
  hide: () => {
    if (timer) clearTimeout(timer);
    set({ open: false });
  },
}));

export function toast(message: string, actionLabel?: string, onAction?: () => void) {
  useToast.getState().show(message, actionLabel, onAction);
}
