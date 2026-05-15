<p align="center">
  <a href="https://publishosapp.designvalue.co/login">
    <img src="docs/wordmark.png" alt="PublishOS by Design Value" width="320" />
  </a>
</p>

<p align="center">
  <strong>Folder-first publishing.</strong><br />
  Organise files in folders, publish any asset with its own URL, and share static sites in seconds.
</p>

<p align="center">
  <a href="#live-demo"><strong>Live demo</strong></a>
  &nbsp;·&nbsp;
  <a href="#screenshots"><strong>Screenshots</strong></a>
  &nbsp;·&nbsp;
  <a href="docs/DEPLOY.md"><strong>Deploy guide</strong></a>
  &nbsp;·&nbsp;
  <a href="#run-locally"><strong>Run locally</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Postgres%20%7C%20SQLite-Drizzle-003B57" alt="Database" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT License" /></a>
</p>

---

## Live demo

| | |
|---|---|
| **URL** | [publishosapp.designvalue.co/login](https://publishosapp.designvalue.co/login) |
| **Email** | `demo@designvalue.co` |
| **Password** | `designvalue` |

On the demo host, use **Sign in with demo account** below the sign-in button to fill the form, then **Sign in to PublishOS**.

---

## What is PublishOS?

PublishOS is an open-source workspace for **sites as folders**: upload HTML, CSS, images, and ZIPs; organise work in a tree; **publish individual files** with public or password-protected URLs; and manage **people, teams, stats, and access logs** — without a heavy CMS for simple static sites.

Built by [Design Value](https://designvalue.co).

---

## Screenshots

<p align="center"><sub>← Use the dots to browse · click an image to open full size →</sub></p>

<!-- Carousel: pure CSS (no JS) for GitHub README -->
<style>
  .pos-carousel {
    position: relative;
    max-width: 820px;
    margin: 0 auto 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  }
  .pos-carousel > input { display: none; }
  .pos-carousel .pos-slides {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 10;
    background: #f6f5f2;
    border-radius: 12px;
    border: 1px solid #e8e6e1;
    overflow: hidden;
  }
  .pos-carousel .pos-slide {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    opacity: 0;
    transition: opacity 0.35s ease;
    pointer-events: none;
  }
  .pos-carousel .pos-slide img {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    border-radius: 6px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  }
  .pos-carousel .pos-slide a { pointer-events: auto; line-height: 0; }
  #pos-s01:checked ~ .pos-slides .pos-slide:nth-child(1),
  #pos-s02:checked ~ .pos-slides .pos-slide:nth-child(2),
  #pos-s03:checked ~ .pos-slides .pos-slide:nth-child(3),
  #pos-s04:checked ~ .pos-slides .pos-slide:nth-child(4),
  #pos-s05:checked ~ .pos-slides .pos-slide:nth-child(5),
  #pos-s06:checked ~ .pos-slides .pos-slide:nth-child(6),
  #pos-s07:checked ~ .pos-slides .pos-slide:nth-child(7),
  #pos-s08:checked ~ .pos-slides .pos-slide:nth-child(8),
  #pos-s09:checked ~ .pos-slides .pos-slide:nth-child(9),
  #pos-s10:checked ~ .pos-slides .pos-slide:nth-child(10),
  #pos-s11:checked ~ .pos-slides .pos-slide:nth-child(11),
  #pos-s12:checked ~ .pos-slides .pos-slide:nth-child(12) {
    opacity: 1;
    pointer-events: auto;
    z-index: 1;
  }
  .pos-carousel .pos-dots {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    margin-top: 14px;
  }
  .pos-carousel .pos-dots label {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #d4d2cc;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.2s ease;
  }
  .pos-carousel .pos-dots label:hover { background: #9a9690; }
  #pos-s01:checked ~ .pos-dots label[for="pos-s01"],
  #pos-s02:checked ~ .pos-dots label[for="pos-s02"],
  #pos-s03:checked ~ .pos-dots label[for="pos-s03"],
  #pos-s04:checked ~ .pos-dots label[for="pos-s04"],
  #pos-s05:checked ~ .pos-dots label[for="pos-s05"],
  #pos-s06:checked ~ .pos-dots label[for="pos-s06"],
  #pos-s07:checked ~ .pos-dots label[for="pos-s07"],
  #pos-s08:checked ~ .pos-dots label[for="pos-s08"],
  #pos-s09:checked ~ .pos-dots label[for="pos-s09"],
  #pos-s10:checked ~ .pos-dots label[for="pos-s10"],
  #pos-s11:checked ~ .pos-dots label[for="pos-s11"],
  #pos-s12:checked ~ .pos-dots label[for="pos-s12"] {
    background: #1a1a1a;
    transform: scale(1.15);
  }
  .pos-carousel .pos-captions {
    position: relative;
    min-height: 1.4em;
    margin-top: 10px;
    text-align: center;
    font-size: 13px;
    color: #6b6862;
  }
  .pos-carousel .pos-caption {
    position: absolute;
    left: 0;
    right: 0;
    opacity: 0;
    transition: opacity 0.35s ease;
  }
  #pos-s01:checked ~ .pos-captions .pos-caption:nth-child(1),
  #pos-s02:checked ~ .pos-captions .pos-caption:nth-child(2),
  #pos-s03:checked ~ .pos-captions .pos-caption:nth-child(3),
  #pos-s04:checked ~ .pos-captions .pos-caption:nth-child(4),
  #pos-s05:checked ~ .pos-captions .pos-caption:nth-child(5),
  #pos-s06:checked ~ .pos-captions .pos-caption:nth-child(6),
  #pos-s07:checked ~ .pos-captions .pos-caption:nth-child(7),
  #pos-s08:checked ~ .pos-captions .pos-caption:nth-child(8),
  #pos-s09:checked ~ .pos-captions .pos-caption:nth-child(9),
  #pos-s10:checked ~ .pos-captions .pos-caption:nth-child(10),
  #pos-s11:checked ~ .pos-captions .pos-caption:nth-child(11),
  #pos-s12:checked ~ .pos-captions .pos-caption:nth-child(12) {
    opacity: 1;
    position: relative;
  }
</style>

<div class="pos-carousel">
  <input type="radio" name="pos-screens" id="pos-s01" checked />
  <input type="radio" name="pos-screens" id="pos-s02" />
  <input type="radio" name="pos-screens" id="pos-s03" />
  <input type="radio" name="pos-screens" id="pos-s04" />
  <input type="radio" name="pos-screens" id="pos-s05" />
  <input type="radio" name="pos-screens" id="pos-s06" />
  <input type="radio" name="pos-screens" id="pos-s07" />
  <input type="radio" name="pos-screens" id="pos-s08" />
  <input type="radio" name="pos-screens" id="pos-s09" />
  <input type="radio" name="pos-screens" id="pos-s10" />
  <input type="radio" name="pos-screens" id="pos-s11" />
  <input type="radio" name="pos-screens" id="pos-s12" />

  <div class="pos-slides">
    <div class="pos-slide"><a href="docs/screenshots/login.png"><img src="docs/screenshots/login.png" alt="Sign in" /></a></div>
    <div class="pos-slide"><a href="docs/screenshots/register.png"><img src="docs/screenshots/register.png" alt="Create workspace" /></a></div>
    <div class="pos-slide"><a href="docs/screenshots/forgot-password.png"><img src="docs/screenshots/forgot-password.png" alt="Forgot password" /></a></div>
    <div class="pos-slide"><a href="docs/screenshots/home-empty.png"><img src="docs/screenshots/home-empty.png" alt="Home — upload" /></a></div>
    <div class="pos-slide"><a href="docs/screenshots/home-folders.png"><img src="docs/screenshots/home-folders.png" alt="Home — folders" /></a></div>
    <div class="pos-slide"><a href="docs/screenshots/home-profile-menu.png"><img src="docs/screenshots/home-profile-menu.png" alt="Profile menu" /></a></div>
    <div class="pos-slide"><a href="docs/screenshots/new-folder-modal.png"><img src="docs/screenshots/new-folder-modal.png" alt="New folder" /></a></div>
    <div class="pos-slide"><a href="docs/screenshots/folder-detail.png"><img src="docs/screenshots/folder-detail.png" alt="Folder detail" /></a></div>
    <div class="pos-slide"><a href="docs/screenshots/publish-file.png"><img src="docs/screenshots/publish-file.png" alt="Publish file" /></a></div>
    <div class="pos-slide"><a href="docs/screenshots/folder-actions.png"><img src="docs/screenshots/folder-actions.png" alt="Folder actions" /></a></div>
    <div class="pos-slide"><a href="docs/screenshots/people.png"><img src="docs/screenshots/people.png" alt="People and teams" /></a></div>
    <div class="pos-slide"><a href="docs/screenshots/settings.png"><img src="docs/screenshots/settings.png" alt="Workspace settings" /></a></div>
  </div>

  <div class="pos-dots">
    <label for="pos-s01" title="Sign in"></label>
    <label for="pos-s02" title="Register"></label>
    <label for="pos-s03" title="Forgot password"></label>
    <label for="pos-s04" title="Home"></label>
    <label for="pos-s05" title="Folders"></label>
    <label for="pos-s06" title="Profile"></label>
    <label for="pos-s07" title="New folder"></label>
    <label for="pos-s08" title="Folder"></label>
    <label for="pos-s09" title="Publish"></label>
    <label for="pos-s10" title="Actions"></label>
    <label for="pos-s11" title="People"></label>
    <label for="pos-s12" title="Settings"></label>
  </div>

  <div class="pos-captions">
    <span class="pos-caption"><strong>Sign in</strong> — demo account link on publishosapp.designvalue.co</span>
    <span class="pos-caption"><strong>Create workspace</strong> — name, email, password</span>
    <span class="pos-caption"><strong>Forgot password</strong> — SMTP configurable in Settings</span>
    <span class="pos-caption"><strong>Home</strong> — drag-and-drop files, folders, or zips</span>
    <span class="pos-caption"><strong>All folders</strong> — private, shared, and org-wide filters</span>
    <span class="pos-caption"><strong>Profile</strong> — settings and sign out</span>
    <span class="pos-caption"><strong>New folder</strong> — location, colour, private or shared</span>
    <span class="pos-caption"><strong>Folder view</strong> — subfolders, files, metadata</span>
    <span class="pos-caption"><strong>Publish</strong> — public or password-protected <code>/c/…</code> URLs</span>
    <span class="pos-caption"><strong>Actions</strong> — share, zip, rename, move, delete</span>
    <span class="pos-caption"><strong>People</strong> — members, roles, invitations</span>
    <span class="pos-caption"><strong>Settings</strong> — storage, API, email, access logs</span>
  </div>
</div>

<details>
<summary><strong>View all screenshots (grid)</strong></summary>
<br />

| Sign in | Register |
|:---:|:---:|
| <img src="docs/screenshots/login.png" width="360" alt="Sign in" /> | <img src="docs/screenshots/register.png" width="360" alt="Register" /> |

| Home | Folders |
|:---:|:---:|
| <img src="docs/screenshots/home-empty.png" width="360" alt="Home empty" /> | <img src="docs/screenshots/home-folders.png" width="360" alt="Home folders" /> |

| Folder | Publish |
|:---:|:---:|
| <img src="docs/screenshots/folder-detail.png" width="360" alt="Folder" /> | <img src="docs/screenshots/publish-file.png" width="360" alt="Publish" /> |

| People | Settings |
|:---:|:---:|
| <img src="docs/screenshots/people.png" width="360" alt="People" /> | <img src="docs/screenshots/settings.png" width="360" alt="Settings" /> |

</details>

---

## Features

| Area | Highlights |
|------|------------|
| **Content** | Folder tree, uploads, ZIP extract, trash, duplicate & move |
| **Publishing** | Per-file public or password URLs at `/c/<id>` |
| **Workspace** | People, teams, roles, stats, access logs, ⌘K search |
| **Auth** | Email/password, optional Google OAuth, password reset via SMTP |
| **Ops** | S3-compatible storage, API tokens, `POST /api/v1/sites` |

---

## Deploy

Production needs durable **Postgres** + **object storage** (not ephemeral local disk on serverless).

**Full guide:** [docs/DEPLOY.md](docs/DEPLOY.md) — Vercel, AWS, Render, Azure, VPS/Docker.

| Variable | Purpose |
|----------|---------|
| `AUTH_SECRET` | Session signing (≥ 16 chars) |
| `AUTH_URL` | Public origin, e.g. `https://your-domain.com` |
| `DATABASE_URL` | Postgres connection string |
| **Settings → Storage** | S3/R2 bucket + **Public URL** for `/c/…` links |

---

## Run locally

**Requires:** Node.js 20+, pnpm

```bash
git clone https://github.com/designvalue/PublishOS.git
cd PublishOS
pnpm install

cp .env.example .env.local
# AUTH_SECRET=$(openssl rand -base64 32)
# AUTH_URL=http://localhost:3000

pnpm drizzle-kit push
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and register your first user at `/register`.

```bash
pnpm build && pnpm start   # production build locally
```

See [`.env.example`](.env.example) for optional Google OAuth and demo-host overrides.

---

## Tech stack

Next.js 16 · React 19 · Auth.js v5 · Drizzle · SQLite or Postgres · Local or S3 storage · Tailwind CSS v4 · Zod

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm start` | Serve production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest |

---

## License

[MIT License](LICENSE) — Copyright (c) 2026 [Design Value](https://designvalue.co).

<p align="center">
  <sub>
    <a href="https://publishosapp.designvalue.co/login">Live demo</a>
    ·
    <a href="docs/DEPLOY.md">Deploy guide</a>
    ·
    Crafted with ❤️ Design Value
  </sub>
</p>
