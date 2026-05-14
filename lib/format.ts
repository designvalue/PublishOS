const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;
const TB = GB * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes < TB) return `${(bytes / GB).toFixed(1)} GB`;
  return `${(bytes / TB).toFixed(1)} TB`;
}

export function formatRelative(input: Date | string | number): string {
  const date = input instanceof Date ? input : new Date(input);
  const ms = Date.now() - date.getTime();
  const sec = Math.round(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Path-relative URL for a published folder. Pass the folder's publicSlug when
 * it's set so the URL is pretty; otherwise we fall back to the canonical id.
 */
export function publicPathForFolder(folderIdOrSlug: string, publicSlug?: string | null): string {
  return `/c/${publicSlug || folderIdOrSlug}`;
}

/** Builds an absolute URL from origin + folder. Returns a bare path if no origin. */
export function publicUrlForFolder(folderId: string, publicSlug: string | null | undefined, origin?: string | null): string {
  const path = publicPathForFolder(folderId, publicSlug);
  if (!origin) return path;
  return origin.replace(/\/$/, "") + path;
}

/** @deprecated kept for callers that haven't migrated to publicPathForFolder yet. */
export function publicUrlForSlug(slug: string): string {
  return `/c/${slug}`;
}

export function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-|-$/g, "") || "untitled"
  );
}
