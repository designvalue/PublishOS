import "server-only";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import * as schema from "./schema-pg";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  throw new Error("DATABASE_URL must be set when using Postgres (Neon).");
}

const sql = neon(url);
export const db = drizzle(sql, { schema });

await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle-pg") });
