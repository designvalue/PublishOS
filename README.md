<p align="center">
  <img src="app/icon.png" alt="PublishOS" width="120" height="120" />
</p>

<h1 align="center">PublishOS</h1>

<p align="center">
  <strong>Folder-first publishing.</strong> Drop a workspace folder with an <code>index.html</code>, control access, and share a live URL.
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#tech-stack">Stack</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#project-layout">Layout</a> ·
  <a href="#api-overview">API</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/SQLite-Drizzle-003B57?logo=sqlite&logoColor=white" alt="SQLite + Drizzle" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT" /></a>
</p>

---

## Overview

PublishOS is a self-hostable web app for managing **sites as folders**: create folders, upload static assets (HTML, CSS, images, archives), tune **sharing and publishing** (public, private, password), and track **activity** (stats, logs, notifications). It targets teams and individuals who want one clear workflow from files on disk to a URL—without a separate CMS for simple static sites.

## Brand assets in the repo

App icons shipped with the Next.js app (used in the shell and for README display on GitHub):

| Asset | Path |
|--------|------|
| Default app icon | [`app/icon.png`](app/icon.png) |
| Apple touch | [`app/apple-icon.png`](app/apple-icon.png) |
| Favicon | [`app/favicon.ico`](app/favicon.ico) |

The optional static **marketing** landing site lives in a local `marketing/` directory in this workspace; that folder is **not tracked in Git** for this repository so it stays out of the remote.

Optional UI screenshots for this README: add images under `docs/screenshots/` (for example `home.png`, `folder-detail.png`) and reference them with relative paths so they render on GitHub.

---

## Features

### Workspace and content

- **Folder tree** with breadcrumbs, nested folders, and a home workspace view.
- **Files** with upload (multipart), size limits, MIME handling, and collision-safe naming.
- **ZIP extract** into a folder where supported.
- **`index.html` awareness** so folders can represent publishable sites.
- **Trash** with restore and purge flows for files and folders.
- **Duplicate** files and folders.
- **Download** folder archives where implemented.

### Sharing and publishing

- **Share drawer** for access and publishing controls on folders.
- **Publishing modes** (e.g. off / public / password-gated) with validation.
- **Slugs** and hosting-oriented settings driven from the app.

### Discovery and navigation

- **Command palette search** (keyboard shortcut from the app shell) wired to a search API.
- **Sort and filter** state integrated with the UI (URL-backed where applicable).

### People and collaboration

- **People** views and user-centric actions (profile, roles where applicable).
- **Teams** and **invitations** APIs for workspace membership.
- **Workspace roles** (e.g. owner / admin / editor / viewer) affecting capabilities such as uploads.

### Insights and system activity

- **Stats** and **logs** routes for usage and anomaly surfacing.
- **Notifications** (list, unread counts, mark read / clear).
- **Live feed** API for recent activity-style data.

### Authentication and account

- **Auth.js (NextAuth) v5** with **credentials** sign-in and optional **Google OAuth**.
- **JWT sessions** with a secure `AUTH_SECRET`.
- **Registration** with optional **signup domain allowlist** (admin-configurable).
- **Password reset** and **change password** flows (email-dependent when SMTP is configured).
- **Avatar** upload for the signed-in user.
- **Must-change-password** gate surfaced in the shell when required.

### Settings and operators

- **App settings**: storage backend (**local filesystem** vs **S3-compatible**), email (SMTP), signup policy, API access toggles, and related operator controls.
- **API tokens** for programmatic access (create/revoke; used by versioned APIs when enabled).

### Programmatic / AI-friendly ingestion

- **`POST /api/v1/sites`** — Bearer-token authenticated endpoint to create a **new folder** and push **HTML or multi-file** sites in one request (designed for tools and automation). Bypasses the session cookie proxy; enable and manage tokens from settings when available.

---

## Tech stack

| Layer | Choice |
|--------|--------|
| Framework | [Next.js 16](https://nextjs.org/) App Router |
| Language | TypeScript (strict) |
| UI | React 19, Radix UI primitives, **Tailwind CSS v4** (`@import "tailwindcss"` in [`styles/globals.css`](styles/globals.css)) plus design tokens and component-scoped class names |
| Auth | Auth.js v5 (`next-auth@beta`), `@auth/drizzle-adapter` |
| Database | SQLite via `better-sqlite3`, [Drizzle ORM](https://orm.drizzle.team/) |
| Passwords | `bcryptjs` |
| Client data | TanStack Query for mutations/cache; Zustand for global UI |
| Object storage | Local dir under configurable root, or S3-compatible (R2, AWS, etc.) via **app settings** (see [`lib/storage/`](lib/storage/)) |
| Validation | Zod |

---

## Getting started

### Prerequisites

- **Node.js** 20+ (LTS recommended)
- **pnpm** (the repo is set up for `pnpm`; you can adapt for `npm` or `yarn` if needed)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Environment variables

Copy the template and edit locally (`.env.local` stays gitignored; [`.env.example`](.env.example) is safe to commit):

```bash
cp .env.example .env.local
# Then set AUTH_SECRET — at least 16 characters, e.g.:
# echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env.local
```

Minimum required values:

```bash
# Required — at least 16 characters; generate e.g. openssl rand -base64 32
AUTH_SECRET=your-long-random-secret-here

# Optional — defaults to publishos.db in the project root (gitignored)
# DATABASE_PATH=publishos.db

# Optional — canonical URL for Auth.js callbacks in production
# AUTH_URL=https://your-domain.example
```

**Optional OAuth (Google):** if both are set, the login UI can offer Google sign-in.

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

**Optional transactional email (Resend):** for magic-link or email-dependent flows when wired in the app.

```bash
RESEND_API_KEY=
EMAIL_FROM=noreply@your-domain.example
```

The authoritative schema for parsed env vars is [`lib/env.ts`](lib/env.ts).

### 3. Create the database schema

```bash
pnpm drizzle-kit push
```

For migration-based workflows:

```bash
pnpm drizzle-kit generate   # emit SQL under drizzle/
pnpm drizzle-kit migrate      # apply migrations
```

### 4. Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated visitors are sent to **`/login`**. Use **Create a workspace** (register) on `/register` to bootstrap the first user if sign-up is open.

### 5. Production build

```bash
pnpm build
pnpm start
```

---

## Configuration

### Database

- **`DATABASE_PATH`** — path to the SQLite file. Default `publishos.db` in the repo root.
- Database artifacts (`*.db`, journals, WAL) are **gitignored**.

### File storage

Storage is **not** configured only through environment variables: the active backend is read from **`app_settings`** (see [`lib/data/settings.ts`](lib/data/settings.ts)).

- **Local (default):** files live under a configurable root (default relative **`storage/`**, gitignored).
- **S3-compatible:** set bucket, region, endpoint, access key, secret, and optional public URL in **Settings** in the app. If S3 fields are incomplete, the app **falls back to local** storage rather than failing writes.

### Auth and routing

- **Edge-safe auth config:** [`lib/auth.config.ts`](lib/auth.config.ts) — imported by the Next.js proxy.
- **Full auth (DB, credentials):** [`lib/auth.ts`](lib/auth.ts).
- **Proxy / middleware:** [`proxy.ts`](proxy.ts) — protects app routes; allows `/api/auth/*`, **`/api/v1/*`** (Bearer tokens), static icon routes, and **`/brand/*`** without a session.

---

## Project layout

```
app/
  (app)/                 # Authenticated app: home, folders, stats, logs, people, settings, profile, trash, …
  (auth)/                # login, register, password reset, …
  api/                   # Route handlers: folders, files, search, teams, invitations, settings, v1, …
components/              # Shell, folder views, modals, share drawer, search palette, …
lib/
  auth.ts / auth.config.ts
  db/                    # Drizzle client + schema
  data/                  # Server-only data access used by RSCs and APIs
  storage/               # Local + S3 backends
  env.ts                 # Validated environment
proxy.ts                 # Auth gate (Next.js 16 “proxy” convention)
styles/globals.css       # Design tokens and global styles
# marketing/             # optional local-only static site (gitignored in this repo)
drizzle/                 # Generated migrations (when used)
```

---

## API overview

| Area | Auth | Examples |
|------|------|----------|
| Session (browser) | Cookie session via Auth.js | `/api/folders`, `/api/files`, `/api/search`, … |
| NextAuth | Same | `/api/auth/*` |
| Versioned HTTP API | `Authorization: Bearer <token>` | `POST /api/v1/sites` — create folder + files from JSON/HTML |

API token issuance and **API access** toggles are tied to settings and account UI when enabled. See [`lib/api-auth.ts`](lib/api-auth.ts) for Bearer resolution.

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm start` | Serve production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests |
| `pnpm drizzle-kit push` | Push schema to DB (dev-friendly) |
| `pnpm drizzle-kit generate` | Create migration files |
| `pnpm drizzle-kit migrate` | Run migrations |

---

## Testing

```bash
pnpm test
```

The repo lists `@playwright/test` as a dev dependency; add Playwright specs and config as needed for end-to-end tests.

---

## Product and engineering references

- High-level build phases and checkpoints: [`PublishOS-MVP-Execution-Plan.md`](PublishOS-MVP-Execution-Plan.md)
- Day-to-day agent notes for this repo: [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md)

---

## Contributing

1. Fork and clone the repository.
2. Create a branch for your change.
3. Run `pnpm lint` and `pnpm test` before opening a pull request.
4. Keep diffs focused; match existing patterns in `lib/data` and `app/api`.

---

## Security notes

- Never commit **`.env.local`**, database files, or the **`storage/`** directory.
- Rotate **`AUTH_SECRET`** if it is ever leaked.
- In production, set **`AUTH_URL`** to your public origin so OAuth and email links resolve correctly.
- Treat **API tokens** like passwords; store them in a secret manager, not in client-side code.

---

## License

PublishOS is released under the **[MIT License](LICENSE)**.

Copyright (c) 2026 Design Value. See [`LICENSE`](LICENSE) for the full text.

---

<p align="center">
  <sub>Built with Next.js, Drizzle, and Auth.js.</sub>
</p>
