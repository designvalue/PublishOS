"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/stores/toast-store";
import { formatBytes, formatRelative } from "@/lib/format";

type Breakdown = { key: string; count: number };
type Payload = {
  file: {
    id: string;
    name: string;
    folderId: string;
    folderName: string;
    mime: string;
    sizeBytes: number;
    publishMode: "off" | "public" | "password";
    publicSlug: string | null;
  };
  window: { days: number; from: string; to: string; label: string };
  totals: {
    visitors: number;
    pageViews: number;
    bounceRate: number;
    realtimeVisitors: number;
  };
  trend: { pageViews: { current: number; prev: number; deltaPct: number | null } };
  daily: { day: string; pageViews: number; visitors: number }[];
  statusBuckets: Record<string, number>;
  byBrowser: Breakdown[];
  byOS: Breakdown[];
  byDevice: Breakdown[];
  byCountry: Breakdown[];
  recent: {
    id: string;
    occurredAt: string;
    status: number;
    ip: string | null;
    userAgent: string | null;
  }[];
};

type Preset = "7" | "30" | "90" | "custom";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function FileStatsClient({ fileId }: { fileId: string }) {
  const router = useRouter();
  const [preset, setPreset] = useState<Preset>("30");
  const [customFrom, setCustomFrom] = useState<string>(daysAgoISO(13));
  const [customTo, setCustomTo] = useState<string>(todayISO());
  const [customOpen, setCustomOpen] = useState(false);
  const [data, setData] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const customRef = useRef<HTMLDivElement>(null);

  const queryString = useMemo(() => {
    if (preset === "custom") return `from=${customFrom}&to=${customTo}`;
    return `window=${preset}`;
  }, [preset, customFrom, customTo]);

  // Fetch payload when query/file changes. `setData(null)` clears the chart
  // while loading. Canonical fetch-on-dep-change pattern; trailing setState
  // happens inside an async then() callback.
  useEffect(() => {
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setData(null);
    setLoadError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    fetch(`/api/files/${fileId}/stats?${queryString}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<Payload>;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [fileId, queryString]);

  // Live re-poll every 20s.
  useEffect(() => {
    if (!data) return;
    const id = window.setInterval(() => {
      fetch(`/api/files/${fileId}/stats?${queryString}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((body: Payload | null) => {
          if (body) setData(body);
        })
        .catch(() => undefined);
    }, 20_000);
    return () => window.clearInterval(id);
  }, [fileId, queryString, data]);

  useEffect(() => {
    if (!customOpen) return;
    function onClick(e: MouseEvent) {
      if (customRef.current && !customRef.current.contains(e.target as Node)) {
        setCustomOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [customOpen]);

  if (loadError) {
    return (
      <main className="page">
        <div className="empty-state">
          <div className="empty-title">Stats unavailable</div>
          <div className="empty-desc">{loadError}</div>
        </div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="page">
        <div className="stats-loading">Loading…</div>
      </main>
    );
  }

  const { file, totals, trend, daily, statusBuckets, byBrowser, byOS, byDevice, byCountry, recent } = data;
  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/c/${file.publicSlug ?? file.id}`
      : `/c/${file.publicSlug ?? file.id}`;
  const isPublished = file.publishMode !== "off";
  const windowLabel =
    preset === "custom"
      ? `${customFrom} → ${customTo}`
      : preset === "7"
        ? "7 days"
        : preset === "30"
          ? "30 days"
          : "90 days";

  return (
    <main className="page">
      <div className="crumbs" style={{ marginBottom: 8 }}>
        <Link href="/">Home</Link>
        <span className="sep"> / </span>
        <Link href={`/folders/${file.folderId}`}>{file.folderName}</Link>
        <span className="sep"> / </span>
        <span className="here">{file.name}</span>
      </div>

      <div className="stats-head">
        <div>
          <p className="eyebrow">
            {preset === "custom" ? "Custom range" : `Last ${windowLabel}`}
            {totals.realtimeVisitors > 0 ? (
              <span className="stats-realtime">
                <span className="stats-realtime-dot" /> {totals.realtimeVisitors} online now
              </span>
            ) : null}
          </p>
          <h1 className="stats-title">{file.name}</h1>
          <p className="stats-sub">
            {formatBytes(file.sizeBytes)} · {file.mime}
            {" · "}
            {isPublished ? (
              <>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="stats-publiclink">
                  {publicUrl.replace(/^https?:\/\//, "")}
                </a>
                {file.publishMode === "password" ? " · Password protected" : null}
              </>
            ) : (
              <span className="stats-unpublished">Not published</span>
            )}
          </p>
        </div>
        <div className="actions" style={{ position: "relative" }}>
          <div className="stats-window-toggle" role="tablist" aria-label="Time window">
            {(["7", "30", "90"] as const).map((w) => (
              <button
                key={w}
                type="button"
                role="tab"
                aria-selected={preset === w}
                className={`stats-window-btn${preset === w ? " is-active" : ""}`}
                onClick={() => {
                  setPreset(w);
                  setCustomOpen(false);
                }}
              >
                {w}d
              </button>
            ))}
            <button
              type="button"
              className={`stats-window-btn${preset === "custom" ? " is-active" : ""}`}
              onClick={() => {
                setPreset("custom");
                setCustomOpen((v) => !v);
              }}
            >
              Custom
            </button>
          </div>
          {customOpen && (
            <div ref={customRef} className="stats-custom-popover">
              <div className="stats-custom-row">
                <label className="stats-custom-label">From</label>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div className="stats-custom-row">
                <label className="stats-custom-label">To</label>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  max={todayISO()}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
              <div className="stats-custom-presets">
                <button type="button" className="stats-custom-preset"
                  onClick={() => { setCustomFrom(daysAgoISO(0)); setCustomTo(todayISO()); }}>Today</button>
                <button type="button" className="stats-custom-preset"
                  onClick={() => { setCustomFrom(daysAgoISO(1)); setCustomTo(daysAgoISO(1)); }}>Yesterday</button>
                <button type="button" className="stats-custom-preset"
                  onClick={() => { setCustomFrom(daysAgoISO(6)); setCustomTo(todayISO()); }}>Last 7d</button>
                <button type="button" className="stats-custom-preset"
                  onClick={() => { setCustomFrom(daysAgoISO(29)); setCustomTo(todayISO()); }}>Last 30d</button>
              </div>
            </div>
          )}
          {isPublished ? (
            <button
              className="btn"
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(publicUrl);
                  toast("Link copied");
                } catch {
                  toast(publicUrl);
                }
              }}
            >
              Copy link
            </button>
          ) : null}
          <button className="btn" type="button" onClick={() => router.refresh()}>
            Refresh
          </button>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="stats-totals">
        <Kpi label="Unique visitors" value={totals.visitors} hint={windowLabel} />
        <Kpi label="Page views" value={totals.pageViews} trend={trend.pageViews} />
        <Kpi
          label="Bounce rate"
          valueText={`${totals.bounceRate.toFixed(0)}%`}
          hint={totals.bounceRate >= 70 ? "High" : totals.bounceRate >= 40 ? "Moderate" : "Low"}
        />
        <Kpi
          label="Realtime"
          value={totals.realtimeVisitors}
          hint="Visitors in the last 5 min"
        />
      </div>

      {/* Daily chart */}
      <section className="stats-section">
        <div className="stats-section-h">
          <div className="stats-section-title">Visitors &amp; page views</div>
          <div className="stats-section-sub">UTC days · hover any bar for that day&apos;s breakdown</div>
        </div>
        <DailyChart daily={daily} />
      </section>

      {/* Devices / Browsers / OS / Countries */}
      <section className="stats-section">
        <div className="stats-grid stats-grid-4">
          <BreakdownCard title="Devices" items={byDevice} empty="No visits in this window." />
          <BreakdownCard title="Browsers" items={byBrowser} empty="No visits in this window." />
          <BreakdownCard title="Operating systems" items={byOS} empty="No visits in this window." />
          <BreakdownCard
            title="Countries"
            items={byCountry}
            empty="Geography isn't resolved on this deployment. IPs are still logged for unique-visitor counts; country data populates once a geo lookup is configured."
          />
        </div>
      </section>

      {/* Status breakdown */}
      <section className="stats-section">
        <div className="stats-section-h">
          <div className="stats-section-title">Status breakdown</div>
          <div className="stats-section-sub">How requests resolved over the selected window.</div>
        </div>
        <StatusBars buckets={statusBuckets} />
      </section>

      {/* Recent visits */}
      <section className="stats-section">
        <div className="stats-section-h">
          <div className="stats-section-title">Recent visits</div>
          <div className="stats-section-sub">Last 25 hits — most recent first.</div>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 8 }}>
            <div className="empty-title">No visits yet</div>
            <div className="empty-desc">
              {isPublished
                ? "Visits will appear here within a minute of being received."
                : "Publish this file to start collecting visits."}
            </div>
          </div>
        ) : (
          <div className="stats-events">
            {recent.map((r) => {
              const cls =
                r.status >= 500
                  ? "is-error"
                  : r.status >= 400
                    ? "is-warn"
                    : r.status >= 300
                      ? "is-redirect"
                      : "is-ok";
              return (
                <div key={r.id} className="stats-event">
                  <span className={`stats-status ${cls}`}>{r.status}</span>
                  <span className="stats-event-time">{formatRelative(new Date(r.occurredAt))}</span>
                  <span className="stats-event-ua" title={r.userAgent ?? undefined}>
                    {r.userAgent ? truncate(r.userAgent, 56) : "—"}
                  </span>
                  <span className="stats-event-ip">{r.ip ?? "—"}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

/* ---------- subcomponents (shared style with workspace StatsClient) ---------- */

function Kpi({
  label,
  value,
  valueText,
  hint,
  trend,
}: {
  label: string;
  value?: number;
  valueText?: string;
  hint?: string;
  trend?: { current: number; prev: number; deltaPct: number | null };
}) {
  let trendNode: React.ReactNode = null;
  if (trend) {
    if (trend.deltaPct === null) {
      trendNode = <div className="stats-trend stats-trend-up">▲ new</div>;
    } else if (trend.deltaPct === 0) {
      trendNode = <div className="stats-trend stats-trend-flat">— flat</div>;
    } else {
      const cls = trend.deltaPct > 0 ? "stats-trend-up" : "stats-trend-down";
      trendNode = (
        <div className={`stats-trend ${cls}`}>
          {trend.deltaPct > 0 ? "▲" : "▼"} {Math.abs(trend.deltaPct).toFixed(0)}% vs prev
        </div>
      );
    }
  } else if (hint) {
    trendNode = <div className="stats-trend stats-trend-flat">{hint}</div>;
  }
  return (
    <div className="stats-total">
      <div className="stats-total-label">{label}</div>
      <div className="stats-total-value">{valueText ?? (value ?? 0).toLocaleString()}</div>
      {trendNode}
    </div>
  );
}

function DailyChart({ daily }: { daily: { day: string; pageViews: number; visitors: number }[] }) {
  const max = useMemo(() => Math.max(1, ...daily.map((d) => d.pageViews)), [daily]);
  const labelCount = Math.min(6, daily.length);
  const labelIndices = useMemo(() => {
    if (daily.length <= 1) return [0];
    const step = (daily.length - 1) / (labelCount - 1);
    const set = new Set<number>();
    for (let i = 0; i < labelCount; i++) set.add(Math.round(i * step));
    return [...set].sort((a, b) => a - b);
  }, [daily.length, labelCount]);
  return (
    <div className="stats-chart-wrap">
      <div className="stats-chart-grid" />
      <div
        className="stats-chart"
        style={{ gridTemplateColumns: `repeat(${daily.length}, 1fr)` }}
        role="img"
        aria-label={`Daily visits across ${daily.length} days`}
      >
        {daily.map((d) => {
          const h = (d.pageViews / max) * 100;
          return (
            <div
              key={d.day}
              className="stats-chart-col"
              title={`${d.day} · ${d.pageViews} views · ${d.visitors} visitors`}
            >
              <div className="stats-chart-bar" style={{ height: `${Math.max(h, d.pageViews > 0 ? 2 : 0)}%` }} />
            </div>
          );
        })}
      </div>
      <div
        className="stats-chart-axis"
        style={{ gridTemplateColumns: `repeat(${daily.length}, 1fr)` }}
        aria-hidden="true"
      >
        {daily.map((d, i) => (
          <div key={d.day} className="stats-chart-tick">
            {labelIndices.includes(i) ? formatTick(d.day) : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
function formatTick(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function BreakdownCard({
  title,
  items,
  empty,
}: {
  title: string;
  items: { key: string; count: number; href?: string }[];
  empty: string;
}) {
  const total = useMemo(() => items.reduce((a, b) => a + b.count, 0), [items]);
  return (
    <div className="stats-card">
      <div className="stats-card-h">{title}</div>
      {items.length === 0 || total === 0 ? (
        <div className="stats-empty">{empty}</div>
      ) : (
        <ul className="stats-breakdown">
          {items.slice(0, 8).map((it) => {
            const pct = total > 0 ? (it.count / total) * 100 : 0;
            const inner = (
              <>
                <span className="stats-breakdown-name">{it.key}</span>
                <span className="stats-breakdown-count">{it.count.toLocaleString()}</span>
                <span className="stats-breakdown-track" aria-hidden="true">
                  <span className="stats-breakdown-fill" style={{ width: `${pct}%` }} />
                </span>
              </>
            );
            return (
              <li key={it.key} className="stats-breakdown-row">
                {it.href ? (
                  <Link href={it.href} className="stats-breakdown-link">{inner}</Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusBars({ buckets }: { buckets: Record<string, number> }) {
  const total = Object.values(buckets).reduce((a, b) => a + b, 0);
  const entries = [
    { key: "2xx", label: "Served (2xx)", cls: "is-ok" },
    { key: "3xx", label: "Redirect (3xx)", cls: "is-redirect" },
    { key: "4xx", label: "Blocked / not found (4xx)", cls: "is-warn" },
    { key: "5xx", label: "Error (5xx)", cls: "is-error" },
  ];
  if (total === 0) return <div className="stats-empty">No visits in this window.</div>;
  return (
    <ul className="stats-statusbars">
      {entries.map((e) => {
        const v = buckets[e.key] ?? 0;
        const pct = total > 0 ? (v / total) * 100 : 0;
        return (
          <li key={e.key}>
            <div className="stats-statusbar-label">
              <span>{e.label}</span>
              <span>{v.toLocaleString()}</span>
            </div>
            <div className="stats-statusbar-track">
              <div className={`stats-statusbar-fill ${e.cls}`} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
