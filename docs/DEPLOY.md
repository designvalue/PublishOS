# PublishOS deployment guide

Deploy PublishOS on **any Node.js host**: Vercel, **AWS**, **Render**, **Azure**, a VPS, or Docker. The app is a standard **Next.js 16** server (`pnpm build` → `pnpm start`); platform differences are mostly **persistence**, **env vars**, and **TLS/DNS**.

**Example production:** [publishosapp.designvalue.co](https://publishosapp.designvalue.co) (Vercel + Postgres + object storage).

---

## Table of contents

1. [Universal requirements](#universal-requirements)
2. [Choose your hosting model](#choose-your-hosting-model)
3. [Environment variables (all platforms)](#environment-variables-all-platforms)
4. [Database (all platforms)](#database-all-platforms)
5. [File storage (all platforms)](#file-storage-all-platforms)
6. [Build and run commands](#build-and-run-commands)
7. [Deploy on Vercel](#deploy-on-vercel)
8. [Deploy on AWS](#deploy-on-aws)
9. [Deploy on Render](#deploy-on-render)
10. [Deploy on Azure](#deploy-on-azure)
11. [Deploy on a VPS / Docker](#deploy-on-a-vps--docker)
12. [Authentication, domains, and OAuth](#authentication-domains-and-oauth)
13. [Optional: Google sign-in](#optional-google-sign-in)
14. [Optional: email (SMTP)](#optional-email-smtp)
15. [Demo login callout](#demo-login-callout)
16. [Post-deploy checklist](#post-deploy-checklist)
17. [Troubleshooting](#troubleshooting)
18. [Related docs](#related-docs)

---

## Universal requirements

| Requirement | Details |
|-------------|---------|
| **Runtime** | Node.js **20+** (LTS recommended) |
| **Package manager** | **pnpm** (repo ships `pnpm-lock.yaml`; `npm`/`yarn` work if you adapt commands) |
| **Build** | `pnpm install` then `pnpm build` (`next build`) |
| **Start** | `pnpm start` (serves on port **3000** unless `PORT` is set by the host) |
| **Secrets** | `AUTH_SECRET` (≥ 16 chars) at **runtime** |
| **Public URL** | `AUTH_URL=https://your-domain.com` (no trailing slash) |
| **Database** | **Postgres** via `DATABASE_URL` for production multi-instance / serverless |
| **File blobs** | **S3-compatible** bucket in **Settings → Storage**, or **persistent local disk** on a **single** long-running server |

### What you are deploying

| Layer | Technology |
|--------|------------|
| Framework | Next.js 16 App Router |
| Auth | Auth.js v5 (`trustHost: true` in [`proxy.ts`](../proxy.ts)) |
| DB | SQLite (dev / single server) or Postgres ([`DATABASE_URL`](../lib/env.ts)) |
| Blobs | Local path or S3-compatible ([`lib/storage/`](../lib/storage/)) |
| Native module | `better-sqlite3` (compiled at install; externalized in [`next.config.ts`](../next.config.ts)) |

Postgres migrations for production run automatically from `drizzle-pg/` when the app connects ([`lib/db/neon-client.ts`](../lib/db/neon-client.ts)). SQLite uses `drizzle/` on first boot when `VERCEL=1` and no `DATABASE_URL` ([`lib/db/sqlite-client.ts`](../lib/db/sqlite-client.ts)) — **not** for real production on serverless.

---

## Choose your hosting model

```text
                         ┌──────────────────────┐
              Browser ──►│  PublishOS (Next.js) │
                         │  pnpm start :3000    │
                         └──────────┬───────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 ▼                  ▼                  ▼
           ┌──────────┐     ┌────────────┐    ┌─────────────┐
           │ Postgres │     │ S3 / R2 /  │    │ Google OAuth│
           │ (any host)│     │ MinIO      │    │ (optional)  │
           └──────────┘     └────────────┘    └─────────────┘
```

| Host type | Examples | Database | File storage | Notes |
|-----------|----------|----------|--------------|--------|
| **Serverless / ephemeral disk** | Vercel, AWS Lambda (without EFS), Azure Functions consumption | **Postgres required** | **S3-compatible required** | No durable local uploads |
| **Single VM / container + disk** | EC2, Render Web Service + disk, Azure App Service + Azure Files, VPS | Postgres **or** SQLite on volume | Local `./storage` **or** S3 | Simplest ops on one machine |
| **Managed PaaS** | Vercel, Render, Azure App Service, Elastic Beanstalk | Managed Postgres addon or RDS | S3 or mounted volume | Prefer managed TLS + deploy from Git |

**Rule of thumb:** If you run **more than one instance** or **serverless**, use **Postgres + S3**. If you run **one container/VM with a persistent volume**, local SQLite + local storage is acceptable for small teams.

---

## Environment variables (all platforms)

Set these in your host’s secret store (Vercel env, AWS Parameter Store / task definition, Render env, Azure App Settings, `.env` on VPS, etc.). Template: [`.env.example`](../.env.example). Parser: [`lib/env.ts`](../lib/env.ts).

### Required at runtime

| Variable | Example | Purpose |
|----------|---------|---------|
| `AUTH_SECRET` | `openssl rand -base64 32` | Session signing (min 16 characters) |
| `AUTH_URL` | `https://app.example.com` | Canonical site URL (no path, no trailing `/`) |

### Strongly recommended for production

| Variable | Example | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db?sslmode=require` | Enables Postgres; auto-runs `drizzle-pg` migrations |

### Optional

| Variable | Purpose |
|----------|---------|
| `DATABASE_PATH` | SQLite file path when **not** using `DATABASE_URL` (default `publishos.db`; on Vercel without Postgres → ephemeral `/tmp`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `NEXT_PUBLIC_GOOGLE_ENABLED` | Set to `1` to show Google button on login |
| `NEXT_PUBLIC_DEMO_LOGIN_HOST` | Hostname for demo login banner (default `publishosapp.designvalue.co`) |
| `PORT` | Listen port (many PaaS set this automatically; Next.js respects it) |
| `NODE_ENV` | `production` on live hosts |

`AUTH_SECRET` may use a build-time placeholder during `next build` if unset in CI; **live traffic must use a real secret**.

---

## Database (all platforms)

### Postgres (recommended for production)

Works on **any** provider: Neon, AWS RDS, Render Postgres, Azure Database for PostgreSQL, Supabase, self-hosted Postgres, etc.

1. Create a database and user.
2. Set `DATABASE_URL` to a `postgresql://` or `postgres://` connection string (use **SSL** in production when offered).
3. Deploy / restart the app. Schema is applied from `drizzle-pg/` on startup.

Manual migrate (optional):

```bash
export DATABASE_URL="postgresql://..."
pnpm drizzle-kit migrate --config=drizzle.config.pg.ts
```

### SQLite (single-server only)

```bash
cp .env.example .env.local
# AUTH_SECRET=...
# DATABASE_PATH=/var/lib/publishos/publishos.db   # persistent path on VM
pnpm drizzle-kit push
pnpm dev   # or pnpm build && pnpm start
```

Do **not** rely on SQLite on **serverless** or **ephemeral** filesystems (Vercel `/tmp`, short-lived containers without volumes).

---

## File storage (all platforms)

Configured in the app by a **Super Admin** under **Settings → Storage** (stored in `app_settings`), not only via env vars.

### Option A — S3-compatible (best for scale and serverless)

Use **AWS S3**, **Cloudflare R2**, **MinIO**, **Wasabi**, etc.

| Field | AWS S3 example |
|-------|----------------|
| Bucket | `my-publishos-bucket` |
| Region | `us-east-1` |
| Endpoint | `https://s3.us-east-1.amazonaws.com` (or provider-specific) |
| Access key / secret | IAM user with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` |
| **Public URL** | CloudFront URL, S3 static website, or R2 public URL — **important for public `/c/…` links** |

After saving: **re-upload or re-publish** files so objects exist in the bucket.

### Option B — Local filesystem (single server + persistent disk)

- Default root: `storage/` under the app directory.
- On Render/Azure/AWS: mount a **volume** and set **Storage folder** in Settings to that path (e.g. `/data/storage`).
- **Do not** use local-only storage on multi-instance or serverless deployments.

### Not supported as storage backends today

- Vercel Blob, Zoho Catalyst Stratus (SDK/REST), Dropbox, Google Drive — would need new code.

---

## Build and run commands

Use on **every** platform (adjust paths if the host uses a monorepo subfolder):

```bash
# Install (production)
pnpm install --frozen-lockfile

# Build
pnpm build

# Run (production)
pnpm start
```

**Health check:** `GET /login` should return `200` (or redirect).  
**Process:** Keep one Node process per container/VM; use the platform’s HTTP proxy (ALB, Render routing, Azure front door, nginx) for HTTPS.

**Docker (generic):**

```dockerfile
FROM node:20-bookworm AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=build /app/package.json /app/pnpm-lock.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle-pg ./drizzle-pg
EXPOSE 3000
CMD ["pnpm", "start"]
```

Mount volumes for `/data/db` and `/data/storage` if using SQLite + local files.

---

## Deploy on Vercel

[Vercel](https://vercel.com) is serverless: use **Postgres + S3/R2**.

1. **Import** the Git repo → Framework **Next.js**.
2. **Install:** `pnpm install` · **Build:** `pnpm build` · **Node:** 20.x.
3. **Environment variables** (Production + Preview):

   | Variable | Value |
   |----------|--------|
   | `AUTH_SECRET` | random 32+ bytes |
   | `AUTH_URL` | `https://your-domain.com` |
   | `DATABASE_URL` | Neon / Vercel Postgres / external Postgres |

4. **Deploy** → attach **custom domain** → set `AUTH_URL` to match.
5. **Settings → Storage** → S3/R2 + **Public URL**.
6. Register first user at `/register`.

`next.config.ts` traces `drizzle/` and `drizzle-pg/` SQL for serverless. `VERCEL=1` enables SQLite migrate fallback and `/tmp` local storage fallback — avoid both in production by setting `DATABASE_URL` and S3.

---

## Deploy on AWS

Common patterns: **Elastic Beanstalk**, **EC2 + Docker/systemd**, **ECS/Fargate**, **App Runner**. All use the same **build/run** commands and env vars.

### Recommended AWS services

| Concern | AWS service |
|---------|-------------|
| App | EC2, ECS Fargate, Elastic Beanstalk (Node.js), App Runner |
| Database | **Amazon RDS** (PostgreSQL) → `DATABASE_URL` |
| Files | **Amazon S3** (+ optional **CloudFront** as Public URL in Settings) |
| TLS | ALB + ACM certificate, or CloudFront |
| Secrets | Secrets Manager or SSM → inject into task/instance env |

### S3 in PublishOS Settings

| Field | Example |
|-------|---------|
| Endpoint | `https://s3.us-east-1.amazonaws.com` |
| Bucket | `publishos-prod` |
| Region | `us-east-1` |
| Public URL | `https://d111111.cloudfront.net` or bucket website URL |

IAM policy (minimum): `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on `arn:aws:s3:::publishos-prod/*`.

### Elastic Beanstalk (Node.js) — outline

1. Create **RDS PostgreSQL**; note endpoint.
2. Create **S3 bucket** (+ CloudFront if needed).
3. Deploy app (CLI `eb init` / `eb deploy` or connect GitHub).
4. Set environment properties: `AUTH_SECRET`, `AUTH_URL`, `DATABASE_URL`, `NODE_ENV=production`.
5. Proxy: ALB terminates HTTPS; set `AUTH_URL` to `https://your-alb-domain`.
6. Configure Storage in app UI with S3 credentials (or instance role — app currently expects access key in Settings, not IAM role metadata).

### EC2 / ECS — outline

1. Launch instance or task with Node 20, persistent EBS volume optional for local storage mode.
2. Clone repo, set env, `pnpm install && pnpm build && pnpm start`.
3. **systemd** or ECS service definition; behind **ALB**.
4. Prefer RDS + S3 over local disk unless single-instance by design.

### AWS Lambda-only

Not documented as a first-class target: Next.js standalone on Lambda still needs **external Postgres** and **S3**; prefer Beanstalk, App Runner, or ECS for fewer sharp edges.

---

## Deploy on Render

[Render](https://render.com) **Web Service** fits PublishOS well.

### Web Service setup

| Setting | Value |
|---------|--------|
| **Environment** | Node |
| **Build command** | `pnpm install --frozen-lockfile && pnpm build` |
| **Start command** | `pnpm start` |
| **Plan** | Paid recommended for always-on + disk |

### Database

- Add **Render PostgreSQL** *or* use external Neon/RDS.
- Set `DATABASE_URL` from the Render dashboard (Internal URL for same-region service).

### Storage

**Option 1 (recommended):** S3/R2 in **Settings → Storage** (works on all Render plans).

**Option 2:** Attach a **persistent disk** on the Web Service, mount e.g. at `/data`, then in Settings set local storage root to `/data/storage` and `DATABASE_PATH=/data/publishos.db` if using SQLite (single instance only).

### Env on Render

```env
AUTH_SECRET=<generated>
AUTH_URL=https://your-service.onrender.com
DATABASE_URL=<postgres connection string>
NODE_ENV=production
```

Custom domain: Render **Settings → Custom Domains** → update `AUTH_URL` → redeploy.

---

## Deploy on Azure

Common targets: **Azure App Service** (Linux), **Azure Container Apps**, **AKS**.

### Recommended Azure services

| Concern | Service |
|---------|---------|
| App | **App Service** (Node 20 LTS) or **Container Apps** |
| Database | **Azure Database for PostgreSQL** → `DATABASE_URL` |
| Files | **S3-compatible external** (AWS S3 / R2) via Settings, **or** mounted **Azure Files** share for local storage mode |
| TLS | App Service managed certificate or Application Gateway |

PublishOS speaks **S3 API** for object storage, not native Azure Blob SDK. Easiest path on Azure: **Postgres on Azure + S3 or R2** configured in the app. For Blob-only shops, front Blob with a CDN and use S3-compatible gateway, or use **local storage** on a mounted file share.

### App Service (Linux) — outline

1. Create **App Service** (Node 20), **PostgreSQL Flexible Server**.
2. **Configuration → Application settings:** `AUTH_SECRET`, `AUTH_URL`, `DATABASE_URL`, `WEBSITES_PORT=3000` if needed.
3. Deployment: GitHub Actions, ZIP deploy, or Docker container.
4. **Startup command:** `pnpm start` (after build in CI or Oryx build: `pnpm install && pnpm build`).
5. Custom domain + HTTPS binding; set `AUTH_URL` to `https://your-domain.com`.
6. Optional: **Azure Files** mount for `/home/storage` → local storage path in Settings.

### Container Apps / AKS

- Build the [Docker image](#build-and-run-commands).
- Set secrets via Key Vault references.
- Ingress with TLS; `AUTH_URL` = public ingress host.

---

## Deploy on a VPS / Docker

Any Linux VPS (DigitalOcean, Linode, Hetzner, bare metal):

```bash
git clone <repo> && cd PublishOS
cp .env.example .env.local
# Edit: AUTH_SECRET, AUTH_URL, DATABASE_URL or DATABASE_PATH

pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Use **Caddy** or **nginx** reverse proxy to `:3000` with Let’s Encrypt.

| Mode | Config |
|------|--------|
| Small single box | SQLite + `DATABASE_PATH=/var/lib/publishos/db.sqlite` + local `storage/` on volume |
| Production | Postgres + S3 (same as cloud PaaS) |

Process manager: **systemd** unit or **PM2** for `pnpm start`.

---

## Authentication, domains, and OAuth

- [`lib/auth.config.ts`](../lib/auth.config.ts) + [`lib/auth.ts`](../lib/auth.ts)
- [`proxy.ts`](../proxy.ts): `trustHost: true` (works behind Vercel, Render, Azure, AWS ALB)
- Public without session: `/login`, `/register`, `/c/*`, `/api/auth/*`, `/api/v1/*` (Bearer token)

Whenever the public URL changes:

1. Update `AUTH_URL` on the host.
2. Restart / redeploy.
3. Re-test login and a public file URL.

---

## Optional: Google sign-in

1. [Google Cloud Console](https://console.cloud.google.com/) → OAuth **Web client**.
2. **Authorized redirect URI:** `https://<your-domain>/api/auth/callback/google`
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_ENABLED=1`.
4. Redeploy / restart.

---

## Optional: email (SMTP)

Outbound mail is configured in-app: **Settings → Email & notifications** (SMTP host, port, credentials). Not required for basic login if you skip password reset email.

---

## Demo login callout

On host **`publishosapp.designvalue.co`** (or `NEXT_PUBLIC_DEMO_LOGIN_HOST`), login shows:

- Email: `demo@designvalue.co`
- Password: `designvalue`

Create that user via `/register` on that deployment. See [`lib/demo-login.ts`](../lib/demo-login.ts).

---

## Post-deploy checklist

- [ ] `https://<domain>/login` loads
- [ ] Sign-in / register works
- [ ] `DATABASE_URL` set (or intentional single-server SQLite on a volume)
- [ ] **Settings → Storage** — S3 configured with **Public URL**, or local path on persistent disk
- [ ] Upload succeeds (`/api/files/upload`)
- [ ] Public `/c/<id>` loads (not 503)
- [ ] `AUTH_URL` matches browser URL exactly
- [ ] Google OAuth (if used) completes

---

## Troubleshooting

| Symptom | Typical cause | Fix |
|---------|----------------|-----|
| **503 on `/c/…`** | Blob missing (ephemeral disk / wrong instance) | S3 + Public URL; re-upload |
| **500 on upload** | Read-only or `/tmp`-only filesystem | S3 storage or persistent volume |
| **Auth fails in prod** | Wrong `AUTH_URL` or missing `AUTH_SECRET` | Align URL with domain; set secret on host |
| **Empty DB** | `DATABASE_URL` missing in that environment | Set secret; check logs for migration errors |
| **Google redirect error** | Mismatch redirect URI | Add exact `https://domain/api/auth/callback/google` |
| **Build OK, runtime env error** | Invalid `AUTH_SECRET` length | ≥ 16 characters |

Check platform logs: Vercel Functions, CloudWatch, Render logs, App Service log stream, container stdout.

---

## Related docs

- [README.md](../README.md) — features and local development
- [.env.example](../.env.example) — environment template

### Example: Design Value (Vercel)

| Item | Value |
|------|--------|
| URL | https://publishosapp.designvalue.co |
| Demo (UI) | `demo@designvalue.co` / `designvalue` |
| Env | `AUTH_URL=https://publishosapp.designvalue.co` |
| DB | Postgres (`DATABASE_URL`) |
| Files | S3/R2 + Public URL in Settings |
