"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FILE_ICONS } from "@/lib/icons";
import { formatBytes } from "@/lib/format";

type FileRow = {
  id: string;
  name: string;
  folderId: string;
  folderName: string;
  mime: string;
  sizeBytes: number;
  publishMode: "public" | "password";
  publicSlug: string | null;
  ownerId: string;
  visits: number;
};
type TopFile = {
  id: string;
  name: string;
  folderId: string;
  folderName: string;
  visits: number;
  publishMode: "public" | "password";
};
type Breakdown = { key: string; count: number };
type Payload = {
  window: { days: number; from: string; to: string; label: string };
  totals: {
    visitors: number;
    pageViews: number;
    bounceRate: number;
    files: number;
    byMode: { public: number; password: number };
    realtimeVisitors: number;
  };
  trend: { pageViews: { current: number; prev: number; deltaPct: number | null } };
  daily: { day: string; pageViews: number; visitors: number }[];
  statusBuckets: Record<string, number>;
  byBrowser: Breakdown[];
  byOS: Breakdown[];
  byDevice: Breakdown[];
  byCountry: Breakdown[];
  topFiles: TopFile[];
  files: FileRow[];
};

type Preset = "7" | "30" | "90" | "custom";

function pickIcon(mime: string): keyof typeof FILE_ICONS {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime === "text/html") return "html";
  if (mime === "text/css") return "css";
  if (mime === "application/javascript" || mime === "text/javascript") return "js";
  return "file";
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function StatsClient({ canSeeAll }: { canSeeAll: boolean }) {
  const [preset, setPreset] = useState<Preset>("30");
  const [customFrom, setCustomFrom] = useState<string>(daysAgoISO(13));
  const [customTo, setCustomTo] = useState<string>(todayISO());
  const [customOpen, setCustomOpen] = useState(false);
  const [data, setData] = useState<Payload | null>(null);
  const [query, setQuery] = useState("");
  const customRef = useRef<HTMLDivElement>(null);

  // Build query string for the current range.
  const queryString = useMemo(() => {
    if (preset === "custom") return `from=${customFrom}&to=${customTo}`;
    return `window=${preset}`;
  }, [preset, customFrom, customTo]);

  // Fetch payload when the query window changes. `setData(null)` clears the
  // chart while loading. Canonical fetch-on-dep-change pattern; the trailing
  // setData fires inside an async then() callback.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    fetch(`/api/stats/published-files?${queryString}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((body: Payload) => {
        if (!cancelled) setData(body);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  // Re-poll the realtime metric every 20 seconds without re-fetching the whole payload.
  useEffect(() => {
    if (!data) return;
    const id = window.setInterval(() => {
      fetch(`/api/stats/published-files?${queryString}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((body: Payload | null) => {
          if (!body) return;
          setData(body);
        })
        .catch(() => undefined);
    }, 20_000);
    return () => window.clearInterval(id);
  }, [queryString, data]);

  // Close the Custom popover on outside click.
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

  const filteredFiles = useMemo(() => {
    if (!data) return [] as FileRow[];
    const q = query.trim().toLowerCase();
    if (!q) return data.files;
    return data.files.filter((f) =>
      f.name.toLowerCase().includes(q) || f.folderName.toLowerCase().includes(q),
    );
  }, [data, query]);

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
      <div className="head">
        <div>
          <p className="eyebrow">
            {preset === "custom" ? "Custom range" : `Last ${windowLabel}`}
            {data && data.totals.realtimeVisitors > 0 ? (
              <span className="stats-realtime">
                <span className="stats-realtime-dot" /> {data.totals.realtimeVisitors} online now
              </span>
            ) : null}
          </p>
          <h1 className="title">
            Stats <span className="it">at a glance</span>
          </h1>
          <p className="sub">
            {canSeeAll
              ? "Visits, visitors, devices and locations across every published file in the workspace."
              : "Visits, visitors, devices and locations across your published files."}
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
                <button
                  type="button"
                  className="stats-custom-preset"
                  onClick={() => {
                    setCustomFrom(daysAgoISO(0));
                    setCustomTo(todayISO());
                  }}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="stats-custom-preset"
                  onClick={() => {
                    setCustomFrom(daysAgoISO(1));
                    setCustomTo(daysAgoISO(1));
                  }}
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  className="stats-custom-preset"
                  onClick={() => {
                    setCustomFrom(daysAgoISO(6));
                    setCustomTo(todayISO());
                  }}
                >
                  Last 7d
                </button>
                <button
                  type="button"
                  className="stats-custom-preset"
                  onClick={() => {
                    setCustomFrom(daysAgoISO(29));
                    setCustomTo(todayISO());
                  }}
                >
                  Last 30d
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {!data ? (
        <div className="stats-loading">Loading…</div>
      ) : data.totals.files === 0 ? (
        <div className="empty-state">
          <div className="empty-title">No published files yet</div>
          <div className="empty-desc">
            Publish a file from any folder to start collecting privacy-friendly visit stats here.
          </div>
        </div>
      ) : (
        <>
          {/* KPI totals — visitors / page views / bounce rate / realtime */}
          <div className="stats-totals">
            <Kpi
              label="Unique visitors"
              value={data.totals.visitors}
              hint={`${windowLabel}`}
            />
            <Kpi
              label="Page views"
              value={data.totals.pageViews}
              trend={data.trend.pageViews}
            />
            <Kpi
              label="Bounce rate"
              valueText={`${data.totals.bounceRate.toFixed(0)}%`}
              hint={data.totals.bounceRate >= 70 ? "High" : data.totals.bounceRate >= 40 ? "Moderate" : "Low"}
            />
            <Kpi
              label="Files published"
              value={data.totals.files}
              hint={`${data.totals.byMode.public} public · ${data.totals.byMode.password} password`}
            />
          </div>

          {/* Daily chart with date labels */}
          <section className="stats-section">
            <div className="stats-section-h">
              <div className="stats-section-title">Visitors &amp; page views</div>
              <div className="stats-section-sub">UTC days · hover any bar for that day&apos;s breakdown</div>
            </div>
            <DailyChart daily={data.daily} />
          </section>

          {/* Top files + Devices + OS + Browser */}
          <section className="stats-section">
            <div className="stats-grid stats-grid-4">
              <BreakdownCard
                title="Top files"
                items={data.topFiles.map((f) => ({ key: f.name, count: f.visits, href: `/files/${f.id}/stats` }))}
                empty="No traffic yet."
              />
              <BreakdownCard
                title="Devices"
                items={data.byDevice}
                empty="No visits yet."
              />
              <BreakdownCard
                title="Browsers"
                items={data.byBrowser}
                empty="No visits yet."
              />
              <BreakdownCard
                title="Operating systems"
                items={data.byOS}
                empty="No visits yet."
              />
            </div>
          </section>

          {/* Countries + Status breakdown */}
          <section className="stats-section">
            <div className="stats-grid">
              <BreakdownCard
                title="Countries"
                items={data.byCountry}
                empty="Geography isn’t resolved on this deployment. IPs are still logged for unique-visitor counts; country data populates once a geo lookup is configured."
              />
              <div className="stats-card">
                <div className="stats-card-h">Status breakdown</div>
                <StatusBars buckets={data.statusBuckets} />
              </div>
            </div>
          </section>

          {/* Per-file leaderboard */}
          <section className="stats-section">
            <div className="stats-section-h" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div className="stats-section-title">All published files</div>
                <div className="stats-section-sub">Sorted by page views in the selected window.</div>
              </div>
              <input
                type="text"
                className="trash-search"
                placeholder="Search files…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ width: 240 }}
              />
            </div>
            {filteredFiles.length === 0 ? (
              <div className="empty-state" style={{ marginTop: 12 }}>
                <div className="empty-title">No matches</div>
                <div className="empty-desc">Nothing matches “{query}”.</div>
              </div>
            ) : (
              <div className="list">
                {filteredFiles.map((f) => (
                  <Link
                    key={f.id}
                    href={`/files/${f.id}/stats`}
                    className="row row-quiet stats-pub-row"
                  >
                    <div className="row-name">
                      <div className="row-icon">{FILE_ICONS[pickIcon(f.mime)]}</div>
                      <div>
                        <div className="row-title">
                          {f.name}
                          {f.publishMode === "password" ? (
                            <span className="live-pill draft" style={{ marginLeft: 8 }}>Password</span>
                          ) : (
                            <span className="live-pill" style={{ marginLeft: 8 }}>Public</span>
                          )}
                        </div>
                        <div className="row-sub">
                          {f.folderName} · {formatBytes(f.sizeBytes)}
                        </div>
                      </div>
                    </div>
                    <div className="stats-pub-count">
                      <div className="stats-pub-value">{f.visits.toLocaleString()}</div>
                      <div className="stats-pub-label">page views</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

/* ---------- KPI tile ---------- */
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
      <div className="stats-total-value">
        {valueText ?? (value ?? 0).toLocaleString()}
      </div>
      {trendNode}
    </div>
  );
}

/* ---------- Daily chart with dated axis ---------- */
function DailyChart({ daily }: { daily: { day: string; pageViews: number; visitors: number }[] }) {
  const max = useMemo(() => Math.max(1, ...daily.map((d) => d.pageViews)), [daily]);
  // Pick ~6 tick labels evenly across the range so the axis stays readable
  // across 7 / 30 / 90 day windows and custom ranges.
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

/* ---------- Breakdown card ---------- */
function BreakdownCard({
  title,
  items,
  empty,
}: {
  title: string;
  items: ({ key: string; count: number; href?: string })[];
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

/* ---------- Status bars ---------- */
function StatusBars({ buckets }: { buckets: Record<string, number> }) {
  const total = Object.values(buckets).reduce((a, b) => a + b, 0);
  const entries = [
    { key: "2xx", label: "Served (2xx)", cls: "is-ok" },
    { key: "3xx", label: "Redirect (3xx)", cls: "is-redirect" },
    { key: "4xx", label: "Blocked / not found (4xx)", cls: "is-warn" },
    { key: "5xx", label: "Error (5xx)", cls: "is-error" },
  ];
  if (total === 0) {
    return <div className="stats-empty">No visits in this window.</div>;
  }
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
