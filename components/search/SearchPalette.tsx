"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/stores/ui-store";
import { FILE_ICONS, Search } from "@/lib/icons";

type Hit = {
  kind: "folder" | "file";
  id: string;
  name: string;
  href: string;
  iconKey: keyof typeof FILE_ICONS;
};

function pickIcon(mime: string | undefined): keyof typeof FILE_ICONS {
  if (!mime) return "file";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime === "text/html") return "html";
  if (mime === "text/css") return "css";
  if (mime === "application/javascript" || mime === "text/javascript") return "js";
  return "file";
}

function highlight(text: string, q: string): React.ReactNode {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function SearchPalette() {
  const { search, closeSearch } = useUI();
  return (
    <>
      <div className={`search-backdrop${search ? " open" : ""}`} onClick={closeSearch} />
      <div className={`search-palette${search ? " open" : ""}`} role="dialog" aria-modal="true">
        <SearchBody key={search ? "open" : "closed"} closeSearch={closeSearch} />
      </div>
    </>
  );
}

function SearchBody({ closeSearch }: { closeSearch: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const debounce = window.setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (cancelled) return;
      if (!res.ok) {
        setHits([]);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as {
        folders: { id: string; name: string; slug: string }[];
        files: { id: string; name: string; folderId: string; mime: string }[];
      };
      const next: Hit[] = [
        ...data.folders.map((f) => ({
          kind: "folder" as const,
          id: f.id,
          name: f.name,
          href: `/folders/${f.id}`,
          iconKey: "folder" as const,
        })),
        ...data.files.map((f) => ({
          kind: "file" as const,
          id: f.id,
          name: f.name,
          href: `/folders/${f.folderId}`,
          iconKey: pickIcon(f.mime),
        })),
      ];
      setHits(next);
      setActiveIdx(0);
      setLoading(false);
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(debounce);
    };
  }, [query]);

  function commit(idx: number) {
    const hit = hits[idx];
    if (!hit) return;
    closeSearch();
    router.push(hit.href);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(activeIdx);
    }
  }

  const folders = hits.filter((h) => h.kind === "folder");
  const files = hits.filter((h) => h.kind === "file");
  let runningIdx = 0;

  return (
    <>
      <div className="search-input-row">
        {Search}
        <input
          ref={inputRef}
          placeholder="Search folders, files, or people…"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
        />
        <kbd>esc</kbd>
      </div>
      <div className="search-results">
        {loading && hits.length === 0 ? (
          <div className="search-empty">Searching…</div>
        ) : hits.length === 0 ? (
          query ? (
            <div className="search-empty">
              No matches for <strong>&quot;{query}&quot;</strong>
            </div>
          ) : (
            <div className="search-empty">Type to search your folders and files.</div>
          )
        ) : (
          <>
            {folders.length > 0 && (
              <div className="search-section-label">
                {query ? `Folders · ${folders.length}` : "Recent folders"}
              </div>
            )}
            {folders.map((hit) => {
              const idx = runningIdx++;
              return (
                <button
                  key={`f-${hit.id}`}
                  type="button"
                  className={`search-result${idx === activeIdx ? " active" : ""}`}
                  onClick={() => commit(idx)}
                  onMouseEnter={() => setActiveIdx(idx)}
                >
                  <div className={`s-icon ${hit.kind}`}>{FILE_ICONS[hit.iconKey]}</div>
                  <div className="s-name">
                    <div>{highlight(hit.name, query)}</div>
                  </div>
                  <div className="s-type">{hit.kind}</div>
                </button>
              );
            })}
            {files.length > 0 && <div className="search-section-label">Files · {files.length}</div>}
            {files.map((hit) => {
              const idx = runningIdx++;
              return (
                <button
                  key={`x-${hit.id}`}
                  type="button"
                  className={`search-result${idx === activeIdx ? " active" : ""}`}
                  onClick={() => commit(idx)}
                  onMouseEnter={() => setActiveIdx(idx)}
                >
                  <div className={`s-icon ${hit.kind}`}>{FILE_ICONS[hit.iconKey]}</div>
                  <div className="s-name">
                    <div>{highlight(hit.name, query)}</div>
                  </div>
                  <div className="s-type">{hit.kind}</div>
                </button>
              );
            })}
          </>
        )}
      </div>
      <div className="search-hint">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> navigate
        </span>
        <span>
          <kbd>↵</kbd> open
        </span>
        <span style={{ marginLeft: "auto" }}>
          <kbd>esc</kbd> close
        </span>
      </div>
    </>
  );
}
