# PublishOS — Product & Feature Note

A detailed walkthrough of what PublishOS is, who it's for, the concepts it's built on, and every screen, feature, and interaction in the prototype.

---

## 1. What PublishOS is

PublishOS is a hosting panel for non-developers and small teams. You drop in files or folders, and PublishOS turns them into shareable, password-protectable, web-publishable workspaces — without exposing the user to S3 buckets, deploy pipelines, DNS, or any other infrastructure noise.

The product's working tagline:

> *Your folders, files, and sites — on the web in seconds.*

Every operation in the product is structured around two questions:

1. **Who can collaborate on this?** (Access — internal)
2. **Who can visit this on the web?** (Publishing — external)

These two axes are kept independent throughout the experience.

---

## 2. Core mental model

### Folders are the central unit
There is no separate concept of "site" vs "folder". A folder is a folder — and if it happens to contain `index.html`, PublishOS publishes it on a URL automatically. Remove the HTML, the folder goes back to being a regular folder. Add a custom domain, the same folder is now hosted at `demo.example.com`.

This single-concept model collapses what most hosting tools split into two products (Drive + Pages, or Drive + Hosting), and is the reason the workspace doesn't have a "Sites" tab.

### Two-axis sharing
A folder has **Access** (collaboration) and **Publishing** (web availability). They are independent radio groups:

- **Access**
  - *Private* — only you
  - *People & teams* — specific people, a team, or your whole org
- **Publishing**
  - *Not published* — off the web entirely
  - *Public* — anyone with the link
  - *Public with password* — anyone with the link + the passphrase

A folder can be `Private` for collaboration but `Public` on the web (a site you alone can edit, anyone can visit). Or `People & teams` + `Not published` (a team workspace that isn't on the internet). Any combination is valid.

### Four fixed roles
PublishOS uses exactly four roles, constant across the whole product:

| Role   | Folders          | Members  | Billing | Domains |
|--------|------------------|----------|---------|---------|
| Owner  | All              | Manage   | Yes     | Yes     |
| Editor | Read · Write     | Invite   | No      | No      |
| Viewer | Read only        | —        | No      | No      |
| Guest  | Read 1 folder    | —        | No      | No      |

No custom roles, no edit dialogs. The list is the spec.

### Teams
Teams are named groups of people that can be granted access to a folder in one click. Marketing (Maya, Ravi), Founders (Jordan Lee), External (Anika). Teams live alongside individual people on the share panel.

### Pilot
Pilot is the always-on AI co-pilot that does routine work — rotating leaked passwords, archiving unused files, pre-warming caches, summarising stats. It works with two autonomy levels (configurable in Settings):

- **Auto-approve** safe, reversible actions (cache warming, image optimisation)
- **Require approval** for destructive actions (deletes, password rotations, public link expiry)

Pilot also surfaces a live status sentence on the home page that rotates every 7 seconds with the most relevant thing it's doing right now.

---

## 3. Brand & visual identity

- **Name**: PublishOS
- **Logo**: a stylised "P" in white inside a rounded square filled with a 3-stop linear gradient: amber `#C97432` → coral `#D8504F` → violet `#7E4FCC`. Defined once as an SVG sprite (`<symbol id="logo">`) and reused at three sizes (18px in the header, 36px in the user dropdown, 56px on the login screen).
- **Typography**: **Inter** for everything (UI, body, headings, monospaced-looking content via `tabular-nums`). One typeface family across the whole product.
- **Light theme only**. No dark mode.
- **Background**: `#FFFFFF` for app, `#FFFEFB` warm white on login.
- **Accent palette** (used sparingly, with intent):
  - **Green** `#2F8A5F` — Public, Live, healthy status
  - **Amber** `#C97432` — Password, folders, drafts/warnings
  - **Blue** `#3F6BD0` — Shared / Editor role
  - **Violet** `#7E4FCC` — Pilot, brand accent, active states
  - **Coral** `#D8504F` — Destructive actions, deltas down
- **Hairlines** in `#EAE9E3` and `#F2F0EA` carry most of the structural work — no heavy borders, no shadows beyond a 1px shadow on cards.

---

## 4. Authentication

The very first thing a user sees is the **login page**. It's a single centred card with:

- The 56px logo
- The **PublishOS** wordmark
- Tagline *"Your folders, files, and sites — on the web in seconds."*
- Email + password fields with focus rings
- *Keep me signed in* checkbox + *Forgot password?* link
- Primary `Sign in to PublishOS` button (full width)
- Divider, then `Continue with Google` and `Send me a magic link`
- Footer: *"New here? Create a workspace · Privacy"*
- Subtle radial gradients (violet from top-right, amber from bottom-left)

Hitting **Enter** in the form, or clicking any sign-in button, removes the `auth` body class and reveals the workspace at the Home view. Clicking **Sign out** in the user dropdown re-applies `auth` and drops you back to the login.

---

## 5. Header (persistent across the app)

Sticky 56px-tall header on every page after login. Contents from left to right:

1. **Brand pill** — logo + "PublishOS" wordmark
2. **Top nav** (4 items) — `Home · Stats · Logs · People`. Active item is dark with a small violet→coral gradient underline at the bottom of the header.
3. **Header search** — a 240px-wide button with a magnifying glass, *"Search folders, files…"*, and a `⌘K` kbd hint. Click or press ⌘K to open the search palette.
4. **Profile pill** — avatar (gradient initials) + name + chevron. Click to open the user dropdown.

### User dropdown
A 252px floating panel with:
- Header: bigger avatar, name, email
- `Settings` (gear)
- `Help & shortcuts` (?)
- `What Pilot can do` (sparkle)
- divider
- `Sign out` in coral red

---

## 6. Home (the hub)

The home view has a single full-width column at `1080px` max width. Top to bottom:

### Personalised, time-aware greeting
- Line 1: `Saturday, December 14` — the actual day of the week, month, date, recomputed every minute
- Line 2: italic `good evening, Jordan Lee.` — the greeting word changes by hour: *good morning* before noon, *good afternoon* until 5pm, *good evening* after, *still up* between midnight and 5am

### Live status row
A small green pulsing dot followed by an auto-rotating Pilot update. Eight messages cycle every 7 seconds with a 350ms fade transition:

1. Password rotation event (Investor deck, NL attempts)
2. Q2 Launch landing traffic update
3. Maya's recent upload to Press kit
4. Pilot's archive operation (240 MB freed)
5. SSL renewal
6. Health check (7 sites, 22ms median)
7. Suggestions waiting in queue
8. Most-edited folder this week

The first message stays for 5 seconds before rotation kicks in.

### Drop zone
A generous dashed-bordered area with subtle warm/violet radial gradients. Inside:
- A 42px gradient icon (down arrow into a tray)
- Title: *"Drop a file, folder, or zip to begin"*
- Sub: *"I'll ask where it should live — a new folder, an existing one, or published to the web. Drop an HTML file and the folder goes live automatically."*
- Two buttons: `Browse from computer` (primary, opens upload modal) + `New empty folder` (secondary, opens new-folder modal)

Drag-anywhere on the page is also supported — a global dashed overlay appears: *"drop anywhere — Pilot will figure out where it belongs"*.

### Templates row
A horizontal chip row instead of a paste field: `Start from a template:` followed by `Press kit / Pitch deck / Hiring page / Landing page / Docs site / Personal site / Browse all →`. Each chip has a tiny line icon and hovers to violet. Clicking creates a new folder pre-populated with that template structure (toast confirms).

### "All folders" workspace section
The actual content of the workspace lives directly below the drop zone — same width — so the page reads as one continuous column:

- Title: *"**All** folders"* (italic "All")
- Sub: *"Yours, shared with you, and across your org. A folder with an HTML file auto-publishes on the web."*
- Action buttons (right): `New folder` + `Upload files` (primary)
- **Source filter tabs** with counts: `All 7 · Created by me 5 · Shared with me 1 · Org-wide 1`
- **Sort dropdown** on the right (`Sort by Modified ↓` — opens a menu with Modified / Added / Name / Size / Type / Visits / Owner + Ascending/Descending)

### Folder rows
Each row in the list shows:
- **Folder icon** in warm-amber gradient (32px rounded square)
- **Title** with optional inline pills:
  - `Live` (green pulsing) for hosted folders
  - `Draft` (grey) for folders with HTML but not yet published
  - `Shared by Maya` (with mini avatar) for folders owned by someone else
  - `Org-wide` (violet) for folders accessible to everyone in the workspace
- **Sub-text** with file count, URL, or context
- **Visibility pill** on the right: `Public · Password · Shared · Private`
- **Size or visit count**
- **Modified time**
- **Hover-revealed actions**: `Share` quick button + `⋯` menu

Click any row to drill into the folder.

---

## 7. Folder drill-down

Clicking a folder navigates to the folder detail view. The page transitions with a 280ms ease-out fade-up animation. The view contains:

### Breadcrumbs
Plain text links separated by `/`:
- `Home / Press kit / May 2026` for top-level folders
- `Home / Q2 Launch landing / assets` for subfolders (each segment is clickable to walk back up)

### Header strip
- **Folder icon** (52px gradient square — folder amber, or violet for hosted folders)
- **Folder name** (26px, semibold, tight letter-spacing)
- **Meta line** — files · subfolders · size · last updated by whom

### Action bar (top right)
- `Stats` — toggles the inline folder stats panel (turns into primary fill when active)
- `Share` — opens the share drawer (covered below)
- `New folder` — opens the new-folder modal
- `Upload files` — opens the upload modal, pre-targeted to *this* folder

### Facts strip
A four-column horizontal strip showing key folder properties: Visibility · Members · Visits this week · Bandwidth (or whatever's relevant per folder type). Coloured for status (Public in green, Password in amber).

### URL row
For published folders only. A copyable bar showing `https://publishos.app/c/launch-q2` with `Copy` and `Open ↗` buttons. Hidden for private folders or subfolders.

### Inline stats panel (expandable)
When the `Stats` button is clicked, a stats panel unfolds in place:
- Title: `Stats · [folder name]` + `Last 30 days · privacy-friendly · ask Pilot for a deeper read`
- Range chips: `7d / 30d / 90d`
- Four KPIs: Visitors, Pageviews, Avg. response, Bandwidth, with delta percentages
- Two-column grid: **Top files within the folder** and **Sources** (Direct, HN, Twitter, LinkedIn, Google)
- Each row uses gradient bars (blue→violet→coral)

The stats panel auto-closes when navigating to a different folder.

### Split layout (contents + sidebar)
- **Left**: subfolders list (with their own visibility, size, modified) → files list (with file-type icons, dimensions, size). Each row has hover `⋯` for per-item actions.
- **Right (320px sidebar)**: settings — visibility & access toggles, password section, downloads, indexing, members with access, custom URL slug, danger zone (`Archive folder`).

### Subfolder mode
When you drill into a subfolder, the layout simplifies dramatically:
- Smaller icon (36px) and title (22px)
- The four-up facts strip is **hidden**
- The URL row is **hidden** (subfolders inherit URL from parent)
- The Stats and Share buttons are **removed** from the action bar
- The right-side settings sidebar **collapses away** — content takes full width
- A new **inherit banner** appears: *"🌐 Sharing and access settings are inherited from Q2 Launch landing.  Manage at parent →"*

So a subfolder page is just: breadcrumb → small title → inherit banner → contents. Clean and flat.

---

## 8. Sharing — the focus drawer

Clicking `Share` (anywhere — folder action bar, workspace row hover, action menu) opens a 440px-wide right-side drawer with a soft blurred backdrop.

### Top toggle (one action at a time)
A segmented control fills the width of the drawer with two pills:
- **Access** (people icon) + state pill (`Private` / `Shared`)
- **Publishing** (globe icon) + state pill (`Off` / `Live` / `Password`)

The active pill lifts on a white background with a hairline shadow. Click to swap the pane below. Both state pills update live as you change the radios — so you always see both states without ever seeing both sets of controls at once.

### Access pane (default)
- Sub: *"Pick who can work on this folder. They'll be able to view, edit, or download depending on the role you give them."*
- Two radio cards:
  - **Private** (lock icon) — *"Only you can open or edit this folder."*
  - **People & teams** (people icon) — *"Specific people, a team, or your whole organisation."*
- When *People & teams* is selected, an inline panel reveals:
  - Add row: `Add an email or pick a team…` input + role select (Editor / Viewer / Guest) + `Invite` button
  - **Crayon Data org** featured row (violet) — grant the entire workspace access at one role
  - Member list with mixed people and teams. The Marketing team appears with its initial badge, member count, and role dropdown. Individual people sit beneath. Each row has role select + remove `×`.

### Publishing pane
- Sub: *"Make this folder available on the web — open to anyone, or behind a shared password."*
- Three radio cards:
  - **Not published** (slash circle icon) — *"Off the web. Only people from Access can see it."*
  - **Public** (globe icon) — *"Anyone with the link can visit. No login or password."*
  - **Public with password** (lock icon) — *"Visitors enter a passphrase you set."*
- When *Public* or *Password* is selected, the link card reveals: `https://publishos.app/f/...` with `Copy` and `Open ↗` buttons, plus an `Index in search engines` toggle.
- When *Password* is specifically selected, the password input row reveals with `Regenerate` and `Copy` buttons.

### Footer
*"Saved automatically"* on the left (with a green dot), `Done` button on the right. No "Save" — settings persist as you toggle.

---

## 9. Search (⌘K)

Global keyboard-accessible search. Press `⌘K` (or click the header search button) to open a 580px-wide centred palette over a blurred backdrop.

- **Empty state** — shows `Recent folders`, the 8 most recent
- **Typing** — filters across all folders, subfolders, and files in real time
- **Matching** highlighted with a violet underline
- **Grouped by type** — `Folders · 3` / `Files · 12` headers
- **Keyboard navigation** — `↑` / `↓` to move, `↵` to open, `Esc` to close
- **Click result** — folders open the folder detail; files open their parent folder

Footer hint row: `↑↓ navigate · ↵ open · esc close`.

---

## 10. New folder modal

Opens centred, 480px wide. Fields:

1. **Folder name** input — letters, numbers, dashes. A live URL slug preview underneath: `publishos.app/f/your-slug` updates as you type.
2. **Where** dropdown — Workspace root, or inside an existing folder.
3. **Initial access** — three selectable tiles: Private (default), Workspace, Public on the web. Each tile has its own coloured icon, title, and one-line description. Selected tile turns violet.
4. **Optional template** — chip row: None / Press kit / Pitch deck / Hiring page / Landing page.

Footer: `Cmd+↵ to create` hint, `Cancel` and `Create folder` buttons. Submitting closes the modal and shows a toast: *"Created 'Q3 Launch landing'"* with `Open` action.

---

## 11. Upload modal with progress

Opens centred, 480px wide.

- **Destination row** at the top: `Upload to: [folder name]` with a `Change` link. If opened from a folder detail page, this is pre-filled with that folder.
- **Drop zone** with `Choose files` button — full drop area + browse trigger
- **Upload list** showing files in different states:
  - **Done** — green state pill, full progress bar
  - **Uploading** — violet state pill (`64%`), animated gradient progress bar
  - **Queued** — grey state pill
  - **Conflict** — small amber pill `name exists · keeps both` next to the filename when a conflict is detected
- File icons reflect type (image, html, pdf, generic file)
- Live progress simulation animates the bars at 280ms ticks; queued files start when their predecessors finish
- Footer: `2 of 4 done · 14.7 MB / 23.1 MB` summary on the left, updating live; `Pause all` + `Done` on the right

---

## 12. Action menus (per-item)

Hover any folder, subfolder, or file row → a `⋯` button appears on the right. Click it for a context menu that auto-positions next to the trigger (with intelligent flipping if there's no room below).

### Folder actions
- Open
- View stats *(opens the inline stats panel for this folder)*
- Share…
- Download as zip
- Replace files…
- Rename
- Duplicate
- Move to…
- — divider —
- Archive
- **Delete** (red)

### Subfolder actions
- Open
- Download as zip
- Rename
- Move to…
- Duplicate
- — divider —
- **Delete subfolder** (red)

### File actions
- Preview
- View stats *(opens per-file stats)*
- Download (`⌘D`)
- Replace…
- Copy link
- Rename
- Move to…
- — divider —
- **Delete** (red)

### Drafts get a special prefix
A folder with HTML in `Draft` state (e.g. Hiring page) gets `Publish now` at the top of the action menu before everything else.

### Confirmations and undo
Every action shows a black toast at the bottom of the screen confirming what just happened. Destructive actions (delete, archive) include an `Undo` button in the toast. Toasts auto-dismiss after 3.5 seconds.

---

## 13. People and teams

A single page with two sub-tabs (no Roles tab — roles aren't editable):

### People tab (default)
- Filter chips: `All · Owners · Editors · Viewers · Pending`
- Sort dropdown: `Sort: Recently active ↓`
- Member list with avatar, name, email, role, folder count, last active time
- Pending invitees appear with reduced opacity and a `Pending — sent 2 days ago` sub-text

### Teams tab
- Three named teams: **Founders**, **Marketing**, **External**
- Each team row shows:
  - Coloured initial badge (violet→coral / blue→violet / amber→coral gradients)
  - Team name + description
  - Stacked member avatars (overlapping circles with white ring)
  - Member count + folder count

The page CTA changes per tab: `Invite` on People, `New team` on Teams.

---

## 14. Stats (workspace-level)

Top-nav `Stats` link. Whole-workspace analytics:

- KPIs: Visitors, Pageviews, Avg. time, Bandwidth — with deltas
- Pilot summary card with insights ("Visitors are up 12.4%, driven mostly by HN referrals to /pricing")
- 30-day visitors area chart with violet→coral gradient
- Top pages bars with coloured fills
- Sources bars (Direct, Twitter, LinkedIn, Google, HN)

Per-folder stats are accessed inline via the folder detail's `Stats` button (covered above) — no need to leave the folder.

Per-file stats are accessed via the file's `⋯` menu → `View stats`.

---

## 15. Logs

Top-nav `Logs` link. Live request stream with:

- Real-time `247 req/min` indicator
- Filter chips by status code: `All / 2xx / 3xx / 4xx / 5xx`
- Site filter dropdown
- Pause and Export buttons
- Log rows with monospaced (Inter tabular-nums) columns: time, status, method, path, IP + country, latency
- Status codes coloured: 2xx green, 3xx grey, 4xx amber, 4xx-restricted (401) coral
- Pilot anomaly cards (e.g., *"14 failed password attempts on /c/investors-may26 from 3 IPs in NL — block IPs & rotate / Just rate-limit / Investigate"*) — only when something needs attention

---

## 16. Settings

Accessible only via the user dropdown (not in the top nav). Sections:

### Pilot autonomy
- Auto-approve safe, reversible actions
- Require approval for destructive actions
- Auto-publish drafts after a 30-min cooling window
- Send a Friday digest to Slack

### Workspace defaults
- New folders are private
- Allow downloads on public folders
- Index public sites in search engines

### Domain
- Workspace base URL: `publishos.app/c/`
- Custom domains list with `Add domain` button

### Account
- Sign out everywhere

Each row is a clear toggle or button — no buried preferences.

---

## 17. Toast system

A single dark toast at the bottom-centre of the screen for every action and confirmation. Slides up from below with a 180ms animation. Includes:

- A small green dot
- The message (*"Downloading Q2 Launch landing.zip…"*)
- An optional action button (*"Undo"* for delete/archive operations)
- Auto-dismisses after 3.5 seconds

Toasts also fire on filter chip clicks (when relevant), template selections, and any meaningful state change.

---

## 18. Keyboard shortcuts

| Shortcut | Action                              |
|----------|-------------------------------------|
| `⌘K`     | Open search palette                 |
| `⌘D`     | Download focused file (in menu)     |
| `⌘↵`     | Submit current modal (e.g. create)  |
| `↑` `↓`  | Navigate search results             |
| `↵`      | Open / confirm                      |
| `Esc`    | Close any open modal/drawer/menu    |

`Esc` closes everything: search palette, share drawer, action menu, sort menu, user dropdown, modals.

---

## 19. Responsive & state behaviour

- The whole UI is designed for desktop widths (1080px+ primary). Header and content scale fluidly down to ~960px before things start to wrap.
- View transitions use a single shared 280ms ease-out fade-up animation (`viewIn`).
- Drawers (Share) slide in from the right with a cubic-bezier ease.
- Modals scale up from 97% with a fade.
- Pulsing dots (live indicator, drop hover, action highlights) use a 2.4-second ease-in-out loop.
- All animations use `cubic-bezier(.2, .8, .2, 1)` for the elegant cluster.

---

## 20. Voice and copy guidelines

The product writes in plain English, in first person from Pilot ("I rotated the password…", "I cleared 240 MB…"), and in second person to the user ("Drop a file below to add to your workspace"). Never marketing-speak, never feature-speak.

Examples of the tone:

- *"Yesterday I noticed someone trying to guess the password on your Investor deck — I rotated it and stopped them. Everything else is running smoothly."*
- *"This folder isn't on the web. Only people with access (above) can see it."*
- *"Pilot is monitoring 7 sites. Everything is healthy right now."*
- *"Visitors enter a passphrase once per session."*

Status pills also use plain words: `Public`, `Password`, `Shared`, `Private`, `Live`, `Draft`, `Org-wide`, `Shared by Maya`. No jargon, no abbreviations.

---

## 21. Summary — what makes PublishOS different

1. **One concept** (folders) instead of two (folders + sites). Hosting is a property of a folder, not a separate object.
2. **Two-axis sharing** (Access vs Publishing) instead of a single mixed visibility radio. The mental model matches reality.
3. **Four fixed roles**, no custom roles, no role editor. Simplicity becomes a feature.
4. **One typeface** (Inter), light theme only, considered colour palette used with intent.
5. **Pilot is woven in**, not bolted on — it shows up as a live status sentence on the home page, as inline insights, as suggested actions, and as a configurable autonomy in Settings.
6. **One action at a time** — share drawer, modals, action menus all isolate a single decision so the UI never overwhelms.
7. **Drag-anywhere** + **⌘K everywhere** — power-user shortcuts that a regular user can ignore but a frequent user lives by.
8. **Subfolders are visually different from their parents** — less chrome, an inherit banner, and they make clear that settings flow from above.
9. **Per-folder stats are inline**, not a separate page — you stay in the context of the folder you're looking at.
10. **The home page is the workspace** — no dashboard, no overview, no separate "All files". You log in and you're already in your stuff.

---

## File location

The interactive prototype lives at:
`shelf-quiet.html` (in this outputs folder)

The product spec (this file):
`PublishOS-Product-Note.md`
