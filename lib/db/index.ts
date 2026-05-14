import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * During `next build` page-data collection, Next runs many workers that share the same
 * default `/tmp` path; concurrent `migrate()` calls race. Use an isolated DB file per PID
 * for the build phase only. At runtime on Vercel, `env.DATABASE_PATH` is `/tmp/publishos.db`.
 */
const isNextBuildPageDataPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.NEXT_PHASE === "phase-development-build";

const sqlitePath =
  process.env.VERCEL === "1" && isNextBuildPageDataPhase
    ? `/tmp/publishos-build-${process.pid}.db`
    : env.DATABASE_PATH;

const sqlite = new Database(sqlitePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

if (process.env.VERCEL === "1") {
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}

export type Db = typeof db;
