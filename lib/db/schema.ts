import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

const uid = () => crypto.randomUUID();

/* ---------------- Auth.js (Drizzle adapter) ---------------- */

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(uid),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "timestamp_ms" }),
  image: text("image"),
  avatarKey: text("avatar_key"),
  avatarUpdatedAt: integer("avatar_updated_at", { mode: "timestamp_ms" }),
  passwordHash: text("password_hash"),
  workspaceRole: text("workspace_role", { enum: ["owner", "admin", "editor", "viewer"] })
    .notNull()
    .default("editor"),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
  lastActiveAt: integer("last_active_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const accounts = sqliteTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = sqliteTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ---------------- App domain ---------------- */

export const teams = sqliteTable("teams", {
  id: text("id").primaryKey().$defaultFn(uid),
  name: text("name").notNull(),
  description: text("description"),
  gradient: text("gradient"),
  initial: text("initial").notNull().default("?"),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const teamMembers = sqliteTable(
  "team_members",
  {
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] })],
);

export const folders = sqliteTable(
  "folders",
  {
    id: text("id").primaryKey().$defaultFn(uid),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    parentId: text("parent_id"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    visibility: text("visibility", { enum: ["private", "shared"] }).notNull().default("private"),
    publishMode: text("publish_mode", { enum: ["off", "public", "password"] })
      .notNull()
      .default("off"),
    publicSlug: text("public_slug"),
    /**
     * Optional Finder-style tag colour shown on the folder icon.
     * Stored as a short token ("red", "orange", …) — CSS resolves it to the
     * real palette value. NULL = default amber/neutral icon.
     */
    color: text("color"),
    customDomain: text("custom_domain"),
    publishPasswordHash: text("publish_password_hash"),
    indexable: integer("indexable", { mode: "boolean" }).notNull().default(false),
    allowDownloads: integer("allow_downloads", { mode: "boolean" }).notNull().default(true),
    hasIndexHtml: integer("has_index_html", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    modifiedAt: integer("modified_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    uniqueIndex("folders_owner_slug_unique").on(t.ownerId, t.parentId, t.slug),
    uniqueIndex("folders_public_slug_unique").on(t.publicSlug),
    index("folders_owner_idx").on(t.ownerId),
    index("folders_parent_idx").on(t.parentId),
  ],
);

export const folderMembers = sqliteTable(
  "folder_members",
  {
    folderId: text("folder_id")
      .notNull()
      .references(() => folders.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["editor", "viewer", "guest"] }).notNull().default("viewer"),
  },
  (t) => [primaryKey({ columns: [t.folderId, t.userId] })],
);

export const folderTeamGrants = sqliteTable(
  "folder_team_grants",
  {
    folderId: text("folder_id")
      .notNull()
      .references(() => folders.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["editor", "viewer", "guest"] }).notNull().default("viewer"),
  },
  (t) => [primaryKey({ columns: [t.folderId, t.teamId] })],
);

export const files = sqliteTable(
  "files",
  {
    id: text("id").primaryKey().$defaultFn(uid),
    folderId: text("folder_id")
      .notNull()
      .references(() => folders.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    path: text("path").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull().default(0),
    storageKey: text("storage_key").notNull(),
    storageEtag: text("storage_etag"),
    // Per-file publishing — folders are private organisational containers and
    // are never publicly accessible. Any file can be published from anywhere
    // in the workspace and gets its own URL.
    publishMode: text("publish_mode", { enum: ["off", "public", "password"] })
      .notNull()
      .default("off"),
    publishPasswordHash: text("publish_password_hash"),
    indexable: integer("indexable", { mode: "boolean" }).notNull().default(false),
    publicSlug: text("public_slug"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    modifiedAt: integer("modified_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    // Soft delete: set when moved to the recycle bin. Null = live.
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("files_folder_idx").on(t.folderId),
    index("files_archived_idx").on(t.archivedAt),
    uniqueIndex("files_public_slug_unique").on(t.publicSlug),
  ],
);

export const invitations = sqliteTable(
  "invitations",
  {
    id: text("id").primaryKey().$defaultFn(uid),
    email: text("email").notNull(),
    role: text("role", { enum: ["admin", "editor", "viewer"] }).notNull().default("editor"),
    token: text("token").notNull().unique(),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invitedAt: integer("invited_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
    acceptedByUserId: text("accepted_by_user_id").references(() => users.id, { onDelete: "set null" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("invitations_email_idx").on(t.email),
    index("invitations_status_idx").on(t.acceptedAt, t.revokedAt, t.expiresAt),
  ],
);

export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey().notNull().default(1),
  storageBackend: text("storage_backend", { enum: ["local", "s3"] }).notNull().default("local"),
  storageRoot: text("storage_root").notNull().default("storage"),
  s3Bucket: text("s3_bucket"),
  s3Region: text("s3_region"),
  s3Endpoint: text("s3_endpoint"),
  s3AccessKeyId: text("s3_access_key_id"),
  s3SecretAccessKey: text("s3_secret_access_key"),
  s3PublicUrl: text("s3_public_url"),
  // SMTP — used for outbound notifications (invites, password resets, etc.).
  smtpEnabled: integer("smtp_enabled", { mode: "boolean" }).notNull().default(false),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpSecure: integer("smtp_secure", { mode: "boolean" }).notNull().default(true),
  smtpUsername: text("smtp_username"),
  smtpPassword: text("smtp_password"),
  smtpFromName: text("smtp_from_name"),
  smtpFromEmail: text("smtp_from_email"),
  // Sign-up domain allowlist. When `signupRestricted` is true, only emails
  // whose domain appears in `signupAllowedDomains` (JSON array of lowercase
  // hostnames) may self-register. Invited users bypass the check — an
  // invitation is the admin's explicit override.
  signupRestricted: integer("signup_restricted", { mode: "boolean" }).notNull().default(false),
  signupAllowedDomains: text("signup_allowed_domains"), // JSON: string[]
  // Workspace-wide kill switch for programmatic API access (`/api/v1/*`).
  // When false, ingestion endpoints return 503 and the API-tokens section
  // on every profile page is hidden. Existing tokens are NOT revoked —
  // turning the toggle back on re-enables them as-is.
  apiAccessEnabled: integer("api_access_enabled", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const accessLogs = sqliteTable(
  "access_logs",
  {
    id: text("id").primaryKey().$defaultFn(uid),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    method: text("method").notNull().default("GET"),
    path: text("path").notNull(),
    status: integer("status").notNull(),
    durationMs: integer("duration_ms").notNull().default(0),
    bytes: integer("bytes").notNull().default(0),
    ip: text("ip"),
    country: text("country"),
    userAgent: text("user_agent"),
    fileId: text("file_id").references(() => files.id, { onDelete: "set null" }),
    folderId: text("folder_id").references(() => folders.id, { onDelete: "set null" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    source: text("source", { enum: ["api", "private", "public"] }).notNull().default("api"),
  },
  (t) => [
    index("access_logs_recent_idx").on(t.occurredAt),
    index("access_logs_status_idx").on(t.status),
    index("access_logs_folder_idx").on(t.folderId),
  ],
);

export const activity = sqliteTable(
  "activity",
  {
    id: text("id").primaryKey().$defaultFn(uid),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorKind: text("actor_kind", { enum: ["user", "pilot", "system"] })
      .notNull()
      .default("user"),
    action: text("action").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    message: text("message").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("activity_recent_idx").on(t.createdAt)],
);

/* ---------------- API tokens (external connector access) ---------------- */
/**
 * Per-user API tokens for programmatic access from AI tools, scripts, and
 * CI pipelines. The plaintext token is shown once at creation time and
 * NEVER stored — only `tokenHash` (sha256 hex) lives in the DB. The
 * `prefix` (first 12 chars of plaintext) is kept for the UI so users can
 * recognise their tokens in a list.
 *
 * Format of issued tokens: `pos_<32 base64url chars>`.
 */
export const apiTokens = sqliteTable(
  "api_tokens",
  {
    id: text("id").primaryKey().$defaultFn(uid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g. "CI deploy"
    tokenHash: text("token_hash").notNull().unique(),
    prefix: text("prefix").notNull(), // first 12 chars of plaintext for display
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    lastUsedIp: text("last_used_ip"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("api_tokens_user_idx").on(t.userId),
    index("api_tokens_active_idx").on(t.revokedAt),
  ],
);

/* ---------------- Password reset tokens ---------------- */
/**
 * Self-service password reset tokens. The plaintext token is sent to the
 * user's email and is NEVER stored — only `tokenHash` (sha256 hex) lives in
 * the DB, so a stolen DB row can't be used to compromise an account.
 *
 * Single-use: `usedAt` is set on first redeem. The route also expires tokens
 * older than `expiresAt` (typically 1 hour from creation).
 */
export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey().$defaultFn(uid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    requestedIp: text("requested_ip"),
    requestedUserAgent: text("requested_user_agent"),
  },
  (t) => [
    index("password_reset_user_idx").on(t.userId),
    index("password_reset_expires_idx").on(t.expiresAt),
  ],
);

/* ---------------- Notifications ---------------- */
/**
 * Per-user in-app notification feed. Surfaced via the bell in the top bar.
 *
 * `kind` is the broad category (drives the icon + colour); `event` is the
 * specific event for filtering/analytics. `link` is an optional in-app route
 * the bell-item navigates to on click. `data` is a JSON blob for arbitrary
 * extras (counts, ids, names) the UI can use to render rich strings.
 */
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey().$defaultFn(uid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["info", "success", "warning", "danger"] })
      .notNull()
      .default("info"),
    event: text("event").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    data: text("data"), // JSON
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index("notifications_user_recent_idx").on(t.userId, t.createdAt),
    index("notifications_user_unread_idx").on(t.userId, t.readAt),
  ],
);

/* ---------------- Relations ---------------- */

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  folders: many(folders),
  teamMemberships: many(teamMembers),
  folderMemberships: many(folderMembers),
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
  owner: one(users, { fields: [folders.ownerId], references: [users.id] }),
  parent: one(folders, { fields: [folders.parentId], references: [folders.id], relationName: "children" }),
  children: many(folders, { relationName: "children" }),
  files: many(files),
  members: many(folderMembers),
  teamGrants: many(folderTeamGrants),
}));

export const filesRelations = relations(files, ({ one }) => ({
  folder: one(folders, { fields: [files.folderId], references: [folders.id] }),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(teamMembers),
  folderGrants: many(folderTeamGrants),
}));
