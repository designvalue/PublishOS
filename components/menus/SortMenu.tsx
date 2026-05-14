"use client";

import { useEffect, useRef } from "react";
import { useUI, type SortKey } from "@/stores/ui-store";
import { toast } from "@/stores/toast-store";

type Choice = { key: SortKey; label: string; icon: React.ReactNode };

const Check = (
  <svg className="check" viewBox="0 0 16 16" fill="none">
    <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CHOICES: Choice[] = [
  {
    key: "modified",
    label: "Modified",
    icon: (
      <svg className="ico" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 5v3l2 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "added",
    label: "Added",
    icon: (
      <svg className="ico" viewBox="0 0 16 16" fill="none">
        <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "name",
    label: "Name",
    icon: (
      <svg className="ico" viewBox="0 0 16 16" fill="none">
        <path d="M3 4h10M3 8h10M3 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "size",
    label: "Size",
    icon: (
      <svg className="ico" viewBox="0 0 16 16" fill="none">
        <rect x="3" y="3" width="10" height="10" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
        <path d="M6 8h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "type",
    label: "Type",
    icon: (
      <svg className="ico" viewBox="0 0 16 16" fill="none">
        <path d="M2 5.5A1.5 1.5 0 013.5 4h2.5l1.5 1.5h5A1.5 1.5 0 0114 7v5.5A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "visits",
    label: "Visits",
    icon: (
      <svg className="ico" viewBox="0 0 16 16" fill="none">
        <path d="M2 12l3-4 3 2 4-5 2 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "owner",
    label: "Owner",
    icon: (
      <svg className="ico" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="6" r="2.3" stroke="currentColor" strokeWidth="1.4" />
        <path d="M3.2 13.2c.7-2 2.6-3.2 4.8-3.2s4.1 1.2 4.8 3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function SortMenu() {
  const { sortMenu, closeSortMenu, sortKey, setSort, sortDir, setSortDir } = useUI();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!sortMenu) return;
      if (ref.current && !ref.current.contains(e.target as Node)) closeSortMenu();
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [sortMenu, closeSortMenu]);

  if (!sortMenu) return null;

  return (
    <div ref={ref} className="sort-menu open" role="menu" style={{ left: sortMenu.x, top: sortMenu.y }}>
      <div className="sort-section-label">Sort by</div>
      {CHOICES.map((c) => (
        <button
          key={c.key}
          type="button"
          className={`sort-item${sortKey === c.key ? " active" : ""}`}
          onClick={() => {
            setSort(c.key, c.label);
            toast(`Sorted by ${c.label}`);
            closeSortMenu();
          }}
        >
          {c.icon}
          <span className="label">{c.label}</span>
          {Check}
        </button>
      ))}
      <div className="sort-divider" />
      <button
        type="button"
        className={`sort-item${sortDir === "asc" ? " active" : ""}`}
        onClick={() => setSortDir("asc")}
      >
        <svg className="ico" viewBox="0 0 16 16" fill="none">
          <path d="M8 13V3M5 6l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="label">Ascending</span>
        {Check}
      </button>
      <button
        type="button"
        className={`sort-item${sortDir === "desc" ? " active" : ""}`}
        onClick={() => setSortDir("desc")}
      >
        <svg className="ico" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M5 10l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="label">Descending</span>
        {Check}
      </button>
    </div>
  );
}
