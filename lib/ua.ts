/**
 * Lightweight User-Agent parsing for analytics rollups.
 *
 * We intentionally avoid a heavy UA library here; the buckets just need to be
 * stable enough to power the breakdown cards on the stats page. Order of the
 * checks matters: edge cases (Edg/, OPR/) need to precede the Chrome match
 * since they include "Chrome" in their UA strings.
 */

export type UAParts = {
  browser: string;
  os: string;
  device: "Desktop" | "Mobile" | "Tablet" | "Bot" | "Unknown";
};

const BROWSER_PATTERNS: { name: string; test: RegExp }[] = [
  // Bots / scripted clients first so they don't show up as "Chrome".
  { name: "curl", test: /^curl\// },
  { name: "Wget", test: /^Wget\// },
  { name: "Googlebot", test: /Googlebot/i },
  { name: "Bingbot", test: /bingbot/i },
  { name: "DuckDuckBot", test: /DuckDuckBot/i },

  { name: "Edge", test: /Edg\/|Edge\//i },
  { name: "Opera", test: /OPR\/|Opera\//i },
  { name: "Brave", test: /Brave\//i },
  { name: "Firefox", test: /Firefox\//i },
  { name: "Chrome", test: /Chrome\//i },
  { name: "Safari", test: /Safari\//i },
];

const OS_PATTERNS: { name: string; test: RegExp }[] = [
  { name: "iPadOS", test: /iPad/i },
  { name: "iOS", test: /iPhone|iPod/i },
  { name: "Android", test: /Android/i },
  { name: "Windows", test: /Windows NT|Win64|Windows/i },
  { name: "macOS", test: /Mac OS X|Macintosh|macOS/i },
  { name: "Linux", test: /Linux/i },
  { name: "ChromeOS", test: /CrOS/i },
];

const BOT_PATTERNS = /bot|crawler|spider|curl\/|wget\//i;
const TABLET_PATTERNS = /iPad|Tablet|PlayBook|Silk/i;
const MOBILE_PATTERNS = /iPhone|iPod|Android.*Mobile|Mobile.*Android|Mobile Safari|Opera Mobi/i;

export function parseUA(ua: string | null | undefined): UAParts {
  if (!ua) return { browser: "Unknown", os: "Unknown", device: "Unknown" };

  let browser = "Unknown";
  for (const p of BROWSER_PATTERNS) {
    if (p.test.test(ua)) { browser = p.name; break; }
  }

  let os = "Unknown";
  for (const p of OS_PATTERNS) {
    if (p.test.test(ua)) { os = p.name; break; }
  }

  let device: UAParts["device"] = "Unknown";
  if (BOT_PATTERNS.test(ua)) device = "Bot";
  else if (TABLET_PATTERNS.test(ua)) device = "Tablet";
  else if (MOBILE_PATTERNS.test(ua)) device = "Mobile";
  else if (os !== "Unknown") device = "Desktop";

  return { browser, os, device };
}
