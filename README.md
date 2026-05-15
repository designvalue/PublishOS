<p align="center">
  <img src="app/icon.png" alt="PublishOS" width="120" height="120" />
</p>

<h1 align="center">PublishOS</h1>

<p align="center">
  <strong>Folder-first publishing.</strong> Organise files in folders, publish any asset with its own URL, and share static sites in seconds.
</p>

<p align="center">
  <a href="#live-demo"><strong>Live demo</strong></a> ·
  <a href="#screenshots">Screenshots</a> ·
  <a href="docs/DEPLOY.md"><strong>Deploy guide</strong></a> ·
  <a href="#getting-started">Run locally</a> ·
  <a href="#features">Features</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Postgres%20%7C%20SQLite-Drizzle-003B57" alt="Postgres or SQLite" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT" /></a>
</p>

<p align="center">
  <a href="https://publishosapp.designvalue.co/login"><img src="docs/screenshots/home-folders.png" alt="PublishOS workspace" width="720" /></a>
</p>

---

## Live demo

Try the hosted workspace at **[publishosapp.designvalue.co](https://publishosapp.designvalue.co/login)**.

| | |
|---|---|
| **URL** | [https://publishosapp.designvalue.co/login](https://publishosapp.designvalue.co/login) |
| **Email** | `demo@designvalue.co` |
| **Password** | `designvalue` |

The login page shows a **Demo account** callout on that host only. Use **Use demo credentials** to fill the form, then **Sign in to PublishOS**.

> **Note:** The demo account must exist on that deployment. If sign-in fails, register once at `/register` with the same email, or ask an admin to create the user.

---

## Overview

PublishOS is a self-hostable web app for managing **sites as folders**: upload HTML, CSS, images, and ZIP archives; organise work in a tree; **publish individual files** with public or password-protected URLs; and run a small workspace with **people, teams, stats, and logs**.

Built by [Design Value](https://designvalue.co). Crafted for teams who want a straight path from files on disk to a shareable link—without a heavy CMS for simple static sites.

---

## Screenshots

### Sign in and onboarding

<p align="center">
  <img src="docs/screenshots/login.png" alt="Sign in with demo credentials" width="380" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/register.png" alt="Create workspace" width="380" />
</p>

<p align="center"><sub>Sign in · Create workspace</sub></p>

<p align="center">
  <img src="docs/screenshots/forgot-password.png" alt="Forgot password" width="380" />
</p>

<p align="center"><sub>Password reset flow (SMTP configurable in Settings)</sub></p>

### Home workspace

<p align="center">
  <img src="docs/screenshots/home-empty.png" alt="Home — drop files to begin" width="720" />
</p>

<p align="center"><sub>Drag-and-drop upload with folder destination picker</sub></p>

<p align="center">
  <img src="docs/screenshots/home-folders.png" alt="Home — folder list" width="720" />
</p>

<p align="center"><sub>All folders — private, shared, and org-wide filters</sub></p>

<p align="center">
  <img src="docs/screenshots/home-profile-menu.png" alt="Profile menu" width="720" />
</p>

<p align="center"><sub>Profile, Settings (Super Admin), and sign out</sub></p>

### Folders and publishing

<p align="center">
  <img src="docs/screenshots/new-folder-modal.png" alt="New folder modal" width="720" />
</p>

<p align="center"><sub>Create folders at the root or nested — private or shared, with colour tags</sub></p>

<p align="center">
  <img src="docs/screenshots/folder-detail.png" alt="Folder detail" width="720" />
</p>

<p align="center"><sub>Subfolders, files, metadata, and quick actions</sub></p>

<p align="center">
  <img src="docs/screenshots/publish-file.png" alt="Publish file from context menu" width="720" />
</p>

<p align="center"><sub>Publish any file to get its own <code>/c/…</code> URL — public or password-protected</sub></p>

<p align="center">
  <img src="docs/screenshots/folder-actions.png" alt="Folder actions menu" width="720" />
</p>

<p align="center"><sub>Rename, duplicate, move, download as zip, and more</sub></p>

### People and settings

<p align="center">
  <img src="docs/screenshots/people.png" alt="People and teams" width="720" />
</p>

<p align="center"><sub>Workspace members, roles, and invitations</sub></p>

<p align="center">
  <img src="docs/screenshots/settings.png" alt="Workspace settings" width="720" />
</p>

<p align="center"><sub>Defaults, sign-up policy, API access, storage, email, and access logs</sub></p>

---

## Features

### Workspace and content

- **Folder tree** with breadcrumbs, nested folders, and a home workspace view
- **File upload** (multipart), ZIP **extract**, collision-safe naming, and trash with restore
- **`index.html` awareness** for publishable site folders
- **Duplicate**, **move**, and **download** (folder zip) where supported

### Publishing

- Per-file **publish modes**: off, public, or password-gated
- Public URLs at **`/c/<id-or-slug>`** with optional search indexing
- **Share drawer** and folder-level visibility (private / shared)

### Collaboration

- **People** and **teams**, invitations, workspace roles (Super Admin, Admin, Editor, Viewer)
- **Command palette** search (`⌘K`), stats, access logs, and in-app notifications

### Authentication

- **Auth.js v5** — email/password and optional **Google OAuth**
- Registration with optional **domain allowlist**
- Password reset when SMTP is configured in Settings

### Operators and automation

- **Settings**: storage (local or **S3-compatible**), SMTP, sign-up policy, API access
- **API tokens** and **`POST /api/v1/sites`** for programmatic HTML / multi-file ingestion

---

## Tech stack

| Layer | Choice |
|--------|--------|
| Framework | [Next.js 16](https://nextjs.org/) App Router |
| UI | React 19, Radix UI, Tailwind CSS v4 |
| Auth | Auth.js v5, `@auth/drizzle-adapter` |
| Database | **SQLite** (dev / single server) or **Postgres** via `DATABASE_URL` |
| ORM | [Drizzle](https://orm.drizzle.team/) |
| Object storage | Local disk or S3-compatible (R2, AWS S3, MinIO) — configured in-app |
| Validation | Zod |

---

## Deploy to production

Full instructions for **Vercel, AWS, Render, Azure**, and **VPS/Docker** — environment variables, Postgres, S3 storage, custom domains, demo login, and troubleshooting:

### → [docs/DEPLOY.md](docs/DEPLOY.md)

**Production checklist (all platforms):**

| Requirement | Why |
|-------------|-----|
| `AUTH_SECRET` (≥ 16 chars) | Session signing |
| `AUTH_URL` = `https://your-domain.com` | Auth callbacks and cookies |
| `DATABASE_URL` (Postgres) | Durable metadata on serverless / multi-instance hosts |
| **Settings → Storage** → S3/R2 + **Public URL** | Durable file blobs and reliable `/c/…` links |

Example stack for [publishosapp.designvalue.co](https://publishosapp.designvalue.co): **Vercel** + **Neon Postgres** + **S3-compatible storage**.

---

## Run locally

### Prerequisites

- **Node.js** 20+
- **pnpm**

### Setup

```bash
git clone https://github.com/designvalue/PublishOS.git
cd PublishOS
pnpm install

cp .env.example .env.local
# AUTH_SECRET=$(openssl rand -base64 32)
# AUTH_URL=http://localhost:3000

pnpm drizzle-kit push   # SQLite schema
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) → `/login` or `/register` for the first user.

### Production build (local)

```bash
pnpm build
pnpm start
```

### Environment variables

See [`.env.example`](.env.example) and [`lib/env.ts`](lib/env.ts).

| Variable | Required | Purpose |
|----------|----------|---------|
| `AUTH_SECRET` | Yes (runtime) | Auth.js secret |
| `AUTH_URL` | Recommended | Public origin, e.g. `http://localhost:3000` |
| `DATABASE_URL` | Optional | Postgres; omit for SQLite |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth |
| `NEXT_PUBLIC_GOOGLE_ENABLED` | Optional | Show Google button when `1` |

---

## Configuration

### Database

- **Postgres:** set `DATABASE_URL`; migrations run from `drizzle-pg/` on startup.
- **SQLite:** default `publishos.db`; use `pnpm drizzle-kit push` locally.

### File storage

Configured by a **Super Admin** under **Settings → Storage** (stored in `app_settings`):

- **Local** — `./storage` or a path on a persistent volume (single-server only).
- **S3-compatible** — bucket, region, endpoint, keys, and **Public URL** for CDN-backed `/c/…` links.

### Auth routing

- [`proxy.ts`](proxy.ts) — session gate; public: `/login`, `/register`, `/c/*`, `/api/auth/*`, `/api/v1/*`.

---

## Project layout

```
app/
  (app)/          # Home, folders, stats, people, settings, trash, …
  (auth)/         # Login, register, password reset
  api/            # REST handlers + /api/v1/sites
components/       # Shell, modals, share drawer, search
lib/
  db/             # Drizzle + schema
  storage/        # Local + S3 backends
  data/           # Server data access
docs/
  DEPLOY.md       # Deployment guide
  screenshots/    # README images
drizzle/          # SQLite migrations
drizzle-pg/       # Postgres migrations
```

---

## API overview

| Area | Auth | Examples |
|------|------|----------|
| Browser session | Cookie (Auth.js) | `/api/folders`, `/api/files`, `/api/search` |
| Versioned API | `Authorization: Bearer pos_…` | `POST /api/v1/sites` |

See [`lib/api-auth.ts`](lib/api-auth.ts).

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm start` | Serve production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest |
| `pnpm drizzle-kit push` | Push SQLite schema |
| `pnpm drizzle-kit migrate --config=drizzle.config.pg.ts` | Postgres migrations (manual) |

---

## Security

- Never commit `.env.local`, `*.db`, or `storage/`.
- Rotate `AUTH_SECRET` if exposed.
- Treat API tokens like passwords.
- For production, use **Postgres + S3** on ephemeral/serverless hosts (see [deploy guide](docs/DEPLOY.md)).

---

## Contributing

1. Fork and clone the repo.
2. Branch, change, run `pnpm lint` and `pnpm test`.
3. Open a pull request with a focused diff.

---

## License

**[MIT License](LICENSE)** — Copyright (c) 2026 Design Value.

---

<p align="center">
  <sub>
    <a href="https://publishosapp.designvalue.co/login">Live demo</a>
    ·
    <a href="docs/DEPLOY.md">Deploy guide</a>
    ·
    Crafted with ❤️ <a href="https://designvalue.co">Design Value</a>
  </sub>
</p>
