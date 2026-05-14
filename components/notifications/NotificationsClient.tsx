"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/stores/toast-store";

type Kind = "info" | "success" | "warning" | "danger";

type Notification = {
  id: string;
  kind: Kind;
  event: string;
  title: string;
  body: string | null;
  link: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

type Initial = {
  items: Notification[];
  unread: number;
  total: number;
};

type Filter = "all" | "unread";

export default function NotificationsClient({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>(initial.items);
  const [unread, setUnread] = useState(initial.unread);
  const [total, setTotal] = useState(initial.total);
  const [filter, setFilter] = useState<Filter>("all");

  const visible = filter === "unread" ? items.filter((n) => !n.readAt) : items;

  async function markOneRead(id: string) {
    setItems((cur) => cur.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnread((u) => Math.max(0, u - 1));
    await fetch(`/api/notifications/${id}`, { method: "POST" }).catch(() => undefined);
  }

  async function markAllRead() {
    if (unread === 0) return;
    const now = new Date().toISOString();
    setItems((cur) => cur.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    setUnread(0);
    const res = await fetch("/api/notifications/mark-all-read", { method: "POST" });
    if (!res.ok) toast("Could not mark all as read.");
  }

  async function dismiss(id: string) {
    const wasUnread = items.find((n) => n.id === id && !n.readAt);
    setItems((cur) => cur.filter((n) => n.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    if (wasUnread) setUnread((u) => Math.max(0, u - 1));
    await fetch(`/api/notifications/${id}`, { method: "DELETE" }).catch(() => undefined);
  }

  async function clearAll() {
    if (total === 0) return;
    setItems([]);
    setTotal(0);
    setUnread(0);
    const res = await fetch("/api/notifications/clear-all", { method: "POST" });
    if (!res.ok) toast("Could not clear notifications.");
  }

  function openLink(n: Notification) {
    if (!n.readAt) void markOneRead(n.id);
    if (n.link) router.push(n.link);
  }

  return (
    <main className="page notifs-page">
      <div className="notifs-head">
        <p className="eyebrow">Inbox</p>
        <h1 className="notifs-title">
          <span className="it">Notifications</span>
        </h1>
        <p className="notifs-sub">
          Workspace activity that mentioned you or that you should know about. Notifications older than 90 days
          are automatically removed.
        </p>
      </div>

      <div className="notifs-toolbar">
        <div className="notifs-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            className={`notifs-tab${filter === "all" ? " is-active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All <span className="notifs-tab-count">{total}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "unread"}
            className={`notifs-tab${filter === "unread" ? " is-active" : ""}`}
            onClick={() => setFilter("unread")}
          >
            Unread <span className="notifs-tab-count">{unread}</span>
          </button>
        </div>
        <div className="notifs-actions">
          <button className="btn" onClick={markAllRead} disabled={unread === 0}>
            Mark all read
          </button>
          <button className="btn btn-danger" onClick={clearAll} disabled={total === 0}>
            Clear all
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="notifs-empty">
          <div className="notifs-empty-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7.5 12.5l3 3 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="notifs-empty-title">
            {filter === "unread" ? "Nothing unread" : "You're all caught up"}
          </div>
          <div className="notifs-empty-body">
            Publishing changes, invites, and account events will show up here.
          </div>
        </div>
      ) : (
        <ul className="notifs-list">
          {visible.map((n) => (
            <li
              key={n.id}
              className={`notifs-row kind-${n.kind}${n.readAt ? "" : " is-unread"}${n.link ? " has-link" : ""}`}
              onClick={() => openLink(n)}
            >
              <span className="notifs-dot" aria-hidden="true" />
              <div className="notifs-row-main">
                <div className="notifs-row-title">{n.title}</div>
                {n.body && <div className="notifs-row-body">{n.body}</div>}
                <div className="notifs-row-meta">
                  <time dateTime={n.createdAt}>{formatTime(n.createdAt)}</time>
                  <span className="notifs-row-event">{prettyEvent(n.event)}</span>
                  {n.link && (
                    <Link
                      href={n.link}
                      className="notifs-row-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open →
                    </Link>
                  )}
                </div>
              </div>
              <div className="notifs-row-actions" onClick={(e) => e.stopPropagation()}>
                {!n.readAt && (
                  <button type="button" className="notifs-row-act" onClick={() => markOneRead(n.id)} title="Mark as read">
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
                <button type="button" className="notifs-row-act" onClick={() => dismiss(n.id)} title="Dismiss">
                  <svg viewBox="0 0 16 16" fill="none">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function prettyEvent(event: string): string {
  // "file.published" → "File · published"
  const [head, ...rest] = event.split(".");
  if (rest.length === 0) return cap(event);
  return `${cap(head)} · ${rest.map(cap).join(" ")}`;
}
function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1).replace(/-/g, " ") : s;
}
function formatTime(t: string): string {
  const d = new Date(t);
  const ms = Date.now() - d.getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
