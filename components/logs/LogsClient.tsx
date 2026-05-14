"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EnrichedAccessLog, StatusBucket } from "@/lib/access-log";

const STATUS_TABS: { value: "all" | StatusBucket; label: string }[] = [
  { value: "all", label: "All" },
  { value: "2xx", label: "2xx" },
  { value: "3xx", label: "3xx" },
  { value: "4xx", label: "4xx" },
  { value: "5xx", label: "5xx" },
];

const RANGE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "thismonth", label: "This month" },
  { key: "lastmonth", label: "Last month" },
  { key: "all", label: "All time" },
] as const;
type RangeKey = (typeof RANGE_PRESETS)[number]["key"] | "custom";

function statusClass(status: number): string {
  if (status >= 500) return "s4r";
  if (status >= 400) return "s4";
  if (status >= 300) return "s3";
  return "s2";
}
function bucketFor(status: number): StatusBucket {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  if (status >= 300) return "3xx";
  return "2xx";
}

function fmtTime(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour12: false });
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}
function fmtBytes(n: number): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
function toDateInput(d: Date | null): string {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function fromDateInputStartOfDay(s: string): Date | null {
  if (!s) return null;
  // s is YYYY-MM-DD in user's local timezone.
  const [y, m, d] = s.split("-").map((n) => Number(n));
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d, 0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}
function fromDateInputEndOfDay(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map((n) => Number(n));
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d, 23, 59, 59, 999);
  return Number.isNaN(date.getTime()) ? null : date;
}
function startOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
}
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0); }
function endOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); }

type Row = Omit<EnrichedAccessLog, "occurredAt"> & { occurredAt: string };
function normalise(r: EnrichedAccessLog): Row {
  return { ...r, occurredAt: (r.occurredAt instanceof Date ? r.occurredAt : new Date(r.occurredAt)).toISOString() };
}

function rangeFor(kind: Exclude<RangeKey, "custom">): { from: Date | null; to: Date | null } {
  if (kind === "all") return { from: null, to: null };
  const now = new Date();
  if (kind === "today") return { from: startOfDay(now), to: endOfDay(now) };
  if (kind === "yesterday") {
    const y = new Date(now); y.setDate(now.getDate() - 1);
    return { from: startOfDay(y), to: endOfDay(y) };
  }
  if (kind === "7d") {
    const s = new Date(now); s.setDate(now.getDate() - 7);
    return { from: startOfDay(s), to: endOfDay(now) };
  }
  if (kind === "30d") {
    const s = new Date(now); s.setDate(now.getDate() - 30);
    return { from: startOfDay(s), to: endOfDay(now) };
  }
  if (kind === "thismonth") return { from: startOfMonth(now), to: endOfMonth(now) };
  const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { from: startOfMonth(lm), to: endOfMonth(lm) };
}

function rangeLabel(kind: RangeKey, from: Date | null, to: Date | null): string {
  if (kind !== "custom") return RANGE_PRESETS.find((p) => p.key === kind)?.label ?? "All time";
  const f = from ? from.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";
  const t = to ? to.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";
  return `${f} → ${t}`;
}

function prettyPath(p: string): string {
  return p.replace(/^\/api\//, "");
}

function incomingMatches(
  row: Row,
  filter: { statusTab: "all" | StatusBucket; query: string; from: Date | null; to: Date | null },
): boolean {
  if (filter.statusTab !== "all" && bucketFor(row.status) !== filter.statusTab) return false;
  if (filter.query.trim()) {
    const q = filter.query.toLowerCase();
    const haystack = [
      row.path,
      row.method,
      row.ip ?? "",
      row.userAgent ?? "",
      row.userName ?? "",
      row.userEmail ?? "",
      row.fileName ?? "",
      row.folderName ?? "",
      row.folderSlug ?? "",
    ].join(" ").toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  if (filter.from || filter.to) {
    const t = new Date(row.occurredAt).getTime();
    if (filter.from && t < filter.from.getTime()) return false;
    if (filter.to && t > filter.to.getTime()) return false;
  }
  return true;
}

export default function LogsClient({
  initial,
  initialPerMinute,
}: {
  initial: EnrichedAccessLog[];
  initialPerMinute: number;
}) {
  const [rows, setRows] = useState<Row[]>(() => initial.map(normalise));
  const [statusTab, setStatusTab] = useState<"all" | StatusBucket>("all");
  const [paused, setPaused] = useState(false);
  const [perMin, setPerMin] = useState(initialPerMinute);
  const [streaming, setStreaming] = useState(false);
  const [query, setQuery] = useState("");

  const [rangeKey, setRangeKey] = useState<RangeKey>("all");
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);

  const rangeWrapRef = useRef<HTMLDivElement>(null);

  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const filterRef = useRef({ statusTab, query, from, to });
  useEffect(() => { filterRef.current = { statusTab, query, from, to }; }, [statusTab, query, from, to]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rangeOpen) return;
      const wrap = rangeWrapRef.current;
      if (!wrap) return;
      const target = e.target as Node;
      if (wrap.contains(target)) return;
      // Don't close while the user is mid-interaction inside our popover —
      // native date pickers can dispatch document clicks even though focus
      // is still on our input.
      const active = document.activeElement;
      if (active && wrap.contains(active as Node)) return;
      setRangeOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setRangeOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [rangeOpen]);

  // SSE
  useEffect(() => {
    const es = new EventSource("/api/logs/stream");
    es.onopen = () => setStreaming(true);
    es.onerror = () => setStreaming(false);
    es.addEventListener("log", (evt) => {
      if (pausedRef.current) return;
      try {
        const row = JSON.parse((evt as MessageEvent).data) as Row;
        if (!incomingMatches(row, filterRef.current)) return;
        setRows((prev) => [row, ...prev].slice(0, 1000));
      } catch {
        /* ignore */
      }
    });
    return () => es.close();
  }, []);

  // Refetch when filters change (debounced)
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(async () => {
      const params = new URLSearchParams({ limit: "200" });
      if (statusTab !== "all") params.set("status", statusTab);
      if (query.trim()) params.set("q", query.trim());
      if (from) params.set("from", from.toISOString());
      if (to) params.set("to", to.toISOString());

      const res = await fetch(`/api/logs?${params.toString()}`);
      if (!res.ok) return;
      const body = (await res.json()) as { logs: EnrichedAccessLog[] };
      setRows(body.logs.map(normalise));
    }, 220);
    return () => { if (fetchTimer.current) clearTimeout(fetchTimer.current); };
  }, [statusTab, query, from, to]);

  // req/min ticker
  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = Date.now() - 60_000;
      const n = rows.reduce((acc, r) => (new Date(r.occurredAt).getTime() >= cutoff ? acc + 1 : acc), 0);
      setPerMin(n);
    }, 5000);
    return () => clearInterval(id);
  }, [rows]);

  const loadingMore = useRef(false);
  const onScroll = useCallback(
    async (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (loadingMore.current) return;
      if (el.scrollTop + el.clientHeight < el.scrollHeight - 80) return;
      const oldest = rows[rows.length - 1];
      if (!oldest) return;

      loadingMore.current = true;
      const params = new URLSearchParams({ before: new Date(oldest.occurredAt).toISOString(), limit: "100" });
      if (statusTab !== "all") params.set("status", statusTab);
      if (query.trim()) params.set("q", query.trim());
      if (from) params.set("from", from.toISOString());
      if (to) params.set("to", to.toISOString());

      try {
        const res = await fetch(`/api/logs?${params.toString()}`);
        if (res.ok) {
          const body = (await res.json()) as { logs: EnrichedAccessLog[] };
          const next = body.logs.map(normalise);
          if (next.length > 0) setRows((prev) => [...prev, ...next]);
        }
      } finally {
        loadingMore.current = false;
      }
    },
    [rows, statusTab, query, from, to],
  );

  function pickPreset(key: Exclude<RangeKey, "custom">) {
    const r = rangeFor(key);
    setRangeKey(key);
    setFrom(r.from);
    setTo(r.to);
    setRangeOpen(false);
  }

  return (
    <main className="page logs-page">
      <div className="head">
        <div>
          <p className="eyebrow">Real-time · 90-day retention</p>
          <h1 className="title">
            Access <span className="it">logs</span>
          </h1>
          <p className="sub">Every request that touches a file or folder is recorded here.</p>
        </div>
        <div className="actions">
          <span className={`live${streaming && !paused ? "" : " offline"}`}>
            {paused ? "Paused" : `${perMin} req/min`}
          </span>
          <button className="btn" onClick={() => setPaused((v) => !v)}>
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
      </div>

      {/* Single, simple filter row */}
      <div className="logs-bar">
        <div className="logs-search">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.3" stroke="currentColor" strokeWidth="1.4" />
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search by user, folder, file, path, IP…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="logs-clear" type="button" onClick={() => setQuery("")}>
              ×
            </button>
          )}
        </div>

        <div className="logs-range-wrap" ref={rangeWrapRef}>
          <button
            type="button"
            className={`logs-range-btn${rangeOpen ? " open" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setRangeOpen((v) => !v);
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <rect x="2.5" y="3.5" width="11" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
              <path d="M2.5 6.5h11M6 1.5v3M10 1.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            {rangeLabel(rangeKey, from, to)}
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {rangeOpen && (
            <RangePopover
              key={`pop-${from?.getTime() ?? "n"}-${to?.getTime() ?? "n"}`}
              currentFrom={from}
              currentTo={to}
              activeKey={rangeKey}
              onPreset={pickPreset}
              onApply={(nf, nt) => {
                if (!nf && !nt) {
                  setRangeKey("all");
                  setFrom(null);
                  setTo(null);
                } else {
                  setRangeKey("custom");
                  setFrom(nf);
                  setTo(nt);
                }
                setRangeOpen(false);
              }}
              onCancel={() => setRangeOpen(false)}
            />
          )}
        </div>
      </div>

      <div className="toolbar">
        <div className="tabs">
          {STATUS_TABS.map((t) => (
            <span
              key={t.value}
              className={`tab${statusTab === t.value ? " active" : ""}`}
              onClick={() => setStatusTab(t.value)}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-title">No matching requests</div>
          <div className="empty-desc">
            Try a different search, change the date range, or trigger some activity from a folder.
          </div>
        </div>
      ) : (
        <div className="logs-table logs-scroll" onScroll={onScroll}>
          {rows.map((r) => {
            const who = r.userName ?? r.userEmail ?? r.ip ?? "—";
            const what = r.fileName ?? r.folderName ?? prettyPath(r.path);
            const where = r.folderSlug ? `/${r.folderSlug}` : r.path;
            return (
              <button
                key={r.id}
                type="button"
                className="logs-row logs-row-button"
                onClick={() => setSelected(r)}
              >
                <span className={`logs-cell logs-status status-${statusClass(r.status)}`}>{r.status}</span>
                <span className="logs-cell logs-method">{r.method}</span>
                <span className="logs-cell logs-what">
                  <span className="logs-what-name">{what}</span>
                  {what !== where && <span className="logs-what-path">{where}</span>}
                </span>
                <span className="logs-cell logs-who">{who}</span>
                <span className="logs-cell logs-meta">
                  {r.durationMs}ms{r.bytes ? ` · ${fmtBytes(r.bytes)}` : ""}
                </span>
                <span className="logs-cell logs-time">{fmtTime(r.occurredAt)}</span>
              </button>
            );
          })}
        </div>
      )}

      {selected && <LogDetail row={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}

function LogDetail({ row, onClose }: { row: Row; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const occurred = new Date(row.occurredAt);
  const fullTimestamp = occurred.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  function copyJson() {
    void navigator.clipboard.writeText(JSON.stringify(row, null, 2)).catch(() => undefined);
  }

  return (
    <>
      <div className="modal-backdrop open" onClick={onClose} />
      <div className="modal modal-wide open" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="modal-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className={`logs-status status-${statusClass(row.status)}`}>{row.status}</span>
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 14 }}>
                {row.method} {row.path}
              </span>
            </div>
            <div className="modal-sub">{fullTimestamp}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <DetailRow label="Source" value={<span className="profile-chip">{row.source}</span>} />
          <DetailRow label="Duration" value={`${row.durationMs} ms`} />
          {row.bytes > 0 && <DetailRow label="Response size" value={fmtBytes(row.bytes)} />}
          {row.userName || row.userEmail ? (
            <DetailRow
              label="User"
              value={
                <a href={`/people/${row.userId}`} className="logs-detail-link">
                  {row.userName ?? row.userEmail}
                  {row.userName && row.userEmail ? ` · ${row.userEmail}` : ""}
                </a>
              }
            />
          ) : null}
          {row.fileName && (
            <DetailRow
              label="File"
              value={
                row.fileId ? (
                  <a href={`/api/files/${row.fileId}`} target="_blank" rel="noreferrer" className="logs-detail-link">
                    {row.fileName}
                  </a>
                ) : (
                  row.fileName
                )
              }
            />
          )}
          {row.folderName && (
            <DetailRow
              label="Folder"
              value={
                row.folderId ? (
                  <a href={`/folders/${row.folderId}`} className="logs-detail-link">
                    {row.folderName}
                  </a>
                ) : (
                  row.folderName
                )
              }
            />
          )}
          {row.folderSlug && <DetailRow label="Folder slug" value={<code>{row.folderSlug}</code>} />}
          {row.ip && <DetailRow label="IP" value={<code>{row.ip}</code>} />}
          {row.country && <DetailRow label="Country" value={row.country} />}
          {row.userAgent && <DetailRow label="User agent" value={<code style={{ wordBreak: "break-all" }}>{row.userAgent}</code>} />}
          <DetailRow label="Log id" value={<code style={{ fontSize: 11 }}>{row.id}</code>} />

          <details className="logs-detail-raw">
            <summary>Raw JSON</summary>
            <pre>{JSON.stringify(row, null, 2)}</pre>
          </details>
        </div>

        <div className="modal-footer">
          <span className="left">Click outside or press Esc to close.</span>
          <div className="right">
            <button className="btn" onClick={copyJson}>
              Copy JSON
            </button>
            <button className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="logs-detail-row">
      <div className="logs-detail-label">{label}</div>
      <div className="logs-detail-value">{value}</div>
    </div>
  );
}

function RangePopover({
  currentFrom,
  currentTo,
  activeKey,
  onPreset,
  onApply,
  onCancel,
}: {
  currentFrom: Date | null;
  currentTo: Date | null;
  activeKey: RangeKey;
  onPreset: (k: Exclude<RangeKey, "custom">) => void;
  onApply: (from: Date | null, to: Date | null) => void;
  onCancel: () => void;
}) {
  const [draftFrom, setDraftFrom] = useState(() => toDateInput(currentFrom));
  const [draftTo, setDraftTo] = useState(() => toDateInput(currentTo));
  const [error, setError] = useState<string | null>(null);

  function commit(nextFrom: string, nextTo: string) {
    const nf = fromDateInputStartOfDay(nextFrom);
    const nt = fromDateInputEndOfDay(nextTo);
    if (nf && nt && nf.getTime() > nt.getTime()) {
      setError("'From' must be on or before 'To'.");
      return;
    }
    setError(null);
    onApply(nf, nt);
  }

  return (
    <div className="logs-range-pop" onMouseDown={(e) => e.stopPropagation()}>
      {RANGE_PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          className={`logs-range-item${activeKey === p.key ? " active" : ""}`}
          onClick={() => onPreset(p.key)}
        >
          {p.label}
        </button>
      ))}
      <div className="logs-range-divider" />
      <div className="logs-range-section-label">Custom range</div>
      <div className="logs-range-custom">
        <label>
          <span>From</span>
          <input
            type="date"
            value={draftFrom}
            max={draftTo || undefined}
            onChange={(e) => {
              setDraftFrom(e.target.value);
              commit(e.target.value, draftTo);
            }}
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="date"
            value={draftTo}
            min={draftFrom || undefined}
            onChange={(e) => {
              setDraftTo(e.target.value);
              commit(draftFrom, e.target.value);
            }}
          />
        </label>
      </div>
      {error && <div className="logs-range-error">{error}</div>}
      <div className="logs-range-actions">
        <button
          type="button"
          className="logs-range-clear"
          onClick={() => {
            setDraftFrom("");
            setDraftTo("");
            setError(null);
            onApply(null, null);
          }}
        >
          Clear
        </button>
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-primary" onClick={onCancel}>
          Done
        </button>
      </div>
    </div>
  );
}
