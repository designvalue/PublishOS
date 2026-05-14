import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Path to the SQLite database file. Defaults to ./publishos.db (gitignored).
  DATABASE_PATH: z.string().default("publishos.db"),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 chars"),
  AUTH_URL: z.string().url().optional(),

  // OAuth (optional — Credentials provider works without these)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Magic links via Resend (optional)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment variables:\n${issues}\n\nSee .env.example for required keys.`);
}

export const env = parsed.data;
export type Env = typeof env;
