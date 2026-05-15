<p align="center">
  <a href="https://publishos.designvalue.co/">
    <img src="docs/wordmark.png" alt="PublishOS by Design Value" width="280" />
  </a>
</p>

<h3 align="center">One URL for everything you publish.</h3>

<p align="center">
  Organise files in folders.<br />
  Publish any asset with its own link.<br />
  Share static sites in seconds.
</p>

<p align="center">
  <a href="https://publishos.designvalue.co/">Website</a>
  &ensp;·&ensp;
  <a href="#gallery">Gallery</a>
  &ensp;·&ensp;
  <a href="#features">Features</a>
  &ensp;·&ensp;
  <a href="#live-demo">Live demo</a>
  &ensp;·&ensp;
  <a href="docs/DEPLOY.md">Deploy</a>
  &ensp;·&ensp;
  <a href="#get-started">Get started</a>
</p>

<br />

<p align="center">
  <a href="https://publishosapp.designvalue.co/login">
    <img src="docs/screenshots/home-folders.png" alt="PublishOS workspace" width="680" />
  </a>
</p>

<p align="center"><sub>Home · folders, uploads, and publishing in one workspace</sub></p>

<br />

---

## Overview

PublishOS is an open-source publishing workspace. Upload HTML, CSS, images, and ZIP archives. Organise work in a folder tree. Give every file its own public or password-protected URL. Run a small team workspace with people, stats, and access logs — without a heavy CMS.

Learn more at **[publishos.designvalue.co](https://publishos.designvalue.co/)**.

Built by [Design Value](https://designvalue.co).

<br />

---

## Gallery

<a id="gallery"></a>

<p align="center"><strong>Sign in</strong></p>

<p align="center">
  <img src="docs/screenshots/login.png" alt="Sign in" width="340" />
  &nbsp;&nbsp;&nbsp;
  <img src="docs/screenshots/register.png" alt="Create workspace" width="340" />
</p>

<p align="center"><sub>Sign in · create a workspace</sub></p>

<br />

<p align="center"><strong>Workspace</strong></p>

<p align="center">
  <img src="docs/screenshots/home-empty.png" alt="Upload" width="680" />
</p>

<p align="center"><sub>Drop files, folders, or zips to begin</sub></p>

<br />

<p align="center">
  <img src="docs/screenshots/home-profile-menu.png" alt="Profile" width="680" />
</p>

<p align="center"><sub>Profile, settings, and sign out</sub></p>

<br />

<p align="center"><strong>Folders & publishing</strong></p>

<p align="center">
  <img src="docs/screenshots/folder-detail.png" alt="Folder" width="680" />
</p>

<p align="center"><sub>Nested folders, files, and metadata at a glance</sub></p>

<br />

<p align="center">
  <img src="docs/screenshots/publish-file.png" alt="Publish" width="340" />
  &nbsp;&nbsp;&nbsp;
  <img src="docs/screenshots/new-folder-modal.png" alt="New folder" width="340" />
</p>

<p align="center"><sub>Publish to a URL · create folders with access controls</sub></p>

<br />

<p align="center"><strong>People & settings</strong></p>

<p align="center">
  <img src="docs/screenshots/people.png" alt="People" width="340" />
  &nbsp;&nbsp;&nbsp;
  <img src="docs/screenshots/settings.png" alt="Settings" width="340" />
</p>

<p align="center"><sub>Members, roles, storage, API, and email</sub></p>

<br />

---

## Features

<a id="features"></a>

<p align="center">
  <strong>Organise</strong> — Folder tree, drag-and-drop upload, ZIP extract, trash & restore<br />
  <strong>Publish</strong> — Public or password URLs at <code>/c/…</code>, optional search indexing<br />
  <strong>Collaborate</strong> — People, teams, roles, invitations, ⌘K search<br />
  <strong>Observe</strong> — Per-file stats, workspace rollup, access logs<br />
  <strong>Integrate</strong> — API tokens, <code>POST /api/v1/sites</code>, S3-compatible storage<br />
  <strong>Authenticate</strong> — Email & password, optional Google OAuth, SMTP reset
</p>

<br />

---

## Live demo

<a id="live-demo"></a>

<p align="center">
  <a href="https://publishosapp.designvalue.co/login"><strong>publishosapp.designvalue.co/login</strong></a>
</p>

<p align="center">
  Email · <code>demo@designvalue.co</code><br />
  Password · <code>designvalue</code>
</p>

<p align="center"><sub>Use <strong>Sign in with demo account</strong> on the login page to fill the form.</sub></p>

<br />

---

## Get started

<a id="get-started"></a>

**Run locally** — Node.js 20+, pnpm

```bash
git clone https://github.com/designvalue/PublishOS.git
cd PublishOS && pnpm install

cp .env.example .env.local
# AUTH_SECRET=$(openssl rand -base64 32)
# AUTH_URL=http://localhost:3000

pnpm drizzle-kit push && pnpm dev
```

Open [localhost:3000](http://localhost:3000) and register at `/register`.

**Deploy** — Use Postgres and S3-compatible storage in production.  
Full guide → **[docs/DEPLOY.md](docs/DEPLOY.md)** (Vercel, AWS, Render, Azure, Docker)

| | |
|---|---|
| `AUTH_SECRET` | Session signing |
| `AUTH_URL` | Your public origin |
| `DATABASE_URL` | Postgres |
| Settings → Storage | S3/R2 + public URL for `/c/…` links |

<br />

---

<p align="center">
  <sub>
    Next.js 16 · React 19 · Auth.js · Drizzle · TypeScript · MIT License
  </sub>
</p>

<p align="center">
  <sub>
    <a href="https://publishos.designvalue.co/">Website</a>
    &ensp;·&ensp;
    <a href="https://publishosapp.designvalue.co/login">Live demo</a>
    &ensp;·&ensp;
    <a href="https://github.com/designvalue/PublishOS">GitHub</a>
    &ensp;·&ensp;
    <a href="docs/DEPLOY.md">Deploy</a>
  </sub>
</p>

<p align="center">
  <sub>Designed by <a href="https://designvalue.co">Design Value</a></sub>
</p>
