"use client";

import { toast } from "@/stores/toast-store";

const TEMPLATES = [
  {
    name: "Press kit",
    icon: (
      <svg viewBox="0 0 16 16" fill="none">
        <rect x="2.5" y="3.5" width="11" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5 6h6M5 8.5h6M5 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Pitch deck",
    icon: (
      <svg viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M6 13h4M8 11v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Hiring page",
    icon: (
      <svg viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="6" r="2.3" stroke="currentColor" strokeWidth="1.4" />
        <path d="M3.2 13.2c.7-2 2.6-3.2 4.8-3.2s4.1 1.2 4.8 3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Landing page",
    icon: (
      <svg viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2.5 8h11M8 2.5c1.7 1.5 2.5 3.5 2.5 5.5s-.8 4-2.5 5.5C6.3 12 5.5 10 5.5 8s.8-4 2.5-5.5z" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    name: "Docs site",
    icon: (
      <svg viewBox="0 0 16 16" fill="none">
        <path d="M4 2.5A1 1 0 015 1.5h5l4 4V13a1 1 0 01-1 1H5a1 1 0 01-1-1V2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M10 1.5V5h4M6 8h4M6 11h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Personal site",
    icon: (
      <svg viewBox="0 0 16 16" fill="none">
        <path d="M3 3h10v10H3z" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5 6h6M5 9h6M5 12h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function TemplatesRow() {
  return (
    <div className="templates-row">
      <span className="templates-label">Start from a template:</span>
      {TEMPLATES.map((t) => (
        <button key={t.name} className="template-chip" onClick={() => toast(`Creating folder from ${t.name} template…`)}>
          {t.icon}
          {t.name}
        </button>
      ))}
      <button className="template-chip muted" onClick={() => toast("Browse all templates…")}>
        Browse all →
      </button>
    </div>
  );
}
