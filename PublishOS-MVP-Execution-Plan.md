---
name: PublishOS MVP Execution
overview: Build PublishOS as a vertical-slice Next.js 14 application with strict TypeScript, starting from UI primitives and app shell, then layering data, sharing, search, analytics, people/teams, and Pilot capabilities. The plan follows the spec’s phase order while adding concrete checkpoints, dependencies, and acceptance gates.
todos:
  - id: foundation-phase0
    content: "Set up project foundation: strict TS, Tailwind tokens, global styles, font, brand sprite, and UI primitives."
    status: completed
  - id: shell-auth-phase1
    content: Implement auth route group and main app shell with global overlays and keyboard shortcuts.
    status: completed
  - id: folders-files-phase2
    content: Build Drizzle schema, core folder/file APIs, home workspace list, and folder detail route with breadcrumbs.
    status: completed
  - id: sharing-phase3
    content: Implement ShareDrawer access/publish panes and wire access/publishing API mutations.
    status: completed
  - id: upload-actions-phase4
    content: Implement new folder/upload modals, context actions, toast queue, and R2 upload flow with progress/conflict handling.
    status: completed
  - id: search-sort-phase5
    content: Deliver Cmd+K search palette, search API integration, sort/filter URL state, and stable query UX.
    status: completed
  - id: analytics-phase6
    content: Implement stats and logs routes with APIs, visual components, and anomaly surface.
    status: completed
  - id: people-teams-phase7
    content: Implement people and team management routes, components, and invite/team APIs.
    status: completed
  - id: pilot-phase8
    content: Implement pilot status/suggestions/actions and enforce autonomy policy controls.
    status: completed
  - id: polish-phase9
    content: Complete accessibility, animation, loading/error/empty states, lazy loading, and final QA gates.
    status: completed
isProject: false
---

## Live Progress
- Completed: Phase 0, Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, Phase 7, Phase 8, Phase 9, Phase 10.
- Validation: `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm test` all passing.
- Current state: end-to-end MVP scaffold is wired with route groups, API contracts, settings-based hosting profile control, and baseline tests.

# PublishOS MVP Build Plan

## Scope And Source Of Truth
- Follow implementation direction from [`/Users/srinivasand/Desktop/Design Value/Github/PublishOS/PublishOS-Engineering-Spec.md`](/Users/srinivasand/Desktop/Design%20Value/Github/PublishOS/PublishOS-Engineering-Spec.md).
- Treat prototype behavior in `shelf-quiet.html` as visual/interaction authority, and product/copy from `PublishOS-Product-Note.md`.
- Deliver MVP only; defer non-MVP items listed in spec section 19.

## Architecture Baseline
- **App framework**: Next.js 14 App Router + React 18 + strict TypeScript.
- **State split**: TanStack Query (server/cache), Zustand (`ui-store`, `toast-store`) for global UI controls, URL params for tab/filter/sort state.
- **Data contracts**: Implement shared domain types + zod schemas in [`/Users/srinivasand/Desktop/Design Value/Github/PublishOS/lib/types.ts`](/Users/srinivasand/Desktop/Design%20Value/Github/PublishOS/lib/types.ts) and [`/Users/srinivasand/Desktop/Design Value/Github/PublishOS/lib/schemas.ts`](/Users/srinivasand/Desktop/Design%20Value/Github/PublishOS/lib/schemas.ts).
- **Rendering strategy**: Server Components by default; client components only where interaction/effects/browser APIs are needed.
- **Email provider**: `Resend` as the transactional email system (auth links, invites, notifications).
- **Pilot model/runtime**: Anthropic Claude Sonnet 4.5 via `@anthropic-ai/sdk`.
- **Hosting model**: hosting/edge configuration is runtime-selectable from Admin settings (no hardcoded single provider path).

## Delivery Sequence (Vertical Slices)

### Phase 0: Foundation
- Scaffold project, dependencies, lint/format/test tooling.
- Implement tokenized design system in Tailwind + CSS variables in [`/Users/srinivasand/Desktop/Design Value/Github/PublishOS/tailwind.config.ts`](/Users/srinivasand/Desktop/Design%20Value/Github/PublishOS/tailwind.config.ts) and [`/Users/srinivasand/Desktop/Design Value/Github/PublishOS/styles/globals.css`](/Users/srinivasand/Desktop/Design%20Value/Github/PublishOS/styles/globals.css).
- Add Inter + shared `BrandSprite` in root layout [`/Users/srinivasand/Desktop/Design Value/Github/PublishOS/app/layout.tsx`](/Users/srinivasand/Desktop/Design%20Value/Github/PublishOS/app/layout.tsx).
- Build all primitives under [`/Users/srinivasand/Desktop/Design Value/Github/PublishOS/components/ui/`](/Users/srinivasand/Desktop/Design%20Value/Github/PublishOS/components/ui/).
- Add `cn()` helper in [`/Users/srinivasand/Desktop/Design Value/Github/PublishOS/lib/cn.ts`](/Users/srinivasand/Desktop/Design%20Value/Github/PublishOS/lib/cn.ts).

### Phase 1: Auth + App Shell
- Build auth route group (`(auth)`) and login page UI.
- Build app route group (`(app)`) layout with header/nav/user dropdown, shortcut handling, toast container, and mounted hidden overlays (search/modals/drawers).
- Stub pages: home, stats, logs, people, settings.

### Phase 2: Folders + Files Core
- Create Drizzle schema and DB access layer for folders/files in [`/Users/srinivasand/Desktop/Design Value/Github/PublishOS/lib/db/`](/Users/srinivasand/Desktop/Design%20Value/Github/PublishOS/lib/db/).
- Implement folder/file API contracts in [`/Users/srinivasand/Desktop/Design Value/Github/PublishOS/app/api/`](/Users/srinivasand/Desktop/Design%20Value/Github/PublishOS/app/api/).
- Build home workspace list + `FolderRow` variants and folder detail page (`/folders/[...path]`) including breadcrumbs and subfolder mode.

### Phase 3: Sharing Controls
- Implement `ShareDrawer` with segmented access/publish panes and typed form validation.
- Wire access/publishing mutations to `PATCH /api/folders/:id/access` and `PATCH /api/folders/:id/publishing`.
- Support deep-link opening via query params (`?share=open&folderId=...`).

### Phase 4: Creation + Upload + Context Actions
- Build `NewFolderModal`, `UploadModal`, action menu system, and toast/undo flows.
- Implement R2 presigned upload flow (`upload-url` -> direct PUT with progress -> `upload-complete`) with concurrency limit 3.
- Handle upload conflicts with suggested naming UX.

### Phase 5: Search + Sort + Filters
- Implement search API and UI palette (`Cmd+K`) with recent fallback on empty query.
- Implement workspace sort dropdown and source filters tied to URL state (`source`, `sort`, `dir`).
- Preserve list continuity using query caching (`keepPreviousData`).

### Phase 6: Stats + Logs
- Build workspace/folder/file stats views and bar/chart components.
- Implement logs feed (SSE or polling) and filtering model.
- Add Pilot anomaly card on logs page.

### Phase 7: People + Teams
- Build people/teams subnav and list management UI.
- Implement invite and team CRUD endpoints.

### Phase 8: Pilot
- Implement live status rotator (`/api/pilot/status`) with 7s client rotation and 5m refresh.
- Add suggestion approval/dismiss flows.
- Implement policy-aware tool execution guardrails from settings.

### Phase 9: Polish + Hardening
- Motion polish (drawer/modal/view transitions), skeletons, empty/error states.
- Accessibility pass, keyboard parity, focus visibility.
- Code-splitting/lazy-load for heavy overlays.

### Phase 10: Admin Hosting Configuration
- Add Admin panel controls to choose active hosting/edge profile per workspace/org.
- Persist provider settings and profile state in DB with strict zod validation.
- Implement runtime resolver used by publish/serve flows to select active config safely.
- Add guardrails: credential completeness checks, dry-run validation, and fallback to safe default profile.

## Cross-Cutting Contracts To Lock Early
- URL query contracts (`tab`, `source`, `sort`, `dir`, `share`, `folderId`) and breadcrumb/path semantics.
- Union types (`Visibility`, `PublishMode`, `Role`) as canonical enums across UI/API/DB.
- Route handler pattern: zod-validated input + typed JSON responses + consistent error envelopes.
- Undo/reversible actions using activity records and restore windows.
- Hosting profile contract:
  - `provider` (e.g., `vercel`, `cloudflare`, `hybrid`)
  - `edgeMode` (`worker`, `function`, `none`)
  - `domainStrategy` (`publishosSubpath`, `subdomain`, `customDomain`)
  - `status` (`active`, `inactive`, `draft`)

## Testing And Quality Gates
- Unit: `format`, `slug`, schema validation.
- Component: primitives + `FolderRow` interactions/variants.
- E2E critical flows:
  - login to workspace
  - create folder + upload file
  - configure sharing to public + copy link
  - search via `Cmd+K` and navigate
- Definition-of-done gate per feature: prototype parity, exact copy, keyboard support, loading/error states, no `any`/ts-ignore, clean lint/typecheck.

## Milestone Cadence (48-Hour Crash Plan)
- **Hour 0-6 (Foundation Sprint)**: Complete Phase 0 and lock design tokens, primitives, root providers, and app scaffolding.
- **Hour 6-16 (Core App Sprint)**: Complete Phases 1-2 with auth shell, folder/file schema, core APIs, workspace list, and folder detail route.
- **Hour 16-28 (Sharing + Upload Sprint)**: Complete Phases 3-4 including share drawer, publishing controls, new folder/upload modals, action menu, and toast queue.
- **Hour 28-36 (Discovery Sprint)**: Complete Phase 5 and minimum viable Phase 6 (search, sort/filter URL state, workspace stats, baseline logs feed).
- **Hour 36-44 (Collaboration + Pilot Sprint)**: Complete Phase 7 and MVP Phase 8 (people/teams CRUD + pilot status rotator and suggestion actions).
- **Hour 44-48 (Admin Config + Stabilization Sprint)**: Complete Phase 10 admin hosting configurability, then Phase 9 essentials: accessibility fixes, loading/error states, e2e smoke flows, lint/typecheck, and release checklist.

## 48-Hour Execution Rules
- Build in parallel tracks: **UI track** (components/pages) + **API/data track** (schema/handlers), integrating every 4-6 hours.
- Enforce MVP cut line: defer non-MVP items from section 19 without exception.
- Timebox polish to critical UX and accessibility only; avoid non-essential animation refinements.
- Run incremental quality gates at the end of each sprint block (typecheck, lint, smoke e2e) to prevent late-stage regression pileup.
