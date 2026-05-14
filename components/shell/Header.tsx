"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { useUI } from "@/stores/ui-store";
import { ChevronDown, Search } from "@/lib/icons";
import NotificationBell from "@/components/shell/NotificationBell";
import BrandWordmark from "@/components/shell/BrandWordmark";

function initials(nameOrEmail: string | null | undefined): string {
  if (!nameOrEmail) return "·";
  const trimmed = nameOrEmail.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  // fallback: take first two chars before @
  const local = trimmed.split("@")[0] ?? trimmed;
  return local.slice(0, 2).toUpperCase();
}

function firstName(nameOrEmail: string | null | undefined): string {
  if (!nameOrEmail) return "there";
  const trimmed = nameOrEmail.trim();
  const parts = trimmed.split(/\s+/);
  if (parts[0]) return parts[0];
  return trimmed.split("@")[0] ?? "there";
}

type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

const NAV: { href: string; label: string; superAdminOnly?: boolean }[] = [
  { href: "/", label: "Home" },
  { href: "/stats", label: "Stats" },
  { href: "/people", label: "People" },
  { href: "/trash", label: "Trash" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/folders");
  return pathname.startsWith(href);
}

export default function Header({ workspaceRole }: { workspaceRole?: WorkspaceRole }) {
  const isSuperAdmin = workspaceRole === "owner";
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { meDropdown, toggleMe, closeMe, openSearch } = useUI();
  const pillRef = useRef<HTMLButtonElement>(null);
  const ddRef = useRef<HTMLDivElement>(null);

  const userName = session?.user?.name ?? session?.user?.email ?? "";
  const userEmail = session?.user?.email ?? "";
  const userInitials = initials(userName || userEmail);
  const displayName = firstName(userName || userEmail);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!meDropdown) return;
      const t = e.target as Node;
      if (ddRef.current?.contains(t) || pillRef.current?.contains(t)) return;
      closeMe();
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [meDropdown, closeMe]);

  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="PublishOS home">
          <BrandWordmark size="md" />
        </Link>
        <nav className="nav">
          {NAV.filter((n) => !n.superAdminOnly || isSuperAdmin).map((n) => (
            <Link key={n.href} href={n.href} className={isActive(pathname, n.href) ? "active" : ""}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <button className="header-search" type="button" onClick={openSearch}>
            {Search}
            <span className="label">Search folders, files…</span>
            <kbd>⌘K</kbd>
          </button>
          <NotificationBell />
          <div className="me-wrap">
        <button
          ref={pillRef}
          className="me-pill"
          aria-haspopup="true"
          aria-expanded={meDropdown}
          onClick={(e) => {
            e.stopPropagation();
            toggleMe();
          }}
        >
          <span className="me-avatar">{userInitials}</span>
          <span className="me-name">{displayName}</span>
          {ChevronDown}
        </button>
        <div ref={ddRef} className={`me-dropdown${meDropdown ? " open" : ""}`} role="menu">
          <div className="dd-header">
            <span className="me-avatar large">{userInitials}</span>
            <div>
              <div className="dd-name">{displayName}</div>
              <div className="dd-mail">{userEmail}</div>
            </div>
          </div>
          <div className="dd-divider" />
          <button
            className="dd-item"
            onClick={() => {
              closeMe();
              router.push("/profile");
            }}
          >
            <svg className="ico" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="6" r="2.3" stroke="currentColor" strokeWidth="1.4" />
              <path d="M3.2 13.2c.7-2 2.6-3.2 4.8-3.2s4.1 1.2 4.8 3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Profile
          </button>
          {isSuperAdmin && (
            <button
              className="dd-item"
              onClick={() => {
                closeMe();
                router.push("/settings");
              }}
            >
              <svg className="ico" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.4" />
                <path
                  d="M8 1.8v1.8M8 12.5v1.7M14.2 8h-1.7M3.5 8H1.8M12.4 3.6l-1.2 1.2M4.8 11.2l-1.2 1.2M12.4 12.4l-1.2-1.2M4.8 4.8L3.6 3.6"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
              Settings
            </button>
          )}
          <div className="dd-divider" />
          <button
            className="dd-item danger"
            onClick={() => {
              closeMe();
              signOut({ callbackUrl: "/login" });
            }}
          >
            <svg className="ico" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 5V3a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h5a1 1 0 001-1v-2M7 8h7m0 0l-2.5-2.5M14 8l-2.5 2.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Sign out
          </button>
        </div>
        </div>
        </div>
      </div>
    </header>
  );
}
