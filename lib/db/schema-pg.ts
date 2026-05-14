import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const uid = () => crypto.randomUUID();

const ts = (name: string) => timestamp(name, { mode: "date", precision: 3, withTimezone: true });

/* ---------------- Auth.js (Drizzle adapter) ---------------- */

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(uid),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: ts("email_verified"),
  image: text("image"),
  avatarKey: text("avatar_key"),
  avatarUpdatedAt: ts("avatar_updated_at"),
  passwordHash: text("password_hash"),
  workspaceRole: text("workspace_role", { enum: ["owner", "admin", "editor", "viewer"] })
    .notNull()
    .default("editor"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  lastActiveAt: ts("last_active_at"),
  createdAt: ts("created_at").notNull().$defaultFn(() => new Date()),
});

export const accounts = pgTable(
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

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: ts("expires").notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: ts("expires").notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ---------------- App domain ---------------- */

export const teams = pgTable("teams", {
  id: text("id").primaryKey().$defaultFn(uid),
  name: text("name").notNull(),
  description: text("description"),
  gradient: text("gradient"),
  initial: text("initial").notNull().default("?"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: ts("created_at").notNull().$defaultFn(() => new Date()),
});

export const teamMembers = pgTable(
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

export const folders = pgTable(
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
    color: text("color"),
    customDomain: text("custom_domain"),
    publishPasswordHash: text("publish_password_hash"),
    indexable: boolean("indexable").notNull().default(false),
    allowDownloads: boolean("allow_downloads").notNull().default(true),
    hasIndexHtml: boolean("has_index_html").notNull().default(false),
    createdAt: ts("created_at").notNull().$defaultFn(() => new Date()),
    modifiedAt: ts("modified_at").notNull().$defaultFn(() => new Date()),
    archivedAt: ts("archived_at"),
  },
  (t) => [
    uniqueIndex("folders_owner_slug_unique").on(t.ownerId, t.parentId, t.slug),
    uniqueIndex("folders_public_slug_unique").on(t.publicSlug),
    index("folders_owner_idx").on(t.ownerId),
    index("folders_parent_idx").on(t.parentId),
  ],
);

export const folderMembers = pgTable(
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

export const folderTeamGrants = pgTable(
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

export const files = pgTable(
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
    publishMode: text("publish_mode", { enum: ["off", "public", "password"] })
      .notNull()
      .default("off"),
    publishPasswordHash: text("publish_password_hash"),
    indexable: boolean("indexable").notNull().default(false),
    publicSlug: text("public_slug"),
    createdAt: ts("created_at").notNull().$defaultFn(() => new Date()),
    modifiedAt: ts("modified_at").notNull().$defaultFn(() => new Date()),
    archivedAt: ts("archived_at"),
  },
  (t) => [
    index("files_folder_idx").on(t.folderId),
    index("files_archived_idx").on(t.archivedAt),
    uniqueIndex("files_public_slug_unique").on(t.publicSlug),
  ],
);

export const invitations = pgTable(
  "invitations",
  {
    id: text("id").primaryKey().$defaultFn(uid),
    email: text("email").notNull(),
    role: text("role", { enum: ["admin", "editor", "viewer"] }).notNull().default("editor"),
    token: text("token").notNull().unique(),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invitedAt: ts("invited_at").notNull().$defaultFn(() => new Date()),
    expiresAt: ts("expires_at").notNull(),
    acceptedAt: ts("accepted_at"),
    acceptedByUserId: text("accepted_by_user_id").references(() => users.id, { onDelete: "set null" }),
    revokedAt: ts("revoked_at"),
  },
  (t) => [
    index("invitations_email_idx").on(t.email),
    index("invitations_status_idx").on(t.acceptedAt, t.revokedAt, t.expiresAt),
  ],
);

export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey().notNull().default(1),
  storageBackend: text("storage_backend", { enum: ["local", "s3"] }).notNull().default("local"),
  storageRoot: text("storage_root").notNull().default("storage"),
  s3Bucket: text("s3_bucket"),
  s3Region: text("s3_region"),
  s3Endpoint: text("s3_endpoint"),
  s3AccessKeyId: text("s3_access_key_id"),
  s3SecretAccessKey: text("s3_secret_access_key"),
  s3PublicUrl: text("s3_public_url"),
  smtpEnabled: boolean("smtp_enabled").notNull().default(false),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpSecure: boolean("smtp_secure").notNull().default(true),
  smtpUsername: text("smtp_username"),
  smtpPassword: text("smtp_password"),
  smtpFromName: text("smtp_from_name"),
  smtpFromEmail: text("smtp_from_email"),
  signupRestricted: boolean("signup_restricted").notNull().default(false),
  signupAllowedDomains: text("signup_allowed_domains"),
  apiAccessEnabled: boolean("api_access_enabled").notNull().default(true),
  updatedAt: ts("updated_at").notNull().$defaultFn(() => new Date()),
});

export const accessLogs = pgTable(
  "access_logs",
  {
    id: text("id").primaryKey().$defaultFn(uid),
    occurredAt: ts("occurred_at").notNull().$defaultFn(() => new Date()),
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

export const activity = pgTable(
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
    createdAt: ts("created_at").notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("activity_recent_idx").on(t.createdAt)],
);

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: text("id").primaryKey().$defaultFn(uid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    prefix: text("prefix").notNull(),
    lastUsedAt: ts("last_used_at"),
    lastUsedIp: text("last_used_ip"),
    createdAt: ts("created_at").notNull().$defaultFn(() => new Date()),
    revokedAt: ts("revoked_at"),
  },
  (t) => [
    index("api_tokens_user_idx").on(t.userId),
    index("api_tokens_active_idx").on(t.revokedAt),
  ],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey().$defaultFn(uid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: ts("created_at").notNull().$defaultFn(() => new Date()),
    requestedIp: text("requested_ip"),
    requestedUserAgent: text("requested_user_agent"),
  },
  (t) => [
    index("password_reset_user_idx").on(t.userId),
    index("password_reset_expires_idx").on(t.expiresAt),
  ],
);

export const notifications = pgTable(
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
    data: text("data"),
    readAt: ts("read_at"),
    createdAt: ts("created_at").notNull().$defaultFn(() => new Date()),
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
