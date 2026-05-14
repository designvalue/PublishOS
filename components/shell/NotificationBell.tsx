"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Kind = "info" | "success" | "warning" | "danger";

export type Notification = {
  id: string;
  kind: Kind;
  event: string;
  title: string;
  body: string | null;
  link: string | null;
  data: Record<string, unknown> | null;
  readAt: string | number | null;
  createdAt: string | number;
};

type FeedResponse = {
  items: Notification[];
  unread: number;
  total: number;
};

const POLL_MS = 30_000;
const PAGE_SIZE = 25;

/**
 * Notification bell in the top bar.
 *
 * - Polls `/api/notifications/unread` every 30s for the badge count.
 * - Fetches the full feed only when the drawer is opened (cheap close).
 * - Mark-read fires optimistically with a server confirmation; failures
 *   silently rewind the local state on next poll.
 */
export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // ---------- polling ----------
  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread", { cache: "no-store", credentials: "include" });
      if (!res.ok) return;
      const json = (await res.json()) as { unread: number };
      setUnread(json.unread);
    } catch {
      /* swallow */
    }
  }, []);

  // Polling effect: refresh the unread count on mount and every POLL_MS.
  // Canonical "subscribe to external state" pattern — fetch+setState fires
  // inside an async callback rather than synchronously in the effect body.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshCount();
    const t = setInterval(refreshCount, POLL_MS);
    return () => clearInterval(t);
  }, [refreshCount]);

  // ---------- full feed (on open) ----------
  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/notifications?limit=${PAGE_SIZE}`, { cache: "no-store", credentials: "include" });
      if (!res.ok) throw new Error("Could not load notifications.");
      const json = (await res.json()) as FeedResponse;
      setItems(json.items);
      setUnread(json.unread);
      setTotal(json.total);
    } catch (e) {
      setError((e as Error).message || "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load the full feed when the bell is opened. Fetch-on-trigger pattern;
  // setState happens inside the async `loadFeed` callback.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) loadFeed();
  }, [open, loadFeed]);

  // ---------- outside click + ESC ----------
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // ---------- actions ----------
  async function markOneRead(id: string) {
    setItems((cur) => cur.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: Date.now() } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await fetch(`/api/notifications/${id}`, { method: "POST", credentials: "include" });
    } catch {
      /* swallow — next poll corrects */
    }
  }

  async function markAllRead() {
    if (unread === 0) return;
    const now = Date.now();
    setItems((cur) => cur.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    setUnread(0);
    try {
      await fetch("/api/notifications/mark-all-read", { method: "POST", credentials: "include" });
    } catch {
      /* swallow */
    }
  }

  async function dismiss(id: string) {
    const wasUnread = items.find((n) => n.id === id && !n.readAt);
    setItems((cur) => cur.filter((n) => n.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    if (wasUnread) setUnread((u) => Math.max(0, u - 1));
    try {
      await fetch(`/api/notifications/${id}`, { method: "DELETE", credentials: "include" });
    } catch {
      /* swallow */
    }
  }

  async function clearAll() {
    if (total === 0) return;
    setItems([]);
    setTotal(0);
    setUnread(0);
    try {
      await fetch("/api/notifications/clear-all", { method: "POST", credentials: "include" });
    } catch {
      /* swallow */
    }
  }

  function onItemClick(n: Notification) {
    if (!n.readAt) void markOneRead(n.id);
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  }

  const badgeLabel = useMemo(() => (unread > 99 ? "99+" : String(unread)), [unread]);

  return (
    <div className="bell-wrap">
      <button
        ref={btnRef}
        type="button"
        className={`bell-btn${unread > 0 ? " has-unread" : ""}${open ? " is-open" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <svg className="bell-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M3.5 11.5h9l-.95-1.3a3 3 0 01-.55-1.7V6.6A3.1 3.1 0 008 3.5a3.1 3.1 0 00-3 3.1v1.9a3 3 0 01-.55 1.7l-.95 1.3z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M6.6 13.2c.3.6.8.95 1.4.95.6 0 1.1-.35 1.4-.95" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span className="bell-badge" aria-hidden="true">
            {badgeLabel}
          </span>
        )}
      </button>

      <div ref={panelRef} className={`bell-panel${open ? " open" : ""}`} role="dialog" aria-label="Notifications">
        <header className="bell-panel-head">
          <div>
            <div className="bell-panel-title">Notifications</div>
            <div className="bell-panel-sub">
              {total === 0
                ? "All caught up."
                : `${unread} unread · ${total} total`}
            </div>
          </div>
          <div className="bell-panel-actions">
            <button
              type="button"
              className="bell-link"
              onClick={markAllRead}
              disabled={unread === 0}
              title="Mark every notification as read"
            >
              Mark all read
            </button>
            <button
              type="button"
              className="bell-link bell-link-danger"
              onClick={clearAll}
              disabled={total === 0}
              title="Permanently remove every notification"
            >
              Clear all
            </button>
          </div>
        </header>

        <div className="bell-list">
          {loading && items.length === 0 ? (
            <BellEmpty
              icon="loading"
              title="Loading…"
              body="Fetching your latest notifications."
            />
          ) : error ? (
            <BellEmpty icon="warn" title="Could not load" body={error} />
          ) : items.length === 0 ? (
            <BellEmpty
              icon="check"
              title="No notifications"
              body="You'll see publishing, sharing, and account updates here."
            />
          ) : (
            items.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                onClick={() => onItemClick(n)}
                onDismiss={() => dismiss(n.id)}
                onMarkRead={() => markOneRead(n.id)}
              />
            ))
          )}
        </div>

        <footer className="bell-panel-foot">
          <Link
            href="/notifications"
            className="bell-foot-link"
            onClick={() => setOpen(false)}
          >
            View all notifications →
          </Link>
        </footer>
      </div>
    </div>
  );
}

/* ============================================================
   Row
   ============================================================ */
function NotificationRow({
  n,
  onClick,
  onDismiss,
  onMarkRead,
}: {
  n: Notification;
  onClick: () => void;
  onDismiss: () => void;
  onMarkRead: () => void;
}) {
  const isUnread = !n.readAt;
  return (
    <div
      className={`bell-row kind-${n.kind}${isUnread ? " is-unread" : ""}${n.link ? " has-link" : ""}`}
      onClick={onClick}
      role={n.link ? "button" : undefined}
      tabIndex={n.link ? 0 : undefined}
      onKeyDown={(e) => {
        if (!n.link) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <span className="bell-row-dot" aria-hidden="true" />
      <div className="bell-row-body">
        <div className="bell-row-title">{n.title}</div>
        {n.body && <div className="bell-row-sub">{n.body}</div>}
        <div className="bell-row-time">{formatTime(n.createdAt)}</div>
      </div>
      <div className="bell-row-actions">
        {isUnread && (
          <button
            type="button"
            className="bell-row-act"
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead();
            }}
            title="Mark as read"
            aria-label="Mark as read"
          >
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <button
          type="button"
          className="bell-row-act"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          title="Dismiss"
          aria-label="Dismiss"
        >
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function BellEmpty({ icon, title, body }: { icon: "check" | "warn" | "loading"; title: string; body: string }) {
  return (
    <div className="bell-empty">
      <div className={`bell-empty-ico ico-${icon}`} aria-hidden="true">
        {icon === "check" && (
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7.5 12.5l3 3 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {icon === "warn" && (
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 4l9 16H3l9-16z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M12 10v4M12 17v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        )}
        {icon === "loading" && (
          <svg viewBox="0 0 24 24" fill="none" className="bell-spin">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.25" />
            <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div className="bell-empty-title">{title}</div>
      <div className="bell-empty-body">{body}</div>
    </div>
  );
}

/* ============================================================
   Util
   ============================================================ */
function formatTime(t: string | number | Date): string {
  const d = t instanceof Date ? t : new Date(t);
  const ms = Date.now() - d.getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
