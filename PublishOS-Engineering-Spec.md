# PublishOS — Engineering Build Spec

> Handoff document for building PublishOS in **Next.js 14 (App Router) + React 18 + TypeScript**.

Use this spec together with two companion references:

| File | What it is | How to use it |
|---|---|---|
| `shelf-quiet.html` | Working interactive prototype | **Source of truth for every visual detail and interaction.** Open it in a browser, click everything, then translate the markup, CSS rules, and JS handlers to React + Tailwind components. |
| `PublishOS-Product-Note.md` | Product PRD | **Source of truth for the *what* and *why*** — features, mental model, copy, voice. |
| `PublishOS-Engineering-Spec.md` | This file | **Source of truth for the *how*** — tech stack, architecture, file layout, types, contracts, build order. |

When in doubt, prefer the prototype's visual / interactive behaviour over what's described in prose.

---

## 0. Recommended reading order

When starting a new task, read in this order:

1. The relevant section of this spec (architecture / component / contract)
2. The corresponding markup + CSS + JS in `shelf-quiet.html` (search by class name or id)
3. The voice / copy notes in `PublishOS-Product-Note.md`

Then write code.

---

## 1. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14** with App Router | RSC for read-heavy pages, route handlers for API, file-based routing |
| Language | **TypeScript** (strict mode) | Type-safe across server + client |
| UI | **React 18** | Server Components by default, Client Components on demand |
| Styling | **Tailwind CSS** + CSS variables for design tokens | The prototype already uses CSS variables; Tailwind gives utility-class velocity |
| Component primitives | **Radix UI** (Dialog, Popover, DropdownMenu, Tabs, Toast, Tooltip) | Accessibility for free; styled with Tailwind |
| Icons | Inline SVGs co-located with components (matches prototype) | Avoid bundling a full icon library |
| Forms | **react-hook-form** + **zod** | Schema validation that flows from server to client |
| Animation | **Framer Motion** (only where needed: drawer slide-in, modal scale, view fade) | Less reach-for than CSS for choreographed motion |
| Server state | **TanStack Query (React Query) v5** | Cache, optimistic updates, mutations |
| Client state | **Zustand** for global UI state (open dialogs, active drawer, toast queue) | Simpler than Context for this scope |
| Auth | **Auth.js (NextAuth) v5** | Email/password, Google OAuth, magic link |
| Database | **PostgreSQL** + **Drizzle ORM** | Type-safe schema, migrations |
| Object storage | **Cloudflare R2** (S3-compatible) for files; multipart upload for large files | Cheap egress, S3 SDK works |
| Hosting | **Vercel** for the app; **Cloudflare Workers + R2** for the published-folder edge serving | Edge-cache the published folders close to visitors |
| AI / Pilot | **Managed LLM** via the Anthropic SDK; tool use for actions; stream for chat | Matches the prototype’s Pilot behaviour |
| Email | **Resend** | Magic links, invite emails, password rotation notifications |
| Analytics for hosted sites | Custom — log requests at the edge, aggregate hourly into Postgres | Privacy-friendly, no third party |
| Tests | **Vitest** + **Playwright** | Unit / component + e2e |

> Stay strict TypeScript. No `any`. Use `unknown` and narrow.

---

## 2. Project structure

```
publishos/
├─ app/
│  ├─ (auth)/                  # auth routes — no layout chrome
│  │  ├─ login/page.tsx
│  │  └─ layout.tsx            # blank layout for auth
│  ├─ (app)/                   # main app — has the header + nav
│  │  ├─ layout.tsx            # header, dropdown, search palette mounted here
│  │  ├─ page.tsx              # /  → home (greeting + drop + workspace list)
│  │  ├─ stats/page.tsx        # /stats → workspace-level analytics
│  │  ├─ logs/page.tsx         # /logs → live request stream
│  │  ├─ people/page.tsx       # /people → People & Teams
│  │  ├─ settings/page.tsx     # /settings (also linked from user dropdown)
│  │  └─ folders/[...path]/page.tsx   # /folders/q2-launch  /folders/q2-launch/assets
│  ├─ api/
│  │  ├─ folders/...           # CRUD for folders
│  │  ├─ files/...             # upload, replace, delete
│  │  ├─ shares/...            # access + publishing settings
│  │  ├─ stats/...             # aggregated metrics
│  │  ├─ search/...            # search index
│  │  ├─ pilot/...             # pilot suggestions, chat
│  │  └─ auth/[...nextauth]/route.ts
│  └─ layout.tsx               # global <html>, fonts, providers
│
├─ components/
│  ├─ shell/                   # header, nav, user-dropdown, search-trigger
│  ├─ home/                    # greeting, live-status, drop-zone, templates
│  ├─ workspace/               # folder-row, folder-list, folder-filters, folder-sort
│  ├─ folder/                  # folder-detail-header, folder-stats, folder-contents,
│  │                           # subfolder-banner, settings-sidebar
│  ├─ share/                   # share-drawer, share-toggle, access-pane, publish-pane
│  ├─ search/                  # search-palette, search-result
│  ├─ menus/                   # action-menu, sort-menu (positioned popovers)
│  ├─ modals/                  # new-folder-modal, upload-modal
│  ├─ people/                  # people-list, teams-list
│  ├─ stats/                   # kpi, bar-row, traffic-chart, sources-list
│  ├─ logs/                    # log-row, log-stream
│  ├─ pilot/                   # live-status-rotator, pilot-suggestion-card
│  └─ ui/                      # shared primitives: button, toggle, input, tile, pill, toast
│
├─ lib/
│  ├─ db/                      # Drizzle client + schema
│  ├─ storage/                 # R2 / S3 client
│  ├─ auth/                    # Auth.js config
│  ├─ pilot/                   # LLM client + system prompts + tool definitions
│  ├─ search/                  # search index builder
│  ├─ slug.ts                  # slugify util
│  ├─ format.ts                # format size / date / relative-time
│  └─ types.ts                 # shared TS types (re-exports)
│
├─ stores/
│  ├─ ui-store.ts              # Zustand: which drawer/modal/menu is open
│  └─ toast-store.ts           # toast queue
│
├─ styles/
│  └─ globals.css              # @tailwind base/components/utilities + CSS variables
│
├─ public/                     # static assets
├─ tests/
│  ├─ unit/
│  └─ e2e/
├─ tailwind.config.ts
├─ tsconfig.json
├─ next.config.mjs
├─ drizzle.config.ts
└─ package.json
```

---

## 3. Design system — tokens & primitives

### 3.1 Tailwind configuration

Extract the exact tokens from `:root` in the prototype CSS and lift them into `tailwind.config.ts`. Use the same names so the prototype stays diff-able.

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:        '#FFFFFF',
        surface:   '#FBFAF6',
        hover:     '#F1EFE8',
        hair:      '#EAE9E3',
        'hair-soft': '#F2F0EA',
        text:      { DEFAULT: '#14130F', 2: '#6B6962', 3: '#ACAAA2' },
        green:     { DEFAULT: '#2F8A5F', soft: '#E4F1EA', border: '#BFE0CD' },
        amber:     { DEFAULT: '#C97432', soft: '#FBE9D6', border: '#F0CDA1' },
        blue:      { DEFAULT: '#3F6BD0', soft: '#E5ECFA', border: '#C7D5F2' },
        violet:    { DEFAULT: '#7E4FCC', soft: '#EFE7FA', border: '#D9C7F0' },
        coral:     { DEFAULT: '#D8504F', soft: '#FBE5E5' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tight: '-0.005em',
        tighter: '-0.012em',
        tightest: '-0.022em',
      },
      borderRadius: {
        sm: '5px',
        DEFAULT: '7px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        '2xl': '14px',
      },
      keyframes: {
        viewIn: { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        ddIn:   { from: { opacity: '0', transform: 'translateY(-4px) scale(0.98)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        pulse:  { '0%,100%': { opacity: '1', transform: 'scale(1)' }, '50%': { opacity: '0.5', transform: 'scale(0.85)' } },
      },
      animation: {
        viewIn: 'viewIn .28s cubic-bezier(.2,.8,.2,1)',
        ddIn:   'ddIn .14s cubic-bezier(.2,.8,.2,1)',
        pulse:  'pulse 2.4s ease-in-out infinite',
      },
    },
  },
} satisfies Config;
```

Brand gradient is a CSS variable (since gradients can't go in Tailwind cleanly):

```css
/* globals.css */
:root {
  --brand-grad: linear-gradient(135deg, #C97432 0%, #D8504F 50%, #7E4FCC 100%);
  --bar-grad: linear-gradient(90deg, #3F6BD0 0%, #7E4FCC 60%, #D8504F 100%);
}
```

Inter is loaded via `next/font/google` in `app/layout.tsx`.

### 3.2 Brand logo as a sprite

Mount one shared SVG sprite once in `app/layout.tsx` (in `<body>`):

```tsx
// components/shell/BrandSprite.tsx — server component
export function BrandSprite() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden>
      <defs>
        <linearGradient id="brandGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#C97432" />
          <stop offset="0.55" stopColor="#D8504F" />
          <stop offset="1" stopColor="#7E4FCC" />
        </linearGradient>
        <symbol id="logo" viewBox="0 0 24 24">
          <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#brandGradient)" />
          <path d="M9 7v10M9 7h4a3 3 0 010 6H9" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </symbol>
      </defs>
    </svg>
  );
}
```

Use anywhere as `<svg className="size-[18px]"><use href="#logo" /></svg>`.

### 3.3 Primitive components (`components/ui/`)

Build these first — every other component composes them:

- `Button` — variants `primary | secondary | ghost | text`, sizes `sm | md`
- `IconButton` — square 28-32px clickable area
- `Toggle` — controlled, animated thumb (the dot)
- `Input`, `Textarea`, `Select` — focus ring `focus:ring-3 focus:ring-violet/15`
- `Pill` — variants `public | private | password | shared | live | draft | org`
- `Tile` — radio card for visibility / templates
- `Avatar` — initials + gradient background; sizes `xs (14px) | sm (22px) | md (24px) | lg (36px)`
- `Tabs` — segmented (Share toggle) + underlined (sub-nav)
- `Modal` — centred dialog wrapper using Radix Dialog
- `Drawer` — right-edge sliding panel using Radix Dialog with custom transform
- `Popover` — for action menu, sort menu, user dropdown (Radix Popover or DropdownMenu)
- `Toast` — global queue, single visible toast, undo support

Every primitive must:
- Be a default-exported component
- Accept `className` for extension
- Forward `ref` if it wraps a native element
- Use `cn()` helper (clsx + tailwind-merge) for class composition

---

## 4. Routes

```
/                         home (greeting + drop + workspace list)
/folders/[...path]        folder detail (any depth: /folders/q2-launch/assets/icons)
/stats                    workspace stats
/logs                     access logs
/people                   people & teams (sub-tab via ?tab=people|teams)
/settings                 settings
/login                    login
```

### URL contracts

- `?tab=teams` for the People page sub-tabs
- `?source=mine|shared|org` for workspace list filter (the source tabs)
- `?sort=modified&dir=desc` for the workspace sort (default: `modified`/`desc`)
- The folder breadcrumb maps directly to the URL: `/folders/q2-launch` and `/folders/q2-launch/assets`

### Search and modals stay client-side

`?share=open&folderId=...` opens the share drawer on direct link.

---

## 5. Component inventory

Every screen → which components compose it. **Use this as your build checklist.**

### `(auth)/login`
- `LoginCard` (form)
- `LoginSocial` (Google + magic link)

### `(app)/layout`
- `Header`
  - `BrandPill`
  - `TopNav`
  - `HeaderSearchTrigger`
  - `UserDropdown`
- `SearchPalette` (mounted, hidden until ⌘K)
- `ToastContainer`
- `KeyboardShortcuts` (Esc → close everything; ⌘K → open search)

### `(app)/page` — Home
- `Greeting` (time-aware, name)
- `LiveStatus` (rotating Pilot updates)
- `DropZone` (with two CTAs)
- `TemplatesRow`
- `WorkspaceSection`
  - `WorkspaceHeader` (title + sub + actions)
  - `WorkspaceFilters` (source tabs)
  - `SortDropdown`
  - `FolderList`
    - `FolderRow` (handles all variants: live, draft, shared-by, org)

### `(app)/folders/[...path]` — Folder Detail
- `FolderBreadcrumbs`
- `FolderHeader` (icon, title, meta, actions)
- `FolderFacts` (4 KPI strip)
- `FolderUrlRow`
- `InheritBanner` (subfolder mode)
- `FolderStatsPanel` (collapsible)
  - `KpiStrip`
  - `BarList` (top files / sources)
- `FolderSplit`
  - `FolderContents` (subfolders → files)
  - `SettingsSidebar`

### `(app)/stats`
- `StatsRangeChips`
- `KpiStrip`
- `TrafficChart`
- `BarList` (top pages, sources)

### `(app)/logs`
- `LogStream` (auto-scrolling)
- `LogFilters`
- `AnomalyCard` (Pilot)

### `(app)/people`
- `PeopleSubNav` (People / Teams)
- `MemberList`
- `TeamList`

### `(app)/settings`
- `SettingsSection`
- `SettingsRow` (toggle + meta)

### Drawers, modals, menus (mounted globally in `(app)/layout`)
- `ShareDrawer`
  - `ShareToggle` (top segmented)
  - `AccessPane`
  - `PublishPane`
- `NewFolderModal`
- `UploadModal`
- `ActionMenu` (positioned popover; built per-target)
- `SortMenu` (positioned popover)
- `DropOverlay` (drag anywhere)

---

## 6. Data models (TypeScript)

```ts
// lib/types.ts

export type Visibility = 'private' | 'shared' | 'public';
export type PublishMode = 'off' | 'public' | 'password';
export type Role = 'owner' | 'editor' | 'viewer' | 'guest';

export type FolderId = string; // e.g. "launch-q2/assets"

export type Folder = {
  id: FolderId;
  name: string;
  parentId: FolderId | null;
  ownerId: string;
  createdAt: Date;
  modifiedAt: Date;

  access: {
    visibility: Visibility;
    members: { userId: string; role: Exclude<Role, 'owner'> }[];
    teams:   { teamId: string; role: Exclude<Role, 'owner'> }[];
    org:     { enabled: boolean; role: Exclude<Role, 'owner'> } | null;
  };

  publishing: {
    mode: PublishMode;
    slug: string;          // publishos.app/c/<slug>
    customDomain?: string; // e.g. demo.example.com
    password?: string;     // hashed at rest, returned in plaintext only to authorised callers
    indexable: boolean;    // robots
    allowDownloads: boolean;
    expiresAt?: Date | null;
  };

  hasIndexHtml: boolean;   // → effectively a hosted site

  stats: {
    files: number;
    subfolders: number;
    sizeBytes: number;
    visits30d: number;
    bandwidthBytes30d: number;
  };
};

export type FileItem = {
  id: string;
  folderId: FolderId;
  name: string;
  path: string;            // full path inside the folder
  mime: string;
  sizeBytes: number;
  modifiedAt: Date;
  createdAt: Date;
  width?: number;          // images
  height?: number;
};

export type User = {
  id: string;
  name: string;
  email: string;
  workspaceRole: Role;
  initials: string;        // 'SD'
  avatarColor: 'amber' | 'green' | 'blue' | 'violet' | 'coral';
};

export type Team = {
  id: string;
  name: string;
  description: string;
  memberIds: string[];
  gradient: 'violet-coral' | 'blue-violet' | 'amber-coral';
  initial: string;
};

export type Activity = {
  id: string;
  actor: 'pilot' | { userId: string };
  action: string;          // 'rotated_password' | 'uploaded_files' | ...
  subject: { type: 'folder' | 'file' | 'site'; id: string };
  message: string;         // plain English, the rotating status sentence
  createdAt: Date;
  reversibleUntil?: Date;
};
```

Validation:

```ts
// lib/schemas.ts
import { z } from 'zod';

export const NewFolderInput = z.object({
  name: z.string().min(1).max(80),
  parentId: z.string().nullable(),
  visibility: z.enum(['private','shared','public']),
  templateId: z.string().nullable(),
});

export const SetAccessInput = z.object({
  folderId: z.string(),
  visibility: z.enum(['private','shared']),
  members: z.array(z.object({ userId: z.string(), role: z.enum(['editor','viewer','guest']) })),
  teams:   z.array(z.object({ teamId: z.string(), role: z.enum(['editor','viewer','guest']) })),
  org:     z.object({ enabled: z.boolean(), role: z.enum(['editor','viewer','guest']) }).nullable(),
});

export const SetPublishingInput = z.object({
  folderId: z.string(),
  mode: z.enum(['off','public','password']),
  password: z.string().min(8).optional(),
  indexable: z.boolean(),
  allowDownloads: z.boolean(),
  expiresAt: z.string().datetime().nullable(),
});
```

---

## 7. State management

| State | Where | Why |
|---|---|---|
| Server data (folders, files, members) | **TanStack Query** + Next route handlers | Cache, mutations, optimistic updates |
| Open dialogs/drawers/menus | **Zustand** (`ui-store`) | Cross-component triggers (action menu in row → open share drawer) |
| Toast queue | **Zustand** (`toast-store`) | One global queue |
| Form state | **react-hook-form** | Validation, dirty tracking |
| URL state (filters, sort, tab) | `useSearchParams` / `useRouter` | Shareable, back-button friendly |
| Auth session | `useSession()` from Auth.js | Read across the app |

Example Zustand UI store:

```ts
// stores/ui-store.ts
import { create } from 'zustand';

type ShareTarget = { folderId: string; tab?: 'access' | 'publish' };

export const useUI = create<{
  shareTarget: ShareTarget | null;
  newFolderOpen: boolean;
  uploadTarget: { folderId: string } | null;
  actionMenu: { x: number; y: number; kind: 'folder'|'file'|'subfolder'; targetId: string } | null;
  search: { open: boolean; query: string };
  openShare: (t: ShareTarget) => void;
  closeShare: () => void;
  // ...
}>((set) => ({
  shareTarget: null,
  newFolderOpen: false,
  uploadTarget: null,
  actionMenu: null,
  search: { open: false, query: '' },
  openShare: (t) => set({ shareTarget: t }),
  closeShare: () => set({ shareTarget: null }),
  // ...
}));
```

---

## 8. API contracts

All under `app/api/`. Use route handlers (`route.ts`), validate input with zod, return typed JSON.

### Folders
- `GET    /api/folders?source=mine|shared|org&sort=modified&dir=desc` → `Folder[]`
- `GET    /api/folders/:id` → `Folder` (with children + files)
- `POST   /api/folders` → `Folder` (NewFolderInput)
- `PATCH  /api/folders/:id` → `Folder` (rename / move)
- `DELETE /api/folders/:id` → `{ ok: true, restoreUntil: Date }`
- `POST   /api/folders/:id/duplicate` → `Folder`
- `POST   /api/folders/:id/archive` → `{ ok: true }`

### Files
- `GET    /api/folders/:id/files` → `FileItem[]`
- `POST   /api/files/upload-url` → `{ uploadUrl, fileId }` (presigned R2 PUT)
- `POST   /api/files/upload-complete` → `FileItem` (after client uploads to R2)
- `PATCH  /api/files/:id` → rename / move
- `DELETE /api/files/:id` → undo-able for 30 days

### Access (Sharing)
- `PATCH /api/folders/:id/access` → `Folder` (SetAccessInput)
- `PATCH /api/folders/:id/publishing` → `Folder` (SetPublishingInput)

### People & teams
- `GET   /api/users`     → `User[]`
- `POST  /api/users/invite` → `{ email, role }`
- `GET   /api/teams`     → `Team[]`
- `POST  /api/teams`     → `Team`
- `PATCH /api/teams/:id` → `Team`

### Stats
- `GET /api/stats?range=30d` → workspace
- `GET /api/folders/:id/stats?range=30d` → folder
- `GET /api/files/:id/stats?range=30d` → file

### Logs
- `GET /api/logs?status=2xx,3xx,4xx,5xx&site=...&since=...` → paginated, with cursor

### Search
- `GET /api/search?q=...` → `{ folders: SearchHit[]; files: SearchHit[] }`

### Pilot
- `GET  /api/pilot/status` → live status sentence (rotating set returned together)
- `GET  /api/pilot/suggestions` → pending suggestions
- `POST /api/pilot/approve`   → run a suggestion
- `POST /api/pilot/dismiss`   → dismiss
- `POST /api/pilot/chat`      → SSE stream

---

## 9. Authentication

Auth.js v5 with three providers:
- Email + password (Credentials)
- Google OAuth
- Magic link (Email provider via Resend)

```ts
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import Email from 'next-auth/providers/email';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Credentials({ /* … */ }), Google, Email({ /* Resend */ })],
  pages: { signIn: '/login' },
  session: { strategy: 'database' },
});
export const { GET, POST } = handlers;
```

Middleware:

```ts
// middleware.ts
import { auth } from '@/lib/auth';

export default auth((req) => {
  if (!req.auth && !req.nextUrl.pathname.startsWith('/login')) {
    return Response.redirect(new URL('/login', req.url));
  }
});

export const config = { matcher: ['/((?!_next/static|_next/image|favicon|api/auth).*)'] };
```

---

## 10. File upload flow

Client side, in `UploadModal`:

1. User picks files (or drops them)
2. For each file: `POST /api/files/upload-url` → `{ uploadUrl, fileId }`
3. Client `PUT`s the file directly to R2 with progress events from `XMLHttpRequest` (fetch can't track upload progress)
4. On 200, client `POST /api/files/upload-complete` with `{ fileId, etag, size }`
5. Optimistic insert into the folder list via TanStack Query

Use a **concurrency limit of 3** to avoid hammering R2.

```ts
// lib/upload.ts
export async function uploadFile(file: File, folderId: string, onProgress: (pct: number) => void) {
  const { uploadUrl, fileId } = await api.post('/api/files/upload-url', { folderId, name: file.name, mime: file.type, size: file.size });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => xhr.status < 400 ? resolve() : reject(new Error('upload failed'));
    xhr.onerror = () => reject(new Error('network error'));
    xhr.send(file);
  });
  return api.post('/api/files/upload-complete', { fileId });
}
```

Conflict handling: server returns `{ conflict: true, suggestedName: 'product_render_03 (1).png' }` and the modal shows the amber `name exists · keeps both` pill.

---

## 11. Hosting / publishing — how a folder becomes a site

When a folder has `hasIndexHtml = true` and `publishing.mode !== 'off'`, it's served at:
- `https://publishos.app/c/<slug>` (workspace base) — or
- `https://<customDomain>/` (when configured)

### Edge serving

Cloudflare Worker in front of R2:
- Path `/c/:slug/*` → look up folder by slug
- If `mode === 'password'`, gate via session cookie set after a passphrase form
- Stream the file from R2 with cache headers
- Log the request to a queue → batched into Postgres every minute

### Custom domains

A `domains` table maps `host` → `folderId`. SSL via Cloudflare for SaaS.

### Search-engine indexing

Worker emits `X-Robots-Tag: noindex` unless `publishing.indexable === true`. Also serves a synthesised `/robots.txt`.

---

## 12. Pilot integration

Pilot is a thin orchestration layer over the configured LLM provider.

### System prompt (sketch)

```
You are Pilot, the AI co-pilot inside PublishOS. You help users manage folders, files,
and hosted sites. You speak in first person, in plain English, like a thoughtful
colleague — never marketing speak. You prefer short sentences. You only act when you
have permission. You always describe what you did and how to undo it.
```

### Tools (function-calling)

```ts
const tools = [
  defineTool('rotatePassword', { folderId: z.string() }),
  defineTool('archiveFiles', { folderId: z.string(), fileIds: z.array(z.string()) }),
  defineTool('publishFolder', { folderId: z.string(), mode: z.enum(['public','password']) }),
  defineTool('queryStats', { folderId: z.string().optional(), range: z.enum(['7d','30d','90d']) }),
  // …
];
```

### Live status rotator

The home `LiveStatus` component fetches `/api/pilot/status` once on mount, gets back an array of 6-10 messages (server picks the most relevant ones for *this user* and *right now*), and rotates client-side every 7 seconds. Re-fetches every 5 minutes.

### Autonomy levels (Settings)

A user-level pref:
- `autoApproveSafe: boolean` (default true)
- `requireApprovalDestructive: boolean` (default true)
- `coolingWindowMinutes: number` (default 30)

Server enforces the policy when Pilot tries to run a tool.

---

## 13. Search

Two indices in the same flat list:

1. **Folders** — name, path
2. **Files** — name, path

Build it with **Postgres full-text search** (`tsvector`) — `lib/search/index.ts`. For now it's fine; add Meilisearch / Typesense if the app grows.

API:

```ts
// app/api/search/route.ts
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  if (!q.trim()) {
    const recent = await db.recentFolders(userId, 8);
    return Response.json({ folders: recent, files: [] });
  }
  const [folders, files] = await Promise.all([
    db.searchFolders(userId, q, 20),
    db.searchFiles(userId, q, 20),
  ]);
  return Response.json({ folders, files });
}
```

Client uses TanStack Query with `keepPreviousData: true` so the list doesn't flicker as you type.

---

## 14. Phasing — build order

> Build in vertical slices. Each phase is independently demoable.

### Phase 0 — scaffold (1 day)
- Init Next.js project, TypeScript, Tailwind, ESLint, Prettier
- Set up `globals.css` with the variables, paste the brand SVG sprite
- Build the **primitives** (`components/ui/*`)
- Add Inter via `next/font/google`

### Phase 1 — auth + shell (1 day)
- Login page (UI only; mock the sign-in to set a fake cookie)
- App layout with Header, UserDropdown, basic empty pages for `/`, `/stats`, `/logs`, `/people`, `/settings`
- Keyboard shortcut handler (Esc, ⌘K)

### Phase 2 — folders & files (3-4 days)
- Drizzle schema for folders + files
- `/api/folders` CRUD with mock data (no R2 yet)
- Home page: workspace section, FolderList, FolderRow with all variants (live / draft / shared / org)
- Folder detail page (top-level): header, facts, URL row, contents (subfolders + files)
- Subfolder mode: render the simplified layout based on `isSubfolder`
- Breadcrumbs that reflect the URL

### Phase 3 — sharing (2-3 days)
- ShareDrawer with the top toggle
- AccessPane: radios + members + teams + org row
- PublishPane: 3 radios + URL + indexing + password
- `/api/folders/:id/access` and `/api/folders/:id/publishing` endpoints

### Phase 4 — modals + actions (2 days)
- NewFolderModal (slug preview, tiles, templates)
- UploadModal with R2 presigned uploads + progress
- ActionMenu component (positioned popover); wire all rows
- Toast system

### Phase 5 — search + sort (1-2 days)
- SearchPalette (Cmd+K)
- SortDropdown component
- WorkspaceFilters (source tabs)

### Phase 6 — stats + logs (2-3 days)
- Workspace stats page
- Per-folder inline stats
- Per-file stats drawer/page (entry from action menu)
- Log stream (SSE or polling)

### Phase 7 — people + teams (1-2 days)
- People list + invite flow
- Teams list + create/edit team

### Phase 8 — Pilot (3-4 days)
- LiveStatus rotator
- Suggestion cards on relevant pages
- Settings — autonomy controls
- Tool-use plumbing for safe actions

### Phase 9 — polish
- Animations (Framer Motion for drawer/modal)
- Empty states
- Error states
- Loading skeletons (match the prototype's calm — small dimming, not heavy spinners)
- Accessibility audit
- Mobile pass (defer aggressive mobile work to Phase 10 if scope permits)

---

## 15. Translating the prototype — concrete rules

When porting from `shelf-quiet.html`:

1. **Find the markup** in the prototype by searching for the section heading or class name (e.g. search `<!-- ============ ACCESS PANE ============ -->`).
2. **Lift the structure** as-is into a React component.
3. **Replace inline `style` with Tailwind classes** using the design tokens.
4. **Replace `onclick="..."` strings with `onClick` handlers** that call the appropriate Zustand action or TanStack mutation.
5. **Replace `id="..."` with refs or controlled state** — never use raw DOM ids in React.
6. **Translate CSS animations** (`viewIn`, `ddIn`, `pulse`) into Tailwind keyframes (already in `tailwind.config.ts` above) or Framer Motion variants.
7. **Keep copy verbatim** — the words in the prototype are the words in production. Any change goes through the product owner.

### Example: porting the FolderRow

In the prototype:

```html
<div class="row" onclick="openFolderById('launch-q2')">
  <div class="row-name">
    <div class="row-icon folder">…</div>
    <div>
      <div class="row-title">Q2 Launch landing <span class="live-pill">Live</span></div>
      <div class="row-sub">12 files · publishos.app/c/launch-q2</div>
    </div>
  </div>
  <span class="row-vis public"><span class="dot"></span>Public</span>
  <span class="row-meta">14,820 visits</span>
  <span class="row-meta">2h ago</span>
  <span class="row-quick">…</span>
</div>
```

In Next.js:

```tsx
// components/workspace/FolderRow.tsx
'use client';
import Link from 'next/link';
import { useUI } from '@/stores/ui-store';
import { Pill } from '@/components/ui/Pill';
import { ActionMenuTrigger } from '@/components/menus/ActionMenuTrigger';
import { FolderIcon } from '@/components/icons';
import type { Folder } from '@/lib/types';
import { formatRelative, formatBytes, isLive } from '@/lib/format';

export function FolderRow({ folder }: { folder: Folder }) {
  const openShare = useUI(s => s.openShare);
  return (
    <Link
      href={`/folders/${folder.id}`}
      className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-7 py-3 px-1 border-b border-hair-soft hover:bg-hair-soft/60 transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <FolderIcon className="size-8 rounded-lg bg-amber-soft text-amber border border-amber-border" />
        <div>
          <div className="font-medium text-sm">
            {folder.name}
            {isLive(folder) && <LivePill />}
            {folder.access.org?.enabled && <OrgPill />}
          </div>
          <div className="text-xs text-text-3 mt-0.5 font-mono">
            {folder.stats.files} files · {folder.publishing.slug ? `publishos.app/c/${folder.publishing.slug}` : `${folder.stats.subfolders} subfolders`}
          </div>
        </div>
      </div>
      <Pill variant={visibilityToPill(folder)} />
      <span className="text-xs text-text-3 tabular-nums whitespace-nowrap">{formatVisits(folder)}</span>
      <span className="text-xs text-text-3 tabular-nums whitespace-nowrap">{formatRelative(folder.modifiedAt)}</span>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        <button onClick={e => { e.preventDefault(); openShare({ folderId: folder.id }); }} className="text-xs px-2.5 py-1 border border-hair rounded-md hover:border-violet hover:bg-violet-soft hover:text-violet">
          Share
        </button>
        <ActionMenuTrigger kind="folder" target={folder} />
      </span>
    </Link>
  );
}
```

---

## 16. Conventions

- **One component per file.** Filename matches export name.
- **Server Components by default.** Add `'use client'` only when you need state, effects, or browser APIs.
- **Co-locate fetch logic** with the page that uses it (`app/(app)/page.tsx` fetches the folder list directly via the DB, not via the API route, when SSR'd).
- **Use the API routes** from client mutations only.
- **Keep component files under 200 lines.** Split into sub-components.
- **Class composition**: use `cn()` from `lib/cn.ts`:
  ```ts
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';
  export function cn(...args: clsx.ClassValue[]) { return twMerge(clsx(args)); }
  ```
- **No magic strings**: visibility, role, mode are typed unions.
- **Format and lint**: Prettier (with `tailwindcss` plugin) + ESLint Next config.
- **Commits**: conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`).
- **Branches**: short-lived feature branches, PR review before merge.

### File header

Every component file starts with this comment:

```tsx
/**
 * <ComponentName>
 * What it does in one sentence.
 *
 * Reference: <prototype section title or class name in shelf-quiet.html>
 */
```

This makes it easy to jump back to the visual reference.

---

## 17. Quality bar

### Accessibility
- Every interactive element is a real `<button>` or `<a>`, not a styled `<div>`.
- Focus states visible everywhere (Tailwind `focus-visible:ring-2`).
- Keyboard parity: every action accessible without a mouse.
- Radix UI components for dialog, popover, menu — gives us focus trap, esc to close, aria roles.
- Colour is never the only carrier of meaning (every status pill has a word).

### Performance budgets
- LCP < 1.5s on 4G
- TBT < 200ms
- App JS budget on the homepage: < 100kb gzip
- Lazy-load: ShareDrawer, NewFolderModal, UploadModal, SearchPalette (mounted but code-split via `dynamic()`)

### Tests
- **Unit (Vitest)** for `lib/format`, `lib/slug`, schema validation
- **Component (Vitest + Testing Library)** for primitives and FolderRow
- **e2e (Playwright)** for the four critical flows:
  1. Login → see workspace
  2. Create folder → upload file → see it in the list
  3. Open folder → click Share → set Public → copy link
  4. Search by Cmd+K → arrow down → enter → land on folder

---

## 18. Definition of done (per feature)

A feature is "done" when:

- [ ] Visual matches the prototype (compare side-by-side)
- [ ] Copy matches the prototype exactly
- [ ] Works without a mouse
- [ ] Has a loading state
- [ ] Has an error state
- [ ] Has at least one Vitest spec or one Playwright spec
- [ ] No `any`, no `// @ts-ignore`, no console errors
- [ ] PR description includes a screen recording / GIF
- [ ] Reviewed by another engineer with a clean diff

---

## 19. Things that exist in the prototype but are *not* MVP

These can wait:

- **Custom domain UI** (the Settings → Domain row) — the field is there, but DNS verification can ship in v1.1.
- **Bulk file selection** in the workspace list (checkboxes).
- **Real-time collaboration** (live cursors).
- **Trash & restore** UI surface — backend keeps deletes for 30 days, but the user-facing "Trash" link in the dropdown can be a v1.1.
- **Full Pilot chat** — the live status rotator and one-click suggestions are in MVP; the conversational composer ships in v1.2.
- **Mobile** — desktop is MVP. Mobile pass is v1.2.

---

## 20. Quick start (greenfield scaffold)

```bash
pnpm create next-app publishos --typescript --tailwind --app --src-dir=false --import-alias='@/*'
cd publishos
pnpm add @tanstack/react-query zustand framer-motion react-hook-form @hookform/resolvers zod
pnpm add @radix-ui/react-dialog @radix-ui/react-popover @radix-ui/react-dropdown-menu @radix-ui/react-tabs @radix-ui/react-toast @radix-ui/react-tooltip
pnpm add clsx tailwind-merge
pnpm add drizzle-orm postgres @auth/drizzle-adapter next-auth@beta
pnpm add @anthropic-ai/sdk @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
pnpm add resend
pnpm add -D drizzle-kit @types/node vitest @testing-library/react @testing-library/jest-dom playwright @playwright/test prettier prettier-plugin-tailwindcss
```

First milestone after install:

1. Read `PublishOS-Engineering-Spec.md` and `PublishOS-Product-Note.md`, and keep `shelf-quiet.html` open in a browser for visual reference.
2. Build **Phase 0** end-to-end — primitives in `components/ui/`, design tokens in `tailwind.config.ts`, fonts in `app/layout.tsx`, brand sprite, the `cn()` helper, and a single working `<Button />` story page at `/_dev/buttons`. Verify with `pnpm dev`.

Then move through phases one at a time, in the order listed in §14.

---

## 21. References

- [Next.js App Router](https://nextjs.org/docs/app)
- [TanStack Query v5](https://tanstack.com/query/latest)
- [Auth.js v5](https://authjs.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Radix UI](https://www.radix-ui.com/)
- [Cloudflare R2 + S3 SDK](https://developers.cloudflare.com/r2/api/s3/)

---

**End of spec.** When in doubt, the prototype wins. When the prototype is silent, the product note wins. When they conflict, ask the product owner.
