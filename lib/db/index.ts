import "server-only";
import type { SqliteDb } from "./sqlite-client";
import { usePostgres } from "./driver-env";

const resolved = usePostgres() ? (await import("./neon-client")).db : (await import("./sqlite-client")).db;

/** Typed as SQLite Drizzle for query-builder compatibility; runtime uses Neon when `DATABASE_URL` is set. */
export const db = resolved as SqliteDb;

export type Db = typeof db;

export * from "./tables";
