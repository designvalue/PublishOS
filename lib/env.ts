import { z } from "zod";

const defaultDatabasePath =
  process.env.VERCEL === "1" && !process.env.DATABASE_PATH ? "/tmp/publishos.db" : "publishos.db";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // SQLite file path. On Vercel the deploy root is read-only, so when DATABASE_PATH
  // is unset we default to /tmp (ephemeral per instance — fine for demos; use a
  // hosted DB for durable production data).
  DATABASE_PATH: z.string().default(defaultDatabasePath),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 chars"),
  AUTH_URL: z.string().url().optional(),

  // OAuth (optional — Credentials provider works without these)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Magic links via Resend (optional)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
});

/**
 * During `next build`, Next loads server modules (e.g. route handlers) to collect page data.
 * CI hosts like Vercel often do not inject Production env vars into that build step unless
 * configured — but `AUTH_SECRET` is still required at runtime. Use a parse-only placeholder
 * when we know we are in the package "build" lifecycle, never at request/runtime.
 */
function envSource(): NodeJS.ProcessEnv {
  const buildLifecycle = process.env.npm_lifecycle_event === "build";
  const nextBuildPhase =
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE === "phase-development-build";
  if (!process.env.AUTH_SECRET && (buildLifecycle || nextBuildPhase)) {
    return { ...process.env, AUTH_SECRET: "build-time-placeholder-do-not-use-in-prod" };
  }
  return process.env;
}

const parsed = schema.safeParse(envSource());
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment variables:\n${issues}\n\nSee .env.example for required keys.`);
}

export const env = parsed.data;
export type Env = typeof env;
