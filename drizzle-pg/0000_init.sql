CREATE TABLE "access_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"occurred_at" timestamp (3) with time zone NOT NULL,
	"method" text DEFAULT 'GET' NOT NULL,
	"path" text NOT NULL,
	"status" integer NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"bytes" integer DEFAULT 0 NOT NULL,
	"ip" text,
	"country" text,
	"user_agent" text,
	"file_id" text,
	"folder_id" text,
	"user_id" text,
	"source" text DEFAULT 'api' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "activity" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"actor_kind" text DEFAULT 'user' NOT NULL,
	"action" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"last_used_at" timestamp (3) with time zone,
	"last_used_ip" text,
	"created_at" timestamp (3) with time zone NOT NULL,
	"revoked_at" timestamp (3) with time zone,
	CONSTRAINT "api_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"storage_backend" text DEFAULT 'local' NOT NULL,
	"storage_root" text DEFAULT 'storage' NOT NULL,
	"s3_bucket" text,
	"s3_region" text,
	"s3_endpoint" text,
	"s3_access_key_id" text,
	"s3_secret_access_key" text,
	"s3_public_url" text,
	"smtp_enabled" boolean DEFAULT false NOT NULL,
	"smtp_host" text,
	"smtp_port" integer,
	"smtp_secure" boolean DEFAULT true NOT NULL,
	"smtp_username" text,
	"smtp_password" text,
	"smtp_from_name" text,
	"smtp_from_email" text,
	"signup_restricted" boolean DEFAULT false NOT NULL,
	"signup_allowed_domains" text,
	"api_access_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"folder_id" text NOT NULL,
	"name" text NOT NULL,
	"path" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"storage_key" text NOT NULL,
	"storage_etag" text,
	"publish_mode" text DEFAULT 'off' NOT NULL,
	"publish_password_hash" text,
	"indexable" boolean DEFAULT false NOT NULL,
	"public_slug" text,
	"created_at" timestamp (3) with time zone NOT NULL,
	"modified_at" timestamp (3) with time zone NOT NULL,
	"archived_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "folder_members" (
	"folder_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	CONSTRAINT "folder_members_folder_id_user_id_pk" PRIMARY KEY("folder_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "folder_team_grants" (
	"folder_id" text NOT NULL,
	"team_id" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	CONSTRAINT "folder_team_grants_folder_id_team_id_pk" PRIMARY KEY("folder_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"parent_id" text,
	"owner_id" text NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"publish_mode" text DEFAULT 'off' NOT NULL,
	"public_slug" text,
	"color" text,
	"custom_domain" text,
	"publish_password_hash" text,
	"indexable" boolean DEFAULT false NOT NULL,
	"allow_downloads" boolean DEFAULT true NOT NULL,
	"has_index_html" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"modified_at" timestamp (3) with time zone NOT NULL,
	"archived_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"token" text NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"invited_at" timestamp (3) with time zone NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"accepted_at" timestamp (3) with time zone,
	"accepted_by_user_id" text,
	"revoked_at" timestamp (3) with time zone,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text DEFAULT 'info' NOT NULL,
	"event" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"data" text,
	"read_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"used_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone NOT NULL,
	"requested_ip" text,
	"requested_user_agent" text,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	CONSTRAINT "team_members_team_id_user_id_pk" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"gradient" text,
	"initial" text DEFAULT '?' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp (3) with time zone,
	"image" text,
	"avatar_key" text,
	"avatar_updated_at" timestamp (3) with time zone,
	"password_hash" text,
	"workspace_role" text DEFAULT 'editor' NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"last_active_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_members" ADD CONSTRAINT "folder_members_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_members" ADD CONSTRAINT "folder_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_team_grants" ADD CONSTRAINT "folder_team_grants_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_team_grants" ADD CONSTRAINT "folder_team_grants_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_logs_recent_idx" ON "access_logs" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "access_logs_status_idx" ON "access_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "access_logs_folder_idx" ON "access_logs" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "activity_recent_idx" ON "activity" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "api_tokens_user_idx" ON "api_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_tokens_active_idx" ON "api_tokens" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX "files_folder_idx" ON "files" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "files_archived_idx" ON "files" USING btree ("archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "files_public_slug_unique" ON "files" USING btree ("public_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "folders_owner_slug_unique" ON "folders" USING btree ("owner_id","parent_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "folders_public_slug_unique" ON "folders" USING btree ("public_slug");--> statement-breakpoint
CREATE INDEX "folders_owner_idx" ON "folders" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "folders_parent_idx" ON "folders" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitations_status_idx" ON "invitations" USING btree ("accepted_at","revoked_at","expires_at");--> statement-breakpoint
CREATE INDEX "notifications_user_recent_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "password_reset_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "password_reset_expires_idx" ON "password_reset_tokens" USING btree ("expires_at");