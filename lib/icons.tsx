import type { ReactNode } from "react";

const folder: ReactNode = (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
    <path
      d="M2 5.5A1.5 1.5 0 013.5 4h3l1.5 1.5h6A1.5 1.5 0 0115.5 7v6.5A1.5 1.5 0 0114 15H4a1.5 1.5 0 01-1.5-1.5v-8z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

const html: ReactNode = (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
    <path
      d="M5 6l-2 3 2 3M13 6l2 3-2 3M11 4l-4 10"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const css: ReactNode = (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
    <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const js: ReactNode = (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
    <path
      d="M11 5v6c0 1.1-.9 2-2 2s-2-.9-2-2M14 13.5c.6.5 1.5 1 2.5 1 1.5 0 2.5-.7 2.5-1.7 0-1-1-1.6-2-1.8-1.2-.3-2-.8-2-1.6 0-.9.9-1.4 2-1.4.8 0 1.5.3 2 .8"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);

const image: ReactNode = (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
    <rect x="2.5" y="3.5" width="13" height="11" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="6" cy="7.5" r="1.3" stroke="currentColor" strokeWidth="1.4" />
    <path d="M3 12l3-3 4 4 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const pdf: ReactNode = (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
    <path
      d="M4 2.5A1 1 0 015 1.5h5l4 4V15a1 1 0 01-1 1H5a1 1 0 01-1-1V2.5z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path d="M10 1.5V5h4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const file: ReactNode = (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
    <path
      d="M4 2.5A1 1 0 015 1.5h5l4 4V15a1 1 0 01-1 1H5a1 1 0 01-1-1V2.5z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

export const FILE_ICONS: Record<string, ReactNode> = { folder, html, css, js, image, pdf, file };

export const Kebab = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <circle cx="3" cy="8" r="1.2" fill="currentColor" />
    <circle cx="8" cy="8" r="1.2" fill="currentColor" />
    <circle cx="13" cy="8" r="1.2" fill="currentColor" />
  </svg>
);

export const Search = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <circle cx="7" cy="7" r="4.3" stroke="currentColor" strokeWidth="1.4" />
    <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export const Close = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const ChevronDown = (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
    <path d="M5 6l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Plus = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M3 8h10M8 3v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const Upload = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path
      d="M8 3v8M4 7l4-4 4 4M3 13h10"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ShareIcon = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <circle cx="4" cy="8" r="1.6" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="12" cy="4" r="1.6" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="12" cy="12" r="1.6" stroke="currentColor" strokeWidth="1.4" />
    <path d="M5.5 7L10.5 4.7M5.5 9L10.5 11.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export const StatsIcon = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M2 13h12M4.5 11V8M8 11V5M11.5 11V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const SortIcon = (
  <svg viewBox="0 0 16 16" fill="none">
    <path
      d="M8 11V4M5 8l3 3 3-3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
